<?php
declare(strict_types=1);

final class SteamReviewFetchException extends RuntimeException
{
}

final class SteamReviewsService
{
    private const REVIEW_LIMIT = 5;
    private const AVAILABLE_CACHE_SECONDS = 86400;
    private const UNAVAILABLE_CACHE_SECONDS = 600;

    public function __construct(private PDO $database)
    {
    }

    public function reviewsForProduct(string $slug): ?array
    {
        $mappingStatement = $this->database->prepare(
            'SELECT p.id AS product_id, mapping.steam_app_id, mapping.store_url
             FROM products p
             LEFT JOIN steam_app_mappings mapping ON mapping.product_id = p.id
             WHERE p.slug = :slug AND p.active = 1
             LIMIT 1',
        );
        $mappingStatement->execute(['slug' => $slug]);
        $mapping = $mappingStatement->fetch();
        if ($mapping === false) {
            return null;
        }

        if ($mapping['steam_app_id'] === null) {
            return [
                'available' => false,
                'message' => 'Steam reviews are not available because this product has no verified Steam App ID.',
                'steamAppId' => null,
                'steamUrl' => null,
                'totalReviews' => 0,
                'positiveCount' => 0,
                'negativeCount' => 0,
                'positivePercent' => null,
                'reviews' => [],
                'fetchedAt' => null,
            ];
        }

        $productId = (int) $mapping['product_id'];
        $steamAppId = (int) $mapping['steam_app_id'];
        $steamUrl = $mapping['store_url'];
        $cached = $this->freshCache($productId, $steamAppId);
        if ($cached !== null) {
            return $this->formatResponse($cached, $steamAppId, $steamUrl);
        }

        try {
            $payload = $this->fetchSteamReviews($steamAppId);
            $result = $this->normalizePayload($payload);
            $cacheSeconds = self::AVAILABLE_CACHE_SECONDS;
        } catch (SteamReviewFetchException $exception) {
            error_log(
                'Steam reviews request failed for App ID ' . $steamAppId . ': ' . $exception->getMessage(),
            );
            $result = [
                'cacheStatus' => 'unavailable',
                'totalReviews' => 0,
                'positiveCount' => 0,
                'negativeCount' => 0,
                'positivePercent' => null,
                'reviews' => [],
                'unavailableReason' => 'Steam reviews are temporarily unavailable. Please try again later.',
            ];
            $cacheSeconds = self::UNAVAILABLE_CACHE_SECONDS;
        }

        $result['fetchedAt'] = gmdate('Y-m-d H:i:s');
        $result['expiresAt'] = gmdate('Y-m-d H:i:s', time() + $cacheSeconds);
        $this->saveCache($productId, $steamAppId, $result);

        return $this->formatResponse($result, $steamAppId, $steamUrl);
    }

    private function freshCache(int $productId, int $steamAppId): ?array
    {
        $statement = $this->database->prepare(
            'SELECT cache_status, total_reviews, positive_count, negative_count,
                    positive_percent, reviews_json, unavailable_reason, fetched_at
             FROM steam_review_cache
             WHERE product_id = :product_id
               AND steam_app_id = :steam_app_id
               AND expires_at > UTC_TIMESTAMP()
             LIMIT 1',
        );
        $statement->execute([
            'product_id' => $productId,
            'steam_app_id' => $steamAppId,
        ]);
        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }

        try {
            $reviews = json_decode($row['reviews_json'], true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            error_log('Steam review cache contains invalid JSON for product ID ' . $productId . '.');
            return null;
        }

        if (!is_array($reviews) || !$this->isValidReviewList($reviews)) {
            error_log('Steam review cache contains invalid review data for product ID ' . $productId . '.');
            return null;
        }

        return [
            'cacheStatus' => $row['cache_status'],
            'totalReviews' => (int) $row['total_reviews'],
            'positiveCount' => (int) $row['positive_count'],
            'negativeCount' => (int) $row['negative_count'],
            'positivePercent' => $row['positive_percent'] !== null
                ? (float) $row['positive_percent']
                : null,
            'reviews' => $reviews,
            'unavailableReason' => $row['unavailable_reason'],
            'fetchedAt' => $row['fetched_at'],
        ];
    }

    private function fetchSteamReviews(int $steamAppId): array
    {
        if (!function_exists('curl_init')) {
            throw new SteamReviewFetchException('PHP cURL extension is not available.');
        }

        $query = http_build_query([
            'json' => 1,
            'filter' => 'recent',
            'language' => 'all',
            'review_type' => 'all',
            'purchase_type' => 'all',
            'num_per_page' => self::REVIEW_LIMIT,
            'cursor' => '*',
        ]);
        $url = 'https://store.steampowered.com/appreviews/' . $steamAppId . '?' . $query;
        $handle = curl_init($url);
        if ($handle === false) {
            throw new SteamReviewFetchException('Unable to initialize the Steam request.');
        }

        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_USERAGENT => 'PixelBayMarketplace/1.0',
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $contentType = (string) curl_getinfo($handle, CURLINFO_CONTENT_TYPE);
        $curlError = curl_error($handle);
        curl_close($handle);

        if ($body === false) {
            throw new SteamReviewFetchException('Steam request failed: ' . $curlError);
        }
        if ($status < 200 || $status >= 300) {
            throw new SteamReviewFetchException('Steam returned HTTP ' . $status . '.');
        }
        if ($contentType !== '' && stripos($contentType, 'application/json') === false) {
            throw new SteamReviewFetchException('Steam returned a non-JSON response.');
        }

        try {
            $payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new SteamReviewFetchException('Steam returned invalid JSON.', 0, $exception);
        }

        if (!is_array($payload)
            || !isset($payload['success'])
            || !in_array($payload['success'], [true, 1], true)
        ) {
            throw new SteamReviewFetchException('Steam did not provide review data for this App ID.');
        }

        return $payload;
    }

    private function normalizePayload(array $payload): array
    {
        $summary = $payload['query_summary'] ?? null;
        $sourceReviews = $payload['reviews'] ?? null;
        if (!is_array($summary) || !is_array($sourceReviews)) {
            throw new SteamReviewFetchException('Steam review response is missing its summary or reviews.');
        }

        foreach (['num_reviews', 'total_positive', 'total_negative'] as $field) {
            if (!isset($summary[$field]) || !is_numeric($summary[$field]) || (int) $summary[$field] < 0) {
                throw new SteamReviewFetchException('Steam review response contains invalid summary counts.');
            }
        }

        $totalReviews = (int) $summary['num_reviews'];
        $positiveCount = (int) $summary['total_positive'];
        $negativeCount = (int) $summary['total_negative'];
        $countedReviews = $positiveCount + $negativeCount;
        $positivePercent = $countedReviews > 0
            ? round(($positiveCount / $countedReviews) * 100, 2)
            : null;

        $reviews = [];
        foreach ($sourceReviews as $review) {
            if (!is_array($review)
                || !isset($review['recommendationid'], $review['review'], $review['voted_up'], $review['timestamp_created'])
                || !is_scalar($review['recommendationid'])
                || !is_string($review['review'])
            ) {
                continue;
            }

            $text = trim((string) $review['review']);
            $createdAt = filter_var($review['timestamp_created'], FILTER_VALIDATE_INT);
            $recommended = filter_var($review['voted_up'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($text === ''
                || $createdAt === false
                || $createdAt < 0
                || $createdAt > time() + 31536000
                || $recommended === null
            ) {
                continue;
            }

            $reviews[] = [
                'id' => (string) $review['recommendationid'],
                'text' => $text,
                'recommended' => $recommended,
                'createdAt' => $createdAt,
                'language' => isset($review['language']) ? (string) $review['language'] : '',
                'helpfulVotes' => isset($review['votes_up']) && is_numeric($review['votes_up'])
                    ? max(0, (int) $review['votes_up'])
                    : 0,
            ];
            if (count($reviews) >= self::REVIEW_LIMIT) {
                break;
            }
        }

        return [
            'cacheStatus' => 'available',
            'totalReviews' => $totalReviews,
            'positiveCount' => $positiveCount,
            'negativeCount' => $negativeCount,
            'positivePercent' => $positivePercent,
            'reviews' => $reviews,
            'unavailableReason' => null,
        ];
    }

    private function saveCache(int $productId, int $steamAppId, array $result): void
    {
        $reviewsJson = json_encode(
            $result['reviews'],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
        );
        $statement = $this->database->prepare(
            'INSERT INTO steam_review_cache
                (product_id, steam_app_id, cache_status, total_reviews, positive_count,
                 negative_count, positive_percent, reviews_json, unavailable_reason, fetched_at, expires_at)
             VALUES
                (:product_id, :steam_app_id, :cache_status, :total_reviews, :positive_count,
                 :negative_count, :positive_percent, :reviews_json, :unavailable_reason, :fetched_at, :expires_at)
             ON DUPLICATE KEY UPDATE
                steam_app_id = VALUES(steam_app_id),
                cache_status = VALUES(cache_status),
                total_reviews = VALUES(total_reviews),
                positive_count = VALUES(positive_count),
                negative_count = VALUES(negative_count),
                positive_percent = VALUES(positive_percent),
                reviews_json = VALUES(reviews_json),
                unavailable_reason = VALUES(unavailable_reason),
                fetched_at = VALUES(fetched_at),
                expires_at = VALUES(expires_at)',
        );
        $statement->execute([
            'product_id' => $productId,
            'steam_app_id' => $steamAppId,
            'cache_status' => $result['cacheStatus'],
            'total_reviews' => $result['totalReviews'],
            'positive_count' => $result['positiveCount'],
            'negative_count' => $result['negativeCount'],
            'positive_percent' => $result['positivePercent'],
            'reviews_json' => $reviewsJson,
            'unavailable_reason' => $result['unavailableReason'],
            'fetched_at' => $result['fetchedAt'],
            'expires_at' => $result['expiresAt'],
        ]);
    }

    private function formatResponse(array $result, int $steamAppId, string $steamUrl): array
    {
        $available = $result['cacheStatus'] === 'available';
        $message = $available
            ? ((int) $result['totalReviews'] === 0
                ? 'No Steam user reviews are currently available.'
                : null)
            : (string) ($result['unavailableReason'] ?? 'Steam reviews are temporarily unavailable. Please try again later.');

        return [
            'available' => $available,
            'message' => $message,
            'steamAppId' => $steamAppId,
            'steamUrl' => $steamUrl,
            'totalReviews' => (int) $result['totalReviews'],
            'positiveCount' => (int) $result['positiveCount'],
            'negativeCount' => (int) $result['negativeCount'],
            'positivePercent' => $result['positivePercent'] !== null
                ? (float) $result['positivePercent']
                : null,
            'reviews' => $result['reviews'],
            'fetchedAt' => $result['fetchedAt'] ?? null,
        ];
    }

    private function isValidReviewList(array $reviews): bool
    {
        if (count($reviews) > self::REVIEW_LIMIT) {
            return false;
        }

        foreach ($reviews as $review) {
            if (!is_array($review)
                || !isset($review['id'], $review['text'], $review['recommended'], $review['createdAt'])
                || !is_string($review['text'])
                || !is_bool($review['recommended'])
                || !is_numeric($review['createdAt'])
            ) {
                return false;
            }
        }

        return true;
    }
}

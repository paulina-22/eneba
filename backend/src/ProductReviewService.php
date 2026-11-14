<?php
declare(strict_types=1);

final class ProductReviewService
{
    private const MAX_REVIEW_LENGTH = 2000;

    public function __construct(private PDO $database)
    {
    }

    public function listForProduct(string $slug, ?int $userId): ?array
    {
        $productId = $this->productId($slug);
        if ($productId === null) {
            return null;
        }

        $summaryStatement = $this->database->prepare(
            'SELECT COUNT(*) AS total_reviews,
                    AVG(rating) AS average_rating,
                    SUM(rating = 1) AS rating_1,
                    SUM(rating = 2) AS rating_2,
                    SUM(rating = 3) AS rating_3,
                    SUM(rating = 4) AS rating_4,
                    SUM(rating = 5) AS rating_5
             FROM product_reviews
             WHERE product_id = :product_id',
        );
        $summaryStatement->execute(['product_id' => $productId]);
        $summary = $summaryStatement->fetch();

        $reviewsStatement = $this->database->prepare(
            'SELECT r.id, r.rating, r.review_text, r.is_demo, r.created_at, r.updated_at,
                    u.name AS user_name,
                    CASE WHEN r.user_id = :user_id THEN 1 ELSE 0 END AS is_mine
             FROM product_reviews r
             JOIN users u ON u.id = r.user_id
             WHERE r.product_id = :product_id
             ORDER BY is_mine DESC, r.created_at DESC, r.id DESC
             LIMIT 100',
        );
        $reviewsStatement->execute([
            'user_id' => $userId,
            'product_id' => $productId,
        ]);
        $reviews = array_map(
            fn(array $review): array => $this->formatReview($review),
            $reviewsStatement->fetchAll(),
        );

        $userReview = null;
        if ($userId !== null) {
            $userReviewStatement = $this->database->prepare(
                'SELECT product_reviews.id, product_reviews.rating, product_reviews.review_text,
                       product_reviews.is_demo, product_reviews.created_at, product_reviews.updated_at,
                       users.name AS user_name, 1 AS is_mine
                 FROM product_reviews
                 JOIN users ON users.id = product_reviews.user_id
                 WHERE product_reviews.product_id = :product_id
                   AND product_reviews.user_id = :user_id
                   AND product_reviews.is_demo = 0
                 LIMIT 1',
            );
            $userReviewStatement->execute([
                'product_id' => $productId,
                'user_id' => $userId,
            ]);
            $ownedReview = $userReviewStatement->fetch();
            if ($ownedReview !== false) {
                $userReview = $this->formatReview($ownedReview);
            }
        }

        return [
            'summary' => [
                'averageRating' => $summary['average_rating'] !== null
                    ? round((float) $summary['average_rating'], 2)
                    : null,
                'totalReviews' => (int) $summary['total_reviews'],
                'distribution' => [
                    1 => (int) ($summary['rating_1'] ?? 0),
                    2 => (int) ($summary['rating_2'] ?? 0),
                    3 => (int) ($summary['rating_3'] ?? 0),
                    4 => (int) ($summary['rating_4'] ?? 0),
                    5 => (int) ($summary['rating_5'] ?? 0),
                ],
            ],
            'reviews' => $reviews,
            'userReview' => $userReview,
            'demoReviewsIncluded' => count(array_filter(
                $reviews,
                static fn(array $review): bool => $review['isDemo'],
            )) > 0,
        ];
    }

    public function create(string $slug, int $userId, array $input): array
    {
        $productId = $this->productId($slug);
        if ($productId === null) {
            throw new ApiException(404, 'Product not found.');
        }
        [$rating, $reviewText] = $this->validateReview($input);

        try {
            $statement = $this->database->prepare(
                'INSERT INTO product_reviews (product_id, user_id, rating, review_text)
                 VALUES (:product_id, :user_id, :rating, :review_text)',
            );
            $statement->execute([
                'product_id' => $productId,
                'user_id' => $userId,
                'rating' => $rating,
                'review_text' => $reviewText,
            ]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new ApiException(409, 'You have already reviewed this game. Edit your existing review instead.');
            }
            throw $exception;
        }

        return $this->listForProduct($slug, $userId) ?? throw new ApiException(404, 'Product not found.');
    }

    public function update(string $slug, int $reviewId, int $userId, array $input): array
    {
        $productId = $this->productId($slug);
        if ($productId === null) {
            throw new ApiException(404, 'Product not found.');
        }
        [$rating, $reviewText] = $this->validateReview($input);
        $this->requireOwnedReview($productId, $reviewId, $userId);

        $statement = $this->database->prepare(
            'UPDATE product_reviews
             SET rating = :rating, review_text = :review_text, updated_at = CURRENT_TIMESTAMP
             WHERE id = :review_id AND product_id = :product_id AND user_id = :user_id AND is_demo = 0',
        );
        $statement->execute([
            'rating' => $rating,
            'review_text' => $reviewText,
            'review_id' => $reviewId,
            'product_id' => $productId,
            'user_id' => $userId,
        ]);

        return $this->listForProduct($slug, $userId) ?? throw new ApiException(404, 'Product not found.');
    }

    public function delete(string $slug, int $reviewId, int $userId): array
    {
        $productId = $this->productId($slug);
        if ($productId === null) {
            throw new ApiException(404, 'Product not found.');
        }
        $this->requireOwnedReview($productId, $reviewId, $userId);

        $statement = $this->database->prepare(
            'DELETE FROM product_reviews
             WHERE id = :review_id AND product_id = :product_id AND user_id = :user_id AND is_demo = 0',
        );
        $statement->execute([
            'review_id' => $reviewId,
            'product_id' => $productId,
            'user_id' => $userId,
        ]);

        return $this->listForProduct($slug, $userId) ?? throw new ApiException(404, 'Product not found.');
    }

    private function productId(string $slug): ?int
    {
        $statement = $this->database->prepare(
            'SELECT id FROM products WHERE slug = :slug AND active = 1 LIMIT 1',
        );
        $statement->execute(['slug' => $slug]);
        $productId = $statement->fetchColumn();

        return $productId === false ? null : (int) $productId;
    }

    private function requireOwnedReview(int $productId, int $reviewId, int $userId): void
    {
        $statement = $this->database->prepare(
            'SELECT id FROM product_reviews
             WHERE id = :review_id AND product_id = :product_id AND user_id = :user_id AND is_demo = 0
             LIMIT 1',
        );
        $statement->execute([
            'review_id' => $reviewId,
            'product_id' => $productId,
            'user_id' => $userId,
        ]);
        if ($statement->fetchColumn() === false) {
            throw new ApiException(404, 'Your review was not found.');
        }
    }

    private function validateReview(array $input): array
    {
        $rating = isset($input['rating']) ? filter_var($input['rating'], FILTER_VALIDATE_INT) : false;
        $reviewText = isset($input['reviewText']) && is_string($input['reviewText'])
            ? trim($input['reviewText'])
            : '';
        $textLength = function_exists('mb_strlen') ? mb_strlen($reviewText) : strlen($reviewText);

        if ($rating === false || $rating < 1 || $rating > 5) {
            throw new ApiException(400, 'Choose a rating from 1 to 5 stars.');
        }
        if ($reviewText === '' || $textLength > self::MAX_REVIEW_LENGTH) {
            throw new ApiException(400, 'Review text is required and must be 2,000 characters or fewer.');
        }

        return [(int) $rating, $reviewText];
    }

    private function formatReview(array $review): array
    {
        return [
            'id' => (int) $review['id'],
            'userName' => (string) $review['user_name'],
            'rating' => (int) $review['rating'],
            'reviewText' => (string) $review['review_text'],
            'isDemo' => (bool) $review['is_demo'],
            'isMine' => (bool) $review['is_mine'],
            'createdAt' => (string) $review['created_at'],
            'updatedAt' => (string) $review['updated_at'],
        ];
    }
}

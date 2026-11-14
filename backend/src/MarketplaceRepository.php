<?php
declare(strict_types=1);

final class MarketplaceRepository
{
    public function __construct(private PDO $database)
    {
    }

    public function checkConnection(): void
    {
        $this->database->query('SELECT 1')->fetchColumn();
    }

    public function hero(): ?array
    {
        return $this->sectionMetadata('hero');
    }

    public function banners(): array
    {
        $statement = $this->database->query(
            'SELECT id, title, subtitle, image_url, cta_label, cta_url
             FROM homepage_banners
             WHERE active = 1
             ORDER BY sort_order ASC, id ASC',
        );

        return array_map(
            static fn(array $row): array => [
                'id' => (int) $row['id'],
                'title' => $row['title'],
                'subtitle' => $row['subtitle'],
                'imageUrl' => $row['image_url'],
                'ctaLabel' => $row['cta_label'],
                'ctaUrl' => $row['cta_url'],
            ],
            $statement->fetchAll(),
        );
    }

    public function productSection(string $sectionSlug): ?array
    {
        $section = $this->sectionMetadata($sectionSlug);
        if ($section === null) {
            return null;
        }

        $discountFilter = $sectionSlug === 'deals'
            ? ' AND candidate.regular_price IS NOT NULL AND candidate.regular_price > candidate.price'
            : '';
        $orderBy = $sectionSlug === 'new-arrivals'
            ? 'p.created_at DESC, p.id DESC'
            : 'hsp.sort_order ASC';

        $statement = $this->database->prepare(
            'SELECT p.id, p.slug, p.name, p.description, p.image_url,
                    c.name AS category, selected_platform.name AS platform_names,
                    selected_offer.price AS lowest_price,
                    selected_offer.regular_price, selected_offer.currency,
                    (SELECT COUNT(*)
                     FROM offers active_offers
                     WHERE active_offers.product_id = p.id AND active_offers.active = 1) AS offer_count
             FROM homepage_sections hs
             INNER JOIN homepage_section_products hsp ON hsp.section_id = hs.id
             INNER JOIN products p ON p.id = hsp.product_id AND p.active = 1
             INNER JOIN categories c ON c.id = p.category_id
             INNER JOIN offers selected_offer ON selected_offer.id = (
                 SELECT candidate.id
                 FROM offers candidate
                 WHERE candidate.product_id = p.id AND candidate.active = 1' . $discountFilter . '
                 ORDER BY candidate.price ASC, candidate.id ASC
                 LIMIT 1
             )
             INNER JOIN platforms selected_platform ON selected_platform.id = selected_offer.platform_id
             WHERE hs.slug = :slug AND hs.active = 1
             ORDER BY ' . $orderBy . '
             LIMIT 12',
        );
        $statement->execute(['slug' => $sectionSlug]);

        return [
            'title' => $section['title'],
            'subtitle' => $section['subtitle'],
            'items' => $this->formatProducts($statement->fetchAll()),
        ];
    }

    private function sectionMetadata(string $sectionSlug): ?array
    {
        $statement = $this->database->prepare(
            'SELECT title, subtitle, image_url, cta_label, cta_url
             FROM homepage_sections
             WHERE slug = :slug AND active = 1
             LIMIT 1',
        );
        $statement->execute(['slug' => $sectionSlug]);
        $row = $statement->fetch();

        if ($row === false) {
            return null;
        }

        return [
            'title' => $row['title'],
            'subtitle' => $row['subtitle'],
            'imageUrl' => $row['image_url'],
            'ctaLabel' => $row['cta_label'],
            'ctaUrl' => $row['cta_url'],
        ];
    }

    public function categorySection(): ?array
    {
        $section = $this->sectionMetadata('popular-categories');
        if ($section === null) {
            return null;
        }

        return [
            'title' => $section['title'],
            'subtitle' => $section['subtitle'],
            'items' => $this->categories(),
        ];
    }

    public function categories(): array
    {
        $statement = $this->database->query(
            'SELECT c.id, c.name, c.slug, COUNT(DISTINCT p.id) AS product_count
             FROM categories c
             INNER JOIN products p ON p.category_id = c.id AND p.active = 1
             INNER JOIN offers o ON o.product_id = p.id AND o.active = 1
             GROUP BY c.id, c.name, c.slug
             ORDER BY c.name ASC',
        );

        return array_map(
            static fn(array $row): array => [
                'id' => (int) $row['id'],
                'name' => $row['name'],
                'slug' => $row['slug'],
                'productCount' => (int) $row['product_count'],
            ],
            $statement->fetchAll(),
        );
    }

    public function platformSection(): ?array
    {
        $section = $this->sectionMetadata('popular-platforms');
        if ($section === null) {
            return null;
        }

        $statement = $this->database->query(
            'SELECT pf.id, pf.name, pf.slug,
                    COALESCE(platform_products.product_count, 0) AS product_count
             FROM platforms pf
             LEFT JOIN (
                 SELECT o.platform_id, COUNT(DISTINCT p.id) AS product_count
                 FROM offers o
                 INNER JOIN products p ON p.id = o.product_id AND p.active = 1
                 WHERE o.active = 1
                 GROUP BY o.platform_id
             ) platform_products ON platform_products.platform_id = pf.id
             ORDER BY product_count DESC, pf.name ASC',
        );

        return [
            'title' => $section['title'],
            'subtitle' => $section['subtitle'],
            'items' => array_map(
                static fn(array $row): array => [
                    'id' => (int) $row['id'],
                    'name' => $row['name'],
                    'slug' => $row['slug'],
                    'productCount' => (int) $row['product_count'],
                ],
                $statement->fetchAll(),
            ),
        ];
    }

    public function products(array $filters): array
    {
        $where = ['p.active = 1', 'o.active = 1'];
        $parameters = [];
        $query = $this->stringFilter($filters, 'q');
        if ($query !== '') {
            if (strlen($query) > 100) {
                throw new InvalidArgumentException('Search text must be 100 characters or fewer.');
            }

            $escapedQuery = strtr($query, ['=' => '==', '%' => '=%', '_' => '=_']);
            $nameQuery = '%' . $escapedQuery . '%';
            $descriptionQuery = '%' . $escapedQuery . '%';
            $searchCondition = "(p.name LIKE :name_query ESCAPE '=' OR p.description LIKE :description_query ESCAPE '='";
            $parameters['name_query'] = $nameQuery;
            $parameters['description_query'] = $descriptionQuery;

            $exactMatch = $this->database->prepare(
                "SELECT 1
                 FROM products
                 WHERE active = 1
                   AND (name LIKE :name_query ESCAPE '=' OR description LIKE :description_query ESCAPE '=')
                 LIMIT 1",
            );
            $exactMatch->execute([
                'name_query' => $nameQuery,
                'description_query' => $descriptionQuery,
            ]);

            if ($exactMatch->fetchColumn() === false) {
                $fuzzyIds = $this->fuzzyProductIds($query);
                if ($fuzzyIds !== []) {
                    $idParameters = [];
                    foreach ($fuzzyIds as $index => $productId) {
                        $parameter = 'fuzzy_id_' . $index;
                        $idParameters[] = ':' . $parameter;
                        $parameters[$parameter] = $productId;
                    }
                    $searchCondition .= ' OR p.id IN (' . implode(', ', $idParameters) . ')';
                }
            }

            $where[] = $searchCondition . ')';
        }

        foreach (['platform' => 'pf.slug', 'region' => 'r.slug'] as $filter => $column) {
            $value = $this->stringFilter($filters, $filter);
            if ($value !== '') {
                $where[] = $column . ' = :' . $filter;
                $parameters[$filter] = $value;
            }
        }

        $minPrice = $this->priceFilter($filters['minPrice'] ?? '', 'minPrice');
        $maxPrice = $this->priceFilter($filters['maxPrice'] ?? '', 'maxPrice');
        if ($minPrice !== null && $maxPrice !== null && $minPrice > $maxPrice) {
            throw new InvalidArgumentException('minPrice must not exceed maxPrice.');
        }
        if ($minPrice !== null) {
            $where[] = 'o.price >= :min_price';
            $parameters['min_price'] = $minPrice;
        }
        if ($maxPrice !== null) {
            $where[] = 'o.price <= :max_price';
            $parameters['max_price'] = $maxPrice;
        }

        $sort = $this->stringFilter($filters, 'sort', 'popular');
        $orderBy = [
            'popular' => 'total_sold DESC, p.name ASC',
            'price-asc' => 'lowest_price ASC, p.name ASC',
            'price-desc' => 'lowest_price DESC, p.name ASC',
            'name' => 'p.name ASC',
        ];
        if (!isset($orderBy[$sort])) {
            throw new InvalidArgumentException('sort must be popular, price-asc, price-desc, or name.');
        }

        $limit = filter_var($this->stringFilter($filters, 'limit', '12'), FILTER_VALIDATE_INT);
        if ($limit === false || $limit < 1 || $limit > 50) {
            throw new InvalidArgumentException('limit must be an integer between 1 and 50.');
        }
        $offset = filter_var($this->stringFilter($filters, 'offset', '0'), FILTER_VALIDATE_INT);
        if ($offset === false || $offset < 0 || $offset > 1000000) {
            throw new InvalidArgumentException('offset must be an integer between 0 and 1000000.');
        }

        $sql = $this->productQuery()
            . ' WHERE ' . implode(' AND ', $where)
            . ' GROUP BY p.id, p.slug, p.name, p.description, p.image_url, c.name, sales.total_sold'
            . ' ORDER BY ' . $orderBy[$sort]
            . ' LIMIT :limit OFFSET :offset';
        $statement = $this->database->prepare($sql);
        foreach ($parameters as $name => $value) {
            $statement->bindValue(':' . $name, $value);
        }
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $this->formatProducts($statement->fetchAll());
    }

    public function product(string $slug): ?array
    {
        $productStatement = $this->database->prepare(
            'SELECT p.id, p.category_id, p.slug, p.name, p.description, p.image_url, c.name AS category
             FROM products p
             INNER JOIN categories c ON c.id = p.category_id
             WHERE p.slug = :slug AND p.active = 1
             LIMIT 1',
        );
        $productStatement->execute(['slug' => $slug]);
        $product = $productStatement->fetch();
        if ($product === false) {
            return null;
        }

        $offerStatement = $this->database->prepare(
            'SELECT o.id, s.display_name AS seller_name,
                    pf.name AS platform, pf.slug AS platform_slug,
                    r.name AS region, r.slug AS region_slug,
                    o.price, o.regular_price, o.currency
             FROM offers o
             INNER JOIN sellers s ON s.id = o.seller_id AND s.active = 1
             INNER JOIN platforms pf ON pf.id = o.platform_id
             INNER JOIN regions r ON r.id = o.region_id
             WHERE o.product_id = :product_id AND o.active = 1
             ORDER BY o.price ASC, s.display_name ASC, o.id ASC',
        );
        $offerStatement->execute(['product_id' => $product['id']]);
        $offers = array_map(
            static fn(array $offer): array => [
                'id' => (int) $offer['id'],
                'sellerName' => $offer['seller_name'],
                'platform' => $offer['platform'],
                'platformSlug' => $offer['platform_slug'],
                'region' => $offer['region'],
                'regionSlug' => $offer['region_slug'],
                'price' => (float) $offer['price'],
                'regularPrice' => $offer['regular_price'] !== null
                    ? (float) $offer['regular_price']
                    : null,
                'currency' => $offer['currency'],
            ],
            $offerStatement->fetchAll(),
        );

        $mediaStatement = $this->database->prepare(
            'SELECT id, media_type, image_url, thumbnail_url, alt_text
             FROM product_media
             WHERE product_id = :product_id
             ORDER BY sort_order ASC, id ASC',
        );
        $mediaStatement->execute(['product_id' => $product['id']]);
        $gallery = array_map(
            static fn(array $media): array => [
                'id' => (int) $media['id'],
                'mediaType' => $media['media_type'],
                'imageUrl' => $media['image_url'],
                'thumbnailUrl' => $media['thumbnail_url'],
                'altText' => $media['alt_text'],
            ],
            $mediaStatement->fetchAll(),
        );

        $metadataStatement = $this->database->prepare(
            'SELECT release_date, publisher, developer, genres, languages, source_url
             FROM product_details
             WHERE product_id = :product_id
             LIMIT 1',
        );
        $metadataStatement->execute(['product_id' => $product['id']]);
        $metadataRow = $metadataStatement->fetch();
        $metadata = $metadataRow === false
            ? [
                'releaseDate' => null,
                'publisher' => null,
                'developer' => null,
                'genres' => [],
                'languages' => [],
                'sourceUrl' => null,
            ]
            : [
                'releaseDate' => $metadataRow['release_date'],
                'publisher' => $metadataRow['publisher'],
                'developer' => $metadataRow['developer'],
                'genres' => $this->splitMetadataList($metadataRow['genres']),
                'languages' => $this->splitMetadataList($metadataRow['languages']),
                'sourceUrl' => $metadataRow['source_url'],
            ];

        $descriptionStatement = $this->database->prepare(
            'SELECT id, heading, body
             FROM product_description_sections
             WHERE product_id = :product_id
             ORDER BY sort_order ASC, id ASC',
        );
        $descriptionStatement->execute(['product_id' => $product['id']]);
        $descriptionSections = array_map(
            static fn(array $section): array => [
                'id' => (int) $section['id'],
                'heading' => $section['heading'],
                'body' => $section['body'],
            ],
            $descriptionStatement->fetchAll(),
        );

        $ratingsStatement = $this->database->prepare(
            'SELECT review_count, overall_rating, gameplay_rating, story_rating,
                    graphics_rating, soundtrack_rating
             FROM product_rating_summaries
             WHERE product_id = :product_id
             LIMIT 1',
        );
        $ratingsStatement->execute(['product_id' => $product['id']]);
        $ratingsRow = $ratingsStatement->fetch();
        $ratings = $ratingsRow === false
            ? null
            : [
                'reviewCount' => (int) $ratingsRow['review_count'],
                'overall' => $ratingsRow['overall_rating'] !== null
                    ? (float) $ratingsRow['overall_rating']
                    : null,
                'gameplay' => $ratingsRow['gameplay_rating'] !== null
                    ? (float) $ratingsRow['gameplay_rating']
                    : null,
                'story' => $ratingsRow['story_rating'] !== null
                    ? (float) $ratingsRow['story_rating']
                    : null,
                'graphics' => $ratingsRow['graphics_rating'] !== null
                    ? (float) $ratingsRow['graphics_rating']
                    : null,
                'soundtrack' => $ratingsRow['soundtrack_rating'] !== null
                    ? (float) $ratingsRow['soundtrack_rating']
                    : null,
            ];

        $recommendationStatement = $this->database->prepare(
            'SELECT p.id, p.slug, p.name, p.image_url,
                    GROUP_CONCAT(DISTINCT pf.name ORDER BY pf.name SEPARATOR ",") AS platform_names,
                    GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ",") AS region_names,
                    best_offer.price AS lowest_price, best_offer.currency,
                    cashback.cashback_percent
             FROM products p
             INNER JOIN offers catalog_offer ON catalog_offer.product_id = p.id AND catalog_offer.active = 1
             INNER JOIN platforms pf ON pf.id = catalog_offer.platform_id
             INNER JOIN regions r ON r.id = catalog_offer.region_id
             INNER JOIN offers best_offer ON best_offer.id = (
                 SELECT candidate.id
                 FROM offers candidate
                 WHERE candidate.product_id = p.id AND candidate.active = 1
                 ORDER BY candidate.price ASC, candidate.id ASC
                 LIMIT 1
             )
             LEFT JOIN offer_cashbacks cashback ON cashback.offer_id = best_offer.id
             WHERE p.active = 1 AND p.id <> :product_id
             GROUP BY p.id, p.slug, p.name, p.image_url, best_offer.price,
                      best_offer.currency, cashback.cashback_percent, p.category_id
             ORDER BY (p.category_id = :category_id) DESC, p.name ASC
             LIMIT 8',
        );
        $recommendationStatement->execute([
            'product_id' => $product['id'],
            'category_id' => $product['category_id'] ?? null,
        ]);
        $recommendations = array_map(
            static fn(array $recommendation): array => [
                'id' => (int) $recommendation['id'],
                'slug' => $recommendation['slug'],
                'name' => $recommendation['name'],
                'imageUrl' => $recommendation['image_url'],
                'platforms' => self::splitList($recommendation['platform_names']),
                'regions' => self::splitList($recommendation['region_names']),
                'lowestPrice' => (float) $recommendation['lowest_price'],
                'currency' => $recommendation['currency'],
                'cashbackPercent' => $recommendation['cashback_percent'] !== null
                    ? (float) $recommendation['cashback_percent']
                    : null,
            ],
            $recommendationStatement->fetchAll(),
        );

        return [
            'id' => (int) $product['id'],
            'slug' => $product['slug'],
            'name' => $product['name'],
            'description' => $product['description'],
            'category' => $product['category'],
            'imageUrl' => $product['image_url'],
            'platforms' => array_values(array_unique(array_column($offers, 'platform'))),
            'regions' => array_values(array_unique(array_column($offers, 'region'))),
            'offers' => $offers,
            'gallery' => $gallery,
            'descriptionSections' => $descriptionSections,
            'metadata' => $metadata,
            'ratings' => $ratings,
            'recommendations' => $recommendations,
        ];
    }

    private function splitMetadataList(?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [];
        }

        return array_values(array_filter(
            array_map('trim', explode(',', $value)),
            static fn(string $item): bool => $item !== '',
        ));
    }

    private static function splitList(?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [];
        }

        return array_values(array_filter(
            array_map('trim', explode(',', $value)),
            static fn(string $item): bool => $item !== '',
        ));
    }

    private function fuzzyProductIds(string $query): array
    {
        $normalizedQuery = implode('', $this->searchTokens($query));
        $queryTokens = array_values(array_filter(
            $this->searchTokens($query),
            static fn(string $token): bool => strlen($token) >= 4,
        ));
        if ($queryTokens === [] && strlen($normalizedQuery) < 3) {
            return [];
        }

        $statement = $this->database->query(
            'SELECT id, name FROM products WHERE active = 1 ORDER BY id ASC',
        );
        $matches = [];

        foreach ($statement->fetchAll() as $row) {
            $nameTokens = $this->searchTokens((string) $row['name']);
            $acronym = implode('', array_map(
                static fn(string $token): string => $token[0],
                $nameTokens,
            ));
            if (strlen($normalizedQuery) >= 3 && str_starts_with($acronym, $normalizedQuery)) {
                $matches[] = ['id' => (int) $row['id'], 'score' => 0];
                continue;
            }
            if ($queryTokens === []) {
                continue;
            }

            $score = 0;

            foreach ($queryTokens as $queryToken) {
                $bestDistance = PHP_INT_MAX;
                foreach ($nameTokens as $nameToken) {
                    $bestDistance = min($bestDistance, levenshtein($queryToken, $nameToken));
                }

                $allowedDistance = strlen($queryToken) >= 9 ? 2 : 1;
                if ($bestDistance > $allowedDistance) {
                    continue 2;
                }
                $score += $bestDistance;
            }

            $matches[] = ['id' => (int) $row['id'], 'score' => $score];
        }

        usort(
            $matches,
            static fn(array $left, array $right): int => $left['score'] <=> $right['score'],
        );

        return array_column(array_slice($matches, 0, 20), 'id');
    }

    private function searchTokens(string $value): array
    {
        $normalized = strtolower($value);
        $normalized = preg_replace('/[^a-z0-9]+/', ' ', $normalized) ?? '';
        $tokens = explode(' ', trim($normalized));

        return array_values(array_filter($tokens, static fn(string $token): bool => $token !== ''));
    }

    private function productQuery(): string
    {
        return 'SELECT p.id, p.slug, p.name, p.description, p.image_url,
                       c.name AS category,
                       GROUP_CONCAT(DISTINCT pf.name ORDER BY pf.name SEPARATOR ",") AS platform_names,
                       MIN(o.price) AS lowest_price,
                       MIN(o.currency) AS currency, COUNT(DISTINCT o.id) AS offer_count,
                       COALESCE(sales.total_sold, 0) AS total_sold
                FROM products p
                INNER JOIN categories c ON c.id = p.category_id
                INNER JOIN offers o ON o.product_id = p.id
                INNER JOIN platforms pf ON pf.id = o.platform_id
                INNER JOIN regions r ON r.id = o.region_id
                LEFT JOIN (
                    SELECT oi.product_id, SUM(oi.quantity) AS total_sold
                    FROM order_items oi
                    INNER JOIN orders ord ON ord.id = oi.order_id AND ord.status = "paid"
                    GROUP BY oi.product_id
                ) sales ON sales.product_id = p.id';
    }

    private function formatProducts(array $rows): array
    {
        return array_map(
            static function (array $row): array {
                $lowestPrice = (float) $row['lowest_price'];
                $regularPrice = isset($row['regular_price']) && $row['regular_price'] !== null
                    ? (float) $row['regular_price']
                    : null;

                return [
                    'id' => (int) $row['id'],
                    'slug' => $row['slug'],
                    'name' => $row['name'],
                    'description' => $row['description'],
                    'category' => $row['category'],
                    'platforms' => array_values(array_filter(
                        explode(',', (string) ($row['platform_names'] ?? '')),
                        static fn(string $platform): bool => $platform !== '',
                    )),
                    'imageUrl' => $row['image_url'],
                    'lowestPrice' => $lowestPrice,
                    'regularPrice' => $regularPrice,
                    'discountPercent' => $regularPrice !== null && $regularPrice > $lowestPrice
                        ? (int) round((($regularPrice - $lowestPrice) / $regularPrice) * 100)
                        : null,
                    'currency' => $row['currency'],
                    'offerCount' => (int) $row['offer_count'],
                ];
            },
            $rows,
        );
    }

    private function priceFilter(mixed $value, string $name): ?float
    {
        if ($value === '' || $value === null) {
            return null;
        }

        if (!is_numeric($value) || !is_finite((float) $value) || (float) $value < 0) {
            throw new InvalidArgumentException($name . ' must be a non-negative number.');
        }

        return (float) $value;
    }

    private function stringFilter(array $filters, string $name, string $default = ''): string
    {
        $value = $filters[$name] ?? $default;
        if (!is_string($value) && !is_numeric($value)) {
            throw new InvalidArgumentException($name . ' must be a single value.');
        }

        return trim((string) $value);
    }
}

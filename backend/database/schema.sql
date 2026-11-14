-- Fresh-install schema and synthetic demo data for MySQL/MariaDB.
-- Select the target database before importing this file.
-- Re-importing does not drop existing tables or delete existing data.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS platforms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS regions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  image_url VARCHAR(500) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_products_name (name),
  INDEX idx_products_active_category (active, category_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_media (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  media_type VARCHAR(20) NOT NULL,
  image_url VARCHAR(1000) NOT NULL,
  thumbnail_url VARCHAR(1000) NOT NULL,
  alt_text VARCHAR(250) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_product_media_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_media_order (product_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_details (
  product_id BIGINT UNSIGNED PRIMARY KEY,
  release_date VARCHAR(50) NULL,
  publisher VARCHAR(180) NULL,
  developer VARCHAR(180) NULL,
  genres TEXT NULL,
  languages TEXT NULL,
  source_url VARCHAR(500) NULL,
  CONSTRAINT fk_product_details_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_description_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  heading VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_product_description_sections_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_description_order (product_id, sort_order),
  INDEX idx_product_description_sections_order (product_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_rating_summaries (
  product_id BIGINT UNSIGNED PRIMARY KEY,
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  overall_rating DECIMAL(3, 2) NULL,
  gameplay_rating DECIMAL(3, 2) NULL,
  story_rating DECIMAL(3, 2) NULL,
  graphics_rating DECIMAL(3, 2) NULL,
  soundtrack_rating DECIMAL(3, 2) NULL,
  CONSTRAINT fk_product_rating_summaries_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  review_text TEXT NOT NULL,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_reviews_user_product (user_id, product_id),
  INDEX idx_product_reviews_product_created (product_id, created_at, id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS steam_app_mappings (
  product_id BIGINT UNSIGNED PRIMARY KEY,
  steam_app_id BIGINT UNSIGNED NOT NULL UNIQUE,
  store_url VARCHAR(500) NOT NULL,
  verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_steam_app_mappings_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS steam_review_cache (
  product_id BIGINT UNSIGNED PRIMARY KEY,
  steam_app_id BIGINT UNSIGNED NOT NULL,
  cache_status ENUM('available', 'unavailable') NOT NULL,
  total_reviews INT UNSIGNED NOT NULL DEFAULT 0,
  positive_count INT UNSIGNED NOT NULL DEFAULT 0,
  negative_count INT UNSIGNED NOT NULL DEFAULT 0,
  positive_percent DECIMAL(5, 2) NULL,
  reviews_json LONGTEXT NOT NULL,
  unavailable_reason VARCHAR(250) NULL,
  fetched_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  CONSTRAINT fk_steam_review_cache_mapping FOREIGN KEY (product_id) REFERENCES steam_app_mappings(product_id) ON DELETE CASCADE,
  INDEX idx_steam_review_cache_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sellers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL UNIQUE,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS offers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  platform_id BIGINT UNSIGNED NOT NULL,
  region_id BIGINT UNSIGNED NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  regular_price DECIMAL(10, 2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_offers_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_offers_seller FOREIGN KEY (seller_id) REFERENCES sellers(id),
  CONSTRAINT fk_offers_platform FOREIGN KEY (platform_id) REFERENCES platforms(id),
  CONSTRAINT fk_offers_region FOREIGN KEY (region_id) REFERENCES regions(id),
  UNIQUE KEY uq_offer_seller_variant (product_id, seller_id, platform_id, region_id),
  INDEX idx_offers_catalog (active, platform_id, region_id, price),
  INDEX idx_offers_product (product_id, active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS offer_cashbacks (
  offer_id BIGINT UNSIGNED PRIMARY KEY,
  cashback_percent DECIMAL(5, 2) NOT NULL,
  CONSTRAINT fk_offer_cashbacks_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homepage_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  subtitle VARCHAR(500) NOT NULL DEFAULT '',
  image_url VARCHAR(500) NULL,
  cta_label VARCHAR(80) NOT NULL DEFAULT 'Explore games',
  cta_url VARCHAR(250) NOT NULL DEFAULT '/store',
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homepage_banners (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  subtitle VARCHAR(500) NOT NULL DEFAULT '',
  image_url VARCHAR(500) NOT NULL,
  cta_label VARCHAR(80) NOT NULL DEFAULT 'Explore games',
  cta_url VARCHAR(250) NOT NULL DEFAULT '/store',
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homepage_section_products (
  section_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (section_id, product_id),
  CONSTRAINT fk_homepage_products_section FOREIGN KEY (section_id) REFERENCES homepage_sections(id),
  CONSTRAINT fk_homepage_products_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS carts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id BIGINT UNSIGNED NOT NULL,
  offer_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_cart_offer (cart_id, offer_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_offer FOREIGN KEY (offer_id) REFERENCES offers(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending_payment', 'paid', 'cancelled') NOT NULL DEFAULT 'pending_payment',
  total DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_orders_user_created (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  offer_id BIGINT UNSIGNED NOT NULL,
  product_name_snapshot VARCHAR(180) NOT NULL,
  seller_name_snapshot VARCHAR(120) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_order_items_offer FOREIGN KEY (offer_id) REFERENCES offers(id),
  INDEX idx_order_items_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL UNIQUE,
  provider VARCHAR(40) NOT NULL DEFAULT 'simulated',
  status ENUM('pending', 'succeeded', 'failed') NOT NULL DEFAULT 'pending',
  reference VARCHAR(120) NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS digital_keys (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NOT NULL,
  key_value VARCHAR(255) NOT NULL COMMENT 'Synthetic test value only; never insert real keys',
  key_hash CHAR(64) NOT NULL UNIQUE,
  status ENUM('available', 'assigned') NOT NULL DEFAULT 'available',
  assigned_order_item_id BIGINT UNSIGNED NULL,
  delivered_at TIMESTAMP NULL,
  CONSTRAINT fk_digital_keys_offer FOREIGN KEY (offer_id) REFERENCES offers(id),
  CONSTRAINT fk_digital_keys_order_item FOREIGN KEY (assigned_order_item_id) REFERENCES order_items(id),
  INDEX idx_digital_keys_available (offer_id, status)
) ENGINE=InnoDB;

INSERT IGNORE INTO categories (id, name, slug) VALUES
  (1, 'Action RPG', 'action-rpg'),
  (2, 'Sandbox', 'sandbox'),
  (3, 'Action', 'action'),
  (4, 'Adventure', 'adventure'),
  (5, 'Racing', 'racing'),
  (6, 'Strategy', 'strategy'),
  (7, 'Survival', 'survival'),
  (8, 'Simulation', 'simulation'),
  (9, 'Sports', 'sports');

INSERT IGNORE INTO platforms (id, name, slug) VALUES
  (1, 'PC', 'pc'),
  (2, 'PlayStation 5', 'playstation-5'),
  (3, 'Xbox Series X|S', 'xbox-series-xs');

INSERT IGNORE INTO regions (id, name, slug) VALUES
  (1, 'Global', 'global'),
  (2, 'Europe', 'europe'),
  (3, 'North America', 'north-america');

-- Product artwork comes from the matching Steam Store or Microsoft Store listing.
INSERT INTO products (id, category_id, slug, name, description, image_url) VALUES
  (1, 1, 'cyberpunk-2077', 'Cyberpunk 2077', 'An open-world role-playing game set in Night City.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/48a93d6445a67520ea49833c93dae8f2e68fc540/header_alt_assets_9.jpg?t=1794474878'),
  (2, 2, 'minecraft', 'Minecraft', 'A sandbox game focused on building, exploration, and survival.', 'https://store-images.s-microsoft.com/image/apps.58378.14492077886571533.338a563a-86e7-47b1-b9dc-41cf411f5dcd.dc840f22-6e8f-4a59-b7bc-57958a0740fd?q=90&w=460&h=274'),
  (3, 1, 'elden-ring', 'Elden Ring', 'An action role-playing game set in a large fantasy world.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg?t=1790290043'),
  (4, 3, 'grand-theft-auto-v', 'Grand Theft Auto V', 'An open-world action game set in Los Santos.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg?t=1765387725'),
  (5, 4, 'red-dead-redemption-2', 'Red Dead Redemption 2', 'An epic western action-adventure set in 1899 America.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/header.jpg?t=1759502961'),
  (6, 1, 'hogwarts-legacy', 'Hogwarts Legacy', 'An open-world action RPG set in the wizarding world.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/990080/be2971b1023bccb04f993887d70ef4d2060262cf/header.jpg?t=1790708992'),
  (7, 5, 'forza-horizon-5', 'Forza Horizon 5', 'Explore the open roads and festivals of a vibrant Mexico.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/header.jpg?t=1788546569'),
  (8, 9, 'ea-sports-fc-25', 'EA SPORTS FC 25', 'Build your squad and compete in the world''s game.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2669320/ec3fb7747fd8080ef53d7686e0d98c5abe1f51f1/header.jpg?t=1788548615'),
  (9, 1, 'baldurs-gate-3', 'Baldur''s Gate 3', 'Gather a party and shape a story-rich fantasy adventure.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/48a2fcbda8565bb45025e98fd8ebde8a7203f6a0/header.jpg?t=1777363040'),
  (10, 1, 'the-witcher-3-wild-hunt', 'The Witcher 3: Wild Hunt', 'Hunt monsters and follow an epic story across a vast fantasy world.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/4b5b1ba5061b8a992cc69ac58b4245434edb4296/header.jpg?t=1793900434'),
  (11, 3, 'helldivers-2', 'HELLDIVERS 2', 'Join a squad-based fight to defend Super Earth.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/850e2f9e5bb15c5706bb9a1edc832f4f782e8be5/header.jpg?t=1793395133'),
  (12, 3, 'resident-evil-4', 'Resident Evil 4', 'Survive a rescue mission in a reimagined action-horror classic.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2050650/header.jpg?t=1772502922')
ON DUPLICATE KEY UPDATE
  category_id = VALUES(category_id),
  slug = VALUES(slug),
  name = VALUES(name),
  description = VALUES(description),
  image_url = VALUES(image_url);

-- Demo accounts are intentionally unable to sign in; seeded reviews are not customer feedback.
INSERT IGNORE INTO users (name, email, password_hash) VALUES
  ('Demo Player One', 'demo-player-one@example.invalid', '!disabled-demo-account!'),
  ('Demo Player Two', 'demo-player-two@example.invalid', '!disabled-demo-account!'),
  ('Demo Player Three', 'demo-player-three@example.invalid', '!disabled-demo-account!');

INSERT IGNORE INTO product_reviews (product_id, user_id, rating, review_text, is_demo)
SELECT p.id, u.id, demo.rating, demo.review_text, 1
FROM (
  SELECT 'cyberpunk-2077' AS product_slug, 'demo-player-one@example.invalid' AS user_email,
         4 AS rating, 'Demo review: Night City is packed with memorable places to explore.' AS review_text
  UNION ALL
  SELECT 'minecraft', 'demo-player-two@example.invalid', 5,
         'Demo review: Building and exploring make this a fun sandbox to revisit.'
  UNION ALL
  SELECT 'grand-theft-auto-v', 'demo-player-three@example.invalid', 4,
         'Demo review: The open-world missions give this sample plenty to talk about.'
  UNION ALL
  SELECT 'red-dead-redemption-2', 'demo-player-one@example.invalid', 5,
         'Demo review: The story and detailed world make a strong first impression.'
  UNION ALL
  SELECT 'elden-ring', 'demo-player-two@example.invalid', 5,
         'Demo review: Discovering new paths and challenges is rewarding.'
  UNION ALL
  SELECT 'baldurs-gate-3', 'demo-player-three@example.invalid', 5,
         'Demo review: The choices and party interactions make each run feel distinct.'
) AS demo
JOIN products p ON p.slug = demo.product_slug
JOIN users u ON u.email = demo.user_email;

INSERT IGNORE INTO sellers (id, display_name) VALUES
  (1, 'Pixel Vault'),
  (2, 'Northstar Digital'),
  (3, 'GameHub Direct');

INSERT INTO offers (id, product_id, seller_id, platform_id, region_id, price, regular_price, currency) VALUES
  (1, 1, 1, 1, 1, 24.99, 39.99, 'EUR'),
  (2, 1, 2, 1, 2, 22.50, 34.99, 'EUR'),
  (3, 1, 3, 2, 2, 34.99, 49.99, 'EUR'),
  (4, 2, 1, 1, 2, 19.50, 24.99, 'EUR'),
  (5, 2, 3, 3, 1, 21.75, 29.99, 'EUR'),
  (6, 3, 2, 1, 1, 39.99, 49.99, 'EUR'),
  (7, 3, 3, 2, 1, 44.50, 59.99, 'EUR'),
  (8, 4, 1, 1, 2, 14.75, 29.99, 'EUR'),
  (9, 4, 2, 3, 2, 18.00, 24.99, 'EUR'),
  (10, 5, 1, 1, 1, 18.99, 29.99, 'EUR'),
  (11, 5, 2, 2, 2, 24.99, 34.99, 'EUR'),
  (12, 6, 2, 1, 2, 16.49, 24.99, 'EUR'),
  (13, 6, 3, 2, 1, 21.99, 29.99, 'EUR'),
  (14, 7, 1, 1, 1, 22.99, 34.99, 'EUR'),
  (15, 7, 3, 3, 3, 27.99, 39.99, 'EUR'),
  (16, 8, 2, 1, 2, 12.99, 19.99, 'EUR'),
  (17, 8, 1, 2, 1, 17.99, 24.99, 'EUR'),
  (18, 9, 3, 1, 2, 14.99, 24.99, 'EUR'),
  (19, 9, 2, 3, 2, 19.99, 29.99, 'EUR'),
  (20, 10, 1, 1, 1, 10.99, 19.99, 'EUR'),
  (21, 10, 3, 2, 3, 14.99, 22.99, 'EUR'),
  (22, 11, 2, 1, 2, 8.99, 14.99, 'EUR'),
  (23, 11, 3, 3, 2, 13.99, 19.99, 'EUR'),
  (24, 12, 1, 1, 1, 17.99, 29.99, 'EUR'),
  (25, 12, 2, 2, 2, 22.99, 34.99, 'EUR')
ON DUPLICATE KEY UPDATE
  price = VALUES(price),
  regular_price = VALUES(regular_price),
  currency = VALUES(currency);

INSERT INTO homepage_sections (id, slug, title, subtitle, cta_label, cta_url, sort_order) VALUES
  (1, 'hero', 'Find your next game', 'Discover original worlds and great marketplace offers.', 'Explore games', '/store', 0),
  (2, 'best-sellers', 'Best sellers', 'Player favourites, ready to explore.', 'See all games', '/store', 1),
  (3, 'deals', 'Special deals', 'Fresh offers across the marketplace.', 'Explore deals', '/store', 2),
  (4, 'trending', 'Trending games', 'See what players are discovering now.', 'See trending games', '/store', 3),
  (5, 'popular-categories', 'Popular categories', 'Find your next game by genre.', 'Browse categories', '/store', 4),
  (6, 'popular-platforms', 'Shop by platform', 'Explore games available for your device.', 'Browse platforms', '/store', 5),
  (7, 'new-arrivals', 'New arrivals', 'Fresh additions to the marketplace.', 'See new arrivals', '/store', 6),
  (8, 'popular-games', 'Recommended for you', 'A few favorites to get you started.', 'Browse popular games', '/store', 7)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  cta_label = VALUES(cta_label),
  cta_url = VALUES(cta_url),
  sort_order = VALUES(sort_order);

INSERT INTO homepage_banners (id, slug, title, subtitle, image_url, cta_label, cta_url, sort_order) VALUES
  (1, 'neon-frontier', 'Big stories. Better prices.', 'Explore open worlds and fresh marketplace offers.', 'https://store.akamai.steamstatic.com/images/storepagebackground/app/271590?t=1765387725', 'Explore best sellers', '/store?sort=popular', 1),
  (2, 'mythic-realms', 'Find your next legend', 'Discover unforgettable adventures for every kind of player.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/990080/7632cad333d97c16732658710b35010a2e165413/page_bg_raw.jpg?t=1790708992', 'Explore adventures', '/store', 2),
  (3, 'high-speed-futures', 'Make every lap count', 'Find your next race, then take on the open road.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/page_bg_raw.jpg?t=1788546569', 'Browse racing games', '/store?platform=pc', 3),
  (4, 'wildwood-discovery', 'Start a new adventure', 'Ride out into a world of stories and discovery.', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/page_bg_raw.jpg?t=1759502961', 'See new arrivals', '/store', 4)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  image_url = VALUES(image_url),
  cta_label = VALUES(cta_label),
  cta_url = VALUES(cta_url),
  sort_order = VALUES(sort_order);

INSERT INTO homepage_section_products (section_id, product_id, sort_order) VALUES
  (2, 1, 1),
  (2, 3, 2),
  (2, 4, 3),
  (2, 5, 4),
  (2, 6, 5),
  (2, 7, 6),
  (2, 9, 7),
  (2, 10, 8),
  (2, 12, 9),
  (3, 1, 1),
  (3, 2, 2),
  (3, 4, 3),
  (3, 5, 4),
  (3, 7, 5),
  (3, 8, 6),
  (3, 10, 7),
  (3, 11, 8),
  (4, 3, 1),
  (4, 5, 2),
  (4, 6, 3),
  (4, 7, 4),
  (4, 8, 5),
  (4, 9, 6),
  (4, 10, 7),
  (4, 11, 8),
  (4, 12, 9),
  (7, 5, 1),
  (7, 6, 2),
  (7, 7, 3),
  (7, 8, 4),
  (7, 9, 5),
  (7, 10, 6),
  (7, 11, 7),
  (7, 12, 8),
  (8, 2, 1),
  (8, 3, 2),
  (8, 5, 3),
  (8, 6, 4),
  (8, 8, 5),
  (8, 9, 6),
  (8, 10, 7),
  (8, 11, 8),
  (8, 12, 9)
ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order);

INSERT IGNORE INTO digital_keys (id, offer_id, key_value, key_hash) VALUES
  (1, 1, 'TEST-ONLY-NOT-REDEEMABLE-001', SHA2('TEST-ONLY-NOT-REDEEMABLE-001', 256)),
  (2, 1, 'TEST-ONLY-NOT-REDEEMABLE-002', SHA2('TEST-ONLY-NOT-REDEEMABLE-002', 256));

INSERT IGNORE INTO digital_keys (offer_id, key_value, key_hash)
SELECT o.id,
       CONCAT('TEST-ONLY-NOT-REDEEMABLE-OFFER-', o.id, suffix.key_suffix),
       SHA2(CONCAT('TEST-ONLY-NOT-REDEEMABLE-OFFER-', o.id, suffix.key_suffix), 256)
FROM offers o
CROSS JOIN (
    SELECT '-A' AS key_suffix
    UNION ALL SELECT '-B'
) AS suffix
WHERE o.active = 1;

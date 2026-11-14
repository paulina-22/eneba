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

INSERT INTO steam_app_mappings (product_id, steam_app_id, store_url) VALUES
  (1, 1091500, 'https://store.steampowered.com/app/1091500/'),
  (3, 1245620, 'https://store.steampowered.com/app/1245620/'),
  (4, 271590, 'https://store.steampowered.com/app/271590/'),
  (5, 1174180, 'https://store.steampowered.com/app/1174180/'),
  (6, 990080, 'https://store.steampowered.com/app/990080/'),
  (7, 1551360, 'https://store.steampowered.com/app/1551360/'),
  (8, 2669320, 'https://store.steampowered.com/app/2669320/'),
  (9, 1086940, 'https://store.steampowered.com/app/1086940/'),
  (10, 292030, 'https://store.steampowered.com/app/292030/'),
  (11, 553850, 'https://store.steampowered.com/app/553850/'),
  (12, 2050650, 'https://store.steampowered.com/app/2050650/')
ON DUPLICATE KEY UPDATE
  steam_app_id = VALUES(steam_app_id),
  store_url = VALUES(store_url),
  verified_at = CURRENT_TIMESTAMP;

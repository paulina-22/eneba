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

-- These accounts are intentionally unable to sign in; their rows only identify demo content.
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

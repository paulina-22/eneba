ALTER TABLE offers
  ADD COLUMN regular_price DECIMAL(10, 2) NULL AFTER price;

ALTER TABLE homepage_sections
  ADD COLUMN cta_label VARCHAR(80) NOT NULL DEFAULT 'Explore games',
  ADD COLUMN cta_url VARCHAR(250) NOT NULL DEFAULT '/store';

-- Add two conspicuously synthetic, non-redeemable checkout keys to offers without stock.
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

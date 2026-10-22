USE xura_lab;

CREATE TABLE IF NOT EXISTS promo_codes (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `discount_type` ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  `discount_value` DECIMAL(10, 2) UNSIGNED NOT NULL,
  `min_order_amount` DECIMAL(10, 2) UNSIGNED NOT NULL DEFAULT 0.00,
  `max_discount_amount` DECIMAL(10, 2) UNSIGNED NULL,
  `usage_limit` INT UNSIGNED NULL,
  `used_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `expires_at` TIMESTAMP NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promo_codes_code` (`code`),
  KEY `idx_promo_codes_active` (`is_active`, `expires_at`)
);

ALTER TABLE orders
  ADD COLUMN `promo_code` VARCHAR(50) NULL AFTER `order_note`,
  ADD COLUMN `discount_amount` DECIMAL(10, 2) UNSIGNED NOT NULL DEFAULT 0.00 AFTER `promo_code`;

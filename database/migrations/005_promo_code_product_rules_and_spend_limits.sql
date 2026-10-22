USE xura_lab;

ALTER TABLE promo_codes
  ADD COLUMN `applies_to` ENUM('all', 'specific') NOT NULL DEFAULT 'all' AFTER `discount_value`,
  ADD COLUMN `max_order_amount` DECIMAL(10, 2) UNSIGNED NULL AFTER `min_order_amount`;

CREATE TABLE IF NOT EXISTS promo_code_products (
  `promo_code_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`promo_code_id`, `product_id`),
  CONSTRAINT `fk_pcp_promo_code` FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pcp_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
);

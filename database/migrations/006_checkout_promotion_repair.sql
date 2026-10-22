-- Run against the existing application database. Safe to run more than once.
-- Repairs the checkout additions from migrations 004 and 005 without reseeding data.

CREATE TABLE IF NOT EXISTS promo_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10, 2) UNSIGNED NOT NULL,
  applies_to ENUM('all', 'specific') NOT NULL DEFAULT 'all',
  min_order_amount DECIMAL(10, 2) UNSIGNED NOT NULL DEFAULT 0.00,
  max_order_amount DECIMAL(10, 2) UNSIGNED NULL,
  max_discount_amount DECIMAL(10, 2) UNSIGNED NULL,
  usage_limit INT UNSIGNED NULL,
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_promo_codes_code (code),
  KEY idx_promo_codes_active (is_active, expires_at)
) ENGINE=InnoDB;

SET @xura_checkout_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'promo_code'),
  'SELECT 1',
  'ALTER TABLE orders ADD COLUMN promo_code VARCHAR(50) NULL'
);
PREPARE xura_checkout_statement FROM @xura_checkout_sql;
EXECUTE xura_checkout_statement;
DEALLOCATE PREPARE xura_checkout_statement;

SET @xura_checkout_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'discount_amount'),
  'SELECT 1',
  'ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10, 2) UNSIGNED NOT NULL DEFAULT 0.00'
);
PREPARE xura_checkout_statement FROM @xura_checkout_sql;
EXECUTE xura_checkout_statement;
DEALLOCATE PREPARE xura_checkout_statement;

SET @xura_checkout_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'promo_codes' AND column_name = 'applies_to'),
  'SELECT 1',
  'ALTER TABLE promo_codes ADD COLUMN applies_to ENUM(''all'', ''specific'') NOT NULL DEFAULT ''all'''
);
PREPARE xura_checkout_statement FROM @xura_checkout_sql;
EXECUTE xura_checkout_statement;
DEALLOCATE PREPARE xura_checkout_statement;

SET @xura_checkout_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'promo_codes' AND column_name = 'max_order_amount'),
  'SELECT 1',
  'ALTER TABLE promo_codes ADD COLUMN max_order_amount DECIMAL(10, 2) UNSIGNED NULL'
);
PREPARE xura_checkout_statement FROM @xura_checkout_sql;
EXECUTE xura_checkout_statement;
DEALLOCATE PREPARE xura_checkout_statement;

-- Migration 004 originally omitted AUTO_INCREMENT on the promo-code primary key.
SET @xura_checkout_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'promo_codes'
      AND column_name = 'id' AND extra LIKE '%auto_increment%'),
  'SELECT 1',
  'ALTER TABLE promo_codes MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT'
);
PREPARE xura_checkout_statement FROM @xura_checkout_sql;
EXECUTE xura_checkout_statement;
DEALLOCATE PREPARE xura_checkout_statement;

CREATE TABLE IF NOT EXISTS promo_code_products (
  promo_code_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (promo_code_id, product_id),
  CONSTRAINT fk_pcp_promo_code FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
  CONSTRAINT fk_pcp_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

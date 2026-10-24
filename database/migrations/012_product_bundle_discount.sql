-- Migration 012: Add bundle_discount_percent to products
-- Safe and idempotent to run multiple times.

SET @xura_sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'bundle_discount_percent'
  ),
  'SELECT 1',
  'ALTER TABLE products ADD COLUMN bundle_discount_percent INT UNSIGNED NOT NULL DEFAULT 10 AFTER bundle_items'
);
PREPARE xura_statement FROM @xura_sql;
EXECUTE xura_statement;
DEALLOCATE PREPARE xura_statement;

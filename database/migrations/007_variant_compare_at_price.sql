-- Migration 007: Add compare_at_price (cut-off / original strikethrough price) to product_variants and products.
-- Safe and idempotent to run multiple times.

SET @xura_sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'product_variants' AND column_name = 'compare_at_price'
  ),
  'SELECT 1',
  'ALTER TABLE product_variants ADD COLUMN compare_at_price DECIMAL(10, 2) UNSIGNED NULL AFTER price'
);
PREPARE xura_statement FROM @xura_sql;
EXECUTE xura_statement;
DEALLOCATE PREPARE xura_statement;

SET @xura_sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'compare_at_price'
  ),
  'SELECT 1',
  'ALTER TABLE products ADD COLUMN compare_at_price DECIMAL(10, 2) UNSIGNED NULL AFTER price'
);
PREPARE xura_statement FROM @xura_sql;
EXECUTE xura_statement;
DEALLOCATE PREPARE xura_statement;

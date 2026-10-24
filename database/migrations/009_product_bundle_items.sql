-- Migration 009: Add bundle_items to products and bundle_details to order_items.
-- Safe and idempotent to run multiple times.

SET @xura_sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'bundle_items'
  ),
  'SELECT 1',
  'ALTER TABLE products ADD COLUMN bundle_items JSON NULL AFTER best_for'
);
PREPARE xura_statement FROM @xura_sql;
EXECUTE xura_statement;
DEALLOCATE PREPARE xura_statement;

SET @xura_sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'bundle_details'
  ),
  'SELECT 1',
  'ALTER TABLE order_items ADD COLUMN bundle_details VARCHAR(255) NULL AFTER concentration_percent'
);
PREPARE xura_statement FROM @xura_sql;
EXECUTE xura_statement;
DEALLOCATE PREPARE xura_statement;

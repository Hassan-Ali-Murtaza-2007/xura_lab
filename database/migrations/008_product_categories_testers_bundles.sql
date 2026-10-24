-- Migration 008: Expand products.gender ENUM to include 'Testers' and 'Bundles'.
-- Safe and idempotent to run multiple times.

SET @xura_sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'products'
      AND column_name = 'gender'
      AND column_type LIKE '%Testers%'
  ),
  'SELECT 1',
  'ALTER TABLE products MODIFY COLUMN gender ENUM(\'Men\', \'Women\', \'Unisex\', \'Testers\', \'Bundles\') NOT NULL DEFAULT \'Unisex\''
);
PREPARE xura_statement FROM @xura_sql;
EXECUTE xura_statement;
DEALLOCATE PREPARE xura_statement;

-- Migration 013: Add payment_receipt_url, payment_bank, and transaction_id to orders
-- Safe and idempotent to run multiple times.

SET @xura_sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_receipt_url'
  ),
  'SELECT 1',
  'ALTER TABLE orders ADD COLUMN payment_receipt_url VARCHAR(255) NULL AFTER payment_method'
);
PREPARE xura_statement FROM @xura_sql;
EXECUTE xura_statement;
DEALLOCATE PREPARE xura_statement;

SET @xura_sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_bank'
  ),
  'SELECT 1',
  'ALTER TABLE orders ADD COLUMN payment_bank VARCHAR(60) NULL AFTER payment_receipt_url'
);
PREPARE xura_statement FROM @xura_sql;
EXECUTE xura_statement;
DEALLOCATE PREPARE xura_statement;

SET @xura_sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'transaction_id'
  ),
  'SELECT 1',
  'ALTER TABLE orders ADD COLUMN transaction_id VARCHAR(100) NULL AFTER payment_bank'
);
PREPARE xura_statement FROM @xura_sql;
EXECUTE xura_statement;
DEALLOCATE PREPARE xura_statement;

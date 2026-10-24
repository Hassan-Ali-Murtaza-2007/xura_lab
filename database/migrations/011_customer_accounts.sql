-- Migration 011: Create customers table for shopper login and account management.
CREATE TABLE IF NOT EXISTS customers (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `phone` VARCHAR(40) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customers_email` (`email`)
);

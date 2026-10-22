CREATE DATABASE IF NOT EXISTS xura_lab
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE xura_lab;

CREATE TABLE IF NOT EXISTS products (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(80) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `tagline` VARCHAR(255) NOT NULL,
  `gender` ENUM('Men', 'Women', 'Unisex') NOT NULL,
  `volume_ml` SMALLINT UNSIGNED NOT NULL,
  `price` DECIMAL(10, 2) UNSIGNED NOT NULL,
  `image_url` VARCHAR(255) NOT NULL,
  `lead` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `notes` VARCHAR(255) NOT NULL,
  `character` VARCHAR(255) NOT NULL,
  `best_for` VARCHAR(255) NOT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_slug` (`slug`),
  KEY `idx_products_active_sort` (`is_active`, `sort_order`)
);

CREATE TABLE IF NOT EXISTS orders (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_name` VARCHAR(160) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `phone` VARCHAR(40) NOT NULL,
  `delivery_address` TEXT NOT NULL,
  `first_name` VARCHAR(80) NOT NULL,
  `last_name` VARCHAR(80) NOT NULL,
  `company` VARCHAR(160) NULL,
  `country_code` CHAR(2) NOT NULL DEFAULT 'PK',
  `address_line1` VARCHAR(255) NOT NULL,
  `address_line2` VARCHAR(255) NULL,
  `city` VARCHAR(120) NOT NULL,
  `province` VARCHAR(120) NOT NULL,
  `postal_code` VARCHAR(24) NULL,
  `shipping_method` VARCHAR(60) NOT NULL DEFAULT 'standard',
  `payment_method` ENUM('cash-on-delivery', 'bank-transfer', 'card') NOT NULL,
  `billing_same_as_shipping` BOOLEAN NOT NULL DEFAULT TRUE,
  `billing_address` JSON NULL,
  `marketing_consent` BOOLEAN NOT NULL DEFAULT FALSE,
  `order_note` TEXT NULL,
  `promo_code` VARCHAR(50) NULL,
  `discount_amount` DECIMAL(10, 2) UNSIGNED NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(10, 2) UNSIGNED NOT NULL,
  `delivery_fee` DECIMAL(10, 2) UNSIGNED NOT NULL DEFAULT 370.00,
  `total` DECIMAL(10, 2) UNSIGNED NOT NULL,
  `status` ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_status_created` (`status`, `created_at`),
  KEY `idx_orders_phone` (`phone`),
  KEY `idx_orders_email` (`email`)
);

CREATE TABLE IF NOT EXISTS product_variants (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `concentration_percent` SMALLINT UNSIGNED NOT NULL,
  `price` DECIMAL(10, 2) UNSIGNED NOT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_variant_concentration` (`product_id`, `concentration_percent`),
  KEY `idx_product_variants_active_sort` (`product_id`, `is_active`, `sort_order`),
  CONSTRAINT `fk_product_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_images (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `image_url` VARCHAR(255) NOT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product_images_sort` (`product_id`, `sort_order`),
  CONSTRAINT `fk_product_images_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `variant_id` BIGINT UNSIGNED NULL,
  `product_name` VARCHAR(120) NOT NULL,
  `concentration_percent` SMALLINT UNSIGNED NULL,
  `unit_price` DECIMAL(10, 2) UNSIGNED NOT NULL,
  `quantity` SMALLINT UNSIGNED NOT NULL,
  `line_total` DECIMAL(10, 2) UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `fk_order_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`)
);

CREATE TABLE IF NOT EXISTS promo_codes (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `discount_type` ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  `discount_value` DECIMAL(10, 2) UNSIGNED NOT NULL,
  `applies_to` ENUM('all', 'specific') NOT NULL DEFAULT 'all',
  `min_order_amount` DECIMAL(10, 2) UNSIGNED NOT NULL DEFAULT 0.00,
  `max_order_amount` DECIMAL(10, 2) UNSIGNED NULL,
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

CREATE TABLE IF NOT EXISTS promo_code_products (
  `promo_code_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`promo_code_id`, `product_id`),
  CONSTRAINT `fk_pcp_promo_code` FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pcp_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
);

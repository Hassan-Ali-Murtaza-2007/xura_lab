USE xura_lab;

ALTER TABLE orders
  ADD COLUMN email VARCHAR(254) NOT NULL DEFAULT '' AFTER customer_name,
  ADD COLUMN first_name VARCHAR(80) NOT NULL DEFAULT '' AFTER delivery_address,
  ADD COLUMN last_name VARCHAR(80) NOT NULL DEFAULT '' AFTER first_name,
  ADD COLUMN company VARCHAR(160) NULL AFTER last_name,
  ADD COLUMN country_code CHAR(2) NOT NULL DEFAULT 'PK' AFTER company,
  ADD COLUMN address_line1 VARCHAR(255) NOT NULL DEFAULT '' AFTER country_code,
  ADD COLUMN address_line2 VARCHAR(255) NULL AFTER address_line1,
  ADD COLUMN city VARCHAR(120) NOT NULL DEFAULT '' AFTER address_line2,
  ADD COLUMN province VARCHAR(120) NOT NULL DEFAULT '' AFTER city,
  ADD COLUMN postal_code VARCHAR(24) NULL AFTER province,
  ADD COLUMN shipping_method VARCHAR(60) NOT NULL DEFAULT 'standard' AFTER postal_code,
  ADD COLUMN billing_same_as_shipping BOOLEAN NOT NULL DEFAULT TRUE AFTER payment_method,
  ADD COLUMN billing_address JSON NULL AFTER billing_same_as_shipping,
  ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT FALSE AFTER billing_address,
  ADD COLUMN order_note TEXT NULL AFTER marketing_consent,
  ADD KEY idx_orders_email (email);

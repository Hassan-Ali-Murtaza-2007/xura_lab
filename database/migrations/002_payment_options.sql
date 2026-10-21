USE xura_lab;

ALTER TABLE orders
  MODIFY COLUMN payment_method ENUM('cash-on-delivery', 'bank-transfer', 'card') NOT NULL;

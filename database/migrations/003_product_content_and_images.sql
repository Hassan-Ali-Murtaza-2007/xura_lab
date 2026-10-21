USE xura_lab;

ALTER TABLE products
  ADD COLUMN lead VARCHAR(255) NULL AFTER image_url,
  ADD COLUMN description TEXT NULL AFTER lead,
  ADD COLUMN notes VARCHAR(255) NULL AFTER description,
  ADD COLUMN character VARCHAR(255) NULL AFTER notes,
  ADD COLUMN best_for VARCHAR(255) NULL AFTER character;

UPDATE products
SET
  lead = COALESCE(lead, tagline),
  description = COALESCE(description, tagline),
  notes = COALESCE(notes, 'Fragrance notes coming soon'),
  character = COALESCE(character, 'Distinctive, considered, memorable'),
  best_for = COALESCE(best_for, 'Everyday expression');

ALTER TABLE products
  MODIFY lead VARCHAR(255) NOT NULL,
  MODIFY description TEXT NOT NULL,
  MODIFY notes VARCHAR(255) NOT NULL,
  MODIFY character VARCHAR(255) NOT NULL,
  MODIFY best_for VARCHAR(255) NOT NULL;

CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_images_sort (product_id, sort_order),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

INSERT INTO product_images (product_id, image_url, sort_order)
SELECT id, image_url, 1 FROM products
WHERE NOT EXISTS (
  SELECT 1 FROM product_images WHERE product_images.product_id = products.id
);

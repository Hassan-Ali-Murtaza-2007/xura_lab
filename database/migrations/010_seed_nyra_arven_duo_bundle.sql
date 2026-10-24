-- Migration 010: Seed default Nyra & Arven Duo Bundle
INSERT INTO products (
  slug, name, tagline, gender, volume_ml, price, compare_at_price, image_url,
  `lead`, description, notes, `character`, best_for, bundle_items, sort_order, is_active
)
SELECT
  'duo-nyra-arven',
  'Nyra & Arven Duo Bundle',
  'Two signature fragrances in one bespoke collection.',
  'Bundles',
  50,
  5400,
  6000,
  '/uploads/products/1792572733109-f084f6b4-1034-46d3-92d2-a26c3987537c.jpg',
  'Luminous white florals meet commanding oud.',
  'The Nyra & Arven Duo pairs contrasting profiles for a complete day-to-night fragrance wardrobe. Select your preferred concentration for both Nyra and Arven individually to tailor the set to your personal wear style.',
  'Nyra: White florals, coffee, vanilla · Arven: Oud, spices, leather, amber',
  'Layered, contrasting, bespoke',
  'Day-to-night styling, signature layering, luxury gifting',
  '[{"name": "Nyra", "tagline": "Luminous white florals, roasted coffee & vanilla", "volumeMl": 50, "concentrations": [10, 20, 40], "defaultConcentration": 20}, {"name": "Arven", "tagline": "Rich oud, warm amber & refined leather", "volumeMl": 50, "concentrations": [10, 20, 40], "defaultConcentration": 10}]',
  4,
  1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'duo-nyra-arven');

SET @bundle_id = (SELECT id FROM products WHERE slug = 'duo-nyra-arven' LIMIT 1);

INSERT INTO product_variants (product_id, concentration_percent, price, compare_at_price, sort_order, is_active)
SELECT @bundle_id, 10, 4500, 5000, 1, 1
WHERE @bundle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_variants WHERE product_id = @bundle_id AND concentration_percent = 10);

INSERT INTO product_variants (product_id, concentration_percent, price, compare_at_price, sort_order, is_active)
SELECT @bundle_id, 20, 5400, 6000, 2, 1
WHERE @bundle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_variants WHERE product_id = @bundle_id AND concentration_percent = 20);

INSERT INTO product_variants (product_id, concentration_percent, price, compare_at_price, sort_order, is_active)
SELECT @bundle_id, 40, 8100, 9000, 3, 1
WHERE @bundle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_variants WHERE product_id = @bundle_id AND concentration_percent = 40);

INSERT INTO product_images (product_id, image_url, sort_order)
SELECT @bundle_id, '/uploads/products/1792572733109-f084f6b4-1034-46d3-92d2-a26c3987537c.jpg', 1
WHERE @bundle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = @bundle_id AND sort_order = 1);

INSERT INTO product_images (product_id, image_url, sort_order)
SELECT @bundle_id, '/uploads/products/1792572651339-45637ccd-3137-4667-8937-bd78d652fee3.jpg', 2
WHERE @bundle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = @bundle_id AND sort_order = 2);

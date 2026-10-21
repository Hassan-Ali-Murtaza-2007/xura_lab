import "dotenv/config";
import { catalogue } from "./catalog.js";
import { getPool } from "./db.js";

const pool = getPool();
if (!pool) {
  throw new Error("Set DB_HOST, DB_USER, and DB_NAME in apps/api/.env before seeding.");
}

for (const product of catalogue) {
  await pool.query(
    `INSERT INTO products (
       id, slug, name, tagline, gender, volume_ml, price, image_url,
       lead, description, notes, character, best_for, sort_order, is_active
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE
       slug = VALUES(slug),
       name = VALUES(name),
       tagline = VALUES(tagline),
       gender = VALUES(gender),
       volume_ml = VALUES(volume_ml),
       price = VALUES(price),
       image_url = VALUES(image_url),
       lead = VALUES(lead),
       description = VALUES(description),
       notes = VALUES(notes),
       character = VALUES(character),
       best_for = VALUES(best_for),
       sort_order = VALUES(sort_order),
       is_active = TRUE`,
    [
      product.id,
      product.slug,
      product.name,
      product.tagline,
      product.gender,
      product.volumeMl,
      product.price,
      product.imageUrl,
      product.lead,
      product.description,
      product.notes,
      product.character,
      product.bestFor,
      product.sortOrder
    ]
  );

  await pool.query("DELETE FROM product_images WHERE product_id = ?", [product.id]);
  for (const [index, imageUrl] of (product.images || [product.imageUrl]).entries()) {
    await pool.query(
      "INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)",
      [product.id, imageUrl, index + 1]
    );
  }

  for (const variant of product.variants) {
    await pool.query(
      `INSERT INTO product_variants (id, product_id, concentration_percent, price, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE
         product_id = VALUES(product_id),
         concentration_percent = VALUES(concentration_percent),
         price = VALUES(price),
         sort_order = VALUES(sort_order),
         is_active = TRUE`,
      [variant.id, product.id, variant.concentrationPercent, variant.price, variant.sortOrder]
    );
  }
}

console.log(`Seeded ${catalogue.length} Xura Lab products.`);
await pool.end();

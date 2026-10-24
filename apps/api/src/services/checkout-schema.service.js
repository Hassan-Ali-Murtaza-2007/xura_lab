import { readFile } from "node:fs/promises";

const migrationFiles = [
  new URL("../../../../database/migrations/006_checkout_promotion_repair.sql", import.meta.url),
  new URL("../../../../database/migrations/007_variant_compare_at_price.sql", import.meta.url),
  new URL("../../../../database/migrations/008_product_categories_testers_bundles.sql", import.meta.url),
  new URL("../../../../database/migrations/009_product_bundle_items.sql", import.meta.url),
  new URL("../../../../database/migrations/011_customer_accounts.sql", import.meta.url),
  new URL("../../../../database/migrations/012_product_bundle_discount.sql", import.meta.url),
  new URL("../../../../database/migrations/013_order_advance_payment_receipt.sql", import.meta.url)
];

export async function repairCheckoutSchema(connection) {
  for (const file of migrationFiles) {
    const sql = await readFile(file, "utf8");
    // These fixed migrations have no delimiters or semicolons inside string literals.
    const statements = sql
      .replace(/^\s*--.*$/gm, "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      // PREPARE and session variables must all use the same connection.
      await connection.query(statement);
    }
  }
}

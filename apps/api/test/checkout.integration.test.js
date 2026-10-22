import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import mysql from "mysql2/promise";
import { getPool } from "../src/db.js";
import { repairCheckoutSchema } from "../src/services/checkout-schema.service.js";

const sqlStatements = (sql) => sql.replace(/^\s*--.*$/gm, "").split(";").map((statement) => statement.trim()).filter(Boolean);

test("checkout schema repair restores real orders and preserves existing data", async (t) => {
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST), "Checkout integration tests require a local MySQL server.");
  const database = `xura_checkout_test_${randomBytes(6).toString("hex")}`;
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || ""
  });
  let pool;
  let server;
  let createdDatabase = false;
  try {
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    createdDatabase = true;
    await admin.query(`USE \`${database}\``);
    const schema = await readFile(new URL("../../../database/schema.sql", import.meta.url), "utf8");
    for (const statement of sqlStatements(schema)) {
      if (!/^(CREATE DATABASE|USE\s)/i.test(statement)) await admin.query(statement);
    }
    await admin.query("INSERT INTO products SET ?", {
      id: 1, slug: "checkout-fixture", name: "Checkout fixture", tagline: "Test fragrance",
      gender: "Unisex", volume_ml: 50, price: 2500, image_url: "/fixture.png",
      lead: "Test", description: "Test", notes: "Test", character: "Test", best_for: "Test"
    });
    await admin.query("INSERT INTO product_variants (id, product_id, concentration_percent, price) VALUES (101, 1, 10, 2500)");

    // Reproduce a deployment where the API was updated but migrations 004/005 were missed.
    await admin.query("DROP TABLE promo_code_products");
    await admin.query("DROP TABLE promo_codes");
    await admin.query("ALTER TABLE orders DROP COLUMN promo_code, DROP COLUMN discount_amount");

    process.env.DB_NAME = database;
    pool = getPool();
    const { default: app } = await import("../src/app.js");
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const order = {
      email: "checkout-test@example.invalid", phone: "03000000000",
      shippingAddress: {
        firstName: "Checkout", lastName: "Test", countryCode: "PK",
        address1: "1 Test Street", city: "Lahore", province: "Punjab"
      },
      shippingMethod: "standard", paymentMethod: "bank-transfer", billingSameAsShipping: true,
      items: [{ productId: 1, variantId: 101, quantity: 1 }]
    };
    const placeOrder = async (overrides = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/orders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...order, ...overrides })
      });
      return { status: response.status, body: await response.json() };
    };

    await t.test("missing promotion columns reproduce the shopper's exact error without a promo code", async () => {
      const result = await placeOrder();
      assert.equal(result.status, 500);
      assert.equal(result.body.message, "The order could not be saved. Please try again.");
      const [[row]] = await admin.query("SELECT COUNT(*) AS count FROM orders");
      assert.equal(Number(row.count), 0);
    });

    await repairCheckoutSchema(admin);

    for (const [paymentMethod, deliveryFee] of [["bank-transfer", 0], ["card", 0], ["cash-on-delivery", 370]]) {
      await t.test(`${paymentMethod} saves the order and line items after repair`, async () => {
        const result = await placeOrder({ paymentMethod });
        assert.equal(result.status, 201);
        assert.equal(result.body.total, 2500 + deliveryFee);
        const [[stored]] = await admin.query("SELECT payment_method, total FROM orders WHERE id = ?", [result.body.orderId]);
        assert.equal(stored.payment_method, paymentMethod);
        assert.equal(Number(stored.total), result.body.total);
        const [items] = await admin.query("SELECT product_id, variant_id, quantity, line_total FROM order_items WHERE order_id = ?", [result.body.orderId]);
        assert.equal(items.length, 1);
        assert.equal(Number(items[0].variant_id), 101);
        assert.equal(Number(items[0].line_total), 2500);
      });
    }

    await t.test("a promo code can be created and used after repair", async () => {
      await admin.query("INSERT INTO promo_codes (code, discount_type, discount_value) VALUES ('CHECKOUT100', 'fixed', 100)");
      const result = await placeOrder({ promoCode: "CHECKOUT100" });
      assert.equal(result.status, 201);
      assert.equal(result.body.discountAmount, 100);
      assert.equal(result.body.total, 2400);
      const [[promo]] = await admin.query("SELECT used_count FROM promo_codes WHERE code = 'CHECKOUT100'");
      assert.equal(promo.used_count, 1);
    });

    await t.test("reapplying the repair preserves orders, order items, products, and promo usage", async () => {
      const snapshot = async () => {
        const result = {};
        for (const table of ["orders", "order_items", "products", "product_variants", "promo_codes"]) {
          const [rows] = await admin.query(`SELECT * FROM \`${table}\` ORDER BY id`);
          result[table] = rows;
        }
        return result;
      };
      const before = await snapshot();
      await repairCheckoutSchema(admin);
      assert.deepEqual(await snapshot(), before);
    });

    await t.test("an existing migration-004/005 promo table is upgraded without losing codes", async () => {
      await admin.query("DROP TABLE promo_code_products");
      await admin.query("DROP TABLE promo_codes");
      const migration004 = await readFile(new URL("../../../database/migrations/004_promo_codes_and_discounts.sql", import.meta.url), "utf8");
      const createPromoTable = sqlStatements(migration004).find((statement) => /^CREATE TABLE/i.test(statement));
      await admin.query(createPromoTable);
      const migration005 = await readFile(new URL("../../../database/migrations/005_promo_code_product_rules_and_spend_limits.sql", import.meta.url), "utf8");
      for (const statement of sqlStatements(migration005)) {
        if (!/^USE\s/i.test(statement)) await admin.query(statement);
      }
      await admin.query("INSERT INTO promo_codes (id, code, discount_value) VALUES (7, 'PRESERVED', 10)");
      await repairCheckoutSchema(admin);
      const [[preserved]] = await admin.query("SELECT code FROM promo_codes WHERE id = 7");
      assert.equal(preserved.code, "PRESERVED");
      const [inserted] = await admin.query("INSERT INTO promo_codes (code, discount_value) VALUES ('NEWCODE', 10)");
      assert.ok(inserted.insertId > 7);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (pool) await pool.end();
    // Only the randomly named database created above can be removed here.
    if (createdDatabase && /^xura_checkout_test_[a-f0-9]{12}$/.test(database)) {
      await admin.query(`DROP DATABASE \`${database}\``);
    }
    await admin.end();
  }
});

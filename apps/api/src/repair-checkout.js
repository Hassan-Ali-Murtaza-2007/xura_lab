import { getPool } from "./db.js";
import { repairCheckoutSchema } from "./services/checkout-schema.service.js";

const pool = getPool();
if (!pool) {
  console.error("Set DB_HOST, DB_USER, and DB_NAME for the application database before repairing checkout.");
  process.exitCode = 1;
} else {
  let connection;
  try {
    connection = await pool.getConnection();
    await repairCheckoutSchema(connection);
    console.log("Checkout promotion schema is ready. Existing products, orders, and promo codes have been preserved.");
  } catch (error) {
    console.error("Checkout schema repair failed:", error.code || "", error.message);
    process.exitCode = 1;
  } finally {
    connection?.release();
    await pool.end();
  }
}

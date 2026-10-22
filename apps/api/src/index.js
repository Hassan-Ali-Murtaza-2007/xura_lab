import app from "./app.js";
import { port } from "./config/index.js";
import { getPool } from "./db.js";
import { repairCheckoutSchema } from "./services/checkout-schema.service.js";

const pool = getPool();
if (pool) {
  try {
    const connection = await pool.getConnection();
    try {
      await repairCheckoutSchema(connection);
      console.log("Checkout promotion schema is ready. Existing products, orders, and promo codes have been preserved.");
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Checkout schema startup check warning:", error.code || "", error.message);
  }
}

app.listen(port, () => {
  console.log(`Xura Lab API listening on http://localhost:${port}`);
});


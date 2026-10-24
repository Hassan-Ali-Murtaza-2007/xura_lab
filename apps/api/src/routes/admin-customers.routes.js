import { Router } from "express";
import { getPool } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/customers", requireAdmin, async (request, response) => {
  response.set("Cache-Control", "no-store");
  const pool = getPool();
  const search = String(request.query.search || "").trim().toLowerCase();
  const filter = String(request.query.filter || "all").trim().toLowerCase();

  if (!pool) {
    return response.json({
      customers: [],
      stats: { totalCustomers: 0, gmailCustomers: 0, customersWithOrders: 0, totalRevenue: 0 }
    });
  }

  try {
    const [statsRows] = await pool.query(`
      SELECT
        COUNT(*) AS totalCustomers,
        COALESCE(SUM(LOWER(email) LIKE '%@gmail.com'), 0) AS gmailCustomers
      FROM customers
    `);
    const totalCustomers = Number(statsRows[0]?.totalCustomers || 0);
    const gmailCustomers = Number(statsRows[0]?.gmailCustomers || 0);

    let whereClause = "1=1";
    const params = [];

    if (search) {
      whereClause += " AND (LOWER(c.name) LIKE ? OR LOWER(c.email) LIKE ? OR c.phone LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    if (filter === "gmail") {
      whereClause += " AND LOWER(c.email) LIKE '%@gmail.com'";
    }

    let havingClause = "";
    if (filter === "orders") {
      havingClause = "HAVING orderCount > 0";
    }

    const query = `
      SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,
        COUNT(o.id) AS orderCount,
        COALESCE(SUM(o.total), 0) AS totalSpent,
        MAX(o.created_at) AS lastOrderAt
      FROM customers c
      LEFT JOIN orders o ON LOWER(o.email) = LOWER(c.email)
      WHERE ${whereClause}
      GROUP BY c.id, c.name, c.email, c.phone, c.created_at, c.updated_at
      ${havingClause}
      ORDER BY c.created_at DESC
    `;

    const [rows] = await pool.query(query, params);

    const customersWithOrdersCount = rows.filter((c) => Number(c.orderCount) > 0).length;
    const totalRevenue = rows.reduce((acc, c) => acc + Number(c.totalSpent || 0), 0);

    const formatted = rows.map((row) => {
      const email = String(row.email || "").toLowerCase();
      const isGmail = email.endsWith("@gmail.com");
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone || null,
        isGmail,
        provider: isGmail ? "Gmail" : email.split("@")[1] || "Email",
        orderCount: Number(row.orderCount || 0),
        totalSpent: Number(row.totalSpent || 0),
        lastOrderAt: row.lastOrderAt || null,
        createdAt: row.createdAt
      };
    });

    response.json({
      customers: formatted,
      stats: {
        totalCustomers,
        gmailCustomers,
        customersWithOrders: customersWithOrdersCount,
        totalRevenue
      }
    });
  } catch (error) {
    response.status(500).json({
      message: "Unable to retrieve customers.",
      detail: error.message
    });
  }
});

router.get("/customers/:id", requireAdmin, async (request, response) => {
  response.set("Cache-Control", "no-store");
  const customerId = Number(request.params.id);
  if (!Number.isInteger(customerId) || customerId < 1) {
    return response.status(400).json({ message: "Invalid customer identifier." });
  }

  const pool = getPool();
  if (!pool) {
    return response.status(404).json({ message: "Customer not found." });
  }

  try {
    const [customerRows] = await pool.query(
      "SELECT id, name, email, phone, created_at AS createdAt, updated_at AS updatedAt FROM customers WHERE id = ? LIMIT 1",
      [customerId]
    );

    if (!customerRows.length) {
      return response.status(404).json({ message: "Customer not found." });
    }

    const customer = customerRows[0];
    const isGmail = String(customer.email || "").toLowerCase().endsWith("@gmail.com");

    const [orders] = await pool.query(
      `SELECT id, total, status, payment_method AS paymentMethod, created_at AS createdAt, delivery_address AS deliveryAddress
       FROM orders
       WHERE LOWER(email) = LOWER(?)
       ORDER BY created_at DESC`,
      [customer.email]
    );

    response.json({
      customer: {
        ...customer,
        isGmail,
        orders,
        orderCount: orders.length,
        totalSpent: orders.reduce((sum, o) => sum + Number(o.total || 0), 0)
      }
    });
  } catch (error) {
    response.status(500).json({ message: "Unable to load customer details.", detail: error.message });
  }
});

export default router;

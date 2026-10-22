import { Router, json } from "express";
import { getPool } from "../db.js";
import { getLocalOrders, getLocalOrderById, updateLocalOrderStatus } from "../local-order-store.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/orders", requireAdmin, async (request, response) => {
  response.set("Cache-Control", "no-store");
  const { search = "", status = "", paymentMethod = "" } = request.query;
  const pool = getPool();

  if (!pool) {
    const orders = await getLocalOrders({ search, status, paymentMethod });
    const allOrders = await getLocalOrders();
    const stats = {
      totalOrders: allOrders.length,
      pendingOrders: allOrders.filter((o) => o.status === "pending").length,
      deliveredOrders: allOrders.filter((o) => o.status === "delivered").length,
      revenue: allOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    };
    return response.json({
      source: "local",
      orders,
      stats
    });
  }

  try {
    let whereClauses = [];
    let queryParams = [];

    if (status && status !== "all") {
      whereClauses.push("o.status = ?");
      queryParams.push(status);
    }

    if (paymentMethod && paymentMethod !== "all") {
      whereClauses.push("o.payment_method = ?");
      queryParams.push(paymentMethod);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push(
        "(o.id LIKE ? OR o.customer_name LIKE ? OR o.email LIKE ? OR o.phone LIKE ? OR o.city LIKE ?)"
      );
      queryParams.push(term, term, term, term, term);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT o.id, o.customer_name AS customerName, o.email, o.phone, o.city, o.delivery_address AS deliveryAddress,
              o.shipping_method AS shippingMethod, o.payment_method AS paymentMethod, o.order_note AS orderNote,
              o.promo_code AS promoCode, o.discount_amount AS discountAmount,
              o.subtotal, o.delivery_fee AS deliveryFee, o.total, o.status, o.created_at AS createdAt
       FROM orders o
       ${whereSql}
       ORDER BY o.created_at DESC`,
      queryParams
    );

    const [statsResult] = await pool.query(
      `SELECT COUNT(*) AS totalOrders,
              COALESCE(SUM(status = 'pending'), 0) AS pendingOrders,
              COALESCE(SUM(status = 'delivered'), 0) AS deliveredOrders,
              COALESCE(SUM(total), 0) AS revenue
       FROM orders`
    );

    const statsRow = statsResult[0] || {};
    const stats = {
      totalOrders: Number(statsRow.totalOrders || 0),
      pendingOrders: Number(statsRow.pendingOrders || 0),
      deliveredOrders: Number(statsRow.deliveredOrders || 0),
      revenue: Number(statsRow.revenue || 0)
    };

    const orderIds = rows.map((r) => r.id);
    let itemsByOrderId = new Map();
    if (orderIds.length) {
      const placeholders = orderIds.map(() => "?").join(",");
      const [itemRows] = await pool.query(
        `SELECT id, order_id AS orderId, product_id AS productId, product_name AS productName,
                concentration_percent AS concentrationPercent, unit_price AS unitPrice, quantity, line_total AS lineTotal
         FROM order_items WHERE order_id IN (${placeholders})`,
        orderIds
      );
      for (const item of itemRows) {
        if (!itemsByOrderId.has(item.orderId)) itemsByOrderId.set(item.orderId, []);
        itemsByOrderId.get(item.orderId).push(item);
      }
    }

    const orders = rows.map((order) => ({
      ...order,
      items: itemsByOrderId.get(order.id) || []
    }));

    response.json({
      source: "mysql",
      orders,
      stats
    });
  } catch (error) {
    response.status(503).json({ message: "Orders are temporarily unavailable.", detail: error.message });
  }
});

router.get("/orders/:id", requireAdmin, async (request, response) => {
  response.set("Cache-Control", "no-store");
  const orderId = Number(request.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return response.status(400).json({ message: "Invalid order identifier." });
  }

  const pool = getPool();
  if (!pool) {
    const order = await getLocalOrderById(orderId);
    return order
      ? response.json({ order, source: "local" })
      : response.status(404).json({ message: "Order not found." });
  }

  try {
    const [orders] = await pool.query(
      `SELECT o.id, o.customer_name AS customerName, o.email, o.phone, o.delivery_address AS deliveryAddress,
              o.first_name AS firstName, o.last_name AS lastName, o.company, o.country_code AS countryCode,
              o.address_line1 AS addressLine1, o.address_line2 AS addressLine2, o.city, o.province, o.postal_code AS postalCode,
              o.shipping_method AS shippingMethod, o.payment_method AS paymentMethod, o.billing_same_as_shipping AS billingSameAsShipping,
              o.billing_address AS billingAddress, o.marketing_consent AS marketingConsent, o.order_note AS orderNote,
              o.promo_code AS promoCode, o.discount_amount AS discountAmount,
              o.subtotal, o.delivery_fee AS deliveryFee, o.total, o.status, o.created_at AS createdAt, o.updated_at AS updatedAt
       FROM orders o WHERE o.id = ? LIMIT 1`,
      [orderId]
    );

    if (!orders.length) return response.status(404).json({ message: "Order not found." });
    const order = orders[0];

    const [items] = await pool.query(
      `SELECT id, order_id AS orderId, product_id AS productId, product_name AS productName,
              concentration_percent AS concentrationPercent, unit_price AS unitPrice, quantity, line_total AS lineTotal
       FROM order_items WHERE order_id = ?`,
      [orderId]
    );

    response.json({
      source: "mysql",
      order: {
        ...order,
        items
      }
    });
  } catch (error) {
    response.status(503).json({ message: "Order details could not be loaded.", detail: error.message });
  }
});

router.patch("/orders/:id/status", requireAdmin, json(), async (request, response) => {
  const orderId = Number(request.params.id);
  const { status } = request.body || {};
  const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

  if (!validStatuses.includes(status)) {
    return response.status(400).json({ message: `Status must be one of: ${validStatuses.join(", ")}` });
  }

  const pool = getPool();
  if (!pool) {
    const updated = await updateLocalOrderStatus(orderId, status);
    if (!updated) return response.status(404).json({ message: "Order not found." });
    return response.json({
      message: `Order #${orderId} marked as ${status}.`,
      order: updated
    });
  }

  try {
    const [result] = await pool.query("UPDATE orders SET status = ? WHERE id = ?", [status, orderId]);
    if (result.affectedRows === 0) return response.status(404).json({ message: "Order not found." });
    response.json({
      message: `Order #${orderId} marked as ${status}.`,
      orderId,
      status
    });
  } catch (error) {
    response.status(500).json({ message: "Unable to update order status.", detail: error.message });
  }
});

export default router;

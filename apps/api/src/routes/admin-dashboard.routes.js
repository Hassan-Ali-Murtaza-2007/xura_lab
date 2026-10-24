import { Router } from "express";
import { getPool } from "../db.js";
import { getLocalCatalogue } from "../local-product-store.js";
import { getLocalOrders } from "../local-order-store.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/dashboard", requireAdmin, async (request, response) => {
  response.set("Cache-Control", "no-store");
  const pool = getPool();
  if (!pool) {
    const localProducts = await getLocalCatalogue();
    const allOrders = await getLocalOrders();
    const pendingOrders = allOrders.filter((o) => o.status === "pending").length;
    const revenue = allOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    return response.json({
      source: "local",
      admin: { email: request.admin.email },
      stats: {
        totalProducts: localProducts.length,
        totalOrders: allOrders.length,
        pendingOrders,
        revenue,
        totalCustomers: 0,
        gmailCustomers: 0
      },
      recentOrders: allOrders.slice(0, 10).map((o) => ({
        id: o.id,
        customerName: o.customerName,
        email: o.email,
        paymentMethod: o.paymentMethod,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt
      })),
      recentCustomers: [],
      products: localProducts.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        gender: product.gender,
        imageUrl: product.imageUrl,
        variantCount: product.variants?.length || 0,
        startingPrice: Math.min(...(product.variants || []).map((variant) => variant.price)),
        compareAtPrice: product.compareAtPrice || null,
        isActive: product.isActive !== false
      }))
    });
  }

  try {
    const [
      productStatsResult,
      orderStatsResult,
      recentOrdersResult,
      productsResult,
      promoStatsResult,
      customerStatsResult,
      recentCustomersResult
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS totalProducts FROM products WHERE is_active = TRUE"),
      pool.query(`SELECT COUNT(*) AS totalOrders,
                         COALESCE(SUM(status = 'pending'), 0) AS pendingOrders,
                         COALESCE(SUM(total), 0) AS revenue
                  FROM orders`),
      pool.query(`SELECT id, customer_name AS customerName, email, payment_method AS paymentMethod,
                         total, status, created_at AS createdAt
                  FROM orders ORDER BY created_at DESC LIMIT 10`),
      pool.query(`SELECT p.id, p.slug, p.name, p.gender, p.image_url AS imageUrl, p.is_active AS isActive,
                         COUNT(pv.id) AS variantCount, COALESCE(MIN(pv.price), p.price) AS startingPrice,
                         p.compare_at_price AS compareAtPrice
                  FROM products p
                  LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
                  WHERE p.is_active = TRUE
                  GROUP BY p.id, p.slug, p.name, p.gender, p.image_url, p.is_active, p.price, p.compare_at_price
                  ORDER BY p.sort_order ASC, p.id ASC`),
      pool.query(`SELECT COUNT(*) AS totalPromos,
                         COALESCE(SUM(is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())), 0) AS activePromos
                  FROM promo_codes`).catch(() => [[{ totalPromos: 0, activePromos: 0 }]]),
      pool.query(`SELECT COUNT(*) AS totalCustomers,
                         COALESCE(SUM(LOWER(email) LIKE '%@gmail.com'), 0) AS gmailCustomers
                  FROM customers`).catch(() => [[{ totalCustomers: 0, gmailCustomers: 0 }]]),
      pool.query(`SELECT c.id, c.name, c.email, c.phone, c.created_at AS createdAt,
                         COUNT(o.id) AS orderCount,
                         COALESCE(SUM(o.total), 0) AS totalSpent
                  FROM customers c
                  LEFT JOIN orders o ON LOWER(o.email) = LOWER(c.email)
                  GROUP BY c.id, c.name, c.email, c.phone, c.created_at
                  ORDER BY c.created_at DESC LIMIT 6`).catch(() => [[]])
    ]);
    const productStats = productStatsResult[0][0] || {};
    const orderStats = orderStatsResult[0][0] || {};
    const promoStats = promoStatsResult?.[0]?.[0] || {};
    const customerStats = customerStatsResult?.[0]?.[0] || {};
    const recentOrders = recentOrdersResult[0] || [];
    const recentCustomers = (recentCustomersResult[0] || []).map((c) => ({
      ...c,
      isGmail: String(c.email || "").toLowerCase().endsWith("@gmail.com"),
      orderCount: Number(c.orderCount || 0),
      totalSpent: Number(c.totalSpent || 0)
    }));
    const products = productsResult[0];
    response.json({
      source: "mysql",
      admin: { email: request.admin.email },
      stats: {
        totalProducts: Number(productStats.totalProducts || 0),
        totalOrders: Number(orderStats.totalOrders || 0),
        pendingOrders: Number(orderStats.pendingOrders || 0),
        revenue: Number(orderStats.revenue || 0),
        totalPromos: Number(promoStats.totalPromos || 0),
        activePromos: Number(promoStats.activePromos || 0),
        totalCustomers: Number(customerStats.totalCustomers || 0),
        gmailCustomers: Number(customerStats.gmailCustomers || 0)
      },
      recentOrders,
      recentCustomers,
      products
    });
  } catch (error) {
    response
      .status(503)
      .json({ message: "Admin data is temporarily unavailable.", detail: error.message });
  }
});

export default router;

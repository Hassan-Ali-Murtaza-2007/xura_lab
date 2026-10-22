import { Router } from "express";
import { getPool } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { getLocalCatalogue } from "../local-product-store.js";
import {
  createLocalPromo,
  deleteLocalPromo,
  getLocalPromos,
  toggleLocalPromoActive,
  updateLocalPromo
} from "../services/local-promo-store.js";

const router = Router();

function validatePromoInput(body) {
  const code = String(body.code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");

  if (!code || code.length < 2 || code.length > 50) {
    throw Object.assign(new Error("Promo code must be 2 to 50 characters (letters, numbers, hyphens)."), {
      statusCode: 400
    });
  }

  const discountType = body.discountType === "fixed" ? "fixed" : "percentage";
  const discountValue = Number(body.discountValue);

  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw Object.assign(new Error("Discount value must be greater than zero."), { statusCode: 400 });
  }

  if (discountType === "percentage" && (discountValue < 1 || discountValue > 100)) {
    throw Object.assign(new Error("Percentage discount must be between 1% and 100%."), { statusCode: 400 });
  }

  const appliesTo = body.appliesTo === "specific" ? "specific" : "all";
  let applicableProductIds = [];
  if (appliesTo === "specific") {
    if (!Array.isArray(body.applicableProductIds) || !body.applicableProductIds.length) {
      throw Object.assign(new Error("Please select at least one fragrance product for this promo code."), {
        statusCode: 400
      });
    }
    applicableProductIds = [...new Set(body.applicableProductIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!applicableProductIds.length) {
      throw Object.assign(new Error("Please select at least one valid fragrance product for this promo code."), {
        statusCode: 400
      });
    }
  }

  const minOrderAmount = Number(body.minOrderAmount || 0);
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
    throw Object.assign(new Error("Minimum spending amount must be 0 or greater."), { statusCode: 400 });
  }

  let maxOrderAmount = null;
  if (body.maxOrderAmount !== undefined && body.maxOrderAmount !== null && body.maxOrderAmount !== "") {
    maxOrderAmount = Number(body.maxOrderAmount);
    if (!Number.isFinite(maxOrderAmount) || maxOrderAmount <= 0) {
      throw Object.assign(new Error("Maximum spending amount must be greater than zero."), { statusCode: 400 });
    }
    if (maxOrderAmount < minOrderAmount) {
      throw Object.assign(new Error("Maximum spending amount cannot be less than minimum spending amount."), {
        statusCode: 400
      });
    }
  }

  let maxDiscountAmount = null;
  if (body.maxDiscountAmount !== undefined && body.maxDiscountAmount !== null && body.maxDiscountAmount !== "") {
    maxDiscountAmount = Number(body.maxDiscountAmount);
    if (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount <= 0) {
      throw Object.assign(new Error("Maximum discount cap must be greater than zero."), { statusCode: 400 });
    }
  }

  let usageLimit = null;
  if (body.usageLimit !== undefined && body.usageLimit !== null && body.usageLimit !== "") {
    usageLimit = Number(body.usageLimit);
    if (!Number.isInteger(usageLimit) || usageLimit <= 0) {
      throw Object.assign(new Error("Usage limit must be a positive whole number."), { statusCode: 400 });
    }
  }

  let expiresAt = null;
  if (body.expiresAt) {
    const parsed = new Date(body.expiresAt);
    if (isNaN(parsed.getTime())) {
      throw Object.assign(new Error("Expiration date is invalid."), { statusCode: 400 });
    }
    expiresAt = parsed.toISOString();
  }

  const isActive = body.isActive !== false;

  return {
    code,
    discountType,
    discountValue,
    appliesTo,
    applicableProductIds,
    minOrderAmount,
    maxOrderAmount,
    maxDiscountAmount,
    usageLimit,
    expiresAt,
    isActive
  };
}

router.get("/promos", requireAdmin, async (request, response) => {
  response.set("Cache-Control", "no-store");
  const pool = getPool();
  const { search = "", status = "" } = request.query;

  if (!pool) {
    let promos = await getLocalPromos();
    const now = new Date();

    if (search.trim()) {
      const term = search.trim().toUpperCase();
      promos = promos.filter((p) => p.code.includes(term));
    }
    if (status === "active") {
      promos = promos.filter((p) => p.isActive && (!p.expiresAt || new Date(p.expiresAt) > now));
    } else if (status === "inactive") {
      promos = promos.filter((p) => !p.isActive);
    } else if (status === "expired") {
      promos = promos.filter((p) => p.expiresAt && new Date(p.expiresAt) <= now);
    }

    const all = await getLocalPromos();
    const stats = {
      total: all.length,
      active: all.filter((p) => p.isActive && (!p.expiresAt || new Date(p.expiresAt) > now)).length,
      usedCount: all.reduce((sum, p) => sum + (Number(p.usedCount) || 0), 0)
    };

    const allProducts = await getLocalCatalogue();
    const enrichedPromos = promos.map((p) => ({
      ...p,
      appliesTo: p.appliesTo || "all",
      applicableProductIds: p.applicableProductIds || [],
      applicableProducts: allProducts
        .filter((prod) => (p.applicableProductIds || []).includes(prod.id))
        .map((prod) => ({ id: prod.id, name: prod.name }))
    }));

    return response.json({ promos: enrichedPromos, stats, source: "local" });
  }

  try {
    let whereClauses = [];
    let queryParams = [];

    if (search && search.trim()) {
      whereClauses.push("code LIKE ?");
      queryParams.push(`%${search.trim().toUpperCase()}%`);
    }

    if (status === "active") {
      whereClauses.push("is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())");
    } else if (status === "inactive") {
      whereClauses.push("is_active = FALSE");
    } else if (status === "expired") {
      whereClauses.push("expires_at IS NOT NULL AND expires_at <= NOW()");
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT id, code, discount_type AS discountType, discount_value AS discountValue,
              applies_to AS appliesTo, min_order_amount AS minOrderAmount,
              max_order_amount AS maxOrderAmount, max_discount_amount AS maxDiscountAmount,
              usage_limit AS usageLimit, used_count AS usedCount, expires_at AS expiresAt,
              is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
       FROM promo_codes
       ${whereSql}
       ORDER BY created_at DESC`,
      queryParams
    );

    const [statsResult] = await pool.query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())), 0) AS active,
              COALESCE(SUM(used_count), 0) AS usedCount
       FROM promo_codes`
    );

    const statsRow = statsResult[0] || {};
    const stats = {
      total: Number(statsRow.total || 0),
      active: Number(statsRow.active || 0),
      usedCount: Number(statsRow.usedCount || 0)
    };

    let productsByPromo = new Map();
    if (rows.length) {
      const promoIds = rows.map((r) => r.id);
      const placeholders = promoIds.map(() => "?").join(",");
      const [mappingRows] = await pool.query(
        `SELECT pcp.promo_code_id AS promoCodeId, pcp.product_id AS productId, p.name AS productName
         FROM promo_code_products pcp
         INNER JOIN products p ON p.id = pcp.product_id
         WHERE pcp.promo_code_id IN (${placeholders})`,
        promoIds
      );
      for (const m of mappingRows) {
        const list = productsByPromo.get(m.promoCodeId) || [];
        list.push({ id: m.productId, name: m.productName });
        productsByPromo.set(m.promoCodeId, list);
      }
    }

    response.json({
      promos: rows.map((r) => {
        const products = productsByPromo.get(r.id) || [];
        return {
          ...r,
          discountValue: Number(r.discountValue),
          minOrderAmount: Number(r.minOrderAmount),
          maxOrderAmount: r.maxOrderAmount ? Number(r.maxOrderAmount) : null,
          maxDiscountAmount: r.maxDiscountAmount ? Number(r.maxDiscountAmount) : null,
          isActive: Boolean(r.isActive),
          appliesTo: r.appliesTo || "all",
          applicableProductIds: products.map((p) => p.id),
          applicableProducts: products
        };
      }),
      stats,
      source: "mysql"
    });
  } catch (error) {
    response.status(503).json({ message: "Promo codes unavailable.", detail: error.message });
  }
});

router.post("/promos", requireAdmin, async (request, response) => {
  try {
    const input = validatePromoInput(request.body || {});
    const pool = getPool();

    if (!pool) {
      const created = await createLocalPromo(input);
      return response.status(201).json({ message: `Promo code "${created.code}" created.`, promo: created });
    }

    const [existing] = await pool.query("SELECT id FROM promo_codes WHERE code = ? LIMIT 1", [input.code]);
    if (existing.length) {
      return response.status(409).json({ message: `Promo code "${input.code}" already exists.` });
    }

    const [result] = await pool.query(
      `INSERT INTO promo_codes (
         code, discount_type, discount_value, applies_to, min_order_amount,
         max_order_amount, max_discount_amount, usage_limit, expires_at, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.code,
        input.discountType,
        input.discountValue,
        input.appliesTo,
        input.minOrderAmount,
        input.maxOrderAmount,
        input.maxDiscountAmount,
        input.usageLimit,
        input.expiresAt ? new Date(input.expiresAt) : null,
        input.isActive
      ]
    );

    if (input.appliesTo === "specific" && input.applicableProductIds.length) {
      const values = input.applicableProductIds.map((pId) => [result.insertId, pId]);
      await pool.query(
        `INSERT INTO promo_code_products (promo_code_id, product_id) VALUES ?`,
        [values]
      );
    }

    response.status(201).json({
      message: `Promo code "${input.code}" created successfully.`,
      promo: {
        id: result.insertId,
        ...input,
        usedCount: 0
      }
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.put("/promos/:id", requireAdmin, async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ message: "Invalid promo code identifier." });
  }

  try {
    const input = validatePromoInput(request.body || {});
    const pool = getPool();

    if (!pool) {
      const updated = await updateLocalPromo(id, input);
      if (!updated) return response.status(404).json({ message: "Promo code not found." });
      return response.json({ message: `Promo code "${updated.code}" updated.`, promo: updated });
    }

    const [existing] = await pool.query("SELECT id FROM promo_codes WHERE code = ? AND id != ? LIMIT 1", [
      input.code,
      id
    ]);
    if (existing.length) {
      return response.status(409).json({ message: `Another promo with code "${input.code}" already exists.` });
    }

    const [result] = await pool.query(
      `UPDATE promo_codes SET
         code = ?, discount_type = ?, discount_value = ?, applies_to = ?, min_order_amount = ?,
         max_order_amount = ?, max_discount_amount = ?, usage_limit = ?, expires_at = ?, is_active = ?
       WHERE id = ?`,
      [
        input.code,
        input.discountType,
        input.discountValue,
        input.appliesTo,
        input.minOrderAmount,
        input.maxOrderAmount,
        input.maxDiscountAmount,
        input.usageLimit,
        input.expiresAt ? new Date(input.expiresAt) : null,
        input.isActive,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return response.status(404).json({ message: "Promo code not found." });
    }

    await pool.query(`DELETE FROM promo_code_products WHERE promo_code_id = ?`, [id]);
    if (input.appliesTo === "specific" && input.applicableProductIds.length) {
      const values = input.applicableProductIds.map((pId) => [id, pId]);
      await pool.query(
        `INSERT INTO promo_code_products (promo_code_id, product_id) VALUES ?`,
        [values]
      );
    }

    response.json({
      message: `Promo code "${input.code}" updated successfully.`,
      promo: { id, ...input }
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.patch("/promos/:id/toggle", requireAdmin, async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ message: "Invalid promo code identifier." });
  }

  const pool = getPool();
  if (!pool) {
    const updated = await toggleLocalPromoActive(id);
    if (!updated) return response.status(404).json({ message: "Promo code not found." });
    return response.json({
      message: `Promo code "${updated.code}" is now ${updated.isActive ? "active" : "inactive"}.`,
      promo: updated
    });
  }

  try {
    const [rows] = await pool.query("SELECT id, code, is_active FROM promo_codes WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) return response.status(404).json({ message: "Promo code not found." });

    const newStatus = !rows[0].is_active;
    await pool.query("UPDATE promo_codes SET is_active = ? WHERE id = ?", [newStatus, id]);

    response.json({
      message: `Promo code "${rows[0].code}" is now ${newStatus ? "active" : "inactive"}.`,
      id,
      isActive: newStatus
    });
  } catch (error) {
    response.status(500).json({ message: "Unable to toggle status.", detail: error.message });
  }
});

router.delete("/promos/:id", requireAdmin, async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ message: "Invalid promo code identifier." });
  }

  const pool = getPool();
  if (!pool) {
    const deleted = await deleteLocalPromo(id);
    if (!deleted) return response.status(404).json({ message: "Promo code not found." });
    return response.json({ message: `Promo code "${deleted.code}" deleted.` });
  }

  try {
    const [result] = await pool.query("DELETE FROM promo_codes WHERE id = ?", [id]);
    if (result.affectedRows === 0) return response.status(404).json({ message: "Promo code not found." });
    response.json({ message: "Promo code deleted successfully." });
  } catch (error) {
    response.status(500).json({ message: "Unable to delete promo code.", detail: error.message });
  }
});

export default router;

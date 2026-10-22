import { Router } from "express";
import { allowedPaymentMethods } from "../config/index.js";
import { getPool, isDatabaseConfigured } from "../db.js";
import { getLocalCatalogue } from "../local-product-store.js";
import { createLocalOrder } from "../local-order-store.js";
import { getLocalPromoByCode, incrementLocalPromoUsage } from "../services/local-promo-store.js";
import { productImagesById } from "../services/image.service.js";
import { isCompleteAddress, normalizeAddress, withCurrentImage } from "../utils/validators.js";

const router = Router();

router.get("/health", async (_request, response) => {
  if (!isDatabaseConfigured()) {
    return response.json({ status: "ok", database: "not-configured" });
  }

  try {
    await getPool().query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    response.status(503).json({ status: "degraded", database: "unavailable", message: error.message });
  }
});

router.get("/products", async (_request, response) => {
  const pool = getPool();
  if (!pool) return response.json({ products: await getLocalCatalogue(), source: "local" });

  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        slug,
        name,
        tagline,
        gender,
        volume_ml AS volumeMl,
        price,
        image_url AS imageUrl,
        sort_order AS sortOrder,
        \`lead\`,
        description,
        notes,
        \`character\`,
        best_for AS bestFor
      FROM products
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, id ASC
    `);
    const [variantRows] = await pool.query(`
      SELECT
        id,
        product_id AS productId,
        concentration_percent AS concentrationPercent,
        price,
        sort_order AS sortOrder
      FROM product_variants
      WHERE is_active = TRUE
      ORDER BY product_id ASC, sort_order ASC, id ASC
    `);
    const variantsByProduct = new Map();
    for (const variant of variantRows) {
      const current = variantsByProduct.get(variant.productId) || [];
      current.push(variant);
      variantsByProduct.set(variant.productId, current);
    }
    const imagesByProduct = await productImagesById(pool, rows.map((product) => product.id));
    response.json({
      products: rows.map((product) =>
        withCurrentImage({
          ...product,
          variants: variantsByProduct.get(product.id) || [],
          images: imagesByProduct.get(product.id) || [product.imageUrl]
        })
      ),
      source: "mysql"
    });
  } catch (error) {
    response
      .status(503)
      .json({ message: "The product catalogue is temporarily unavailable.", detail: error.message });
  }
});

router.get("/products/:slug", async (request, response) => {
  const pool = getPool();
  if (!pool) {
    const localProduct = (await getLocalCatalogue()).find(
      (product) => product.slug === request.params.slug
    );
    return localProduct
      ? response.json({ product: localProduct, source: "local" })
      : response.status(404).json({ message: "Product not found." });
  }

  try {
    const [products] = await pool.query(
      `SELECT id, slug, name, tagline, gender, volume_ml AS volumeMl, price, image_url AS imageUrl,
              sort_order AS sortOrder, \`lead\`, description, notes, \`character\`, best_for AS bestFor
       FROM products WHERE slug = ? AND is_active = TRUE LIMIT 1`,
      [request.params.slug]
    );
    if (!products.length) return response.status(404).json({ message: "Product not found." });
    const product = products[0];
    const [variants] = await pool.query(
      `SELECT id, product_id AS productId, concentration_percent AS concentrationPercent, price, sort_order AS sortOrder
       FROM product_variants WHERE product_id = ? AND is_active = TRUE ORDER BY sort_order ASC, id ASC`,
      [product.id]
    );
    const imagesByProduct = await productImagesById(pool, [product.id]);
    response.json({
      product: withCurrentImage({
        ...product,
        variants,
        images: imagesByProduct.get(product.id) || [product.imageUrl]
      }),
      source: "mysql"
    });
  } catch (error) {
    response.status(503).json({ message: "The product is temporarily unavailable.", detail: error.message });
  }
});

async function evaluatePromoCode(code, subtotal, connectionOrPool, items = []) {
  if (!code || !String(code).trim()) return { promo: null, discountAmount: 0, eligibleSubtotal: 0 };
  const cleanCode = String(code).trim().toUpperCase();

  let promo = null;
  if (!connectionOrPool) {
    promo = await getLocalPromoByCode(cleanCode);
  } else {
    const [rows] = await connectionOrPool.query(
      `SELECT id, code, discount_type AS discountType, discount_value AS discountValue,
              applies_to AS appliesTo, min_order_amount AS minOrderAmount,
              max_order_amount AS maxOrderAmount, max_discount_amount AS maxDiscountAmount,
              usage_limit AS usageLimit, used_count AS usedCount, expires_at AS expiresAt,
              is_active AS isActive
       FROM promo_codes WHERE code = ? LIMIT 1`,
      [cleanCode]
    );
    if (rows.length) {
      const r = rows[0];
      let applicableProductIds = [];
      if (r.appliesTo === "specific") {
        const [pRows] = await connectionOrPool.query(
          `SELECT product_id AS productId FROM promo_code_products WHERE promo_code_id = ?`,
          [r.id]
        );
        applicableProductIds = pRows.map((pr) => pr.productId);
      }
      promo = {
        id: r.id,
        code: r.code,
        discountType: r.discountType,
        discountValue: Number(r.discountValue),
        appliesTo: r.appliesTo || "all",
        applicableProductIds,
        minOrderAmount: Number(r.minOrderAmount),
        maxOrderAmount: r.maxOrderAmount ? Number(r.maxOrderAmount) : null,
        maxDiscountAmount: r.maxDiscountAmount ? Number(r.maxDiscountAmount) : null,
        usageLimit: r.usageLimit ? Number(r.usageLimit) : null,
        usedCount: Number(r.usedCount || 0),
        expiresAt: r.expiresAt,
        isActive: Boolean(r.isActive)
      };
    }
  }

  if (!promo) {
    throw Object.assign(new Error(`Promo code "${cleanCode}" is invalid.`), { statusCode: 400 });
  }

  if (!promo.isActive) {
    throw Object.assign(new Error(`Promo code "${cleanCode}" is not active.`), { statusCode: 400 });
  }

  if (promo.expiresAt && new Date(promo.expiresAt) <= new Date()) {
    throw Object.assign(new Error(`Promo code "${cleanCode}" has expired.`), { statusCode: 400 });
  }

  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    throw Object.assign(new Error(`Promo code "${cleanCode}" usage limit has been reached.`), { statusCode: 400 });
  }

  // Determine eligible items and eligible subtotal
  let eligibleSubtotal = subtotal;
  if (promo.appliesTo === "specific") {
    const applicableIds = (promo.applicableProductIds || []).map(Number);
    const eligibleItems = (items || []).filter((item) => applicableIds.includes(Number(item.productId)));

    if (!eligibleItems.length) {
      throw Object.assign(
        new Error(`Promo code "${cleanCode}" is only applicable to selected fragrances that are not in your cart.`),
        { statusCode: 400 }
      );
    }

    eligibleSubtotal = eligibleItems.reduce((sum, item) => {
      const lineTotal = item.lineTotal !== undefined
        ? Number(item.lineTotal)
        : Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1);
      return sum + lineTotal;
    }, 0);
  }

  // Minimum spending check
  if (promo.minOrderAmount > 0 && subtotal < promo.minOrderAmount) {
    throw Object.assign(
      new Error(`Cart subtotal must be at least PKR ${promo.minOrderAmount.toLocaleString()} to use this code.`),
      { statusCode: 400 }
    );
  }

  // Maximum spending check
  if (promo.maxOrderAmount !== null && promo.maxOrderAmount > 0 && subtotal > promo.maxOrderAmount) {
    throw Object.assign(
      new Error(`Cart subtotal cannot exceed PKR ${promo.maxOrderAmount.toLocaleString()} to use this code.`),
      { statusCode: 400 }
    );
  }

  // Calculate discount only from eligible items sum
  let discountAmount = 0;
  if (promo.discountType === "percentage") {
    discountAmount = Math.round((eligibleSubtotal * promo.discountValue) / 100);
    if (promo.maxDiscountAmount && discountAmount > promo.maxDiscountAmount) {
      discountAmount = promo.maxDiscountAmount;
    }
  } else {
    discountAmount = Math.min(eligibleSubtotal, promo.discountValue);
  }

  return { promo, discountAmount, eligibleSubtotal };
}

router.post("/promo-codes/validate", async (request, response) => {
  const { code, subtotal = 0, items = [] } = request.body || {};
  if (!code || !String(code).trim()) {
    return response.status(400).json({ valid: false, message: "Please enter a promo code." });
  }

  const pool = getPool();
  try {
    const { promo, discountAmount, eligibleSubtotal } = await evaluatePromoCode(code, Number(subtotal), pool, items);
    response.json({
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount,
      appliesTo: promo.appliesTo,
      applicableProductIds: promo.applicableProductIds,
      minOrderAmount: promo.minOrderAmount,
      maxOrderAmount: promo.maxOrderAmount,
      eligibleSubtotal,
      message: `Promo code "${promo.code}" applied! You save PKR ${discountAmount.toLocaleString()}.`
    });
  } catch (error) {
    response.status(error.statusCode || 400).json({ valid: false, message: error.message });
  }
});

router.post("/orders", async (request, response) => {
  const {
    email,
    phone,
    marketingConsent = false,
    shippingAddress: rawShippingAddress,
    shippingMethod,
    paymentMethod,
    billingSameAsShipping = true,
    billingAddress: rawBillingAddress,
    orderNote,
    promoCode,
    items
  } = request.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase().slice(0, 254);
  const normalizedPhone = String(phone || "").trim().slice(0, 40);
  const shippingAddress = normalizeAddress(rawShippingAddress);
  const billingAddress = billingSameAsShipping ? null : normalizeAddress(rawBillingAddress);

  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedPhone.length < 7) {
    return response.status(400).json({ message: "A valid email address and phone number are required." });
  }
  if (!isCompleteAddress(shippingAddress) || (!billingSameAsShipping && !isCompleteAddress(billingAddress))) {
    return response.status(400).json({ message: "Complete delivery and billing address details are required." });
  }
  if (shippingAddress.countryCode !== "PK" || shippingMethod !== "standard") {
    return response.status(400).json({ message: "Please select an available Pakistan delivery method." });
  }
  if (!allowedPaymentMethods.has(paymentMethod)) {
    return response.status(400).json({ message: "Please select an available payment method." });
  }
  if (!Array.isArray(items) || !items.length) {
    return response.status(400).json({ message: "Your cart is empty." });
  }

  const normalizedItems = items
    .map((item) => ({
      productId: Number(item.productId),
      variantId: Number(item.variantId),
      quantity: Number(item.quantity)
    }))
    .filter(
      (item) =>
        Number.isInteger(item.productId) &&
        Number.isInteger(item.variantId) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 20
    );

  if (normalizedItems.length !== items.length) {
    return response.status(400).json({ message: "One or more cart items are invalid." });
  }

  const pool = getPool();
  if (!pool) {
    const localCatalogue = await getLocalCatalogue();
    const customerName = `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim();
    const deliveryAddress = [
      shippingAddress.company,
      shippingAddress.address1,
      shippingAddress.address2,
      shippingAddress.city,
      shippingAddress.province,
      shippingAddress.postalCode,
      shippingAddress.countryCode
    ]
      .filter(Boolean)
      .join(", ");

    const orderItems = [];
    let subtotal = 0;
    for (const item of normalizedItems) {
      const prod = localCatalogue.find((p) => Number(p.id) === item.productId);
      const variant = prod?.variants?.find((v) => Number(v.id) === item.variantId);
      if (!variant) {
        return response
          .status(409)
          .json({ message: "A fragrance concentration in your cart is no longer available." });
      }
      const unitPrice = Number(variant.price);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      orderItems.push({
        productId: item.productId,
        variantId: item.variantId,
        productName: prod.name,
        concentrationPercent: variant.concentrationPercent,
        unitPrice,
        quantity: item.quantity,
        lineTotal
      });
    }

    const isAdvance = paymentMethod === "bank-transfer" || paymentMethod === "card";
    const deliveryFee = isAdvance ? 0 : 370;
    const { promo, discountAmount } = await evaluatePromoCode(promoCode, subtotal, null, orderItems);
    const total = Math.max(0, subtotal - discountAmount) + deliveryFee;

    if (promo) {
      await incrementLocalPromoUsage(promo.code);
    }

    const createdOrder = await createLocalOrder({
      customerName,
      email: normalizedEmail,
      phone: normalizedPhone,
      deliveryAddress,
      firstName: shippingAddress.firstName,
      lastName: shippingAddress.lastName,
      company: shippingAddress.company || null,
      countryCode: shippingAddress.countryCode,
      addressLine1: shippingAddress.address1,
      addressLine2: shippingAddress.address2 || null,
      city: shippingAddress.city,
      province: shippingAddress.province,
      postalCode: shippingAddress.postalCode || null,
      shippingMethod,
      paymentMethod,
      billingSameAsShipping: Boolean(billingSameAsShipping),
      billingAddress: billingAddress || null,
      marketingConsent: Boolean(marketingConsent),
      orderNote: String(orderNote || "").trim().slice(0, 500) || null,
      promoCode: promo?.code || null,
      discountAmount,
      subtotal,
      deliveryFee,
      total,
      items: orderItems
    });

    return response.status(201).json({
      message: "Your order has been placed successfully.",
      orderId: createdOrder.id,
      subtotal,
      discountAmount,
      deliveryFee,
      total: createdOrder.total,
      promoCode: promo?.code || null
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const variantIds = [...new Set(normalizedItems.map((item) => item.variantId))];
    const placeholders = variantIds.map(() => "?").join(",");
    const [variants] = await connection.query(
      `SELECT
         pv.id AS variantId,
         pv.product_id AS productId,
         pv.concentration_percent AS concentrationPercent,
         pv.price,
         p.name
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       WHERE pv.is_active = TRUE AND p.is_active = TRUE AND pv.id IN (${placeholders})
       FOR SHARE`,
      variantIds
    );

    if (variants.length !== variantIds.length) {
      throw Object.assign(
        new Error("A fragrance concentration in your cart is no longer available."),
        { statusCode: 409 }
      );
    }

    const variantById = new Map(variants.map((variant) => [variant.variantId, variant]));
    const hasMismatchedProduct = normalizedItems.some(
      (item) => variantById.get(item.variantId)?.productId !== item.productId
    );
    if (hasMismatchedProduct) {
      throw Object.assign(new Error("A cart item does not match the selected fragrance."), {
        statusCode: 400
      });
    }

    const subtotal = normalizedItems.reduce(
      (total, item) => total + variantById.get(item.variantId).price * item.quantity,
      0
    );
    const isAdvance = paymentMethod === "bank-transfer" || paymentMethod === "card";
    const deliveryFee = isAdvance ? 0 : 370;

    const itemsForEvaluation = normalizedItems.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      price: variantById.get(item.variantId).price,
      lineTotal: variantById.get(item.variantId).price * item.quantity
    }));

    const { promo, discountAmount } = await evaluatePromoCode(promoCode, subtotal, connection, itemsForEvaluation);
    const total = Math.max(0, subtotal - discountAmount) + deliveryFee;

    const customerName = `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim();
    const deliveryAddress = [
      shippingAddress.company,
      shippingAddress.address1,
      shippingAddress.address2,
      shippingAddress.city,
      shippingAddress.province,
      shippingAddress.postalCode,
      shippingAddress.countryCode
    ]
      .filter(Boolean)
      .join(", ");
    const [orderResult] = await connection.query(
      `INSERT INTO orders (
         customer_name, email, phone, delivery_address, first_name, last_name, company,
         country_code, address_line1, address_line2, city, province, postal_code,
         shipping_method, payment_method, billing_same_as_shipping, billing_address,
         marketing_consent, order_note, promo_code, discount_amount, subtotal, delivery_fee, total, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        customerName,
        normalizedEmail,
        normalizedPhone,
        deliveryAddress,
        shippingAddress.firstName,
        shippingAddress.lastName,
        shippingAddress.company || null,
        shippingAddress.countryCode,
        shippingAddress.address1,
        shippingAddress.address2 || null,
        shippingAddress.city,
        shippingAddress.province,
        shippingAddress.postalCode || null,
        shippingMethod,
        paymentMethod,
        Boolean(billingSameAsShipping),
        billingAddress ? JSON.stringify(billingAddress) : null,
        Boolean(marketingConsent),
        String(orderNote || "").trim().slice(0, 500) || null,
        promo?.code || null,
        discountAmount,
        subtotal,
        deliveryFee,
        total
      ]
    );

    if (promo) {
      await connection.query(
        `UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?`,
        [promo.id]
      );
    }

    for (const item of normalizedItems) {
      const variant = variantById.get(item.variantId);
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_name, concentration_percent, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderResult.insertId,
          variant.productId,
          variant.variantId,
          variant.name,
          variant.concentrationPercent,
          variant.price,
          item.quantity,
          variant.price * item.quantity
        ]
      );
    }

    await connection.commit();
    response.status(201).json({
      message: "Your order has been placed successfully.",
      orderId: orderResult.insertId,
      subtotal,
      discountAmount,
      deliveryFee,
      total,
      promoCode: promo?.code || null
    });
  } catch (error) {
    await connection.rollback();
    console.error("Order creation failed:", {
      code: error.code,
      message: error.sqlMessage || error.message
    });
    response.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "The order could not be saved. Please try again."
    });
  } finally {
    connection.release();
  }
});

export default router;

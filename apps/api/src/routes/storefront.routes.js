import { Router } from "express";
import { allowedPaymentMethods } from "../config/index.js";
import { getPool, isDatabaseConfigured } from "../db.js";
import { getLocalCatalogue } from "../local-product-store.js";
import { createLocalOrder } from "../local-order-store.js";
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

    const deliveryFee = 370;
    const total = subtotal + deliveryFee;
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
      subtotal,
      deliveryFee,
      total,
      items: orderItems
    });

    return response.status(201).json({
      message: "Your order has been placed successfully.",
      orderId: createdOrder.id,
      total: createdOrder.total
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
    const deliveryFee = 370;
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
         marketing_consent, order_note, subtotal, delivery_fee, total, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
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
        subtotal,
        deliveryFee,
        subtotal + deliveryFee
      ]
    );

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
      orderId: orderResult.insertId,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee
    });
  } catch (error) {
    await connection.rollback();
    response.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "The order could not be saved. Please try again."
    });
  } finally {
    connection.release();
  }
});

export default router;

import "dotenv/config";
import cors from "cors";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { getPool, isDatabaseConfigured } from "./db.js";
import { createLocalProduct, deleteLocalProduct, getLocalCatalogue, updateLocalProduct } from "./local-product-store.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === "production";
const adminEmail = String(process.env.ADMIN_EMAIL || (!isProduction ? "admin@xuralab.com" : "")).trim().toLowerCase();
const adminPassword = String(process.env.ADMIN_PASSWORD || (!isProduction ? "XuraLab@2026" : ""));
const adminSessionSecret = String(process.env.ADMIN_SESSION_SECRET || (!isProduction ? "xura-local-development-session-secret" : ""));
const adminCookieName = "xura_admin_session";
const adminSessionSeconds = 60 * 60 * 8;
const loginAttempts = new Map();
const allowedPaymentMethods = new Set(["cash-on-delivery", "bank-transfer", "card"]);
const allowedProductCategories = new Set(["Men", "Women", "Unisex"]);
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const productUploadDirectory = process.env.PRODUCT_UPLOAD_DIR
  ? resolve(process.env.PRODUCT_UPLOAD_DIR)
  : resolve(moduleDirectory, "../../web/public/uploads/products");
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 8 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return callback(null, true);
    callback(Object.assign(new Error("Images must be JPG, PNG, or WebP files."), { statusCode: 400 }));
  }
});
const withCurrentImage = (product) => ({
  ...product,
  images: product.images?.length ? product.images : [product.imageUrl]
});

const productSummary = (product) => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  gender: product.gender,
  imageUrl: product.imageUrl,
  variantCount: product.variants.length,
  startingPrice: product.price,
  isActive: product.isActive !== false
});

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "fragrance";
}

function imageExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return ".jpg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return ".webp";
  return null;
}

function parseProductInput(body) {
  let rawVariants;
  try {
    rawVariants = JSON.parse(body.variants || "[]");
  } catch {
    throw Object.assign(new Error("Concentrations and prices are invalid."), { statusCode: 400 });
  }

  const product = {
    name: String(body.name || "").trim().slice(0, 120),
    tagline: String(body.tagline || "").trim().slice(0, 255),
    gender: String(body.gender || "").trim(),
    volumeMl: Number(body.volumeMl),
    lead: String(body.lead || "").trim().slice(0, 255),
    description: String(body.description || "").trim().slice(0, 3000),
    notes: String(body.notes || "").trim().slice(0, 255),
    character: String(body.character || "").trim().slice(0, 255),
    bestFor: String(body.bestFor || "").trim().slice(0, 255),
    variants: Array.isArray(rawVariants) ? rawVariants.map((variant) => ({
      concentrationPercent: Number(variant.concentrationPercent),
      price: Number(variant.price)
    })) : []
  };

  if (!product.name || !product.tagline || !product.lead || !product.description || !product.notes || !product.character || !product.bestFor) {
    throw Object.assign(new Error("Complete all product information fields."), { statusCode: 400 });
  }
  if (!allowedProductCategories.has(product.gender)) {
    throw Object.assign(new Error("Choose Men, Women, or Unisex as the category."), { statusCode: 400 });
  }
  if (!Number.isInteger(product.volumeMl) || product.volumeMl < 1 || product.volumeMl > 1000) {
    throw Object.assign(new Error("Bottle size must be between 1 and 1,000 ml."), { statusCode: 400 });
  }
  if (!product.variants.length || product.variants.length > 10) {
    throw Object.assign(new Error("Add between 1 and 10 concentration options."), { statusCode: 400 });
  }
  const concentrations = new Set();
  for (const variant of product.variants) {
    if (!Number.isInteger(variant.concentrationPercent) || variant.concentrationPercent < 1 || variant.concentrationPercent > 100) {
      throw Object.assign(new Error("Each concentration must be a whole percentage from 1 to 100."), { statusCode: 400 });
    }
    if (!Number.isFinite(variant.price) || variant.price < 1 || variant.price > 99999999) {
      throw Object.assign(new Error("Each concentration needs a valid PKR price."), { statusCode: 400 });
    }
    if (concentrations.has(variant.concentrationPercent)) {
      throw Object.assign(new Error("Each concentration percentage must be unique."), { statusCode: 400 });
    }
    concentrations.add(variant.concentrationPercent);
  }
  product.variants.sort((left, right) => left.concentrationPercent - right.concentrationPercent);
  product.price = Math.min(...product.variants.map((variant) => variant.price));
  return product;
}

async function availableSlug(name, pool) {
  const base = slugify(name);
  const existing = new Set();
  if (pool) {
    const [rows] = await pool.query("SELECT slug FROM products WHERE slug = ? OR slug LIKE ?", [base, `${base}-%`]);
    rows.forEach((row) => existing.add(row.slug));
  } else {
    (await getLocalCatalogue({ includeInactive: true })).forEach((product) => existing.add(product.slug));
  }
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

async function saveProductImages(files) {
  if (!files?.length) throw Object.assign(new Error("Add at least one product image."), { statusCode: 400 });
  await mkdir(productUploadDirectory, { recursive: true });
  const saved = [];
  try {
    for (const file of files) {
      const extension = imageExtension(file.buffer);
      if (!extension) throw Object.assign(new Error("Images must be valid JPG, PNG, or WebP files."), { statusCode: 400 });
      const filename = `${Date.now()}-${randomUUID()}${extension}`;
      const diskPath = resolve(productUploadDirectory, filename);
      await writeFile(diskPath, file.buffer);
      saved.push({ diskPath, publicUrl: `/uploads/products/${filename}` });
    }
    return saved;
  } catch (error) {
    await Promise.all(saved.map((image) => unlink(image.diskPath).catch(() => {})));
    throw error;
  }
}

function uploadedProductImagePath(imageUrl) {
  const prefix = "/uploads/products/";
  const value = String(imageUrl || "");
  if (!value.startsWith(prefix)) return null;
  const filename = value.slice(prefix.length);
  if (!filename || filename !== basename(filename)) return null;
  const diskPath = resolve(productUploadDirectory, filename);
  return dirname(diskPath) === productUploadDirectory ? diskPath : null;
}

async function removeUploadedProductImages(imageUrls) {
  const diskPaths = [...new Set(imageUrls.map(uploadedProductImagePath).filter(Boolean))];
  await Promise.all(diskPaths.map((diskPath) => unlink(diskPath).catch((error) => {
    if (error.code !== "ENOENT") console.error(`Unable to remove product image ${diskPath}:`, error);
  })));
}

function orderProductImages(imageUrls, rawPrimaryIndex) {
  const primaryIndex = rawPrimaryIndex === undefined || rawPrimaryIndex === ""
    ? 0
    : Number(rawPrimaryIndex);
  if (!Number.isInteger(primaryIndex) || primaryIndex < 0 || primaryIndex >= imageUrls.length) {
    throw Object.assign(new Error("Choose a valid primary product image."), { statusCode: 400 });
  }
  return [imageUrls[primaryIndex], ...imageUrls.filter((_imageUrl, index) => index !== primaryIndex)];
}

function retainedProductImages(rawRetainedImages, currentImages) {
  if (rawRetainedImages === undefined) return null;
  let requested;
  try {
    requested = JSON.parse(rawRetainedImages);
  } catch {
    throw Object.assign(new Error("The retained image list is invalid."), { statusCode: 400 });
  }
  if (!Array.isArray(requested)) {
    throw Object.assign(new Error("The retained image list is invalid."), { statusCode: 400 });
  }
  const available = new Set(currentImages);
  const retained = [];
  for (const imageUrl of requested) {
    if (typeof imageUrl !== "string" || !available.has(imageUrl)) {
      throw Object.assign(new Error("An existing product image could not be verified."), { statusCode: 400 });
    }
    if (!retained.includes(imageUrl)) retained.push(imageUrl);
  }
  return retained;
}

async function productImagesById(pool, productIds) {
  const imageMap = new Map();
  if (!productIds.length) return imageMap;
  try {
    const placeholders = productIds.map(() => "?").join(",");
    const [rows] = await pool.query(
      `SELECT product_id AS productId, image_url AS imageUrl
       FROM product_images WHERE product_id IN (${placeholders}) ORDER BY product_id, sort_order, id`,
      productIds
    );
    for (const row of rows) {
      const current = imageMap.get(row.productId) || [];
      current.push(row.imageUrl);
      imageMap.set(row.productId, current);
    }
  } catch (error) {
    if (error.code !== "ER_NO_SUCH_TABLE") throw error;
  }
  return imageMap;
}

function normalizeAddress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    firstName: String(value.firstName || "").trim().slice(0, 80),
    lastName: String(value.lastName || "").trim().slice(0, 80),
    company: String(value.company || "").trim().slice(0, 160),
    countryCode: String(value.countryCode || "").trim().toUpperCase().slice(0, 2),
    address1: String(value.address1 || "").trim().slice(0, 255),
    address2: String(value.address2 || "").trim().slice(0, 255),
    city: String(value.city || "").trim().slice(0, 120),
    province: String(value.province || "").trim().slice(0, 120),
    postalCode: String(value.postalCode || "").trim().slice(0, 24)
  };
}

function isCompleteAddress(address) {
  return Boolean(
    address?.firstName &&
    address?.lastName &&
    address?.countryCode &&
    address?.address1 &&
    address?.city &&
    address?.province
  );
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header = "") {
  return header.split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({ email: adminEmail, exp: Date.now() + adminSessionSeconds * 1000 })).toString("base64url");
  const signature = createHmac("sha256", adminSessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readAdminSession(request) {
  if (!adminSessionSecret) return null;
  const token = parseCookies(request.headers.cookie)[adminCookieName];
  if (!token) return null;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;
  const expectedSignature = createHmac("sha256", adminSessionSecret).update(payload).digest("base64url");
  if (!safeEqual(providedSignature, expectedSignature)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.email === adminEmail && Number(session.exp) > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function adminCookie(token, maxAge = adminSessionSeconds) {
  return `${adminCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProduction ? "; Secure" : ""}`;
}

function requireAdmin(request, response, next) {
  const session = readAdminSession(request);
  if (!session) return response.status(401).json({ message: "Admin authentication is required." });
  request.admin = session;
  next();
}

app.disable("x-powered-by");
app.use(cors({ origin: process.env.WEB_ORIGIN || "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "32kb" }));

app.post("/api/admin/login", (request, response) => {
  response.set("Cache-Control", "no-store");
  if (!adminEmail || !adminPassword || !adminSessionSecret) {
    return response.status(503).json({ message: "Admin access is not configured on the server." });
  }

  const clientKey = request.ip || "unknown";
  const attempt = loginAttempts.get(clientKey);
  if (attempt?.blockedUntil > Date.now()) {
    return response.status(429).json({ message: "Too many login attempts. Please wait a few minutes and try again." });
  }

  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  if (!safeEqual(email, adminEmail) || !safeEqual(password, adminPassword)) {
    const failures = (attempt?.failures || 0) + 1;
    loginAttempts.set(clientKey, {
      failures,
      blockedUntil: failures >= 5 ? Date.now() + 10 * 60 * 1000 : 0
    });
    return response.status(401).json({ message: "The email or password is incorrect." });
  }

  loginAttempts.delete(clientKey);
  response.setHeader("Set-Cookie", adminCookie(createAdminSession()));
  response.json({ authenticated: true, admin: { email: adminEmail } });
});

app.get("/api/admin/session", (request, response) => {
  response.set("Cache-Control", "no-store");
  const session = readAdminSession(request);
  if (!session) return response.status(401).json({ authenticated: false });
  response.json({ authenticated: true, admin: { email: session.email } });
});

app.post("/api/admin/logout", (_request, response) => {
  response.setHeader("Set-Cookie", adminCookie("", 0));
  response.json({ authenticated: false });
});

app.get("/api/admin/dashboard", requireAdmin, async (_request, response) => {
  response.set("Cache-Control", "no-store");
  const pool = getPool();
  if (!pool) {
    const localProducts = await getLocalCatalogue();
    return response.json({
      source: "local",
      admin: { email: _request.admin.email },
      stats: { totalProducts: localProducts.length, totalOrders: 0, pendingOrders: 0, revenue: 0 },
      recentOrders: [],
      products: localProducts.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        gender: product.gender,
        imageUrl: product.imageUrl,
        variantCount: product.variants.length,
        startingPrice: Math.min(...product.variants.map((variant) => variant.price)),
        isActive: true
      }))
    });
  }

  try {
    const [productStatsResult, orderStatsResult, recentOrdersResult, productsResult] = await Promise.all([
      pool.query("SELECT COUNT(*) AS totalProducts FROM products WHERE is_active = TRUE"),
      pool.query(`SELECT COUNT(*) AS totalOrders,
                         COALESCE(SUM(status = 'pending'), 0) AS pendingOrders,
                         COALESCE(SUM(total), 0) AS revenue
                  FROM orders`),
      pool.query(`SELECT id, customer_name AS customerName, email, payment_method AS paymentMethod,
                         total, status, created_at AS createdAt
                  FROM orders ORDER BY created_at DESC LIMIT 10`),
      pool.query(`SELECT p.id, p.slug, p.name, p.gender, p.image_url AS imageUrl, p.is_active AS isActive,
                         COUNT(pv.id) AS variantCount, COALESCE(MIN(pv.price), p.price) AS startingPrice
                  FROM products p
                  LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
                  WHERE p.is_active = TRUE
                  GROUP BY p.id, p.slug, p.name, p.gender, p.image_url, p.is_active, p.price
                  ORDER BY p.sort_order ASC, p.id ASC`)
    ]);
    const productStats = productStatsResult[0][0] || {};
    const orderStats = orderStatsResult[0][0] || {};
    const recentOrders = recentOrdersResult[0];
    const products = productsResult[0];
    response.json({
      source: "mysql",
      admin: { email: _request.admin.email },
      stats: {
        totalProducts: Number(productStats.totalProducts || 0),
        totalOrders: Number(orderStats.totalOrders || 0),
        pendingOrders: Number(orderStats.pendingOrders || 0),
        revenue: Number(orderStats.revenue || 0)
      },
      recentOrders,
      products
    });
  } catch (error) {
    response.status(503).json({ message: "Admin data is temporarily unavailable.", detail: error.message });
  }
});

app.post("/api/admin/products", requireAdmin, productImageUpload.array("images", 5), async (request, response) => {
  let savedImages = [];
  let connection;
  try {
    const productInput = parseProductInput(request.body || {});
    savedImages = await saveProductImages(request.files);
    const imageUrls = orderProductImages(
      savedImages.map((image) => image.publicUrl),
      request.body.primaryImageIndex
    );
    const pool = getPool();
    const slug = await availableSlug(productInput.name, pool);
    let product;

    if (!pool) {
      product = await createLocalProduct({
        ...productInput,
        slug,
        imageUrl: imageUrls[0],
        images: imageUrls,
        isActive: true
      });
    } else {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [sortRows] = await connection.query("SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextSortOrder FROM products FOR UPDATE");
      const sortOrder = Number(sortRows[0]?.nextSortOrder || 1);
      const [productResult] = await connection.query(
        `INSERT INTO products (
           slug, name, tagline, gender, volume_ml, price, image_url, sort_order,
           lead, description, notes, character, best_for, is_active
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          slug,
          productInput.name,
          productInput.tagline,
          productInput.gender,
          productInput.volumeMl,
          productInput.price,
          imageUrls[0],
          sortOrder,
          productInput.lead,
          productInput.description,
          productInput.notes,
          productInput.character,
          productInput.bestFor
        ]
      );
      const productId = productResult.insertId;
      for (const [index, variant] of productInput.variants.entries()) {
        await connection.query(
          `INSERT INTO product_variants (product_id, concentration_percent, price, sort_order, is_active)
           VALUES (?, ?, ?, ?, TRUE)`,
          [productId, variant.concentrationPercent, variant.price, index + 1]
        );
      }
      for (const [index, imageUrl] of imageUrls.entries()) {
        await connection.query(
          "INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)",
          [productId, imageUrl, index + 1]
        );
      }
      await connection.commit();
      product = {
        ...productInput,
        id: productId,
        slug,
        imageUrl: imageUrls[0],
        images: imageUrls,
        sortOrder,
        isActive: true
      };
    }

    response.status(201).json({
      message: `${product.name} is now visible in the storefront.`,
      product,
      summary: productSummary(product)
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    await Promise.all(savedImages.map((image) => unlink(image.diskPath).catch(() => {})));
    response.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "The product could not be saved. Please try again."
    });
  } finally {
    connection?.release();
  }
});

app.get("/api/admin/products/:id", requireAdmin, async (request, response) => {
  const productId = Number(request.params.id);
  if (!Number.isInteger(productId) || productId < 1) {
    return response.status(400).json({ message: "Invalid product identifier." });
  }

  const pool = getPool();
  if (!pool) {
    const product = (await getLocalCatalogue()).find((candidate) => Number(candidate.id) === productId);
    return product
      ? response.json({ product, source: "local" })
      : response.status(404).json({ message: "Product not found." });
  }

  try {
    const [products] = await pool.query(
      `SELECT id, slug, name, tagline, gender, volume_ml AS volumeMl, price,
              image_url AS imageUrl, sort_order AS sortOrder, lead, description,
              notes, character, best_for AS bestFor, is_active AS isActive
       FROM products WHERE id = ? AND is_active = TRUE LIMIT 1`,
      [productId]
    );
    if (!products.length) return response.status(404).json({ message: "Product not found." });
    const [variants] = await pool.query(
      `SELECT id, product_id AS productId, concentration_percent AS concentrationPercent,
              price, sort_order AS sortOrder
       FROM product_variants WHERE product_id = ? AND is_active = TRUE
       ORDER BY sort_order ASC, id ASC`,
      [productId]
    );
    const imagesByProduct = await productImagesById(pool, [productId]);
    const product = products[0];
    response.json({
      source: "mysql",
      product: withCurrentImage({ ...product, variants, images: imagesByProduct.get(productId) || [product.imageUrl] })
    });
  } catch (error) {
    response.status(503).json({ message: "The product could not be loaded for editing.", detail: error.message });
  }
});

app.put("/api/admin/products/:id", requireAdmin, productImageUpload.array("images", 5), async (request, response) => {
  const productId = Number(request.params.id);
  if (!Number.isInteger(productId) || productId < 1) {
    return response.status(400).json({ message: "Invalid product identifier." });
  }

  let savedImages = [];
  let removedImageUrls = [];
  let connection;
  try {
    const productInput = parseProductInput(request.body || {});
    const pool = getPool();
    let product;

    if (!pool) {
      const currentProduct = (await getLocalCatalogue()).find((candidate) => Number(candidate.id) === productId);
      if (!currentProduct) return response.status(404).json({ message: "Product not found." });
      if (request.files?.length) savedImages = await saveProductImages(request.files);
      const currentImages = currentProduct.images?.length ? currentProduct.images : [currentProduct.imageUrl];
      const retainedImages = retainedProductImages(request.body.retainedImages, currentImages);
      const availableImages = retainedImages === null
        ? (savedImages.length ? savedImages.map((image) => image.publicUrl) : currentImages)
        : [...retainedImages, ...savedImages.map((image) => image.publicUrl)];
      if (!availableImages.length) throw Object.assign(new Error("Add at least one product image."), { statusCode: 400 });
      if (availableImages.length > 5) throw Object.assign(new Error("A product can have no more than five images."), { statusCode: 400 });
      const imageUrls = orderProductImages(availableImages, request.body.primaryImageIndex);
      removedImageUrls = currentImages.filter((imageUrl) => !availableImages.includes(imageUrl));
      product = await updateLocalProduct(productId, {
        ...productInput,
        imageUrl: imageUrls[0],
        images: imageUrls
      });
    } else {
      if (request.files?.length) savedImages = await saveProductImages(request.files);
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [products] = await connection.query(
        `SELECT id, slug, name, image_url AS imageUrl, sort_order AS sortOrder,
                is_active AS isActive
         FROM products WHERE id = ? LIMIT 1 FOR UPDATE`,
        [productId]
      );
      if (!products.length) throw Object.assign(new Error("Product not found."), { statusCode: 404 });
      const currentProduct = products[0];
      const currentImages = await productImagesById(connection, [productId]);
      const existingImageUrls = currentImages.get(productId)?.length ? currentImages.get(productId) : [currentProduct.imageUrl];
      const retainedImages = retainedProductImages(request.body.retainedImages, existingImageUrls);
      const availableImages = retainedImages === null
        ? (savedImages.length ? savedImages.map((image) => image.publicUrl) : existingImageUrls)
        : [...retainedImages, ...savedImages.map((image) => image.publicUrl)];
      if (!availableImages.length) throw Object.assign(new Error("Add at least one product image."), { statusCode: 400 });
      if (availableImages.length > 5) throw Object.assign(new Error("A product can have no more than five images."), { statusCode: 400 });
      const imageUrls = orderProductImages(availableImages, request.body.primaryImageIndex);
      removedImageUrls = existingImageUrls.filter((imageUrl) => !availableImages.includes(imageUrl));

      await connection.query(
        `UPDATE products SET
           name = ?, tagline = ?, gender = ?, volume_ml = ?, price = ?, image_url = ?,
           lead = ?, description = ?, notes = ?, character = ?, best_for = ?
         WHERE id = ?`,
        [
          productInput.name,
          productInput.tagline,
          productInput.gender,
          productInput.volumeMl,
          productInput.price,
          imageUrls[0],
          productInput.lead,
          productInput.description,
          productInput.notes,
          productInput.character,
          productInput.bestFor,
          productId
        ]
      );

      const [existingVariants] = await connection.query(
        `SELECT id, concentration_percent AS concentrationPercent
         FROM product_variants WHERE product_id = ? FOR UPDATE`,
        [productId]
      );
      const existingByConcentration = new Map(
        existingVariants.map((variant) => [Number(variant.concentrationPercent), variant])
      );
      await connection.query("UPDATE product_variants SET is_active = FALSE WHERE product_id = ?", [productId]);
      const variants = [];
      for (const [index, variant] of productInput.variants.entries()) {
        const existingVariant = existingByConcentration.get(variant.concentrationPercent);
        if (existingVariant) {
          await connection.query(
            `UPDATE product_variants SET price = ?, sort_order = ?, is_active = TRUE WHERE id = ?`,
            [variant.price, index + 1, existingVariant.id]
          );
          variants.push({ ...variant, id: existingVariant.id, productId, sortOrder: index + 1 });
        } else {
          const [variantResult] = await connection.query(
            `INSERT INTO product_variants (product_id, concentration_percent, price, sort_order, is_active)
             VALUES (?, ?, ?, ?, TRUE)`,
            [productId, variant.concentrationPercent, variant.price, index + 1]
          );
          variants.push({ ...variant, id: variantResult.insertId, productId, sortOrder: index + 1 });
        }
      }

      await connection.query("DELETE FROM product_images WHERE product_id = ?", [productId]);
      for (const [index, imageUrl] of imageUrls.entries()) {
        await connection.query(
          "INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)",
          [productId, imageUrl, index + 1]
        );
      }
      await connection.commit();
      product = {
        ...productInput,
        id: productId,
        slug: currentProduct.slug,
        imageUrl: imageUrls[0],
        images: imageUrls,
        variants,
        sortOrder: currentProduct.sortOrder,
        isActive: Boolean(currentProduct.isActive)
      };
    }

    await removeUploadedProductImages(removedImageUrls);

    response.json({
      message: `${product.name} has been updated across the storefront.`,
      product,
      summary: productSummary(product)
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    await Promise.all(savedImages.map((image) => unlink(image.diskPath).catch(() => {})));
    response.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "The product changes could not be saved. Please try again."
    });
  } finally {
    connection?.release();
  }
});

app.delete("/api/admin/products/:id", requireAdmin, async (request, response) => {
  const productId = Number(request.params.id);
  if (!Number.isInteger(productId) || productId < 1) {
    return response.status(400).json({ message: "Invalid product identifier." });
  }

  const pool = getPool();
  if (!pool) {
    try {
      const product = await deleteLocalProduct(productId);
      if (!product) return response.status(404).json({ message: "Product not found." });
      await removeUploadedProductImages(product.images?.length ? product.images : [product.imageUrl]);
      return response.json({
        deleted: true,
        id: productId,
        message: `${product.name} has been removed from the catalogue.`
      });
    } catch {
      return response.status(500).json({ message: "The product could not be removed. Please try again." });
    }
  }

  let connection;
  let imageUrls = [];
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [products] = await connection.query(
      "SELECT id, name, image_url AS imageUrl FROM products WHERE id = ? AND is_active = TRUE LIMIT 1 FOR UPDATE",
      [productId]
    );
    if (!products.length) throw Object.assign(new Error("Product not found."), { statusCode: 404 });
    const product = products[0];
    const imagesByProduct = await productImagesById(connection, [productId]);
    imageUrls = imagesByProduct.get(productId)?.length
      ? imagesByProduct.get(productId)
      : [product.imageUrl];

    await connection.query("UPDATE product_variants SET is_active = FALSE WHERE product_id = ?", [productId]);
    await connection.query("UPDATE products SET is_active = FALSE WHERE id = ?", [productId]);
    await connection.query("DELETE FROM product_images WHERE product_id = ?", [productId]);
    await connection.commit();
    await removeUploadedProductImages(imageUrls);
    response.json({
      deleted: true,
      id: productId,
      message: `${product.name} has been removed from the catalogue.`
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    response.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "The product could not be removed. Please try again."
    });
  } finally {
    connection?.release();
  }
});

app.get("/api/health", async (_request, response) => {
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

app.get("/api/products", async (_request, response) => {
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
        lead,
        description,
        notes,
        character,
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
      products: rows.map((product) => withCurrentImage({
        ...product,
        variants: variantsByProduct.get(product.id) || [],
        images: imagesByProduct.get(product.id) || [product.imageUrl]
      })),
      source: "mysql"
    });
  } catch (error) {
    response.status(503).json({ message: "The product catalogue is temporarily unavailable.", detail: error.message });
  }
});

app.get("/api/products/:slug", async (request, response) => {
  const pool = getPool();
  if (!pool) {
    const localProduct = (await getLocalCatalogue()).find((product) => product.slug === request.params.slug);
    return localProduct
      ? response.json({ product: localProduct, source: "local" })
      : response.status(404).json({ message: "Product not found." });
  }

  try {
    const [products] = await pool.query(
      `SELECT id, slug, name, tagline, gender, volume_ml AS volumeMl, price, image_url AS imageUrl,
              sort_order AS sortOrder, lead, description, notes, character, best_for AS bestFor
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
      product: withCurrentImage({ ...product, variants, images: imagesByProduct.get(product.id) || [product.imageUrl] }),
      source: "mysql"
    });
  } catch (error) {
    response.status(503).json({ message: "The product is temporarily unavailable.", detail: error.message });
  }
});

app.post("/api/orders", async (request, response) => {
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
    .map((item) => ({ productId: Number(item.productId), variantId: Number(item.variantId), quantity: Number(item.quantity) }))
    .filter((item) => Number.isInteger(item.productId) && Number.isInteger(item.variantId) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20);

  if (normalizedItems.length !== items.length) {
    return response.status(400).json({ message: "One or more cart items are invalid." });
  }

  const pool = getPool();
  if (!pool) {
    return response.status(503).json({ message: "Ordering needs MySQL setup. Add the API database settings, run the schema, and try again." });
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
      throw Object.assign(new Error("A fragrance concentration in your cart is no longer available."), { statusCode: 409 });
    }

    const variantById = new Map(variants.map((variant) => [variant.variantId, variant]));
    const hasMismatchedProduct = normalizedItems.some((item) => variantById.get(item.variantId)?.productId !== item.productId);
    if (hasMismatchedProduct) {
      throw Object.assign(new Error("A cart item does not match the selected fragrance."), { statusCode: 400 });
    }

    const subtotal = normalizedItems.reduce((total, item) => total + variantById.get(item.variantId).price * item.quantity, 0);
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
    ].filter(Boolean).join(", ");
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
        [orderResult.insertId, variant.productId, variant.variantId, variant.name, variant.concentrationPercent, variant.price, item.quantity, variant.price * item.quantity]
      );
    }

    await connection.commit();
    response.status(201).json({ orderId: orderResult.insertId, subtotal, deliveryFee, total: subtotal + deliveryFee });
  } catch (error) {
    await connection.rollback();
    response.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "The order could not be saved. Please try again." });
  } finally {
    connection.release();
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Each product image must be 8 MB or smaller."
      : "Upload up to five JPG, PNG, or WebP product images.";
    return response.status(400).json({ message });
  }
  if (error instanceof SyntaxError && error.status === 400) {
    return response.status(400).json({ message: "Invalid JSON body." });
  }
  if (error.statusCode) {
    return response.status(error.statusCode).json({ message: error.message });
  }
  console.error(error);
  response.status(500).json({ message: "Unexpected server error." });
});

app.listen(port, () => {
  console.log(`Xura Lab API listening on http://localhost:${port}`);
});

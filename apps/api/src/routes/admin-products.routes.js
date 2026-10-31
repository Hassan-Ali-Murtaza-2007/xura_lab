import { Router } from "express";
import { unlink } from "node:fs/promises";
import { getPool } from "../db.js";
import {
  createLocalProduct,
  deleteLocalProduct,
  getLocalCatalogue,
  updateLocalProduct
} from "../local-product-store.js";
import { requireAdmin } from "../middleware/auth.js";
import { productImageUpload } from "../middleware/upload.js";
import {
  orderProductImages,
  productImagesById,
  removeUploadedProductImages,
  retainedProductImages,
  saveProductImages
} from "../services/image.service.js";
import { availableSlug } from "../utils/slugify.js";
import { parseProductInput, productSummary, withCurrentImage } from "../utils/validators.js";

function formatAdminProduct(product, variants, images) {
  let bundleItems = product.bundleItems || null;
  if (typeof bundleItems === "string") {
    try {
      bundleItems = JSON.parse(bundleItems);
    } catch {
      bundleItems = null;
    }
  }

  let price = Number(product.price || 0);
  let compareAtPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;

  if (bundleItems && Array.isArray(bundleItems) && bundleItems.length > 0) {
    let lowestStandardSum = 0;
    let lowestCompareSum = 0;
    for (const bottle of bundleItems) {
      const concs = Array.isArray(bottle.concentrations) ? bottle.concentrations : [];
      if (concs.length > 0) {
        const prices = concs.map((c) => (typeof c === "object" ? Number(c.price) : Number(c))).filter((p) => Number.isFinite(p) && p > 0);
        const compares = concs.map((c) => {
          if (typeof c === "object") {
            const comp = Number(c.compareAtPrice);
            const pr = Number(c.price);
            return Number.isFinite(comp) && comp > pr ? comp : (Number.isFinite(pr) && pr > 0 ? pr : 2500);
          }
          return Number(c) || 2500;
        });
        const minP = prices.length ? Math.min(...prices) : 2500;
        const minC = compares.length ? Math.min(...compares) : minP;
        lowestStandardSum += minP;
        lowestCompareSum += (minC > minP ? minC : minP);
      } else {
        lowestStandardSum += 2500;
        lowestCompareSum += 2500;
      }
    }
    const discountRate = (100 - (Number(product.bundleDiscountPercent) || 10)) / 100;
    const lowestDiscounted = Math.round(lowestStandardSum * discountRate);
    const lowestComp = lowestCompareSum > lowestDiscounted ? lowestCompareSum : (lowestStandardSum > lowestDiscounted ? lowestStandardSum : null);
    if (lowestDiscounted > 0) {
      price = lowestDiscounted;
      compareAtPrice = lowestComp;
    }
  } else if (variants?.length) {
    const vPrices = variants.map((v) => Number(v.price)).filter((p) => Number.isFinite(p) && p > 0);
    if (vPrices.length) {
      const minVPrice = Math.min(...vPrices);
      price = minVPrice;
      const match = variants.find((v) => Number(v.price) === minVPrice);
      if (match?.compareAtPrice && Number(match.compareAtPrice) > minVPrice) {
        compareAtPrice = Number(match.compareAtPrice);
      }
    }
  }

  return withCurrentImage({
    ...product,
    price,
    startingPrice: price,
    compareAtPrice,
    bundleItems,
    variants: variants || [],
    images: images || [product.imageUrl]
  });
}

const router = Router();

router.post("/products", requireAdmin, productImageUpload.array("images", 5), async (request, response) => {
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
      const [sortRows] = await connection.query(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextSortOrder FROM products FOR UPDATE"
      );
      const sortOrder = Number(sortRows[0]?.nextSortOrder || 1);
      const [productResult] = await connection.query(
        `INSERT INTO products (
           slug, name, tagline, gender, volume_ml, price, compare_at_price, image_url, sort_order,
           \`lead\`, description, notes, \`character\`, best_for, bundle_items, bundle_discount_percent, is_active
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          slug,
          productInput.name,
          productInput.tagline,
          productInput.gender,
          productInput.volumeMl,
          productInput.price,
          productInput.compareAtPrice || null,
          imageUrls[0],
          sortOrder,
          productInput.lead,
          productInput.description,
          productInput.notes,
          productInput.character,
          productInput.bestFor,
          productInput.bundleItems ? JSON.stringify(productInput.bundleItems) : null,
          productInput.bundleDiscountPercent ?? 10
        ]
      );
      const productId = productResult.insertId;
      for (const [index, variant] of productInput.variants.entries()) {
        await connection.query(
          `INSERT INTO product_variants (product_id, concentration_percent, price, compare_at_price, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, TRUE)`,
          [productId, variant.concentrationPercent, variant.price, variant.compareAtPrice || null, index + 1]
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

router.get("/products", requireAdmin, async (_request, response) => {
  response.set("Cache-Control", "no-store");
  const pool = getPool();
  if (!pool) {
    const products = await getLocalCatalogue({ includeInactive: true });
    return response.json({
      source: "local",
      products: products.map(withCurrentImage)
    });
  }

  try {
    const [products] = await pool.query(
      `SELECT p.id, p.slug, p.name, p.tagline, p.gender, p.volume_ml AS volumeMl,
              p.price, p.compare_at_price AS compareAtPrice, p.image_url AS imageUrl, p.lead, p.description, p.notes,
              p.character, p.best_for AS bestFor, p.bundle_items AS bundleItems,
              p.bundle_discount_percent AS bundleDiscountPercent, p.sort_order AS sortOrder,
              p.is_active AS isActive, p.created_at AS createdAt
       FROM products p
       ORDER BY p.sort_order ASC, p.id ASC`
    );

    const [variants] = await pool.query(
      `SELECT id, product_id AS productId, concentration_percent AS concentrationPercent,
              price, compare_at_price AS compareAtPrice, sort_order AS sortOrder, is_active AS isActive
       FROM product_variants
       ORDER BY sort_order ASC, id ASC`
    );

    const imagesByProduct = await productImagesById(pool, products.map((p) => p.id));
    const variantsByProduct = new Map();
    for (const v of variants) {
      if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, []);
      variantsByProduct.get(v.productId).push(v);
    }

    response.json({
      source: "mysql",
      products: products.map((p) =>
        formatAdminProduct(
          p,
          variantsByProduct.get(p.id) || [],
          imagesByProduct.get(p.id)
        )
      )
    });
  } catch (error) {
    response.status(503).json({ message: "Products could not be loaded.", detail: error.message });
  }
});

router.get("/products/:id", requireAdmin, async (request, response) => {
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
      `SELECT id, slug, name, tagline, gender, volume_ml AS volumeMl, price, compare_at_price AS compareAtPrice,
              image_url AS imageUrl, sort_order AS sortOrder, \`lead\`, description,
              notes, \`character\`, best_for AS bestFor, bundle_items AS bundleItems,
              bundle_discount_percent AS bundleDiscountPercent, is_active AS isActive
       FROM products WHERE id = ? AND is_active = TRUE LIMIT 1`,
      [productId]
    );
    if (!products.length) return response.status(404).json({ message: "Product not found." });
    const [variants] = await pool.query(
      `SELECT id, product_id AS productId, concentration_percent AS concentrationPercent,
              price, compare_at_price AS compareAtPrice, sort_order AS sortOrder
       FROM product_variants WHERE product_id = ? AND is_active = TRUE
       ORDER BY sort_order ASC, id ASC`,
      [productId]
    );
    const imagesByProduct = await productImagesById(pool, [productId]);
    const product = products[0];
    response.json({
      source: "mysql",
      product: formatAdminProduct(
        product,
        variants,
        imagesByProduct.get(productId)
      )
    });
  } catch (error) {
    response
      .status(503)
      .json({ message: "The product could not be loaded for editing.", detail: error.message });
  }
});

router.put("/products/:id", requireAdmin, productImageUpload.array("images", 5), async (request, response) => {
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
      const currentProduct = (await getLocalCatalogue()).find(
        (candidate) => Number(candidate.id) === productId
      );
      if (!currentProduct) return response.status(404).json({ message: "Product not found." });
      if (request.files?.length) savedImages = await saveProductImages(request.files);
      const currentImages = currentProduct.images?.length
        ? currentProduct.images
        : [currentProduct.imageUrl];
      const retainedImages = retainedProductImages(request.body.retainedImages, currentImages);
      const availableImages =
        retainedImages === null
          ? savedImages.length
            ? savedImages.map((image) => image.publicUrl)
            : currentImages
          : [...retainedImages, ...savedImages.map((image) => image.publicUrl)];
      if (!availableImages.length) {
        throw Object.assign(new Error("Add at least one product image."), { statusCode: 400 });
      }
      if (availableImages.length > 5) {
        throw Object.assign(new Error("A product can have no more than five images."), { statusCode: 400 });
      }
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
      const existingImageUrls = currentImages.get(productId)?.length
        ? currentImages.get(productId).filter(Boolean)
        : (currentProduct.imageUrl ? [currentProduct.imageUrl] : []);
      const retainedImages = retainedProductImages(request.body.retainedImages, existingImageUrls);
      const availableImages =
        retainedImages === null
          ? savedImages.length
            ? savedImages.map((image) => image.publicUrl)
            : existingImageUrls
          : [...retainedImages, ...savedImages.map((image) => image.publicUrl)];
      if (!availableImages.length) {
        throw Object.assign(new Error("Add at least one product image."), { statusCode: 400 });
      }
      if (availableImages.length > 5) {
        throw Object.assign(new Error("A product can have no more than five images."), { statusCode: 400 });
      }
      const imageUrls = orderProductImages(availableImages, request.body.primaryImageIndex);
      removedImageUrls = existingImageUrls.filter((imageUrl) => !availableImages.includes(imageUrl));

      await connection.query(
        `UPDATE products SET
           name = ?, tagline = ?, gender = ?, volume_ml = ?, price = ?, compare_at_price = ?, image_url = ?,
           \`lead\` = ?, description = ?, notes = ?, \`character\` = ?, best_for = ?, bundle_items = ?,
           bundle_discount_percent = ?
         WHERE id = ?`,
        [
          productInput.name,
          productInput.tagline,
          productInput.gender,
          productInput.volumeMl,
          productInput.price,
          productInput.compareAtPrice || null,
          imageUrls[0],
          productInput.lead,
          productInput.description,
          productInput.notes,
          productInput.character,
          productInput.bestFor,
          productInput.bundleItems ? JSON.stringify(productInput.bundleItems) : null,
          productInput.bundleDiscountPercent ?? 10,
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

      await connection.query("UPDATE product_variants SET is_active = FALSE WHERE product_id = ?", [
        productId
      ]);
      const variants = [];
      for (const [index, variant] of productInput.variants.entries()) {
        const existingVariant = existingByConcentration.get(variant.concentrationPercent);
        if (existingVariant) {
          await connection.query(
            `UPDATE product_variants SET price = ?, compare_at_price = ?, sort_order = ?, is_active = TRUE WHERE id = ?`,
            [variant.price, variant.compareAtPrice || null, index + 1, existingVariant.id]
          );
          variants.push({ ...variant, id: existingVariant.id, productId, sortOrder: index + 1 });
        } else {
          const [variantResult] = await connection.query(
            `INSERT INTO product_variants (product_id, concentration_percent, price, compare_at_price, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, TRUE)`,
            [productId, variant.concentrationPercent, variant.price, variant.compareAtPrice || null, index + 1]
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

router.delete("/products/:id", requireAdmin, async (request, response) => {
  const productId = Number(request.params.id);
  if (!Number.isInteger(productId) || productId < 1) {
    return response.status(400).json({ message: "Invalid product identifier." });
  }

  const pool = getPool();
  if (!pool) {
    try {
      const product = await deleteLocalProduct(productId);
      if (!product) return response.status(404).json({ message: "Product not found." });
      await removeUploadedProductImages(
        product.images?.length ? product.images : [product.imageUrl]
      );
      return response.json({
        deleted: true,
        id: productId,
        message: `${product.name} has been removed from the catalogue.`
      });
    } catch {
      return response
        .status(500)
        .json({ message: "The product could not be removed. Please try again." });
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

export default router;

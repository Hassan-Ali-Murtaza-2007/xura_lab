import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { productUploadDirectory } from "../config/index.js";
import { imageExtension } from "../middleware/upload.js";

export async function saveProductImages(files) {
  if (!files?.length) {
    throw Object.assign(new Error("Add at least one product image."), { statusCode: 400 });
  }
  await mkdir(productUploadDirectory, { recursive: true });
  const saved = [];
  try {
    for (const file of files) {
      const extension = imageExtension(file.buffer);
      if (!extension) {
        throw Object.assign(new Error("Images must be valid JPG, PNG, or WebP files."), { statusCode: 400 });
      }
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

export function uploadedProductImagePath(imageUrl) {
  const prefix = "/uploads/products/";
  const value = String(imageUrl || "");
  if (!value.startsWith(prefix)) return null;
  const filename = value.slice(prefix.length);
  if (!filename || filename !== basename(filename)) return null;
  const diskPath = resolve(productUploadDirectory, filename);
  return dirname(diskPath) === productUploadDirectory ? diskPath : null;
}

export async function removeUploadedProductImages(imageUrls) {
  const diskPaths = [...new Set(imageUrls.map(uploadedProductImagePath).filter(Boolean))];
  await Promise.all(
    diskPaths.map((diskPath) =>
      unlink(diskPath).catch((error) => {
        if (error.code !== "ENOENT") console.error(`Unable to remove product image ${diskPath}:`, error);
      })
    )
  );
}

export function orderProductImages(imageUrls, rawPrimaryIndex) {
  const primaryIndex =
    rawPrimaryIndex === undefined || rawPrimaryIndex === "" ? 0 : Number(rawPrimaryIndex);
  if (!Number.isInteger(primaryIndex) || primaryIndex < 0 || primaryIndex >= imageUrls.length) {
    throw Object.assign(new Error("Choose a valid primary product image."), { statusCode: 400 });
  }
  return [imageUrls[primaryIndex], ...imageUrls.filter((_imageUrl, index) => index !== primaryIndex)];
}

export function retainedProductImages(rawRetainedImages, currentImages) {
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

export async function productImagesById(pool, productIds) {
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

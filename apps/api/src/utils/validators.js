import { allowedProductCategories } from "../config/index.js";

export const withCurrentImage = (product) => ({
  ...product,
  images: product.images?.length ? product.images : [product.imageUrl]
});

export const productSummary = (product) => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  gender: product.gender,
  imageUrl: product.imageUrl,
  variantCount: product.variants.length,
  startingPrice: product.price,
  isActive: product.isActive !== false
});

export function parseProductInput(body) {
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
    variants: Array.isArray(rawVariants)
      ? rawVariants.map((variant) => ({
          concentrationPercent: Number(variant.concentrationPercent),
          price: Number(variant.price)
        }))
      : []
  };

  if (
    !product.name ||
    !product.tagline ||
    !product.lead ||
    !product.description ||
    !product.notes ||
    !product.character ||
    !product.bestFor
  ) {
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
    if (
      !Number.isInteger(variant.concentrationPercent) ||
      variant.concentrationPercent < 1 ||
      variant.concentrationPercent > 100
    ) {
      throw Object.assign(
        new Error("Each concentration must be a whole percentage from 1 to 100."),
        { statusCode: 400 }
      );
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

export function normalizeAddress(value) {
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

export function isCompleteAddress(address) {
  return Boolean(
    address?.firstName &&
      address?.lastName &&
      address?.countryCode &&
      address?.address1 &&
      address?.city &&
      address?.province
  );
}

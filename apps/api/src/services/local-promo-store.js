import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(moduleDirectory, "../../data");
const promosFile = resolve(dataDirectory, "custom-promos.json");

let writeQueue = Promise.resolve();

async function readCustomPromos() {
  try {
    const content = await readFile(promosFile, "utf8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (error) {
    if (error.code === "ENOENT") {
      await persistCustomPromos([]);
      return [];
    }
    throw error;
  }
}

async function persistCustomPromos(promos) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(promosFile, `${JSON.stringify(promos, null, 2)}\n`, "utf8");
}

function runExclusive(operation) {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => {});
  return result;
}

export async function getLocalPromos() {
  return readCustomPromos();
}

export async function getLocalPromoByCode(code) {
  const cleanCode = String(code || "").trim().toUpperCase();
  const promos = await readCustomPromos();
  return promos.find((p) => p.code.toUpperCase() === cleanCode) || null;
}

export async function createLocalPromo(input) {
  return runExclusive(async () => {
    const promos = await readCustomPromos();
    const cleanCode = String(input.code || "").trim().toUpperCase();
    if (promos.some((p) => p.code.toUpperCase() === cleanCode)) {
      throw Object.assign(new Error(`Promo code "${cleanCode}" already exists.`), { statusCode: 409 });
    }
    const nextId = promos.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
    const newPromo = {
      id: nextId,
      code: cleanCode,
      discountType: input.discountType === "fixed" ? "fixed" : "percentage",
      discountValue: Number(input.discountValue),
      appliesTo: input.appliesTo === "specific" ? "specific" : "all",
      applicableProductIds: Array.isArray(input.applicableProductIds) ? input.applicableProductIds.map(Number) : [],
      minOrderAmount: Number(input.minOrderAmount || 0),
      maxOrderAmount: input.maxOrderAmount !== undefined && input.maxOrderAmount !== null && input.maxOrderAmount !== "" ? Number(input.maxOrderAmount) : null,
      maxDiscountAmount: input.maxDiscountAmount ? Number(input.maxDiscountAmount) : null,
      usageLimit: input.usageLimit ? Number(input.usageLimit) : null,
      usedCount: 0,
      expiresAt: input.expiresAt || null,
      isActive: input.isActive !== false,
      createdAt: new Date().toISOString()
    };
    promos.unshift(newPromo);
    await persistCustomPromos(promos);
    return newPromo;
  });
}

export async function updateLocalPromo(id, input) {
  return runExclusive(async () => {
    const promoId = Number(id);
    const promos = await readCustomPromos();
    const index = promos.findIndex((p) => Number(p.id) === promoId);
    if (index === -1) return null;

    const current = promos[index];
    const cleanCode = input.code ? String(input.code).trim().toUpperCase() : current.code;

    // Check collision if code changed
    if (cleanCode !== current.code && promos.some((p) => p.code.toUpperCase() === cleanCode && p.id !== promoId)) {
      throw Object.assign(new Error(`Promo code "${cleanCode}" already exists.`), { statusCode: 409 });
    }

    const updated = {
      ...current,
      code: cleanCode,
      discountType: input.discountType ? (input.discountType === "fixed" ? "fixed" : "percentage") : current.discountType,
      discountValue: input.discountValue !== undefined ? Number(input.discountValue) : current.discountValue,
      appliesTo: input.appliesTo !== undefined ? (input.appliesTo === "specific" ? "specific" : "all") : (current.appliesTo || "all"),
      applicableProductIds: input.applicableProductIds !== undefined ? (Array.isArray(input.applicableProductIds) ? input.applicableProductIds.map(Number) : []) : (current.applicableProductIds || []),
      minOrderAmount: input.minOrderAmount !== undefined ? Number(input.minOrderAmount) : current.minOrderAmount,
      maxOrderAmount: input.maxOrderAmount !== undefined ? (input.maxOrderAmount !== null && input.maxOrderAmount !== "" ? Number(input.maxOrderAmount) : null) : current.maxOrderAmount,
      maxDiscountAmount: input.maxDiscountAmount !== undefined ? (input.maxDiscountAmount ? Number(input.maxDiscountAmount) : null) : current.maxDiscountAmount,
      usageLimit: input.usageLimit !== undefined ? (input.usageLimit ? Number(input.usageLimit) : null) : current.usageLimit,
      expiresAt: input.expiresAt !== undefined ? input.expiresAt : current.expiresAt,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : current.isActive,
      updatedAt: new Date().toISOString()
    };
    promos[index] = updated;
    await persistCustomPromos(promos);
    return updated;
  });
}

export async function toggleLocalPromoActive(id) {
  return runExclusive(async () => {
    const promoId = Number(id);
    const promos = await readCustomPromos();
    const target = promos.find((p) => Number(p.id) === promoId);
    if (!target) return null;
    target.isActive = !target.isActive;
    target.updatedAt = new Date().toISOString();
    await persistCustomPromos(promos);
    return target;
  });
}

export async function deleteLocalPromo(id) {
  return runExclusive(async () => {
    const promoId = Number(id);
    const promos = await readCustomPromos();
    const index = promos.findIndex((p) => Number(p.id) === promoId);
    if (index === -1) return null;
    const [deleted] = promos.splice(index, 1);
    await persistCustomPromos(promos);
    return deleted;
  });
}

export async function incrementLocalPromoUsage(code) {
  return runExclusive(async () => {
    const cleanCode = String(code || "").trim().toUpperCase();
    const promos = await readCustomPromos();
    const promo = promos.find((p) => p.code.toUpperCase() === cleanCode);
    if (promo) {
      promo.usedCount = (promo.usedCount || 0) + 1;
      await persistCustomPromos(promos);
    }
  });
}

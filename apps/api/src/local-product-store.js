import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogue } from "./catalog.js";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.PRODUCT_DATA_DIR
  ? resolve(process.env.PRODUCT_DATA_DIR)
  : resolve(moduleDirectory, "../data");
const productFile = resolve(dataDirectory, "custom-products.json");
let writeQueue = Promise.resolve();

async function readCustomProducts() {
  try {
    const parsed = JSON.parse(await readFile(productFile, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function persistCustomProducts(products) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(productFile, `${JSON.stringify(products, null, 2)}\n`, "utf8");
}

export async function getLocalCatalogue({ includeInactive = false } = {}) {
  const customProducts = await readCustomProducts();
  const customById = new Map(customProducts.map((product) => [Number(product.id), product]));
  const baseIds = new Set(catalogue.map((product) => Number(product.id)));
  const products = [
    ...catalogue.map((product) => customById.get(Number(product.id)) || product),
    ...customProducts.filter((product) => !baseIds.has(Number(product.id)))
  ];
  return products
    .filter((product) => includeInactive || product.isActive !== false)
    .sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder));
}

export async function createLocalProduct(productInput) {
  let createdProduct;
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const customProducts = await readCustomProducts();
    const allProducts = await getLocalCatalogue({ includeInactive: true });
    const nextProductId = Math.max(0, ...allProducts.map((product) => Number(product.id))) + 1;
    const nextVariantId = Math.max(
      0,
      ...allProducts.flatMap((product) => product.variants || []).map((variant) => Number(variant.id))
    ) + 1;
    createdProduct = {
      ...productInput,
      id: nextProductId,
      sortOrder: Math.max(0, ...allProducts.map((product) => Number(product.sortOrder || 0))) + 1,
      variants: productInput.variants.map((variant, index) => ({
        ...variant,
        id: nextVariantId + index,
        sortOrder: index + 1
      }))
    };
    await persistCustomProducts([...customProducts, createdProduct]);
  });
  await writeQueue;
  return createdProduct;
}

export async function updateLocalProduct(productId, productInput) {
  let updatedProduct;
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const id = Number(productId);
    const customProducts = await readCustomProducts();
    const existingProduct = customProducts.find((product) => Number(product.id) === id)
      || catalogue.find((product) => Number(product.id) === id);
    if (!existingProduct) return;

    const allProducts = await getLocalCatalogue({ includeInactive: true });
    let nextVariantId = Math.max(
      0,
      ...allProducts.flatMap((product) => product.variants || []).map((variant) => Number(variant.id))
    ) + 1;
    const existingVariants = new Map(
      (existingProduct.variants || []).map((variant) => [Number(variant.concentrationPercent), variant])
    );
    const variants = productInput.variants.map((variant, index) => {
      const existingVariant = existingVariants.get(Number(variant.concentrationPercent));
      return {
        ...variant,
        id: existingVariant?.id || nextVariantId++,
        sortOrder: index + 1
      };
    });
    updatedProduct = {
      ...existingProduct,
      ...productInput,
      id,
      slug: existingProduct.slug,
      sortOrder: existingProduct.sortOrder,
      variants,
      isActive: existingProduct.isActive !== false
    };
    const customIndex = customProducts.findIndex((product) => Number(product.id) === id);
    if (customIndex >= 0) customProducts[customIndex] = updatedProduct;
    else customProducts.push(updatedProduct);
    await persistCustomProducts(customProducts);
  });
  await writeQueue;
  return updatedProduct;
}

export async function deleteLocalProduct(productId) {
  let deletedProduct;
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const id = Number(productId);
    const customProducts = await readCustomProducts();
    const existingProduct = customProducts.find((product) => Number(product.id) === id)
      || catalogue.find((product) => Number(product.id) === id);
    if (!existingProduct || existingProduct.isActive === false) return;

    deletedProduct = existingProduct;
    const deletedRecord = { ...existingProduct, isActive: false };
    const customIndex = customProducts.findIndex((product) => Number(product.id) === id);
    if (customIndex >= 0) customProducts[customIndex] = deletedRecord;
    else customProducts.push(deletedRecord);
    await persistCustomProducts(customProducts);
  });
  await writeQueue;
  return deletedProduct;
}

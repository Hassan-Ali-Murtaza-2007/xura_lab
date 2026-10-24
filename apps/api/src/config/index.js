import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

// Resilient .env loading from apps/api/.env or current working directory
dotenv.config();
dotenv.config({ path: resolve(moduleDirectory, "../../.env") });

export const port = Number(process.env.PORT || 4000);
export const isProduction = process.env.NODE_ENV === "production";

export const adminEmail = String(
  process.env.ADMIN_EMAIL || (!isProduction ? "admin@xuralab.com" : "")
).trim().toLowerCase();

export const adminPassword = String(
  process.env.ADMIN_PASSWORD || (!isProduction ? "XuraLab@2026" : "")
);

export const adminSessionSecret = String(
  process.env.ADMIN_SESSION_SECRET || (!isProduction ? "xura-local-development-session-secret" : "")
);

export const adminCookieName = "xura_admin_session";
export const adminSessionSeconds = 60 * 60 * 8; // 8 hours

export const productUploadDirectory = process.env.PRODUCT_UPLOAD_DIR
  ? resolve(process.env.PRODUCT_UPLOAD_DIR)
  : resolve(moduleDirectory, "../../../web/public/uploads/products");

export const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3007";

export const allowedPaymentMethods = new Set(["cash-on-delivery", "bank-transfer", "card"]);
export const allowedProductCategories = new Set(["Men", "Women", "Unisex", "Testers", "Bundles"]);

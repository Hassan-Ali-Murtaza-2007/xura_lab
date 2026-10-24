import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  adminCookieName,
  adminEmail,
  adminSessionSeconds,
  adminSessionSecret,
  isProduction
} from "../config/index.js";

export const customerCookieName = "xura_customer_session";
export const customerSessionSeconds = 30 * 24 * 60 * 60; // 30 days

export function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function parseCookies(header = "") {
  return header.split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

export function createAdminSession() {
  const payload = Buffer.from(
    JSON.stringify({ email: adminEmail, exp: Date.now() + adminSessionSeconds * 1000 })
  ).toString("base64url");
  const signature = createHmac("sha256", adminSessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readAdminSession(request) {
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

export function adminCookie(token, maxAge = adminSessionSeconds) {
  return `${adminCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    isProduction ? "; Secure" : ""
  }`;
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  const testHash = scryptSync(String(password), salt, 64).toString("hex");
  return safeEqual(originalHash, testHash);
}

export function createCustomerSession(customer) {
  const payload = Buffer.from(
    JSON.stringify({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone || null,
      exp: Date.now() + customerSessionSeconds * 1000
    })
  ).toString("base64url");
  const signature = createHmac("sha256", adminSessionSecret || "xura-customer-secret").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readCustomerSession(request) {
  const secret = adminSessionSecret || "xura-customer-secret";
  const cookies = parseCookies(request.headers.cookie);
  const authHeader = request.headers.authorization;
  const token = cookies[customerCookieName] || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);
  if (!token) return null;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;
  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(providedSignature, expectedSignature)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(session.exp) > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function customerCookie(token, maxAge = customerSessionSeconds) {
  return `${customerCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    isProduction ? "; Secure" : ""
  }`;
}

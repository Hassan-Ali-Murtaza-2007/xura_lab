import { createHmac, timingSafeEqual } from "node:crypto";
import {
  adminCookieName,
  adminEmail,
  adminSessionSeconds,
  adminSessionSecret,
  isProduction
} from "../config/index.js";

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

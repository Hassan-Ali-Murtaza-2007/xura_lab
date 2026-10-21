import { Router } from "express";
import { adminEmail, adminPassword, adminSessionSecret } from "../config/index.js";
import { adminCookie, createAdminSession, readAdminSession, safeEqual } from "../utils/crypto.js";

const router = Router();
const loginAttempts = new Map();

router.post("/login", (request, response) => {
  response.set("Cache-Control", "no-store");
  if (!adminEmail || !adminPassword || !adminSessionSecret) {
    return response.status(503).json({ message: "Admin access is not configured on the server." });
  }

  const clientKey = request.ip || "unknown";
  const attempt = loginAttempts.get(clientKey);
  if (attempt?.blockedUntil > Date.now()) {
    return response
      .status(429)
      .json({ message: "Too many login attempts. Please wait a few minutes and try again." });
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

router.get("/session", (request, response) => {
  response.set("Cache-Control", "no-store");
  const session = readAdminSession(request);
  if (!session) return response.status(401).json({ authenticated: false });
  response.json({ authenticated: true, admin: { email: session.email } });
});

router.post("/logout", (_request, response) => {
  response.setHeader("Set-Cookie", adminCookie("", 0));
  response.json({ authenticated: false });
});

export default router;

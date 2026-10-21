import { readAdminSession } from "../utils/crypto.js";

export function requireAdmin(request, response, next) {
  const session = readAdminSession(request);
  if (!session) {
    return response.status(401).json({ message: "Admin authentication is required." });
  }
  request.admin = session;
  next();
}

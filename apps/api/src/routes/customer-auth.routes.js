import { Router } from "express";
import { getPool } from "../db.js";
import {
  createCustomerSession,
  customerCookie,
  hashPassword,
  readCustomerSession,
  verifyPassword
} from "../utils/crypto.js";

const router = Router();
const inMemoryCustomers = new Map();

// Helper to find customer by email
async function findCustomerByEmail(email) {
  const pool = getPool();
  if (pool) {
    const [rows] = await pool.query(
      "SELECT id, email, password_hash AS passwordHash, name, phone FROM customers WHERE email = ? LIMIT 1",
      [email]
    );
    if (rows.length) return rows[0];
  }
  return inMemoryCustomers.get(email.toLowerCase()) || null;
}

// Helper to create customer
async function saveCustomer({ email, passwordHash, name, phone }) {
  const pool = getPool();
  if (pool) {
    const [result] = await pool.query(
      "INSERT INTO customers (email, password_hash, name, phone) VALUES (?, ?, ?, ?)",
      [email, passwordHash, name, phone || null]
    );
    return { id: result.insertId, email, name, phone };
  }
  const id = inMemoryCustomers.size + 1;
  const customer = { id, email: email.toLowerCase(), passwordHash, name, phone };
  inMemoryCustomers.set(email.toLowerCase(), customer);
  return { id, email, name, phone };
}

router.post("/register", async (request, response) => {
  response.set("Cache-Control", "no-store");
  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  const confirmPassword = String(request.body?.confirmPassword || "");
  const name = String(request.body?.name || "").trim();
  const phone = String(request.body?.phone || "").trim();

  if (!name || name.length < 2) {
    return response.status(400).json({ message: "Please provide your full name." });
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return response.status(400).json({ message: "Please provide a valid email address." });
  }
  if (!phone || phone.length < 7) {
    return response.status(400).json({ message: "Please provide a valid WhatsApp or phone number." });
  }
  if (!password || password.length < 6) {
    return response.status(400).json({ message: "Password must be at least 6 characters." });
  }
  if (confirmPassword && password !== confirmPassword) {
    return response.status(400).json({ message: "Passwords do not match." });
  }

  try {
    const existing = await findCustomerByEmail(email);
    if (existing) {
      return response.status(409).json({ message: "An account with this email already exists. Please sign in." });
    }

    const passwordHash = hashPassword(password);
    const customer = await saveCustomer({ email, passwordHash, name, phone });
    const token = createCustomerSession(customer);

    response.setHeader("Set-Cookie", customerCookie(token));
    return response.status(201).json({
      authenticated: true,
      message: `Welcome to Xura Lab, ${customer.name}!`,
      customer: { id: customer.id, email: customer.email, name: customer.name, phone: customer.phone },
      token
    });
  } catch (error) {
    return response.status(500).json({ message: "Unable to create account. Please try again.", detail: error.message });
  }
});

router.post("/login", async (request, response) => {
  response.set("Cache-Control", "no-store");
  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");

  if (!email || !password) {
    return response.status(400).json({ message: "Email and password are required." });
  }

  try {
    const customerRecord = await findCustomerByEmail(email);
    if (!customerRecord || !verifyPassword(password, customerRecord.passwordHash)) {
      return response.status(401).json({ message: "Invalid email or password. Please try again." });
    }

    const customer = {
      id: customerRecord.id,
      email: customerRecord.email,
      name: customerRecord.name,
      phone: customerRecord.phone
    };
    const token = createCustomerSession(customer);

    response.setHeader("Set-Cookie", customerCookie(token));
    return response.json({
      authenticated: true,
      message: `Welcome back, ${customer.name}!`,
      customer,
      token
    });
  } catch (error) {
    return response.status(500).json({ message: "Login failed. Please try again.", detail: error.message });
  }
});

router.get("/session", (request, response) => {
  response.set("Cache-Control", "no-store");
  const session = readCustomerSession(request);
  if (!session) {
    return response.json({ authenticated: false, customer: null });
  }
  return response.json({
    authenticated: true,
    customer: {
      id: session.id,
      email: session.email,
      name: session.name,
      phone: session.phone
    }
  });
});

router.post("/logout", (_request, response) => {
  response.setHeader("Set-Cookie", customerCookie("", 0));
  return response.json({ authenticated: false });
});

export default router;

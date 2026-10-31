"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [hasPendingAction, setHasPendingAction] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store the pending action to execute automatically upon successful login or when dismissed as guest
  const pendingActionRef = useRef(null);

  // Hydrate customer from localStorage on mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("xura-customer");
      if (stored) {
        setCustomer(JSON.parse(stored));
      }
    } catch {
      window.localStorage.removeItem("xura-customer");
    }

    // Verify session with server in background
    fetch("/api/customer/session", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.customer) {
          setCustomer(data.customer);
          window.localStorage.setItem("xura-customer", JSON.stringify(data.customer));
        } else {
          // If server session invalid, check if we had demo or remove
          // keep local customer if offline
        }
      })
      .catch(() => {})
      .finally(() => setAuthHydrated(true));
  }, []);

  // Sync customer state to localStorage
  useEffect(() => {
    if (!authHydrated) return;
    if (customer) {
      window.localStorage.setItem("xura-customer", JSON.stringify(customer));
    } else {
      window.localStorage.removeItem("xura-customer");
    }
  }, [customer, authHydrated]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (loginModalOpen) {
      document.body.classList.add("is-locked");
    } else {
      document.body.classList.remove("is-locked");
    }
    return () => document.body.classList.remove("is-locked");
  }, [loginModalOpen]);

  // Handle Escape key to close modal and continue with pending cart action
  useEffect(() => {
    if (!loginModalOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        closeLoginModal();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loginModalOpen]);

  function openLoginModal(action = null, mode = "login") {
    if (action && typeof action === "function") {
      pendingActionRef.current = action;
      setHasPendingAction(true);
    } else {
      pendingActionRef.current = null;
      setHasPendingAction(false);
    }
    setAuthMode(mode);
    setAuthError("");
    setAuthMessage("");
    setLoginModalOpen(true);
  }

  function closeLoginModal() {
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    setHasPendingAction(false);
    setLoginModalOpen(false);
    setAuthError("");
    setAuthMessage("");
    if (pending && typeof pending === "function") {
      pending();
    }
  }

  function dismissWithoutAction() {
    pendingActionRef.current = null;
    setHasPendingAction(false);
    setLoginModalOpen(false);
    setAuthError("");
    setAuthMessage("");
  }

  function requireAuth(action) {
    if (customer) {
      if (typeof action === "function") action();
      return true;
    }
    openLoginModal(action, "login");
    return false;
  }

  async function login(email, password) {
    setIsSubmitting(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const res = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        throw new Error(data.message || "Invalid email or password.");
      }

      setCustomer(data.customer);
      window.localStorage.setItem("xura-customer", JSON.stringify(data.customer));
      setAuthMessage(data.message || "Welcome back!");

      // Execute pending action if any
      const pending = pendingActionRef.current;
      pendingActionRef.current = null;
      setHasPendingAction(false);

      setTimeout(() => {
        setLoginModalOpen(false);
        if (pending && typeof pending === "function") {
          pending();
        }
      }, 400);

      return data.customer;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function register({ name, email, password, confirmPassword, phone }) {
    setIsSubmitting(true);
    setAuthError("");
    setAuthMessage("");
    try {
      if (!phone || !phone.trim()) {
        throw new Error("WhatsApp / Phone number is required.");
      }
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match. Please verify.");
      }

      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password, confirmPassword, phone })
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        throw new Error(data.message || "Failed to create account.");
      }

      setCustomer(data.customer);
      window.localStorage.setItem("xura-customer", JSON.stringify(data.customer));
      setAuthMessage(data.message || "Account created successfully!");

      const pending = pendingActionRef.current;
      pendingActionRef.current = null;
      setHasPendingAction(false);

      setTimeout(() => {
        setLoginModalOpen(false);
        if (pending && typeof pending === "function") {
          pending();
        }
      }, 400);

      return data.customer;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/customer/logout", {
        method: "POST",
        credentials: "include"
      });
    } catch {}
    setCustomer(null);
    window.localStorage.removeItem("xura-customer");
  }

  const value = {
    customer,
    isLoggedIn: Boolean(customer),
    loginModalOpen,
    hasPendingAction,
    authMode,
    authError,
    authMessage,
    isSubmitting,
    setAuthMode,
    openLoginModal,
    closeLoginModal,
    dismissWithoutAction,
    requireAuth,
    login,
    register,
    logout
  };

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
      <CustomerLoginModal />
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  }
  return context;
}

function CustomerLoginModal() {
  const {
    loginModalOpen,
    closeLoginModal,
    hasPendingAction,
    authMode,
    setAuthMode,
    authError,
    authMessage,
    isSubmitting,
    login,
    register
  } = useCustomerAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  if (!loginModalOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (authMode === "login") {
      await login(email, password).catch(() => {});
    } else {
      if (!phone || !phone.trim()) {
        setAuthError("WhatsApp / Phone number is required.");
        return;
      }
      if (password !== confirmPassword) {
        setAuthError("Passwords do not match. Please verify.");
        return;
      }
      await register({ name, email, password, confirmPassword, phone }).catch(() => {});
    }
  }

  function handleQuickDemo() {
    setEmail("customer@xuralab.com");
    setPassword("password123");
    login("customer@xuralab.com", "password123").catch(() => {});
  }

  const modalTitle = authMode === "login"
    ? (hasPendingAction ? "Sign In or Continue as Guest" : "Sign In to Your Account")
    : (hasPendingAction ? "Create Account or Continue as Guest" : "Create Your Account");

  const modalSubtitle = authMode === "login"
    ? (hasPendingAction
        ? "Sign in to save your bespoke order history, or close (×) to add to cart and checkout as guest."
        : "Access your order history and bespoke fragrance collection.")
    : (hasPendingAction
        ? "Create an account to track your orders, or close (×) to checkout as guest."
        : "Create a Xura Lab account to curate your bespoke fragrances.");

  return (
    <div
      className="auth-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Client Sign In"
      onClick={closeLoginModal}
    >
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          className="auth-modal-close"
          type="button"
          onClick={closeLoginModal}
          aria-label={hasPendingAction ? "Close and add to cart as guest" : "Close modal"}
          title={hasPendingAction ? "Close & continue to cart" : "Close modal"}
        >
          ×
        </button>

        <div className="auth-modal-header">
          <span className="auth-modal-kicker">CLIENT PRIVILEGE</span>
          <h2 className="auth-modal-title">{modalTitle}</h2>
          <p className="auth-modal-subtitle">{modalSubtitle}</p>
        </div>

        {/* Tab switcher */}
        <div className="auth-modal-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${authMode === "login" ? "is-active" : ""}`}
            onClick={() => setAuthMode("login")}
          >
            SIGN IN
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${authMode === "register" ? "is-active" : ""}`}
            onClick={() => setAuthMode("register")}
          >
            NEW CLIENT
          </button>
        </div>

        {authError && <div className="auth-alert is-error">{authError}</div>}
        {authMessage && <div className="auth-alert is-success">{authMessage}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {authMode === "register" && (
            <label className="auth-field">
              <span>Full Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hassan Ali"
                required
                autoComplete="name"
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. client@xuralab.com"
              required
              autoComplete="email"
            />
          </label>

          {authMode === "register" && (
            <label className="auth-field">
              <span>WhatsApp / Phone Number</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0312 9181720"
                required
                autoComplete="tel"
              />
            </label>
          )}

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {authMode === "register" && (
            <label className="auth-field">
              <span>Confirm Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
          )}

          <button className="auth-submit-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "PROCESSING…"
              : hasPendingAction
              ? (authMode === "login" ? "SIGN IN & ADD TO CART" : "CREATE ACCOUNT & ADD TO CART")
              : (authMode === "login" ? "SIGN IN" : "CREATE ACCOUNT")}
          </button>
        </form>

        {hasPendingAction && (
          <div className="auth-guest-option">
            <span className="auth-divider-text">OR SHOP WITHOUT AN ACCOUNT</span>
            <button
              type="button"
              className="auth-continue-guest-btn"
              onClick={closeLoginModal}
            >
              <span>Continue as Guest & Add to Cart</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        {authMode === "login" && (
          <div className="auth-quick-access">
            <span className="auth-divider-text">DEMO CREDENTIALS</span>
            <button
              type="button"
              className="auth-demo-btn"
              onClick={handleQuickDemo}
              disabled={isSubmitting}
            >
              1-Click Demo Sign In (customer@xuralab.com)
            </button>
          </div>
        )}

        <div className="auth-modal-footer">
          <p>
            {authMode === "login" ? (
              <>
                New to Xura Lab?{" "}
                <button type="button" onClick={() => setAuthMode("register")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => setAuthMode("login")}>
                  Sign in here
                </button>
              </>
            )}
          </p>
          <small>Complimentary nationwide delivery on all advance orders.</small>
        </div>
      </div>
    </div>
  );
}

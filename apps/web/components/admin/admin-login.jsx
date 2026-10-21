"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

export default function AdminLogin() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { credentials: "include", cache: "no-store" })
      .then((response) => {
        if (response.ok) router.replace("/admin");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, [router]);

  async function submitLogin(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password")
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to sign in.");
      router.replace("/admin");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-brand" aria-label="Xura Lab administration">
        <Link className="admin-brand-lockup" href="/" aria-label="Xura Lab storefront">
          <span>XURA LAB</span>
          <small>FRAGRANCE</small>
        </Link>
        <div className="admin-login-brand-copy">
          <p className="admin-eyebrow">PRIVATE ADMINISTRATION</p>
          <h1>The quiet side of every beautiful experience.</h1>
          <p>Review the store, understand every order, and keep the Xura Lab experience moving with intention.</p>
        </div>
        <p className="admin-login-edition">XURA LAB · STORE OPERATIONS</p>
      </section>

      <section className="admin-login-panel">
        <div className="admin-login-form-wrap">
          <p className="admin-eyebrow">WELCOME BACK</p>
          <h2>Sign in to your workspace.</h2>
          <p className="admin-login-intro">Use your administrator credentials to continue to the dashboard.</p>

          <form className="admin-login-form" onSubmit={submitLogin}>
            <label>
              <span>Email address</span>
              <input name="email" type="email" required autoComplete="username" placeholder="admin@xuralab.com" disabled={checking || submitting} />
            </label>
            <label>
              <span>Password</span>
              <div className="admin-password-field">
                <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter your password" disabled={checking || submitting} />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
              </div>
            </label>
            <button className="admin-login-submit" type="submit" disabled={checking || submitting}>
              <span>{checking ? "CHECKING SESSION…" : submitting ? "SIGNING IN…" : "SIGN IN"}</span>
              <ArrowIcon />
            </button>
            {status && <p className="admin-login-status" role="alert">{status}</p>}
          </form>

          <div className="admin-login-help">
            <span>Having trouble signing in?</span>
            <a href="mailto:contact@xuralab.com">Contact support</a>
          </div>
          <Link className="admin-back-link" href="/">← Return to storefront</Link>
        </div>
      </section>
    </main>
  );
}

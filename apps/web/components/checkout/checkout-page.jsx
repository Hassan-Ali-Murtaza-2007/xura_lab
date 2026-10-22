"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { withCurrentProductImages } from "@/data/products";

const DELIVERY_FEE = 370;
const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const money = (value) => `PKR ${number.format(Number(value))}`;
const itemKey = (item) => item.cartKey || `${item.id}:${item.variantId || "base"}`;

const provinces = [
  "Balochistan",
  "Gilgit-Baltistan",
  "Islamabad Capital Territory",
  "Khyber Pakhtunkhwa",
  "Punjab",
  "Sindh"
];

function AddressFields({ prefix, includeContact = false }) {
  return (
    <div className="checkout-address-grid">
      <label className="checkout-field">
        <span>First name</span>
        <input name={`${prefix}FirstName`} required autoComplete={prefix === "shipping" ? "shipping given-name" : "billing given-name"} />
      </label>
      <label className="checkout-field">
        <span>Last name</span>
        <input name={`${prefix}LastName`} required autoComplete={prefix === "shipping" ? "shipping family-name" : "billing family-name"} />
      </label>
      <label className="checkout-field checkout-field-wide">
        <span>Company <small>(optional)</small></span>
        <input name={`${prefix}Company`} autoComplete={prefix === "shipping" ? "shipping organization" : "billing organization"} />
      </label>
      <label className="checkout-field checkout-field-wide">
        <span>Country / region</span>
        <select name={`${prefix}CountryCode`} defaultValue="PK" autoComplete={prefix === "shipping" ? "shipping country" : "billing country"}>
          <option value="PK">Pakistan</option>
        </select>
      </label>
      <label className="checkout-field checkout-field-wide">
        <span>Address</span>
        <input name={`${prefix}Address1`} required autoComplete={prefix === "shipping" ? "shipping address-line1" : "billing address-line1"} placeholder="House number and street name" />
      </label>
      <label className="checkout-field checkout-field-wide">
        <span>Apartment, suite, etc. <small>(optional)</small></span>
        <input name={`${prefix}Address2`} autoComplete={prefix === "shipping" ? "shipping address-line2" : "billing address-line2"} />
      </label>
      <label className="checkout-field">
        <span>City</span>
        <input name={`${prefix}City`} required autoComplete={prefix === "shipping" ? "shipping address-level2" : "billing address-level2"} />
      </label>
      <label className="checkout-field">
        <span>Province / region</span>
        <select name={`${prefix}Province`} required defaultValue="" autoComplete={prefix === "shipping" ? "shipping address-level1" : "billing address-level1"}>
          <option value="" disabled>Select province</option>
          {provinces.map((province) => <option key={province} value={province}>{province}</option>)}
        </select>
      </label>
      <label className="checkout-field">
        <span>Postal code <small>(optional)</small></span>
        <input name={`${prefix}PostalCode`} inputMode="numeric" autoComplete={prefix === "shipping" ? "shipping postal-code" : "billing postal-code"} />
      </label>
      {includeContact && (
        <label className="checkout-field">
          <span>Phone</span>
          <input name="phone" required inputMode="tel" autoComplete="shipping tel" placeholder="0312 9181720" />
        </label>
      )}
    </div>
  );
}

function formAddress(formData, prefix) {
  return {
    firstName: formData.get(`${prefix}FirstName`),
    lastName: formData.get(`${prefix}LastName`),
    company: formData.get(`${prefix}Company`),
    countryCode: formData.get(`${prefix}CountryCode`),
    address1: formData.get(`${prefix}Address1`),
    address2: formData.get(`${prefix}Address2`),
    city: formData.get(`${prefix}City`),
    province: formData.get(`${prefix}Province`),
    postalCode: formData.get(`${prefix}PostalCode`)
  };
}

export default function CheckoutPage() {
  const [cart, setCart] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [billingSame, setBillingSame] = useState(true);
  const [paymentMode, setPaymentMode] = useState("advance");
  const [advanceMethod, setAdvanceMethod] = useState("bank-transfer");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("xura-cart");
    if (stored) {
      try {
        setCart(withCurrentProductImages(JSON.parse(stored)));
      } catch {
        window.localStorage.removeItem("xura-cart");
      }
    }
    setHydrated(true);
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0),
    [cart]
  );

  const isAdvance = paymentMode === "advance";
  const deliveryFee = isAdvance ? 0 : DELIVERY_FEE;

  // Calculate discount based on eligible products in cart
  const discountAmount = useMemo(() => {
    if (!appliedPromo) return 0;

    let eligibleSubtotal = subtotal;
    if (appliedPromo.appliesTo === "specific" && Array.isArray(appliedPromo.applicableProductIds)) {
      const applicableIds = appliedPromo.applicableProductIds.map(Number);
      eligibleSubtotal = cart
        .filter((item) => applicableIds.includes(Number(item.id)))
        .reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    }

    if (eligibleSubtotal <= 0) return 0;

    if (appliedPromo.discountType === "percentage") {
      let discount = Math.round((eligibleSubtotal * appliedPromo.discountValue) / 100);
      if (appliedPromo.maxDiscountAmount && discount > appliedPromo.maxDiscountAmount) {
        discount = appliedPromo.maxDiscountAmount;
      }
      return discount;
    }
    return Math.min(eligibleSubtotal, appliedPromo.discountValue);
  }, [appliedPromo, subtotal, cart]);

  const total = Math.max(0, subtotal - discountAmount) + deliveryFee;

  async function handleApplyPromo(e) {
    e.preventDefault();
    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    setPromoLoading(true);
    setPromoError("");

    try {
      const response = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          subtotal,
          items: cart.map((item) => ({
            productId: item.id,
            price: item.price,
            quantity: item.quantity
          }))
        })
      });
      const data = await response.json();
      if (!response.ok || !data.valid) {
        throw new Error(data.message || "Invalid promo code.");
      }
      setAppliedPromo(data);
      setPromoInput("");
    } catch (err) {
      setPromoError(err.message);
    } finally {
      setPromoLoading(false);
    }
  }

  function handleRemovePromo() {
    setAppliedPromo(null);
    setPromoError("");
  }

  async function submitOrder(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("Placing your order…");
    const formData = new FormData(event.currentTarget);
    const shippingAddress = formAddress(formData, "shipping");
    const paymentMethod = paymentMode === "advance" ? advanceMethod : "cash-on-delivery";
    const payload = {
      email: formData.get("email"),
      phone: formData.get("phone"),
      marketingConsent: formData.get("marketingConsent") === "on",
      shippingAddress,
      shippingMethod: formData.get("shippingMethod"),
      paymentMethod,
      billingSameAsShipping: billingSame,
      billingAddress: billingSame ? null : formAddress(formData, "billing"),
      orderNote: formData.get("orderNote"),
      promoCode: appliedPromo?.code || null,
      items: cart.map((item) => ({
        productId: item.id,
        variantId: item.variantId || null,
        quantity: item.quantity
      }))
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "The order could not be placed.");
      setConfirmedOrder(data);
      setCart([]);
      window.localStorage.setItem("xura-cart", "[]");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return <main className="checkout-loading" aria-live="polite">Preparing your checkout…</main>;
  }

  if (confirmedOrder) {
    return (
      <main className="checkout-confirmation">
        <Link className="checkout-logo" href="/" aria-label="Xura Lab home">
          <span>XURA LAB</span><small>FRAGRANCE</small>
        </Link>
        <div className="checkout-confirmation-mark" aria-hidden="true">✓</div>
        <p className="checkout-kicker">ORDER CONFIRMED</p>
        <h1>Thank you. Your fragrance is being prepared.</h1>
        <p>Order <strong>#{confirmedOrder.orderId}</strong> has been received. We will contact you at the details provided with delivery and payment updates.</p>
        <div className="checkout-confirmation-total">
          <span>Order total</span><strong>{money(confirmedOrder.total)}</strong>
        </div>
        {confirmedOrder.promoCode && (
          <p className="checkout-confirmation-benefit">
            Promo code <strong>{confirmedOrder.promoCode}</strong> applied (-{money(confirmedOrder.discountAmount)})
          </p>
        )}
        {confirmedOrder.deliveryFee === 0 && (
          <p className="checkout-confirmation-benefit checkout-free-shipping-tag">
            ✓ Complimentary free delivery applied for advance payment
          </p>
        )}
        <Link className="checkout-return-button" href="/">CONTINUE SHOPPING</Link>
      </main>
    );
  }

  if (!cart.length) {
    return (
      <main className="checkout-empty">
        <Link className="checkout-logo" href="/" aria-label="Xura Lab home">
          <span>XURA LAB</span><small>FRAGRANCE</small>
        </Link>
        <p className="checkout-kicker">YOUR CART</p>
        <h1>Your checkout is waiting.</h1>
        <p>Add a fragrance to your cart before continuing.</p>
        <Link className="checkout-return-button" href="/#collection">EXPLORE THE COLLECTION</Link>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <header className="checkout-header">
        <div className="checkout-header-inner">
          <Link className="checkout-logo" href="/" aria-label="Xura Lab home">
            <span>XURA LAB</span><small>FRAGRANCE</small>
          </Link>
          <p>Secure checkout</p>
        </div>
      </header>

      <div className="checkout-layout">
        <section className="checkout-details" aria-labelledby="checkout-title">
          <nav className="checkout-breadcrumbs" aria-label="Checkout progress">
            <Link href="/">Cart</Link><span>›</span><b>Information</b><span>›</span><span>Shipping</span><span>›</span><span>Payment</span>
          </nav>
          <h1 id="checkout-title">Complete your order</h1>
          <p className="checkout-intro">Your details are used only to process and deliver your Xura Lab order.</p>

          <form id="xura-checkout-form" onSubmit={submitOrder}>
            <section className="checkout-section" aria-labelledby="contact-heading">
              <div className="checkout-section-heading">
                <span>01</span>
                <div><h2 id="contact-heading">Contact</h2><p>For order and delivery updates.</p></div>
              </div>
              <label className="checkout-field">
                <span>Email address</span>
                <input type="email" name="email" required autoComplete="email" placeholder="you@example.com" />
              </label>
              <label className="checkout-check">
                <input type="checkbox" name="marketingConsent" />
                <span>Email me product news and private releases.</span>
              </label>
            </section>

            <section className="checkout-section" aria-labelledby="delivery-heading">
              <div className="checkout-section-heading">
                <span>02</span>
                <div><h2 id="delivery-heading">Delivery</h2><p>Where should we send your fragrance?</p></div>
              </div>
              <AddressFields prefix="shipping" includeContact />
            </section>

            <section className="checkout-section" aria-labelledby="shipping-heading">
              <div className="checkout-section-heading">
                <span>03</span>
                <div><h2 id="shipping-heading">Shipping method</h2><p>Delivery throughout Pakistan.</p></div>
              </div>
              <label className="checkout-choice is-selected">
                <input type="radio" name="shippingMethod" value="standard" defaultChecked />
                <span>
                  <strong>
                    Standard delivery
                    {isAdvance && <span className="checkout-free-badge">FREE SHIPPING</span>}
                  </strong>
                  <small>
                    {isAdvance
                      ? "3–5 business days · Complimentary free delivery with advance payment"
                      : "3–5 business days"}
                  </small>
                </span>
                <b>
                  {isAdvance ? (
                    <span className="checkout-shipping-free-val">
                      <span className="free-tag">FREE</span>
                      <s>{money(DELIVERY_FEE)}</s>
                    </span>
                  ) : (
                    money(DELIVERY_FEE)
                  )}
                </b>
              </label>
            </section>

            <section className="checkout-section" aria-labelledby="payment-heading">
              <div className="checkout-section-heading">
                <span>04</span>
                <div><h2 id="payment-heading">Payment</h2><p>Choose how you would like to pay.</p></div>
              </div>
              <div className="checkout-payment-list">
                <label className={`checkout-choice ${paymentMode === "advance" ? "is-selected" : ""}`}>
                  <input type="radio" name="paymentMode" value="advance" checked={paymentMode === "advance"} onChange={() => setPaymentMode("advance")} />
                  <span>
                    <strong>
                      Advance Payment
                      <span className="checkout-free-badge">FREE DELIVERY</span>
                    </strong>
                    <small>Pay in advance and get 100% free courier delivery nationwide.</small>
                  </span>
                </label>
                {paymentMode === "advance" && (
                  <div className="checkout-payment-suboptions" role="radiogroup" aria-label="Advance payment method">
                    <label className={`checkout-choice checkout-subchoice ${advanceMethod === "bank-transfer" ? "is-selected" : ""}`}>
                      <input type="radio" name="advanceMethod" value="bank-transfer" checked={advanceMethod === "bank-transfer"} onChange={() => setAdvanceMethod("bank-transfer")} />
                      <span><strong>Bank transfer</strong><small>Account details will be provided after your order is placed.</small></span>
                    </label>
                    <label className={`checkout-choice checkout-subchoice ${advanceMethod === "card" ? "is-selected" : ""}`}>
                      <input type="radio" name="advanceMethod" value="card" checked={advanceMethod === "card"} onChange={() => setAdvanceMethod("card")} />
                      <span><strong>Card</strong><small>Complete payment through a secure payment link after placing the order.</small></span>
                    </label>
                  </div>
                )}
                <label className={`checkout-choice ${paymentMode === "cash-on-delivery" ? "is-selected" : ""}`}>
                  <input type="radio" name="paymentMode" value="cash-on-delivery" checked={paymentMode === "cash-on-delivery"} onChange={() => setPaymentMode("cash-on-delivery")} />
                  <span>
                    <strong>Cash on Delivery</strong>
                    <small>Pay in cash when your fragrance arrives. Standard courier delivery fee (PKR 370) applies.</small>
                  </span>
                </label>
              </div>
              <p className="checkout-security-note">For your security, Xura Lab never asks for or stores card numbers or CVVs on this page.</p>
            </section>

            <section className="checkout-section" aria-labelledby="billing-heading">
              <div className="checkout-section-heading">
                <span>05</span>
                <div><h2 id="billing-heading">Billing address</h2><p>Select the address linked to this payment.</p></div>
              </div>
              <div className="checkout-billing-options">
                <label className={`checkout-choice ${billingSame ? "is-selected" : ""}`}>
                  <input type="radio" name="billingMode" value="same" checked={billingSame} onChange={() => setBillingSame(true)} />
                  <span><strong>Same as delivery address</strong></span>
                </label>
                <label className={`checkout-choice ${!billingSame ? "is-selected" : ""}`}>
                  <input type="radio" name="billingMode" value="different" checked={!billingSame} onChange={() => setBillingSame(false)} />
                  <span><strong>Use a different billing address</strong></span>
                </label>
              </div>
              {!billingSame && <div className="checkout-billing-fields"><AddressFields prefix="billing" /></div>}
            </section>

            <section className="checkout-section checkout-note-section" aria-labelledby="note-heading">
              <div className="checkout-section-heading">
                <span>06</span>
                <div><h2 id="note-heading">Order note</h2><p>Optional delivery or gifting instructions.</p></div>
              </div>
              <label className="checkout-field">
                <span>Note <small>(optional)</small></span>
                <textarea name="orderNote" rows="3" maxLength="500" placeholder="Anything you would like us to know?" />
              </label>
            </section>

            <div className="checkout-submit-row">
              <Link href="/">‹ Return to store</Link>
              <button type="submit" disabled={submitting}>{submitting ? "PLACING ORDER…" : `PAY ${money(total)}`}</button>
            </div>
            <p className="checkout-consent-note">
              By placing your order, you agree to Xura Lab's{" "}
              <Link href="/policies/terms-of-service" target="_blank">Terms & Conditions</Link>,{" "}
              <Link href="/policies/refund-policy" target="_blank">Return Policy</Link>, and{" "}
              <Link href="/policies/privacy-policy" target="_blank">Privacy Policy</Link>.
            </p>
            {status && <p className="checkout-status-message" role="status">{status}</p>}
          </form>
        </section>

        <aside className="checkout-summary" aria-labelledby="summary-heading">
          <div className="checkout-summary-inner">
            <p className="checkout-kicker">YOUR ORDER</p>
            <h2 id="summary-heading">Order summary</h2>
            <div className="checkout-summary-items">
              {cart.map((item) => (
                <div className="checkout-summary-item" key={itemKey(item)}>
                  <div className="checkout-summary-image">
                    <Image src={item.imageUrl} width={88} height={88} alt={`${item.name} fragrance`} />
                    <span>{item.quantity}</span>
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.concentration}% concentration · {item.volumeMl} ml</p>
                  </div>
                  <b>{money(item.price * item.quantity)}</b>
                </div>
              ))}
            </div>

            {/* Promo Code Input Section */}
            <div className="checkout-promo-box">
              {appliedPromo ? (
                <div className="checkout-promo-applied">
                  <div className="checkout-promo-info">
                    <span className="checkout-promo-tag-icon">🏷️</span>
                    <div>
                      <div className="checkout-promo-code-text">
                        <strong>{appliedPromo.code}</strong>
                        <span className="checkout-promo-value-badge">
                          {appliedPromo.discountType === "percentage"
                            ? `${appliedPromo.discountValue}% OFF`
                            : `PKR ${appliedPromo.discountValue} OFF`}
                        </span>
                      </div>
                      <small className="checkout-promo-savings">
                        You save {money(discountAmount)}
                        {appliedPromo.appliesTo === "specific" && " (on eligible items)"}
                      </small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="checkout-promo-remove-btn"
                    onClick={handleRemovePromo}
                    aria-label="Remove promo code"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="checkout-promo-form">
                  <div className="checkout-promo-input-wrap">
                    <input
                      type="text"
                      className="checkout-promo-input"
                      placeholder="Enter promo code"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value.toUpperCase());
                        if (promoError) setPromoError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyPromo(e);
                        }
                      }}
                      disabled={promoLoading}
                      aria-label="Promo code"
                    />
                    <button
                      type="button"
                      className="checkout-promo-apply-btn"
                      onClick={handleApplyPromo}
                      disabled={promoLoading || !promoInput.trim()}
                    >
                      {promoLoading ? "APPLYING…" : "APPLY"}
                    </button>
                  </div>
                </div>
              )}
              {promoError && <p className="checkout-promo-msg is-error">{promoError}</p>}
              {appliedPromo?.message && !promoError && (
                <p className="checkout-promo-msg is-success">{appliedPromo.message}</p>
              )}
            </div>

            <dl className="checkout-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              {appliedPromo && (
                <div className="checkout-promo-row">
                  <dt>
                    Promo code (<span className="checkout-promo-applied-code">{appliedPromo.code}</span>)
                  </dt>
                  <dd className="checkout-discount-val">- {money(discountAmount)}</dd>
                </div>
              )}
              <div>
                <dt>Shipping</dt>
                <dd>
                  {isAdvance ? (
                    <span className="checkout-free-shipping-display">
                      <span className="checkout-free-pill">FREE</span>
                      <s>{money(DELIVERY_FEE)}</s>
                    </span>
                  ) : (
                    money(DELIVERY_FEE)
                  )}
                </dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>
                  <small>PKR</small>
                  {money(total).replace("PKR ", "")}
                </dd>
              </div>
            </dl>
            <p className="checkout-summary-help">Need help with your order? <a href="https://wa.me/923129181720" target="_blank" rel="noreferrer">WhatsApp Xura Lab</a>.</p>
          </div>
        </aside>
      </div>

      <footer className="checkout-footer">
        <span>© 2026 Xura Lab · Registered in Rawalpindi, Pakistan</span>
        <Link href="/policies/refund-policy" target="_blank">Refund Policy</Link>
        <Link href="/policies/shipping-policy" target="_blank">Shipping Policy</Link>
        <Link href="/policies/privacy-policy" target="_blank">Privacy Policy</Link>
        <Link href="/policies/terms-of-service" target="_blank">Terms of Service</Link>
        <Link href="/contact" target="_blank">Contact</Link>
      </footer>
    </main>
  );
}

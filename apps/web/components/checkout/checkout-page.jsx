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
  const [selectedBank, setSelectedBank] = useState("JazzCash");
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptError, setReceiptError] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (receiptPreview) {
        URL.revokeObjectURL(receiptPreview);
      }
    };
  }, [receiptPreview]);

  const copyAccountDetails = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText("03129181720");
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 2000);
    }
  };

  const handleReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setReceiptError("Please select a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setReceiptError("Receipt file size cannot exceed 10MB.");
      return;
    }
    setReceiptError("");
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview);
    }
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleRemoveReceipt = () => {
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview);
    }
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptError("");
  };

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
    setReceiptError("");

    // Capture form values synchronously before any async await calls
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const shippingAddress = formAddress(formData, "shipping");
    const billingAddress = billingSame ? null : formAddress(formData, "billing");
    const email = formData.get("email");
    const phone = formData.get("phone");
    const marketingConsent = formData.get("marketingConsent") === "on";
    const shippingMethod = formData.get("shippingMethod");
    const orderNote = formData.get("orderNote");

    if (paymentMode === "advance" && !receiptFile) {
      setReceiptError("Please attach a photo or screenshot of your payment receipt to complete advance payment.");
      const dropzone = document.getElementById("checkout-receipt-section");
      if (dropzone) dropzone.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    let uploadedReceiptUrl = null;

    try {
      if (paymentMode === "advance" && receiptFile) {
        setStatus("Uploading your payment receipt…");
        const receiptFormData = new FormData();
        receiptFormData.append("receipt", receiptFile);
        const uploadRes = await fetch("/api/orders/receipt", {
          method: "POST",
          body: receiptFormData
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.receiptUrl) {
          throw new Error(uploadData.message || "Failed to upload payment receipt. Please try again.");
        }
        uploadedReceiptUrl = uploadData.receiptUrl;
      }

      setStatus("Placing your order…");
      const paymentMethod = paymentMode === "advance" ? "bank-transfer" : "cash-on-delivery";
      const payload = {
        email,
        phone,
        marketingConsent,
        shippingAddress,
        shippingMethod,
        paymentMethod,
        paymentReceiptUrl: uploadedReceiptUrl,
        paymentBank: paymentMode === "advance" ? selectedBank : null,
        transactionId: paymentMode === "advance" && transactionId.trim() ? transactionId.trim() : null,
        billingSameAsShipping: billingSame,
        billingAddress,
        orderNote,
        promoCode: appliedPromo?.code || null,
        items: cart.map((item) => ({
          productId: item.id,
          variantId: item.variantId || null,
          quantity: item.quantity,
          price: item.price,
          bundleSelectionText: item.bundleSelectionText || null,
          bundleSelections: item.bundleSelections || null
        }))
      };

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
        {confirmedOrder.paymentReceiptUrl && (
          <div className="checkout-confirmation-receipt-card">
            <div className="checkout-receipt-confirm-header">
              <span className="checkout-receipt-check">✓</span>
              <div>
                <strong>Advance Payment Received</strong>
                <p>Transfer via <strong>{confirmedOrder.paymentBank || "Advance Payment"}</strong> to Muhammad Aarib</p>
              </div>
            </div>
            {confirmedOrder.transactionId && (
              <p className="checkout-receipt-tid-confirm">
                Transaction ID: <strong>{confirmedOrder.transactionId}</strong>
              </p>
            )}
            <div className="checkout-receipt-preview-row">
              <a
                href={confirmedOrder.paymentReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="checkout-receipt-preview-link"
                title="View full receipt photo"
              >
                <img
                  src={confirmedOrder.paymentReceiptUrl}
                  alt="Payment receipt"
                  className="checkout-receipt-confirm-img"
                />
                <span>View Uploaded Receipt ↗</span>
              </a>
            </div>
            <p className="checkout-receipt-note">
              Our team will verify your transfer to Muhammad Aarib (03129181720) and dispatch your order.
            </p>
          </div>
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
                  <div className="checkout-advance-box" id="checkout-receipt-section">
                    <div className="checkout-advance-badge-row">
                      <span className="checkout-advance-free-pill">✓ 100% FREE NATIONWIDE COURIER DELIVERY</span>
                      <span className="checkout-advance-amount-pill">Total: {money(total)}</span>
                    </div>

                    <div className="checkout-advance-instructions">
                      <p className="checkout-advance-step-title">
                        1. Send <strong>{money(total)}</strong> to Muhammad Aarib
                      </p>

                      {/* Account Details Box */}
                      <div className="checkout-account-card">
                        <div className="checkout-account-row">
                          <span className="checkout-acc-label">Account Name:</span>
                          <strong className="checkout-acc-val">Muhammad Aarib</strong>
                        </div>
                        <div className="checkout-account-row">
                          <span className="checkout-acc-label">Account / Mobile:</span>
                          <div className="checkout-acc-number-wrap">
                            <strong className="checkout-acc-number">03129181720</strong>
                            <button
                              type="button"
                              className={`checkout-copy-btn ${copiedNumber ? "is-copied" : ""}`}
                              onClick={copyAccountDetails}
                              aria-label="Copy account number"
                            >
                              {copiedNumber ? "✓ Copied!" : "Copy Number"}
                            </button>
                          </div>
                        </div>
                        <div className="checkout-account-row">
                          <span className="checkout-acc-label">Banks / Wallets:</span>
                          <span className="checkout-acc-banks">JazzCash · Easypaisa · SadaPay</span>
                        </div>
                      </div>

                      {/* Bank / Wallet selection pills */}
                      <div className="checkout-bank-select-wrap">
                        <label className="checkout-step-sublabel">Select the wallet you transferred from:</label>
                        <div className="checkout-bank-pills" role="radiogroup" aria-label="Selected payment wallet">
                          {["JazzCash", "Easypaisa", "SadaPay"].map((bank) => (
                            <button
                              key={bank}
                              type="button"
                              role="radio"
                              aria-checked={selectedBank === bank}
                              className={`checkout-bank-pill ${selectedBank === bank ? "is-active" : ""}`}
                              onClick={() => setSelectedBank(bank)}
                            >
                              <span className="checkout-bank-pill-dot" />
                              <span>{bank}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Step 2: Receipt upload */}
                      <div className="checkout-receipt-upload-wrap">
                        <p className="checkout-advance-step-title">
                          2. Upload Payment Receipt / Screenshot <span className="checkout-required-star">*</span>
                        </p>
                        <p className="checkout-advance-subtext">
                          Upload the screenshot of your transfer so we can verify and approve your order.
                        </p>

                        {!receiptFile ? (
                          <label className="checkout-receipt-dropzone">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleReceiptFileChange}
                              className="sr-only"
                            />
                            <div className="checkout-dropzone-content">
                              <span className="checkout-dropzone-icon">📸</span>
                              <strong>Click to choose receipt photo / screenshot</strong>
                              <small>Supported formats: JPG, PNG, WebP (up to 10MB)</small>
                            </div>
                          </label>
                        ) : (
                          <div className="checkout-receipt-preview-card">
                            <div className="checkout-receipt-thumb-box">
                              <img src={receiptPreview} alt="Receipt preview" className="checkout-receipt-thumb-img" />
                            </div>
                            <div className="checkout-receipt-info">
                              <div className="checkout-receipt-verified-tag">✓ Receipt attached</div>
                              <strong className="checkout-receipt-filename">{receiptFile.name}</strong>
                              <small>{(receiptFile.size / 1024).toFixed(0)} KB · Ready for order verification</small>
                            </div>
                            <button
                              type="button"
                              className="checkout-receipt-remove-btn"
                              onClick={handleRemoveReceipt}
                              title="Remove receipt image"
                            >
                              Remove
                            </button>
                          </div>
                        )}

                        {receiptError && (
                          <p className="checkout-receipt-error" role="alert">
                            ⚠️ {receiptError}
                          </p>
                        )}
                      </div>

                      {/* Step 3: Optional Transaction ID */}
                      <div className="checkout-tid-wrap">
                        <label className="checkout-field">
                          <span>Transaction ID / TID <small>(optional)</small></span>
                          <input
                            type="text"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="e.g. 01849204928"
                            maxLength={100}
                          />
                        </label>
                      </div>
                    </div>
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
                    <Image
                      src={item.imageUrl || "/images/xura-hero-4k.jpg"}
                      width={88}
                      height={88}
                      alt={`${item.name} fragrance`}
                      unoptimized={Boolean(item.imageUrl && (item.imageUrl.startsWith("/uploads/") || item.imageUrl.startsWith("blob:")))}
                    />
                    <span>{item.quantity}</span>
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    {item.bundleSelectionText ? (
                      <p>{item.bundleSelectionText} · {item.volumeMl} ml each</p>
                    ) : (
                      <p>{item.concentration}% concentration · {item.volumeMl} ml</p>
                    )}
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

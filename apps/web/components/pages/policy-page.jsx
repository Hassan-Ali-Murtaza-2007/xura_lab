"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CartDrawer from "@/components/storefront/cart-drawer";
import { withCurrentProductImages } from "@/data/products";
import { BRAND_CONTACT, POLICIES_DATA, POLICIES_LIST } from "@/data/policies";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8.5h12l1 12H5l1-12Z" />
      <path d="M9 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: 18, height: 18 }}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.11 7.42C8.95 7.42 8.78 7.43 8.63 7.5C8.48 7.57 8.35 7.68 8.24 7.81C7.87 8.24 7.67 8.79 7.67 9.35C7.67 10.42 8.16 11.45 8.9 12.33C9.97 13.62 11.36 14.67 12.92 15.34C13.56 15.61 14.24 15.75 14.93 15.75C15.5 15.75 16.07 15.63 16.6 15.38C17.07 15.15 17.47 14.79 17.73 14.34C17.92 14.01 18.01 13.63 18.01 13.25C18.01 13.06 17.93 12.96 17.65 12.82L15.35 11.69C15.11 11.57 14.94 11.58 14.77 11.75C14.63 11.89 14.49 12.05 14.34 12.21C14.19 12.38 14.04 12.54 13.89 12.67C13.78 12.76 13.63 12.78 13.49 12.72C13.22 12.6 12.44 12.31 11.5 11.48C10.77 10.83 10.27 10.03 10.12 9.77C10.04 9.63 10.05 9.49 10.12 9.36C10.22 9.18 10.36 9.01 10.49 8.87C10.6 8.75 10.7 8.63 10.78 8.5C10.87 8.36 10.84 8.23 10.79 8.12L9.82 5.78C9.69 5.47 9.53 5.48 9.37 5.48C9.28 5.48 9.19 5.48 9.11 5.49" />
    </svg>
  );
}

export default function PolicyPageView({ initialSlug = "privacy-policy" }) {
  const router = useRouter();
  const [activeSlug, setActiveSlug] = useState(initialSlug);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync state if slug prop changes
  useEffect(() => {
    if (initialSlug && POLICIES_DATA[initialSlug]) {
      setActiveSlug(initialSlug);
    }
  }, [initialSlug]);

  useEffect(() => {
    const stored = window.localStorage.getItem("xura-cart");
    if (stored) {
      try {
        setCart(withCurrentProductImages(JSON.parse(stored)));
      } catch {
        window.localStorage.removeItem("xura-cart");
      }
    }
    setCartHydrated(true);
  }, []);

  useEffect(() => {
    if (!cartHydrated) return;
    window.localStorage.setItem("xura-cart", JSON.stringify(cart));
  }, [cart, cartHydrated]);

  useEffect(() => {
    document.body.classList.toggle("is-locked", cartOpen || mobileOpen);
    return () => document.body.classList.remove("is-locked");
  }, [cartOpen, mobileOpen]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0);

  const currentPolicy = useMemo(() => {
    return POLICIES_DATA[activeSlug] || POLICIES_DATA["privacy-policy"];
  }, [activeSlug]);

  function handleSelectPolicy(slug) {
    setActiveSlug(slug);
    window.history.replaceState(null, "", `/policies/${slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (!search.trim()) return;
    router.push(`/collections?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className="policy-page">
      {/* Standard Sitewide Header */}
      <header className="site-header">
        <div className="header-primary shell">
          <form className="search-control" onSubmit={handleSearchSubmit}>
            <SearchIcon />
            <label className="sr-only" htmlFor="policy-search">Search fragrances</label>
            <input
              id="policy-search"
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search collection"
            />
          </form>

          <Link className="wordmark" href="/" aria-label="Xura Lab home">
            <span>XURA LAB</span>
            <small>FRAGRANCE</small>
          </Link>

          <button
            className="cart-trigger"
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open shopping bag, ${cartCount} items`}
          >
            <BagIcon />
            <span>Cart ({cartCount})</span>
          </button>

          <button
            className="menu-trigger"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <span />
            <span />
          </button>
        </div>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/">Home</Link>
          <Link href="/collections">Collection</Link>
          <Link href="/?gender=Men#collection">Men</Link>
          <Link href="/?gender=Unisex#collection">Unisex</Link>
          <Link href="/?gender=Women#collection">Women</Link>
          <Link href="/?gender=Testers#collection">Testers</Link>
          <Link href="/?gender=Bundles#collection">Bundles</Link>
          <Link href="/about">About us</Link>
          <Link href="/contact">Contact us</Link>
          <Link className="is-active" href="/policies" aria-current="page">Policies</Link>
        </nav>
      </header>

      {/* Sitewide Mobile Menu */}
      <div className={`mobile-menu ${mobileOpen ? "is-open" : ""}`} aria-hidden={!mobileOpen}>
        <button className="mobile-menu-scrim" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
        <nav aria-label="Mobile navigation">
          <button className="icon-button" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <CloseIcon />
          </button>
          <Link href="/" onClick={() => setMobileOpen(false)}>Home</Link>
          <Link href="/collections" onClick={() => setMobileOpen(false)}>Collection</Link>
          <Link href="/?gender=Men#collection" onClick={() => setMobileOpen(false)}>Men</Link>
          <Link href="/?gender=Unisex#collection" onClick={() => setMobileOpen(false)}>Unisex</Link>
          <Link href="/?gender=Women#collection" onClick={() => setMobileOpen(false)}>Women</Link>
          <Link href="/?gender=Testers#collection" onClick={() => setMobileOpen(false)}>Testers</Link>
          <Link href="/?gender=Bundles#collection" onClick={() => setMobileOpen(false)}>Bundles</Link>
          <Link href="/about" onClick={() => setMobileOpen(false)}>About us</Link>
          <Link href="/contact" onClick={() => setMobileOpen(false)}>Contact us</Link>
          <Link className="is-active" href="/policies" onClick={() => setMobileOpen(false)}>Policies</Link>
        </nav>
      </div>

      <main className="policy-main">
        {/* Editorial Hero Banner */}
        <section className="policy-hero">
          <div className="shell">
            <div className="policy-hero-breadcrumbs">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>Client Care</span>
              <span>/</span>
              <span>{currentPolicy.shortTitle}</span>
            </div>

            <p className="eyebrow">{currentPolicy.eyebrow}</p>
            <h1>{currentPolicy.title}</h1>
            <p className="policy-hero-lead">{currentPolicy.summary}</p>

            <div className="policy-meta-strip">
              <div>
                <span>EFFECTIVE DATE</span>
                <strong>{BRAND_CONTACT.effectiveDate}</strong>
              </div>
              <div>
                <span>BRAND HOUSE</span>
                <strong>{BRAND_CONTACT.brandName}</strong>
              </div>
              <div>
                <span>WEBSITE</span>
                <strong>{BRAND_CONTACT.website}</strong>
              </div>
              <div>
                <span>REGISTERED AT</span>
                <strong>{BRAND_CONTACT.formattedLocation}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Horizontal Mobile / Sticky Tab Switcher */}
        <nav className="policy-tabs-bar" aria-label="Website Policies Navigation">
          <div className="shell policy-tabs-inner">
            {POLICIES_LIST.map((policy) => {
              const isCurrent = policy.slug === currentPolicy.slug;
              return (
                <button
                  key={policy.slug}
                  type="button"
                  className={`policy-tab-btn ${isCurrent ? "is-active" : ""}`}
                  onClick={() => handleSelectPolicy(policy.slug)}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  <span className="policy-tab-indicator" aria-hidden="true" />
                  <span>{policy.shortTitle}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Two-Column Layout */}
        <div className="shell policy-body-layout">
          {/* Sticky Sidebar */}
          <aside className="policy-sidebar">
            <div className="policy-sidebar-sticky">
              <div className="policy-sidebar-box">
                <span className="policy-sidebar-label">POLICIES CATALOGUE</span>
                <ul className="policy-nav-list">
                  {POLICIES_LIST.map((p) => {
                    const isSelected = p.slug === currentPolicy.slug;
                    return (
                      <li key={p.slug}>
                        <button
                          type="button"
                          className={`policy-nav-link ${isSelected ? "is-active" : ""}`}
                          onClick={() => handleSelectPolicy(p.slug)}
                        >
                          <span>{p.title}</span>
                          {isSelected && <span className="policy-nav-arrow" aria-hidden="true">→</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Table of Contents for Current Policy */}
              <div className="policy-sidebar-box policy-toc-box">
                <span className="policy-sidebar-label">IN THIS POLICY</span>
                <nav className="policy-toc-nav" aria-label="Table of contents">
                  {currentPolicy.sections.map((sec) => (
                    <a key={sec.num} href={`#section-${sec.num}`} className="policy-toc-link">
                      <small>{sec.num}</small>
                      <span>{sec.heading}</span>
                    </a>
                  ))}
                </nav>
              </div>

              {/* Client Care & Direct Contact Card */}
              <div className="policy-sidebar-box policy-contact-card">
                <div className="policy-contact-badge">
                  <ShieldCheckIcon />
                  <span>CLIENT CARE & SUPPORT</span>
                </div>
                <h3>Need assistance or have a question?</h3>
                <p>Our dedicated team in Rawalpindi is here to assist with order verifications, courier tracking, and return requests.</p>

                <div className="policy-contact-links">
                  <a
                    className="policy-contact-whatsapp-btn"
                    href={BRAND_CONTACT.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WhatsAppIcon />
                    <span>WhatsApp: {BRAND_CONTACT.phone}</span>
                  </a>
                  <a className="policy-contact-email-link" href={`mailto:${BRAND_CONTACT.email}`}>
                    Email: {BRAND_CONTACT.email}
                  </a>
                </div>

                <div className="policy-contact-meta">
                  <p><strong>Support Hours:</strong> {BRAND_CONTACT.supportHours}</p>
                  <p><strong>Location:</strong> {BRAND_CONTACT.formattedLocation}</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Article Content */}
          <article className="policy-article">
            {/* Highlights Bar */}
            {currentPolicy.highlights && (
              <div className="policy-highlights-grid">
                {currentPolicy.highlights.map((h, i) => (
                  <div className="policy-highlight-card" key={i}>
                    <span className="policy-highlight-number">0{i + 1}</span>
                    <strong>{h.label}</strong>
                    <p>{h.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Policy Sections */}
            <div className="policy-sections-container">
              {currentPolicy.sections.map((section) => (
                <section
                  key={section.num}
                  id={`section-${section.num}`}
                  className="policy-section"
                >
                  <div className="policy-section-header">
                    <span className="policy-section-num">{section.num}</span>
                    <h2>{section.heading}</h2>
                  </div>

                  {section.lead && (
                    <p className="policy-section-lead">{section.lead}</p>
                  )}

                  {section.content && section.content.map((p, idx) => (
                    <p key={idx} className="policy-paragraph">{p}</p>
                  ))}

                  {section.items && (
                    <div className="policy-items-grid">
                      {section.items.map((item, idx) => (
                        <div key={idx} className="policy-item-row">
                          <strong className="policy-item-title">{item.title}:</strong>
                          <span className="policy-item-text">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {section.bullets && (
                    <ul className="policy-bullet-list">
                      {section.bullets.map((bullet, idx) => (
                        <li key={idx}>{bullet}</li>
                      ))}
                    </ul>
                  )}

                  {section.footerNote && (
                    <div className="policy-note-card">
                      <p>{section.footerNote}</p>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Bottom Support Banner */}
            <div className="policy-bottom-banner">
              <div>
                <p className="eyebrow">HERE TO ASSIST</p>
                <h3>Have questions regarding this policy?</h3>
                <p>
                  Speak directly with our client care team on WhatsApp or write to us at {BRAND_CONTACT.email}.
                  We ensure prompt, clear answers for every customer.
                </p>
              </div>
              <div className="policy-bottom-actions">
                <a
                  className="policy-primary-btn"
                  href={BRAND_CONTACT.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <WhatsAppIcon />
                  <span>CHAT ON WHATSAPP</span>
                </a>
                <Link className="policy-secondary-btn" href="/contact">
                  CONTACT PAGE →
                </Link>
              </div>
            </div>
          </article>
        </div>
      </main>

      {/* Sitewide Luxury Footer with Client Care / Policies column */}
      <footer className="site-footer" id="contact">
        <div className="shell footer-inner">
          <div className="footer-brand">
            <div className="footer-brand-mark">
              <Image src="/images/xura-logo-4k.png" width={4096} height={4096} alt="Xura Lab" />
            </div>
            <span className="footer-brand-tagline">FRAGRANCE</span>
          </div>

          <div className="footer-column footer-shop">
            <h3>Shop</h3>
            <Link href="/collections">All Fragrances</Link>
            <Link href="/?gender=Men#collection">Men</Link>
            <Link href="/?gender=Unisex#collection">Unisex</Link>
            <Link href="/?gender=Women#collection">Women</Link>
            <Link href="/?gender=Testers#collection">Testers</Link>
            <Link href="/?gender=Bundles#collection">Bundles</Link>
          </div>

          <div className="footer-column footer-policies">
            <h3>Client Care</h3>
            <Link href="/policies/privacy-policy">Privacy Policy</Link>
            <Link href="/policies/refund-policy">Return & Refund Policy</Link>
            <Link href="/policies/shipping-policy">Shipping & Delivery</Link>
            <Link href="/policies/terms-of-service">Terms & Conditions</Link>
          </div>

          <div className="footer-column footer-contact">
            <h3>Contact</h3>
            <a href={`tel:${BRAND_CONTACT.formattedPhone}`}>{BRAND_CONTACT.formattedPhone}</a>
            <a href={BRAND_CONTACT.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp: {BRAND_CONTACT.phone}</a>
            <a href={`mailto:${BRAND_CONTACT.email}`}>{BRAND_CONTACT.email}</a>
            <small style={{ color: "#777a74", marginTop: "4px" }}>{BRAND_CONTACT.formattedLocation}</small>
          </div>

          <div className="footer-column footer-social">
            <h3>Social</h3>
            <a href="https://instagram.com/xura.lab" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://x.com/" target="_blank" rel="noreferrer">Twitter</a>
            <a href="https://facebook.com/" target="_blank" rel="noreferrer">Facebook</a>
            <a href="https://tiktok.com/" target="_blank" rel="noreferrer">TikTok</a>
          </div>

          <div className="copyright-row">
            <p className="copyright">© 2026 Xura Lab. All prices in PKR. Registered in Rawalpindi, Pakistan.</p>
            <div className="copyright-links">
              <Link href="/policies/privacy-policy">Privacy</Link>
              <span>·</span>
              <Link href="/policies/terms-of-service">Terms</Link>
              <span>·</span>
              <Link href="/policies/refund-policy">Refunds</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer
        cart={cart}
        cartOpen={cartOpen}
        cartTotal={cartTotal}
        onClose={() => setCartOpen(false)}
        onUpdateQuantity={(key, qty) => {
          setCart((current) => {
            if (qty <= 0) return current.filter((it) => (it.cartKey || `${it.id}:${it.variantId || "base"}`) !== key);
            return current.map((it) => ((it.cartKey || `${it.id}:${it.variantId || "base"}`) === key ? { ...it, quantity: qty } : it));
          });
        }}
      />
    </div>
  );
}

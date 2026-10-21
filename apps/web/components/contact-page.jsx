"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CartDrawer from "@/components/cart-drawer";
import { withCurrentProductImages } from "@/data/products";

const itemKey = (item) => item.cartKey || `${item.id}:${item.variantId || "base"}`;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8.5h12l1 12H5l1-12Z" />
      <path d="M9 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d="M23 13.2a9.2 9.2 0 0 1-13.5 8.1L5 22.6l1.4-4.2A9.2 9.2 0 1 1 23 13.2Z" />
      <path d="M10.1 10.2c.7 3.1 2.4 4.8 5.6 5.7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d="M8.2 4.8 5.4 7.3c.2 7.8 7.5 15.1 15.3 15.3l2.5-2.8-4.7-4-2.3 2.1c-2.9-1.2-4.9-3.2-6.1-6.1l2.1-2.3-4-4.7Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <rect x="3.5" y="6" width="21" height="16" rx="1" />
      <path d="m4.5 7 9.5 8 9.5-8" />
    </svg>
  );
}

export default function ContactPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  function updateQuantity(key, quantity) {
    setCart((items) => items
      .map((item) => itemKey(item) === key ? { ...item, quantity } : item)
      .filter((item) => item.quantity > 0));
  }

  function submitSearch(event) {
    event.preventDefault();
    const value = search.trim();
    router.push(value ? `/?search=${encodeURIComponent(value)}#collection` : "/#collection");
  }

  return (
    <>
      <header className="site-header">
        <div className="header-primary shell">
          <form className="search-control" onSubmit={submitSearch}>
            <SearchIcon />
            <label className="sr-only" htmlFor="contact-search">Search fragrances</label>
            <input id="contact-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" />
          </form>
          <Link className="wordmark" href="/" aria-label="Xura Lab home">
            <span>XURA LAB</span>
            <small>FRAGRANCE</small>
          </Link>
          <button className="cart-trigger" type="button" onClick={() => setCartOpen(true)} aria-label={`Open cart with ${cartCount} items`}>
            <BagIcon />
            <span>Cart ({cartCount})</span>
          </button>
          <button className="menu-trigger" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <span />
            <span />
          </button>
        </div>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/">Home</Link>
          <Link href="/?gender=Men#collection">Men</Link>
          <Link href="/?gender=Unisex#collection">Unisex</Link>
          <Link href="/?gender=Women#collection">Women</Link>
          <Link href="/about">About us</Link>
          <Link className="is-active" href="/contact" aria-current="page">Contact us</Link>
        </nav>
      </header>

      <main className="contact-page" id="top">
        <section className="contact-hero shell">
          <div className="contact-hero-copy">
            <p className="eyebrow">CONTACT XURA LAB</p>
            <h1>Some choices deserve a conversation.</h1>
            <p>Whether you are discovering your first Xura Lab fragrance, deciding between concentrations, or checking on an order, speak with us directly. We are here to help you find what feels right—not simply what is familiar.</p>
            <div className="contact-hero-actions">
              <a className="contact-primary-action" href="https://wa.me/923129181720" target="_blank" rel="noreferrer">Message on WhatsApp <span aria-hidden="true">↗</span></a>
              <a className="contact-secondary-action" href="mailto:contact@xuralab.com">Send an email</a>
            </div>
          </div>
          <div className="contact-hero-image">
            <Image src="/images/xura-story-4k.jpg" alt="Xura Lab fragrances arranged in warm light" fill priority sizes="(max-width: 720px) calc(100vw - 32px), 52vw" />
            <div className="contact-image-note">
              <span>PERSONAL GUIDANCE</span>
              <p>A thoughtful answer begins with understanding what you want to feel.</p>
            </div>
          </div>
        </section>

        <section className="contact-methods">
          <div className="shell">
            <div className="contact-section-heading">
              <p className="eyebrow">REACH US DIRECTLY</p>
              <h2>Choose the way that feels easiest.</h2>
              <p>No complicated process. Just a direct line to Xura Lab for scent guidance, order questions, and everything in between.</p>
            </div>
            <div className="contact-method-grid">
              <a className="contact-method-card contact-method-featured" href="https://wa.me/923129181720" target="_blank" rel="noreferrer">
                <span className="contact-method-icon"><MessageIcon /></span>
                <span className="contact-method-label">WHATSAPP</span>
                <strong>Start a conversation</strong>
                <p>Message us when you want quick, direct guidance about a fragrance or an order.</p>
                <span className="contact-method-value">0312 9181720 <b aria-hidden="true">↗</b></span>
              </a>
              <a className="contact-method-card" href="tel:+923129181720">
                <span className="contact-method-icon"><PhoneIcon /></span>
                <span className="contact-method-label">SIM CALL</span>
                <strong>Speak with us</strong>
                <p>Call when a conversation feels easier than typing out the details.</p>
                <span className="contact-method-value">0312 9181720 <b aria-hidden="true">↗</b></span>
              </a>
              <a className="contact-method-card" href="mailto:contact@xuralab.com">
                <span className="contact-method-icon"><MailIcon /></span>
                <span className="contact-method-label">EMAIL</span>
                <strong>Write to Xura Lab</strong>
                <p>Ideal for detailed questions, order information, or anything you would like to explain fully.</p>
                <span className="contact-method-value contact-email-value">contact@xuralab.com <b aria-hidden="true">↗</b></span>
              </a>
            </div>
          </div>
        </section>

        <section className="contact-guide shell">
          <div className="contact-guide-intro">
            <p className="eyebrow">BEFORE YOU MESSAGE</p>
            <h2>A little context helps us guide you beautifully.</h2>
            <p>You do not need to know perfume terminology. Tell us what you are drawn to, how you want the fragrance to feel, or simply where you plan to wear it.</p>
          </div>
          <ol className="contact-guide-list">
            <li><span>01</span><p>The fragrance—or kind of feeling—you are considering.</p></li>
            <li><span>02</span><p>Your preferred concentration, if you already have one in mind.</p></li>
            <li><span>03</span><p>The occasion, mood, or time of day you are choosing it for.</p></li>
            <li><span>04</span><p>Your order number when you are following up on an existing order.</p></li>
          </ol>
        </section>

        <section className="contact-closing">
          <div className="shell contact-closing-inner">
            <p className="eyebrow">A PERSONAL INVITATION</p>
            <h2>Your fragrance should feel personal. So should the conversation.</h2>
            <p>Tell us what you are looking for. We will help you move beyond the familiar and closer to your own.</p>
            <div className="contact-closing-actions">
              <a href="https://wa.me/923129181720" target="_blank" rel="noreferrer">WhatsApp us</a>
              <a href="mailto:contact@xuralab.com">contact@xuralab.com</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="contact-footer">
        <div className="shell footer-inner">
          <div className="footer-brand">
            <div className="footer-brand-mark">
              <Image src="/images/xura-logo-4k.png" width={4096} height={4096} alt="Xura Lab" />
            </div>
            <span className="footer-brand-tagline">FRAGRANCE</span>
          </div>
          <div className="footer-column">
            <h3>Contact</h3>
            <a href="tel:+923129181720">+92 312 9181720</a>
            <a href="mailto:contact@xuralab.com">contact@xuralab.com</a>
          </div>
          <div className="footer-column footer-shop">
            <h3>Shop</h3>
            <Link href="/?gender=Men#collection">Men</Link>
            <Link href="/?gender=Unisex#collection">Unisex</Link>
            <Link href="/?gender=Women#collection">Women</Link>
          </div>
          <div className="footer-column footer-social">
            <h3>Social</h3>
            <a href="https://x.com/" target="_blank" rel="noreferrer">Twitter</a>
            <a href="https://instagram.com/xura.lab" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://facebook.com/" target="_blank" rel="noreferrer">Facebook</a>
            <a href="https://tiktok.com/" target="_blank" rel="noreferrer">TikTok</a>
          </div>
          <p className="copyright">© 2026 Xura Lab. All prices in PKR.</p>
        </div>
      </footer>

      <CartDrawer
        cart={cart}
        cartOpen={cartOpen}
        cartTotal={cartTotal}
        onClose={() => setCartOpen(false)}
        onUpdateQuantity={updateQuantity}
      />

      <div className={`mobile-menu ${mobileOpen ? "is-open" : ""}`} aria-hidden={!mobileOpen}>
        <button className="mobile-menu-scrim" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
        <nav aria-label="Mobile navigation">
          <button className="icon-button" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><CloseIcon /></button>
          <Link href="/">Home</Link>
          <Link href="/?gender=Men#collection">Men</Link>
          <Link href="/?gender=Unisex#collection">Unisex</Link>
          <Link href="/?gender=Women#collection">Women</Link>
          <Link href="/about">About us</Link>
          <Link href="/contact" aria-current="page">Contact us</Link>
        </nav>
      </div>
    </>
  );
}

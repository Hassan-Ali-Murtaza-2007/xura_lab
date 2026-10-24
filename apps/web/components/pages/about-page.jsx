"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CartDrawer from "@/components/storefront/cart-drawer";
import { productCatalog, withCurrentProductImages } from "@/data/products";

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

export default function AboutPage() {
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
            <label className="sr-only" htmlFor="about-search">Search fragrances</label>
            <input id="about-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" />
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
          <Link href="/?gender=Testers#collection">Testers</Link>
          <Link href="/?gender=Bundles#collection">Bundles</Link>
          <Link className="is-active" href="/about" aria-current="page">About us</Link>
          <Link href="/contact">Contact us</Link>
        </nav>
      </header>

      <main className="about-page" id="top">
        <section className="about-hero shell">
          <div className="about-hero-copy">
            <p className="eyebrow">THE HOUSE OF XURA LAB</p>
            <h1>Fragrance,<br />returned to the self.</h1>
            <p className="about-hero-lead">Xura Lab is an invitation to move beyond familiar names, borrowed tastes, and expected choices—and discover the scent that feels unmistakably your own.</p>
            <Link className="about-text-link" href="/collections">Explore the collection <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="about-hero-image">
            <Image src="/images/xura-story-4k.jpg" alt="Arven, Velor, and Nyra fragrances arranged with amber resin and oud wood" fill priority sizes="(max-width: 720px) calc(100vw - 32px), 54vw" />
          </div>
        </section>

        <section className="about-manifesto">
          <div className="shell about-manifesto-inner">
            <p className="eyebrow">OUR POINT OF VIEW</p>
            <h2>Perfume is the most invisible thing you wear—and often the most remembered.</h2>
            <div className="about-manifesto-copy">
              <p>We believe fragrance should begin with curiosity, not rules. Not who a scent is marketed to. Not what everyone else is wearing. Simply: what moves you?</p>
              <p>The right fragrance does more than complete a look. It becomes a private atmosphere, a trace of presence, a feeling that belongs to you before it belongs to anyone else.</p>
            </div>
          </div>
        </section>

        <section className="about-belief shell">
          <div className="about-belief-image">
            <Image src="/images/xura-hero-4k.jpg" alt="The Xura Lab fragrance collection in warm evening light" fill sizes="(max-width: 720px) calc(100vw - 32px), 58vw" />
          </div>
          <div className="about-belief-copy">
            <p className="eyebrow">BEYOND THE FAMILIAR</p>
            <h2>Character begins where imitation ends.</h2>
            <p>Our point of view is simple: a fragrance earns meaning through the person who wears it. We shape every Xura Lab scent around a clear emotional character—bold, refined, luminous—then leave space for your story to enter.</p>
            <p>That is why the collection is small and intentional. Three distinct expressions. Multiple concentrations. No single definition of who you should be.</p>
          </div>
        </section>

        <section className="about-principles">
          <div className="shell">
            <div className="about-section-heading">
              <p className="eyebrow">WHAT GUIDES US</p>
              <h2>A quieter kind of confidence.</h2>
            </div>
            <div className="about-principle-grid">
              <article>
                <span>01</span>
                <h3>Character over imitation</h3>
                <p>A fragrance should reveal something personal—not make you disappear into somebody else’s idea of taste.</p>
              </article>
              <article>
                <span>02</span>
                <h3>Intention over excess</h3>
                <p>Every note should have a reason to be there. Presence does not need noise; it needs clarity.</p>
              </article>
              <article>
                <span>03</span>
                <h3>Connection over convention</h3>
                <p>Labels can guide you, but instinct should decide. The scent that feels right is the scent that belongs to you.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="about-scents shell" id="fragrances">
          <div className="about-section-heading about-scents-heading">
            <p className="eyebrow">THE COLLECTION</p>
            <h2>Three moods. One instinct: your own.</h2>
          </div>
          <div className="about-scent-grid">
            {productCatalog.map((product, index) => (
              <Link className="about-scent-card" href={`/products/${product.slug}`} key={product.id}>
                <div className="about-scent-image">
                  <Image src={product.imageUrl} alt={`${product.name} fragrance`} fill loading="eager" sizes="(max-width: 720px) calc(100vw - 32px), 33vw" />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div>
                  <h3>{product.name}</h3>
                  <p>{product.lead}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="about-closing">
          <div className="shell about-closing-inner">
            <p className="eyebrow">AN INVITATION</p>
            <h2>You do not need a signature chosen for you.</h2>
            <p>Meet the fragrance that feels like it was waiting for you.</p>
            <Link href="/collections">Find your scent</Link>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="contact">
        <div className="shell footer-inner">
          <div className="footer-brand">
            <div className="footer-brand-mark">
              <Image src="/images/xura-brand-mark.png" width={1060} height={1090} alt="Xura Lab" unoptimized priority />
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
            <a href="tel:+923129181720">+92 312 9181720</a>
            <a href="https://wa.me/923129181720" target="_blank" rel="noreferrer">WhatsApp: 0312 9181720</a>
            <a href="mailto:contact@xuralab.com">contact@xuralab.com</a>
            <small style={{ color: "#777a74", marginTop: "4px" }}>Nussah town khanna pul Rawalpindi</small>
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
          <Link href="/?gender=Testers#collection">Testers</Link>
          <Link href="/?gender=Bundles#collection">Bundles</Link>
          <Link href="/about" aria-current="page">About us</Link>
          <Link href="/contact">Contact us</Link>
        </nav>
      </div>
    </>
  );
}

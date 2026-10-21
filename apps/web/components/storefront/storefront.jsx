"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CartDrawer from "./cart-drawer";
import { productCatalog, withCurrentProductImages } from "@/data/products";

const fallbackProducts = productCatalog;

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const money = (value) => `PKR ${number.format(Number(value))}`;
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

export default function Storefront() {
  const [products, setProducts] = useState(fallbackProducts);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("All");
  const [sort, setSort] = useState("featured");
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [cartHydrated, setCartHydrated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedGender = params.get("gender");
    const requestedSearch = params.get("search");
    if (["Men", "Women", "Unisex"].includes(requestedGender)) setGender(requestedGender);
    if (requestedSearch) setQuery(requestedSearch);

    const stored = window.localStorage.getItem("xura-cart");
    if (stored) {
      try {
        setCart(withCurrentProductImages(JSON.parse(stored)));
      } catch {
        window.localStorage.removeItem("xura-cart");
      }
    }
    setCartHydrated(true);

    fetch("/api/products")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (Array.isArray(data.products) && data.products.length) {
          setProducts(data.products);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cartHydrated) return;
    window.localStorage.setItem("xura-cart", JSON.stringify(cart));
  }, [cart, cartHydrated]);

  useEffect(() => {
    const shouldLock = cartOpen || mobileOpen;
    document.body.classList.toggle("is-locked", Boolean(shouldLock));
    return () => document.body.classList.remove("is-locked");
  }, [cartOpen, mobileOpen]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesGender = gender === "All" || product.gender === gender;
      const matchesQuery = !normalizedQuery || `${product.name} ${product.tagline} ${product.gender}`.toLowerCase().includes(normalizedQuery);
      return matchesGender && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "price-low") return Number(a.price) - Number(b.price);
      if (sort === "price-high") return Number(b.price) - Number(a.price);
      if (sort === "name") return a.name.localeCompare(b.name);
      return Number(a.sortOrder) - Number(b.sortOrder);
    });
  }, [gender, products, query, sort]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0);

  function updateQuantity(key, quantity) {
    setCart((items) => items
      .map((item) => itemKey(item) === key ? { ...item, quantity } : item)
      .filter((item) => item.quantity > 0));
  }

  function addToCart(product) {
    const defaultVariant = product.variants?.[0];
    if (!defaultVariant) return;

    const cartKey = `${product.id}:${defaultVariant.id}`;
    const newItem = {
      id: product.id,
      variantId: defaultVariant.id,
      cartKey,
      slug: product.slug,
      name: product.name,
      gender: product.gender,
      volumeMl: product.volumeMl,
      concentration: defaultVariant.concentrationPercent,
      price: defaultVariant.price,
      imageUrl: product.imageUrl,
      quantity: 1
    };

    setCart((items) => {
      const existing = items.find((item) => itemKey(item) === cartKey);
      if (existing) {
        return items.map((item) => itemKey(item) === cartKey ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...items, newItem];
    });
    setCartOpen(true);
  }

  function chooseGender(nextGender) {
    setGender(nextGender);
    setMobileOpen(false);
    document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" });
  }

  function showHome(event) {
    event.preventDefault();
    setGender("All");
    setQuery("");
    setMobileOpen(false);
    window.history.replaceState({}, "", "/#top");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <header className="site-header">
        <div className="header-primary shell">
          <label className="search-control">
            <SearchIcon />
            <span className="sr-only">Search fragrances</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
          </label>

          <a className="wordmark" href="#top" onClick={showHome} aria-label="Xura Lab home">
            <span>XURA LAB</span>
            <small>FRAGRANCE</small>
          </a>

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
          <a href="#top" onClick={showHome}>Home</a>
          <button type="button" onClick={() => chooseGender("Men")}>Men</button>
          <button type="button" onClick={() => chooseGender("Unisex")}>Unisex</button>
          <button type="button" onClick={() => chooseGender("Women")}>Women</button>
          <Link href="/about">About us</Link>
          <Link href="/contact">Contact us</Link>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-label="Xura Lab fragrance collection">
          <Image src="/images/xura-hero-4k.jpg" alt="Velor, Arven, and Nyra fragrance bottles" fill priority sizes="100vw" />
        </section>

        <section className="intro shell">
          <h1>Fragrance beyond familiarity.</h1>
          <Link href="/collections">Shop the collection</Link>
        </section>

        <section className="collection shell" id="collection">
          <div className="collection-toolbar">
            <div>
              <p className="eyebrow">COLLECTION</p>
              <p className="muted-count">
                <span className="home-count-desktop">{visibleProducts.length} {visibleProducts.length === 1 ? "fragrance" : "fragrances"}</span>
                <span className="home-count-mobile">{Math.min(visibleProducts.length, 4)} {Math.min(visibleProducts.length, 4) === 1 ? "fragrance" : "fragrances"}</span>
              </p>
            </div>
            <label className="sort-control">
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-low">Price, low to high</option>
                <option value="price-high">Price, high to low</option>
                <option value="name">Alphabetically</option>
              </select>
            </label>
          </div>

          <div className="product-grid home-product-grid">
            {visibleProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-image">
                  <Link className="product-image-link" href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
                    <Image src={product.imageUrl} alt={`${product.name} fragrance`} fill sizes="(max-width: 680px) 100vw, (max-width: 960px) 50vw, 33vw" />
                  </Link>
                  <button className="quick-view" type="button" onClick={() => addToCart(product)}>Add to cart</button>
                </div>
                <Link className="product-meta" href={`/products/${product.slug}`}>
                  <span className="product-row">
                    <span>{product.name}</span>
                    <span>From {money(product.price)}</span>
                  </span>
                  <span className="product-detail">{product.gender} · {product.volumeMl} ml</span>
                </Link>
              </article>
            ))}
          </div>

          {visibleProducts.length > 0 && (
            <div className="collection-explore-action">
              <Link href="/collections">Explore the full collection <span aria-hidden="true">→</span></Link>
            </div>
          )}

          {!visibleProducts.length && (
            <div className="empty-state">
              <p>No fragrances match that search.</p>
              <button type="button" onClick={() => { setQuery(""); setGender("All"); }}>Clear filters</button>
            </div>
          )}
        </section>

        <section className="story shell" id="story">
          <div className="story-image">
            <Image
              src="/images/xura-story-4k.jpg"
              alt="Arven, Velor, and Nyra fragrances arranged with amber resin and oud wood"
              fill
              sizes="(max-width: 720px) calc(100vw - 32px), (max-width: 1280px) calc(50vw - 32px), 608px"
            />
          </div>
          <div className="story-copy">
            <p className="eyebrow">OUR STORY</p>
            <h2>Fragrance should be a personal experience, not just a borrowed identity.</h2>
            <p>A scent can remind you of a place you have never visited, capture a feeling you cannot explain, or become something people associate with you alone. It does not need a famous name to mean something. It needs character, intention, and the right connection with the person wearing it.</p>
            <p>We are here to encourage you to discover what you love, question what you have been told to love, and find a scent that feels like you.</p>
            <p className="story-signoff">Beyond the familiar. Into your own.</p>
          </div>
        </section>

        <section className="purchasing shell">
          <p className="eyebrow">PURCHASING</p>
          <div className="purchase-grid">
            <div>
              <h3>How to order</h3>
              <p>Choose a fragrance, add it to your cart and complete the checkout form with your delivery details and preferred payment method. You review the full order before confirming.</p>
            </div>
            <div>
              <h3>Payment</h3>
              <p>Payment card, Easypaisa, JazzCash, SadaPay, or bank transfer to Askari Bank or Meezan Bank. All prices are in Pakistani rupees (PKR).</p>
            </div>
            <div>
              <h3>Delivery</h3>
              <p>Delivery fee: PKR 370. [Delivery areas and delivery time.] [Returns and exchange policy.]</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="contact">
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
            <button type="button" onClick={() => chooseGender("Men")}>Men</button>
            <button type="button" onClick={() => chooseGender("Unisex")}>Unisex</button>
            <button type="button" onClick={() => chooseGender("Women")}>Women</button>
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
          <a href="#top" onClick={showHome}>Home</a>
          <button type="button" onClick={() => chooseGender("Men")}>Men</button>
          <button type="button" onClick={() => chooseGender("Unisex")}>Unisex</button>
          <button type="button" onClick={() => chooseGender("Women")}>Women</button>
          <Link href="/about">About us</Link>
          <Link href="/contact">Contact us</Link>
        </nav>
      </div>
    </>
  );
}

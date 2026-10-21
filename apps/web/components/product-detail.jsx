"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CartDrawer from "@/components/cart-drawer";
import { withCurrentProductImages } from "@/data/products";

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

export default function ProductDetail({ product }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSpecifications, setOpenSpecifications] = useState([]);
  const productImages = useMemo(() => product.images?.length ? product.images : [product.imageUrl], [product]);
  const [activeImage, setActiveImage] = useState(productImages[0]);

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

  useEffect(() => {
    setSelectedVariant(product.variants[0]);
    setQuantity(1);
    setOpenSpecifications([]);
    setActiveImage(productImages[0]);
  }, [product, productImages]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
  const specifications = useMemo(() => [
    ["Concentration", `${selectedVariant.concentrationPercent}%`],
    ["Bottle size", `${product.volumeMl} ml`],
    ["Notes", product.notes],
    ["For", product.gender],
    ["Character", product.character],
    ["Best for", product.bestFor]
  ], [product, selectedVariant]);

  function addToCart() {
    const cartKey = `${product.id}:${selectedVariant.id}`;
    const newItem = {
      id: product.id,
      variantId: selectedVariant.id,
      cartKey,
      slug: product.slug,
      name: product.name,
      gender: product.gender,
      volumeMl: product.volumeMl,
      concentration: selectedVariant.concentrationPercent,
      price: selectedVariant.price,
      imageUrl: product.imageUrl,
      quantity
    };
    setCart((items) => {
      const existing = items.find((item) => itemKey(item) === cartKey);
      if (existing) {
        return items.map((item) => itemKey(item) === cartKey ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...items, newItem];
    });
    setCartOpen(true);
  }

  function updateQuantity(key, nextQuantity) {
    setCart((items) => items
      .map((item) => itemKey(item) === key ? { ...item, quantity: nextQuantity } : item)
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
            <label className="sr-only" htmlFor="product-search">Search fragrances</label>
            <input id="product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" />
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
          <Link href="/contact">Contact us</Link>
        </nav>
      </header>

      <main className="product-page-main">
        <div className="shell product-page-shell">
          <Link className="back-link" href="/#collection">←&nbsp; Collection</Link>
          <div className="product-detail-layout">
            <div className="product-detail-gallery">
              <div className="product-detail-image">
                <Image src={activeImage} alt={`${product.name} fragrance`} fill priority sizes="(max-width: 760px) 100vw, 573px" />
              </div>
              {productImages.length > 1 && (
                <div className="product-thumbnails" aria-label={`${product.name} product images`}>
                  {productImages.map((image, index) => (
                    <button className={image === activeImage ? "is-selected" : ""} type="button" key={image} onClick={() => setActiveImage(image)} aria-label={`View image ${index + 1}`} aria-pressed={image === activeImage}>
                      <Image src={image} alt="" fill sizes="84px" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <section className="product-purchase" aria-labelledby="product-name">
              <h1 id="product-name">{product.name}</h1>
              <p className="product-subtitle">{product.gender} · {product.volumeMl} ml</p>

              <fieldset className="variant-picker">
                <legend>Concentration, {product.volumeMl} ml</legend>
                <div className="variant-options">
                  {product.variants.map((variant) => (
                    <button
                      className={variant.id === selectedVariant.id ? "is-selected" : ""}
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariant(variant)}
                      aria-pressed={variant.id === selectedVariant.id}
                    >
                      <span>{variant.concentrationPercent}%</span>
                      <small>{money(variant.price)}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <p className="selected-price">{money(selectedVariant.price)}</p>
              <div className="product-description">
                <h2>{product.lead}</h2>
                <p>{product.description}</p>
              </div>

              <div className="purchase-actions">
                <div className="detail-quantity" aria-label="Quantity">
                  <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">−</button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => setQuantity((value) => Math.min(20, value + 1))} aria-label="Increase quantity">+</button>
                </div>
                <button className="detail-add-button" type="button" onClick={addToCart}>ADD TO CART</button>
              </div>
            </section>

            <dl className="specification-list">
              {specifications.map(([label, value], index) => {
                const isOpen = openSpecifications.includes(label);
                const detailId = `specification-${product.slug}-${index}`;

                return (
                  <div className={isOpen ? "is-open" : ""} key={label}>
                    <dt>
                      <button
                        className="specification-trigger"
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={detailId}
                        onClick={() => setOpenSpecifications((current) => (
                          current.includes(label)
                            ? current.filter((item) => item !== label)
                            : [...current, label]
                        ))}
                      >
                        <span>{label}</span>
                        <span className="specification-toggle" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                      </button>
                    </dt>
                    <dd id={detailId} hidden={!isOpen}>{value}</dd>
                  </div>
                );
              })}
            </dl>

          </div>
        </div>
      </main>

      <footer className="site-footer product-page-footer" id="contact">
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
          <Link href="/contact">Contact us</Link>
        </nav>
      </div>
    </>
  );
}

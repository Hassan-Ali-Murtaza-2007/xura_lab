"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CartDrawer from "./cart-drawer";
import { withCurrentProductImages } from "@/data/products";
import { useCustomerAuth } from "@/context/customer-auth-context";

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
  const { customer, isLoggedIn, requireAuth, openLoginModal, logout } = useCustomerAuth();
  const [search, setSearch] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSpecifications, setOpenSpecifications] = useState([]);
  const productImages = useMemo(() => {
    const list = (product.images?.length ? product.images : [product.imageUrl]).filter(Boolean);
    return list.length ? list : ["/images/xura-hero-4k.jpg"];
  }, [product]);
  const [activeImage, setActiveImage] = useState(productImages[0] || "/images/xura-hero-4k.jpg");

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

  const isBundle = product.gender === "Bundles" || Boolean(product.bundleItems?.length);

  const bundleBottles = useMemo(() => {
    let items = [];
    if (product.bundleItems && Array.isArray(product.bundleItems) && product.bundleItems.length > 0) {
      items = product.bundleItems;
    } else if (product.gender === "Bundles" || product.slug?.includes("bundle") || product.name?.toLowerCase().includes("bundle")) {
      const nameLower = product.name?.toLowerCase() || "";
      const hasVelor = nameLower.includes("velor");
      const hasNyra = nameLower.includes("nyra");
      const hasArven = nameLower.includes("arven");

      if (hasVelor && hasArven && !hasNyra) {
        items = [
          {
            name: "Velor",
            tagline: "Bright bergamot, cedarwood & smoky vetiver",
            volumeMl: product.volumeMl || 50,
            concentrations: [10, 20, 40],
            defaultConcentration: 20
          },
          {
            name: "Arven",
            tagline: "Rich oud, warm amber & refined leather",
            volumeMl: product.volumeMl || 50,
            concentrations: [10, 20, 40],
            defaultConcentration: 10
          }
        ];
      } else if (hasVelor && hasNyra && !hasArven) {
        items = [
          {
            name: "Nyra",
            tagline: "Luminous white florals, roasted coffee & vanilla",
            volumeMl: product.volumeMl || 50,
            concentrations: [10, 20, 40],
            defaultConcentration: 20
          },
          {
            name: "Velor",
            tagline: "Bright bergamot, cedarwood & smoky vetiver",
            volumeMl: product.volumeMl || 50,
            concentrations: [10, 20, 40],
            defaultConcentration: 10
          }
        ];
      } else {
        items = [
          {
            name: "Nyra",
            tagline: "Luminous white florals, roasted coffee & vanilla",
            volumeMl: product.volumeMl || 50,
            concentrations: [10, 20, 40],
            defaultConcentration: 20
          },
          {
            name: "Arven",
            tagline: "Rich oud, warm amber & refined leather",
            volumeMl: product.volumeMl || 50,
            concentrations: [10, 20, 40],
            defaultConcentration: 10
          }
        ];
      }
    }

    return items.map((b, idx) => {
      const concs = Array.isArray(b.concentrations) && b.concentrations.length > 0
        ? b.concentrations
        : [
            { concentrationPercent: 10, price: 2500, compareAtPrice: null },
            { concentrationPercent: 20, price: 3500, compareAtPrice: null },
            { concentrationPercent: 40, price: 5500, compareAtPrice: null }
          ];
      return {
        ...b,
        name: b.name || `Bottle ${idx + 1}`,
        concentrations: concs
      };
    });
  }, [product]);

  const [selectedBottleConcentrations, setSelectedBottleConcentrations] = useState(() =>
    bundleBottles.map((b) => {
      if (b.defaultConcentration) return Number(b.defaultConcentration);
      const first = b.concentrations?.[0];
      if (typeof first === "object" && first !== null) return Number(first.concentrationPercent || 20);
      return Number(first || 20);
    })
  );

  useEffect(() => {
    if (bundleBottles.length) {
      setSelectedBottleConcentrations(
        bundleBottles.map((b) => {
          if (b.defaultConcentration) return Number(b.defaultConcentration);
          const first = b.concentrations?.[0];
          if (typeof first === "object" && first !== null) return Number(first.concentrationPercent || 20);
          return Number(first || 20);
        })
      );
    }
  }, [bundleBottles]);

  function getPriceForConcentration(bottleName, conc) {
    const bottle = bundleBottles.find((b) => b.name === bottleName);
    if (bottle && Array.isArray(bottle.concentrations)) {
      const match = bottle.concentrations.find((c) =>
        typeof c === "object" ? Number(c.concentrationPercent) === Number(conc) : Number(c) === Number(conc)
      );
      if (match && typeof match === "object" && match.price) {
        return Number(match.price);
      }
      if (bottle.prices && bottle.prices[conc]) {
        return Number(bottle.prices[conc]);
      }
    }
    const c = Number(conc);
    if (c === 10) return 2500;
    if (c === 20) return 3500;
    if (c === 25) return 4500;
    if (c === 40) return 5500;
    return 2500 + Math.round((c / 10) * 1000);
  }

  function getCompareAtPriceForConcentration(bottleName, conc) {
    const bottle = bundleBottles.find((b) => b.name === bottleName);
    if (bottle && Array.isArray(bottle.concentrations)) {
      const match = bottle.concentrations.find((c) =>
        typeof c === "object" ? Number(c.concentrationPercent) === Number(conc) : Number(c) === Number(conc)
      );
      if (match && typeof match === "object" && match.compareAtPrice) {
        return Number(match.compareAtPrice);
      }
      if (bottle.compareAtPrices && bottle.compareAtPrices[conc]) {
        return Number(bottle.compareAtPrices[conc]);
      }
    }
    return 0;
  }

  const { bundlePrice, bundleCompareAtPrice, bundleSavingsPct, bundleSavingsAmount } = useMemo(() => {
    if (!isBundle || !bundleBottles.length) {
      return { bundlePrice: 0, bundleCompareAtPrice: 0, bundleSavingsPct: 0, bundleSavingsAmount: 0 };
    }
    const regularSum = bundleBottles.reduce((sum, bottle, idx) => {
      const conc = selectedBottleConcentrations[idx] || 20;
      return sum + getPriceForConcentration(bottle.name, conc);
    }, 0);
    const compareAtSum = bundleBottles.reduce((sum, bottle, idx) => {
      const conc = selectedBottleConcentrations[idx] || 20;
      const comp = getCompareAtPriceForConcentration(bottle.name, conc);
      return sum + (comp > 0 ? comp : getPriceForConcentration(bottle.name, conc));
    }, 0);

    const configuredDiscount = Number.isFinite(Number(product.bundleDiscountPercent))
      ? Number(product.bundleDiscountPercent)
      : 10;
    const discountRate = (100 - configuredDiscount) / 100;
    const discounted = Math.round(regularSum * discountRate);
    const effectiveCompareAt = compareAtSum > discounted ? compareAtSum : regularSum;
    const savings = effectiveCompareAt - discounted;
    const pct = effectiveCompareAt > 0 ? Math.round((savings / effectiveCompareAt) * 100) : configuredDiscount;

    return {
      bundlePrice: discounted,
      bundleCompareAtPrice: effectiveCompareAt,
      bundleSavingsPct: pct,
      bundleSavingsAmount: savings
    };
  }, [isBundle, bundleBottles, selectedBottleConcentrations, product.bundleDiscountPercent]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
  const specifications = useMemo(() => {
    if (isBundle) {
      return [
        ["Bundle Type", "Bespoke Duo Fragrance Set (2 bottles)"],
        ["Your Selection", bundleBottles.map((b, i) => `${b.name} (${selectedBottleConcentrations[i] || 20}%)`).join(" + ")],
        ["Bottle Sizes", `${product.volumeMl} ml each (${(product.volumeMl || 50) * 2} ml total)`],
        ["Fragrances", bundleBottles.map((b) => b.name).join(" and ")],
        ["Notes", product.notes],
        ["For", product.gender],
        ["Character", product.character || "Layered, complementary, versatile"],
        ["Best for", product.bestFor || "Day-to-night styling, signature layering, luxury gifting"],
        ["Shipping & Delivery", "1–3 business days dispatch. Standard delivery 3–7 business days nationwide. Complimentary shipping on all advance payments."],
        ["Returns & Exchanges", "7-day returns for unopened, unsealed bottles in original packaging. Report damaged or leaking parcels within 48 hours."]
      ];
    }
    return [
      ["Concentration", `${selectedVariant.concentrationPercent}%`],
      ["Bottle size", `${product.volumeMl} ml`],
      ["Notes", product.notes],
      ["For", product.gender],
      ["Character", product.character],
      ["Best for", product.bestFor],
      ["Shipping & Delivery", "1–3 business days dispatch. Standard delivery 3–7 business days nationwide. Complimentary shipping on all advance payments."],
      ["Returns & Exchanges", "7-day returns for unopened, unsealed bottles in original packaging. Report damaged or leaking parcels within 48 hours."]
    ];
  }, [product, selectedVariant, isBundle, bundleBottles, selectedBottleConcentrations]);

  function addToCart() {
    requireAuth(() => {
      performAddToCart();
    });
  }

  function performAddToCart() {
    if (isBundle) {
      const selections = bundleBottles.map((b, i) => ({
        productName: b.name,
        concentration: selectedBottleConcentrations[i] || 20
      }));
      const selectionText = selections.map((s) => `${s.productName} (${s.concentration}%)`).join(" · ");
      const cartKey = `${product.id}:bundle:${selections.map((s) => `${s.productName}-${s.concentration}`).join(":")}`;

      const activeVariant = product.variants?.find((v) => Number(v.price) === bundlePrice) || product.variants?.[0];

      const newItem = {
        id: product.id,
        variantId: activeVariant?.id || null,
        cartKey,
        slug: product.slug,
        name: product.name,
        gender: product.gender,
        volumeMl: product.volumeMl,
        isBundle: true,
        bundleSelections: selections,
        bundleSelectionText: selectionText,
        concentration: null,
        price: bundlePrice,
        compareAtPrice: bundleCompareAtPrice > bundlePrice ? bundleCompareAtPrice : null,
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
      return;
    }

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
      compareAtPrice: selectedVariant.compareAtPrice || null,
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
          <div className="header-user-actions">
            {isLoggedIn ? (
              <button
                className="client-auth-btn"
                type="button"
                onClick={logout}
                title="Sign out of your account"
              >
                <span>Hi, {customer?.name?.split(" ")[0] || "Client"}</span>
                <small>Sign Out</small>
              </button>
            ) : (
              <button
                className="client-auth-btn"
                type="button"
                onClick={() => openLoginModal()}
                title="Client Sign In"
              >
                <span>Sign In</span>
              </button>
            )}
            <button className="cart-trigger" type="button" onClick={() => setCartOpen(true)} aria-label={`Open cart with ${cartCount} items`}>
              <BagIcon />
              <span>Cart ({cartCount})</span>
            </button>
          </div>
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
                <Image
                  src={activeImage || "/images/xura-hero-4k.jpg"}
                  alt={`${product.name} fragrance`}
                  fill
                  priority
                  unoptimized={Boolean(activeImage && (activeImage.startsWith("/uploads/") || activeImage.startsWith("blob:")))}
                  sizes="(max-width: 760px) 100vw, 573px"
                />
              </div>
              {productImages.length > 1 && (
                <div className="product-thumbnails" aria-label={`${product.name} product images`}>
                  {productImages.map((image, index) => (
                    <button className={image === activeImage ? "is-selected" : ""} type="button" key={image} onClick={() => setActiveImage(image)} aria-label={`View image ${index + 1}`} aria-pressed={image === activeImage}>
                      <Image
                        src={image}
                        alt=""
                        fill
                        unoptimized={Boolean(image && (image.startsWith("/uploads/") || image.startsWith("blob:")))}
                        sizes="84px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <section className="product-purchase" aria-labelledby="product-name">
              <h1 id="product-name">{product.name}</h1>
              <p className="product-subtitle">
                {isBundle ? `Bespoke Fragrance Bundle · 2 × ${product.volumeMl} ml` : `${product.gender} · ${product.volumeMl} ml`}
              </p>

              {isBundle ? (
                <div className="bundle-bottle-picker">
                  <div className="bundle-picker-header">
                    <span className="bundle-picker-kicker">CURATE YOUR SET</span>
                    <h2 className="bundle-picker-title">Select Concentrations for Each Fragrance</h2>
                    <p className="bundle-picker-subtitle">
                      Choose your preferred concentration for both perfume bottles ({product.volumeMl} ml each).
                    </p>
                  </div>

                  <div className="bundle-bottles-list">
                    {bundleBottles.map((bottle, bottleIdx) => {
                      const selectedConc = selectedBottleConcentrations[bottleIdx] || 20;
                      return (
                        <div key={bottle.name || bottleIdx} className="bundle-bottle-card">
                          <div className="bundle-bottle-card-header">
                            <div className="bundle-bottle-identity">
                              <span className="bundle-bottle-badge">Bottle {bottleIdx + 1}</span>
                              <h3 className="bundle-bottle-name">{bottle.name}</h3>
                              {bottle.tagline && <span className="bundle-bottle-tagline">{bottle.tagline}</span>}
                            </div>
                            <span className="bundle-bottle-selected-tag">
                              Concentration: <strong>{selectedConc}%</strong>
                            </span>
                          </div>

                          <div className="bundle-conc-grid">
                            {(Array.isArray(bottle.concentrations) && bottle.concentrations.length > 0
                              ? bottle.concentrations
                              : [10, 20, 40]
                            ).map((concItem, itemIdx) => {
                              const conc = typeof concItem === "object" ? Number(concItem.concentrationPercent) : Number(concItem);
                              const isSelected = selectedConc === conc;
                              const concPrice = getPriceForConcentration(bottle.name, conc);
                              return (
                                <button
                                  key={concItem.key || `${bottle.name}-${conc}-${itemIdx}`}
                                  type="button"
                                  className={`bundle-conc-pill ${isSelected ? "is-selected" : ""}`}
                                  onClick={() => {
                                    setSelectedBottleConcentrations((curr) => {
                                      const next = [...curr];
                                      next[bottleIdx] = conc;
                                      return next;
                                    });
                                  }}
                                  aria-pressed={isSelected}
                                >
                                  <strong>{conc}%</strong>
                                  <small>{money(concPrice)}</small>
                                  {isSelected && <span className="bundle-conc-active-dot">Selected</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bundle Live Selection Summary */}
                  <div className="bundle-set-summary-bar">
                    <div className="bundle-set-summary-copy">
                      <span>YOUR CUSTOM SET</span>
                      <strong>
                        {bundleBottles.map((b, i) => `${b.name} (${selectedBottleConcentrations[i] || 20}%)`).join(" + ")}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <fieldset className="variant-picker">
                  <legend>Concentration, {product.volumeMl} ml</legend>
                  <div className="variant-options">
                    {product.variants.map((variant) => {
                      const vComp = Number(variant.compareAtPrice || 0);
                      const vPr = Number(variant.price || 0);
                      const vHasDiscount = vComp > 0 && vPr > 0 && vComp > vPr;
                      const vPct = vHasDiscount ? Math.round(((vComp - vPr) / vComp) * 100) : 0;

                      return (
                        <button
                          className={variant.id === selectedVariant.id ? "is-selected" : ""}
                          key={variant.id}
                          type="button"
                          onClick={() => setSelectedVariant(variant)}
                          aria-pressed={variant.id === selectedVariant.id}
                        >
                          <span>{variant.concentrationPercent}%</span>
                          <small>{money(variant.price)}</small>
                          {vHasDiscount && (
                            <span className="variant-pill-badge">{vPct}% OFF</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {isBundle ? (
                <div className="selected-price-block">
                  <div className="selected-price-row">
                    <p className="selected-price">{money(bundlePrice)}</p>
                    {bundleCompareAtPrice > bundlePrice && (
                      <>
                        <s className="selected-price-cutoff">{money(bundleCompareAtPrice)}</s>
                        <span className="selected-price-badge">{bundleSavingsPct}% OFF</span>
                      </>
                    )}
                  </div>
                  {bundleCompareAtPrice > bundlePrice && (
                    <small className="selected-price-savings">
                      Bundle savings: you save {money(bundleSavingsAmount)} ({bundleSavingsPct}%) with bespoke set pricing.
                    </small>
                  )}
                </div>
              ) : (() => {
                const comp = Number(selectedVariant.compareAtPrice || 0);
                const pr = Number(selectedVariant.price || 0);
                const hasCutoff = comp > 0 && pr > 0 && comp > pr;
                const pct = hasCutoff ? Math.round(((comp - pr) / comp) * 100) : 0;
                const savings = hasCutoff ? comp - pr : 0;

                return (
                  <div className="selected-price-block">
                    <div className="selected-price-row">
                      <p className="selected-price">{money(selectedVariant.price)}</p>
                      {hasCutoff && (
                        <>
                          <s className="selected-price-cutoff">{money(comp)}</s>
                          <span className="selected-price-badge">{pct}% OFF</span>
                        </>
                      )}
                    </div>
                    {hasCutoff && (
                      <small className="selected-price-savings">
                        You save {money(savings)} ({pct}%)
                      </small>
                    )}
                  </div>
                );
              })()}
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
          <Link href="/about">About us</Link>
          <Link href="/contact">Contact us</Link>
          {isLoggedIn ? (
            <button
              type="button"
              className="mobile-auth-btn"
              onClick={() => {
                setMobileOpen(false);
                logout();
              }}
            >
              Hi, {customer?.name?.split(" ")[0] || "Client"} · Sign Out
            </button>
          ) : (
            <button
              type="button"
              className="mobile-auth-btn"
              onClick={() => {
                setMobileOpen(false);
                openLoginModal();
              }}
            >
              Client Sign In / Register
            </button>
          )}
        </nav>
      </div>
    </>
  );
}

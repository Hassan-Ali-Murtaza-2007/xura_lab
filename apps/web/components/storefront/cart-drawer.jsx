"use client";

import Image from "next/image";
import Link from "next/link";

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const money = (value) => `PKR ${number.format(Number(value))}`;
const itemKey = (item) => item.cartKey || `${item.id}:${item.variantId || "base"}`;

export default function CartDrawer({
  cart,
  cartOpen,
  cartTotal,
  onClose,
  onUpdateQuantity
}) {
  return (
    <div className={`drawer-layer ${cartOpen ? "is-open" : ""}`} aria-hidden={!cartOpen}>
      <button className="drawer-scrim" type="button" onClick={onClose} aria-label="Close cart" />
      <aside className="cart-drawer" aria-label="Shopping cart">
        <div className="drawer-titlebar">
          <p>CART</p>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        <div className="cart-items">
          {!cart.length && <p className="cart-empty">Your cart is waiting for a fragrance that feels like you.</p>}
          {cart.map((item) => (
            <div className="cart-item" key={itemKey(item)}>
              <Image
                src={item.imageUrl || "/images/xura-hero-4k.jpg"}
                width={72}
                height={72}
                alt={`${item.name} fragrance`}
                unoptimized={Boolean(item.imageUrl && (item.imageUrl.startsWith("/uploads/") || item.imageUrl.startsWith("blob:")))}
              />
              <div className="cart-item-copy">
                <strong>{item.name}{!item.bundleSelectionText && item.concentration ? ` ${item.concentration}%` : ""}</strong>
                {item.bundleSelectionText ? (
                  <p className="cart-item-bundle-meta">
                    <span className="cart-bundle-pill">Set</span> {item.bundleSelectionText}
                  </p>
                ) : (
                  <p>{item.gender} · {item.volumeMl} ml</p>
                )}
                <div className="quantity-control" aria-label={`Quantity for ${item.name}`}>
                  <button type="button" onClick={() => onUpdateQuantity(itemKey(item), item.quantity - 1)} aria-label="Decrease quantity">−</button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => onUpdateQuantity(itemKey(item), item.quantity + 1)} aria-label="Increase quantity">+</button>
                </div>
              </div>
              <div className="cart-item-side">
                <div className="cart-item-price-stack">
                  {item.compareAtPrice && Number(item.compareAtPrice) > Number(item.price) && (
                    <s className="cart-item-cutoff">{money(Number(item.compareAtPrice) * item.quantity)}</s>
                  )}
                  <span>{money(item.price * item.quantity)}</span>
                </div>
                <button type="button" onClick={() => onUpdateQuantity(itemKey(item), 0)}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="cart-summary">
            <div><span>Subtotal</span><strong>{money(cartTotal)}</strong></div>
            <p>Delivery (PKR 370) is added at checkout · Free on advance payment.</p>
            <Link className="cart-checkout-button" href="/checkout" onClick={onClose}>CHECKOUT</Link>
            <p style={{ fontSize: "11px", color: "var(--muted)", margin: "10px 0 0", textAlign: "center", lineHeight: "1.4" }}>
              7-day returns on sealed bottles · <Link href="/policies/refund-policy" onClick={onClose} style={{ textDecoration: "underline", color: "inherit" }}>Return Policy</Link>
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

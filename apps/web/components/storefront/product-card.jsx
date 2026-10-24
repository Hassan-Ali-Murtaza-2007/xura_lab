"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const money = (value) => `PKR ${number.format(Number(value || 0))}`;

export default function ProductCard({ product, onAddToCart }) {
  const [isSelecting, setIsSelecting] = useState(false);
  const cardRef = useRef(null);

  // Close picker if user clicks outside or presses Escape
  useEffect(() => {
    if (!isSelecting) return;

    function handleClickOutside(event) {
      if (cardRef.current && !cardRef.current.contains(event.target)) {
        setIsSelecting(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsSelecting(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSelecting]);

  const variants = product.variants || [];
  const hasMultipleVariants = variants.length > 1;

  const compareAt = Number(product.compareAtPrice || 0);
  const currentPrice = Number(product.price || product.startingPrice || 0);
  const hasProductDiscount = compareAt > 0 && currentPrice > 0 && compareAt > currentPrice;
  const productDiscountPct = hasProductDiscount ? Math.round(((compareAt - currentPrice) / compareAt) * 100) : 0;

  const maxVariantDiscountPct = variants.reduce((max, v) => {
    const vc = Number(v.compareAtPrice || 0);
    const vp = Number(v.price || 0);
    if (vc > vp && vc > 0) {
      const pct = Math.round(((vc - vp) / vc) * 100);
      return Math.max(max, pct);
    }
    return max;
  }, productDiscountPct);

  const isBundle = product.gender === "Bundles" || Boolean(product.bundleItems?.length);

  function handleQuickClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (isBundle) {
      window.location.href = `/products/${product.slug}`;
      return;
    }
    if (hasMultipleVariants) {
      setIsSelecting(true);
    } else {
      onAddToCart(product, variants[0] || null);
    }
  }

  function handleSelectVariant(event, variant) {
    event.preventDefault();
    event.stopPropagation();
    onAddToCart(product, variant);
    setIsSelecting(false);
  }

  return (
    <article
      ref={cardRef}
      className={`product-card ${isSelecting ? "is-picker-open" : ""}`}
      onMouseLeave={() => {
        if (isSelecting) setIsSelecting(false);
      }}
    >
      <div className="product-image">
        <Link
          className="product-image-link"
          href={`/products/${product.slug}`}
          aria-label={`View ${product.name}`}
        >
          <Image
            src={product.imageUrl || "/images/xura-hero-4k.jpg"}
            alt={`${product.name} fragrance`}
            fill
            unoptimized={Boolean(product.imageUrl && (product.imageUrl.startsWith("/uploads/") || product.imageUrl.startsWith("blob:")))}
            sizes="(max-width: 720px) calc(100vw - 32px), (max-width: 1120px) 50vw, 33vw"
          />
        </Link>
        {maxVariantDiscountPct > 0 && (
          <span className="product-sale-badge">{maxVariantDiscountPct}% OFF</span>
        )}

        {isSelecting ? (
          <div
            className="quick-concentration-picker is-open"
            role="dialog"
            aria-label={`Select concentration for ${product.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="quick-picker-header">
              <span>SELECT CONCENTRATION</span>
              <button
                type="button"
                className="quick-picker-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSelecting(false);
                }}
                aria-label="Close concentration options"
              >
                ×
              </button>
            </div>
            <div className="quick-picker-options-list">
              {variants.map((variant) => {
                const vComp = Number(variant.compareAtPrice || 0);
                const vPrice = Number(variant.price || 0);
                const vHasDiscount = vComp > 0 && vPrice > 0 && vComp > vPrice;
                const vDiscountPct = vHasDiscount ? Math.round(((vComp - vPrice) / vComp) * 100) : 0;

                return (
                  <button
                    key={variant.id}
                    type="button"
                    className="quick-picker-variant-btn"
                    onClick={(e) => handleSelectVariant(e, variant)}
                  >
                    <span className="quick-picker-variant-name">
                      <strong>{variant.concentrationPercent}%</strong>
                      <small>Concentration</small>
                    </span>
                    <span className="quick-picker-variant-price">
                      {vHasDiscount && (
                        <s className="quick-picker-cutoff-price">{money(vComp)}</s>
                      )}
                      <strong>{money(variant.price)}</strong>
                      {vHasDiscount && (
                        <span className="quick-picker-discount-badge">{vDiscountPct}% OFF</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button
            className="quick-view"
            type="button"
            onClick={handleQuickClick}
          >
            {isBundle ? "Customize Bundle" : "Add to cart"}
          </button>
        )}
      </div>

      <Link className="product-meta" href={`/products/${product.slug}`}>
        <span className="product-row">
          <span>{product.name}</span>
          <span className="product-price-col">
            {hasProductDiscount && (
              <s className="product-cutoff-price">{money(compareAt)}</s>
            )}
            <span className="product-current-price">From {money(currentPrice)}</span>
          </span>
        </span>
        <span className="product-detail">
          {product.gender} · {product.volumeMl} ml
        </span>
      </Link>
    </article>
  );
}

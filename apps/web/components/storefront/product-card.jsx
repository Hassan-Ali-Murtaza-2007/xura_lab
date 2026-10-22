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

  function handleQuickClick(event) {
    event.preventDefault();
    event.stopPropagation();
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
            src={product.imageUrl}
            alt={`${product.name} fragrance`}
            fill
            sizes="(max-width: 720px) calc(100vw - 32px), (max-width: 1120px) 50vw, 33vw"
          />
        </Link>

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
              {variants.map((variant) => (
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
                    {money(variant.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            className="quick-view"
            type="button"
            onClick={handleQuickClick}
          >
            Add to cart
          </button>
        )}
      </div>

      <Link className="product-meta" href={`/products/${product.slug}`}>
        <span className="product-row">
          <span>{product.name}</span>
          <span>From {money(product.price)}</span>
        </span>
        <span className="product-detail">
          {product.gender} · {product.volumeMl} ml
        </span>
      </Link>
    </article>
  );
}

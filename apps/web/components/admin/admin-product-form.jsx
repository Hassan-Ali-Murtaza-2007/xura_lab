"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

const defaultFields = {
  name: "",
  tagline: "",
  gender: "Unisex",
  volumeMl: "50",
  lead: "",
  description: "",
  notes: "",
  character: "",
  bestFor: ""
};

const defaultVariants = () => [
  { key: "variant-1", concentrationPercent: "10", price: "2500", compareAtPrice: "" },
  { key: "variant-2", concentrationPercent: "20", price: "3500", compareAtPrice: "" },
  { key: "variant-3", concentrationPercent: "40", price: "5500", compareAtPrice: "" }
];

function defaultPriceForConc(conc) {
  const c = Number(conc);
  if (c === 10) return 2500;
  if (c === 20) return 3500;
  if (c === 25) return 4500;
  if (c === 40) return 5500;
  return 2500 + Math.round((c / 10) * 1000);
}

function normalizeBottleConcentrations(rawConcs) {
  if (!Array.isArray(rawConcs) || rawConcs.length === 0) {
    return [
      { key: "c-10", concentrationPercent: 10, price: 2500, compareAtPrice: "" },
      { key: "c-20", concentrationPercent: 20, price: 3500, compareAtPrice: "" },
      { key: "c-40", concentrationPercent: 40, price: 5500, compareAtPrice: "" }
    ];
  }
  return rawConcs.map((item, idx) => {
    if (typeof item === "object" && item !== null) {
      const conc = Number(item.concentrationPercent || item.concentration || 20);
      return {
        key: item.key || `c-${conc}-${idx}`,
        concentrationPercent: conc,
        price: Number(item.price) || defaultPriceForConc(conc),
        compareAtPrice: item.compareAtPrice ? Number(item.compareAtPrice) : ""
      };
    }
    const conc = Number(item);
    return {
      key: `c-${conc}-${idx}`,
      concentrationPercent: conc,
      price: defaultPriceForConc(conc),
      compareAtPrice: ""
    };
  });
}

function fieldsForProduct(product) {
  if (!product) return defaultFields;
  return {
    name: product.name || "",
    tagline: product.tagline || "",
    gender: product.gender || "Unisex",
    volumeMl: String(product.volumeMl || 50),
    lead: product.lead || "",
    description: product.description || "",
    notes: product.notes || "",
    character: product.character || "",
    bestFor: product.bestFor || ""
  };
}

function variantsForProduct(product) {
  if (!product?.variants?.length) return defaultVariants();
  return product.variants.map((variant, index) => ({
    key: `variant-${variant.id || index + 1}`,
    concentrationPercent: String(variant.concentrationPercent),
    price: String(variant.price),
    compareAtPrice: variant.compareAtPrice ? String(variant.compareAtPrice) : ""
  }));
}

export default function AdminProductForm({ product = null, onCancel, onCreated, onUpdated }) {
  const isEditing = Boolean(product);
  const imageInput = useRef(null);
  const [fields, setFields] = useState(() => fieldsForProduct(product));
  const [bundleBottles, setBundleBottles] = useState(() => {
    if (product?.bundleItems && Array.isArray(product.bundleItems) && product.bundleItems.length > 0) {
      return product.bundleItems.map((b, i) => ({
        name: b.name || `Fragrance ${i + 1}`,
        tagline: b.tagline || "",
        volumeMl: b.volumeMl || product?.volumeMl || 50,
        concentrations: normalizeBottleConcentrations(b.concentrations)
      }));
    }
    return [
      {
        name: "Nyra",
        tagline: "Luminous white florals, roasted coffee & vanilla",
        volumeMl: 50,
        concentrations: normalizeBottleConcentrations([10, 20, 40])
      },
      {
        name: "Arven",
        tagline: "Rich oud, warm amber & refined leather",
        volumeMl: 50,
        concentrations: normalizeBottleConcentrations([10, 20, 40])
      }
    ];
  });
  const [bundleDiscountPercent, setBundleDiscountPercent] = useState(() => {
    return Number(product?.bundleDiscountPercent) || 10;
  });
  const [simulatedSelections, setSimulatedSelections] = useState([40, 20]);
  const [variants, setVariants] = useState(() => variantsForProduct(product));
  const [existingImageUrls, setExistingImageUrls] = useState(() => (
    product?.images?.length ? product.images : (product?.imageUrl ? [product.imageUrl] : [])
  ));
  const [images, setImages] = useState([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previews = useMemo(() => images.map((file) => ({ file, url: URL.createObjectURL(file) })), [images]);
  const displayedPreviews = [
    ...existingImageUrls.map((url) => ({ url, file: null })),
    ...previews
  ];

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  function updateField(event) {
    setFields((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateVariant(key, field, value) {
    setVariants((current) => current.map((variant) => (
      variant.key === key ? { ...variant, [field]: value } : variant
    )));
  }

  function handleCompareAtChange(key, value) {
    setVariants((current) => current.map((v) => (
      v.key === key ? { ...v, compareAtPrice: value } : v
    )));
  }

  function handlePriceChange(key, value) {
    setVariants((current) => current.map((v) => (
      v.key === key ? { ...v, price: value } : v
    )));
  }

  function applyDiscountPreset(key, percent) {
    setVariants((current) => current.map((v) => {
      if (v.key !== key) return v;
      let original = Number(v.compareAtPrice);
      if (!original || original <= 0) {
        original = Number(v.price) || 0;
      }
      if (!original || original <= 0) return v;
      const discountAmount = Math.round((original * percent) / 100);
      const salePrice = Math.max(1, original - discountAmount);
      return {
        ...v,
        compareAtPrice: String(original),
        price: String(salePrice)
      };
    }));
  }

  function clearCutoff(key) {
    setVariants((current) => current.map((v) => (
      v.key === key ? { ...v, compareAtPrice: "" } : v
    )));
  }

  function removeVariant(key) {
    setVariants((current) => current.length === 1 ? current : current.filter((variant) => variant.key !== key));
  }

  function addVariant() {
    setVariants((current) => [
      ...current,
      { key: `variant-${Date.now()}`, concentrationPercent: "", price: "", compareAtPrice: "" }
    ]);
  }

  function updateBottleField(bottleIdx, field, value) {
    setBundleBottles((curr) => {
      const next = [...curr];
      next[bottleIdx] = { ...next[bottleIdx], [field]: value };
      return next;
    });
  }

  function updateBottleConc(bottleIdx, concKey, field, value) {
    setBundleBottles((curr) => {
      const next = [...curr];
      const bottle = { ...next[bottleIdx] };
      bottle.concentrations = bottle.concentrations.map((c) =>
        c.key === concKey ? { ...c, [field]: value } : c
      );
      next[bottleIdx] = bottle;
      return next;
    });
  }

  function applyBottleDiscountPreset(bottleIdx, concKey, percent) {
    setBundleBottles((curr) => {
      const next = [...curr];
      const bottle = { ...next[bottleIdx] };
      bottle.concentrations = bottle.concentrations.map((c) => {
        if (c.key !== concKey) return c;
        let original = Number(c.compareAtPrice);
        if (!original || original <= 0) {
          original = Number(c.price) || 0;
        }
        if (!original || original <= 0) return c;
        const discountAmount = Math.round((original * percent) / 100);
        const salePrice = Math.max(1, original - discountAmount);
        return {
          ...c,
          compareAtPrice: String(original),
          price: String(salePrice)
        };
      });
      next[bottleIdx] = bottle;
      return next;
    });
  }

  function addBottleConc(bottleIdx) {
    setBundleBottles((curr) => {
      const next = [...curr];
      const bottle = { ...next[bottleIdx] };
      const nextConc = 30;
      bottle.concentrations = [
        ...bottle.concentrations,
        {
          key: `c-new-${Date.now()}`,
          concentrationPercent: nextConc,
          price: defaultPriceForConc(nextConc),
          compareAtPrice: ""
        }
      ];
      next[bottleIdx] = bottle;
      return next;
    });
  }

  function removeBottleConc(bottleIdx, concKey) {
    setBundleBottles((curr) => {
      const next = [...curr];
      const bottle = { ...next[bottleIdx] };
      if (bottle.concentrations.length <= 1) return curr;
      bottle.concentrations = bottle.concentrations.filter((c) => c.key !== concKey);
      next[bottleIdx] = bottle;
      return next;
    });
  }

  function addBundleBottle() {
    setBundleBottles((curr) => [
      ...curr,
      {
        name: `Fragrance ${curr.length + 1}`,
        tagline: "",
        volumeMl: fields.volumeMl || 50,
        concentrations: normalizeBottleConcentrations([10, 20, 40])
      }
    ]);
  }

  function removeBundleBottle(bottleIdx) {
    setBundleBottles((curr) => (curr.length > 2 ? curr.filter((_, i) => i !== bottleIdx) : curr));
  }

  const simPrices = useMemo(() => {
    return bundleBottles.map((bottle, idx) => {
      const selectedConc = simulatedSelections[idx] || bottle.concentrations[0]?.concentrationPercent || 20;
      const found = bottle.concentrations.find((c) => Number(c.concentrationPercent) === Number(selectedConc)) || bottle.concentrations[0];
      return Number(found?.price || defaultPriceForConc(selectedConc));
    });
  }, [bundleBottles, simulatedSelections]);

  const simTotalStandard = simPrices.reduce((sum, p) => sum + p, 0);
  const simTotalDiscounted = Math.round(simTotalStandard * ((100 - bundleDiscountPercent) / 100));

  function chooseImages(event) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;

    const currentTotal = displayedPreviews.length;
    const remainingSlots = 5 - currentTotal;

    if (remainingSlots <= 0) {
      setStatus("This product already has the maximum of 5 images. Delete an image first to add another.");
      if (imageInput.current) imageInput.current.value = "";
      return;
    }

    if (selected.length > remainingSlots) {
      const allowed = selected.slice(0, remainingSlots);
      setImages((current) => [...current, ...allowed]);
      setStatus(`Added ${allowed.length} image${allowed.length === 1 ? "" : "s"}. Maximum limit of 5 images reached.`);
    } else {
      setImages((current) => [...current, ...selected]);
      const nextTotal = currentTotal + selected.length;
      setStatus(
        nextTotal === 5
          ? "5 of 5 images added (limit reached)."
          : `Added ${selected.length} image${selected.length === 1 ? "" : "s"} (${nextTotal}/5 total).`
      );
    }

    if (imageInput.current) imageInput.current.value = "";
  }

  function removeImage(index) {
    const nextCount = displayedPreviews.length - 1;
    if (index < existingImageUrls.length) {
      setExistingImageUrls((current) => current.filter((_url, imageIndex) => imageIndex !== index));
    } else {
      const newImageIndex = index - existingImageUrls.length;
      setImages((current) => current.filter((_file, imageIndex) => imageIndex !== newImageIndex));
    }
    setPrimaryImageIndex((current) => {
      if (nextCount <= 0) return 0;
      if (index < current) return current - 1;
      if (index === current) return Math.min(index, nextCount - 1);
      return current;
    });
    setStatus(
      nextCount > 0
        ? `Photo removed (${nextCount}/5 images remaining). Save changes to update the storefront.`
        : "Photo removed. Add at least one product image before saving."
    );
  }

  function resetForm() {
    setFields(defaultFields);
    setVariants(defaultVariants());
    setExistingImageUrls([]);
    setImages([]);
    setPrimaryImageIndex(0);
    if (imageInput.current) imageInput.current.value = "";
  }

  async function submitProduct(event) {
    event.preventDefault();
    if (!displayedPreviews.length) {
      setStatus("Select at least one customer-facing product image.");
      return;
    }

    setIsSubmitting(true);
    setStatus("");
    const body = new FormData();
    Object.entries(fields).forEach(([key, value]) => body.append(key, value));
    let variantsToSubmit = variants.map(({ concentrationPercent, price, compareAtPrice }) => ({
      concentrationPercent,
      price,
      compareAtPrice: compareAtPrice && Number(compareAtPrice) > Number(price) ? compareAtPrice : null
    }));

    if (fields.gender === "Bundles") {
      const serializedBundleItems = bundleBottles.map((b) => ({
        name: (b.name || "").trim(),
        tagline: (b.tagline || "").trim(),
        volumeMl: Number(b.volumeMl) || Number(fields.volumeMl) || 50,
        concentrations: b.concentrations.map((c) => ({
          concentrationPercent: Number(c.concentrationPercent),
          price: Number(c.price),
          compareAtPrice: c.compareAtPrice && Number(c.compareAtPrice) > Number(c.price) ? Number(c.compareAtPrice) : null
        })),
        defaultConcentration: Number(b.concentrations[0]?.concentrationPercent) || 20
      }));
      body.append("bundleItems", JSON.stringify(serializedBundleItems));
      body.append("bundleDiscountPercent", String(bundleDiscountPercent));

      // Build representative combo variants for the database
      const b1 = bundleBottles[0];
      const b2 = bundleBottles[1];
      if (b1 && b2) {
        const distinctConcs = [10, 20, 40];
        variantsToSubmit = distinctConcs.map((conc) => {
          const p1 = Number(b1.concentrations.find((c) => Number(c.concentrationPercent) === conc)?.price) || defaultPriceForConc(conc);
          const p2 = Number(b2.concentrations.find((c) => Number(c.concentrationPercent) === conc)?.price) || defaultPriceForConc(conc);
          const sum = p1 + p2;
          const discounted = Math.round(sum * ((100 - bundleDiscountPercent) / 100));
          return {
            concentrationPercent: conc,
            price: discounted,
            compareAtPrice: sum
          };
        });
      }
    }

    body.append("variants", JSON.stringify(variantsToSubmit));
    body.append("primaryImageIndex", String(primaryImageIndex));
    body.append("retainedImages", JSON.stringify(existingImageUrls));
    images.forEach((image) => body.append("images", image));

    try {
      const response = await fetch(isEditing ? `/api/admin/products/${product.id}` : "/api/admin/products", {
        method: isEditing ? "PUT" : "POST",
        credentials: "include",
        body
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || `Unable to ${isEditing ? "update" : "create"} the product.`);
      if (!isEditing) resetForm();
      setStatus(payload.message);
      if (isEditing) onUpdated(payload.summary);
      else onCreated(payload.summary);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="admin-product-form" onSubmit={submitProduct}>
      <div className="admin-product-form-intro">
        <div>
          <p className="admin-eyebrow">{isEditing ? "EDIT FRAGRANCE" : "NEW FRAGRANCE"}</p>
          <h3>{isEditing ? `Refine ${product.name}.` : "Build the product customers will see."}</h3>
          <p>{isEditing ? "Changes publish across the collection and product page as soon as you save." : "Product information, pricing and imagery publish to the storefront together."}</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close product form">×</button>
      </div>

      <div className="admin-product-form-grid">
        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>01</span><div><h4>Identity</h4><p>Name, category and bottle format</p></div></div>
          <div className="admin-field-grid">
            <label className="admin-field admin-field-wide"><span>Product name</span><input name="name" value={fields.name} onChange={updateField} placeholder="e.g. Solenne" required maxLength={120} /></label>
            <label className="admin-field admin-field-wide"><span>Tagline</span><input name="tagline" value={fields.tagline} onChange={updateField} placeholder="A short customer-facing line" required maxLength={255} /></label>
            <label className="admin-field">
              <span>Category</span>
              <select name="gender" value={fields.gender} onChange={updateField}>
                <option>Men</option>
                <option>Women</option>
                <option>Unisex</option>
                <option>Testers</option>
                <option>Bundles</option>
              </select>
            </label>
            <label className="admin-field"><span>Bottle size (ml)</span><input name="volumeMl" type="number" min="1" max="1000" value={fields.volumeMl} onChange={updateField} required /></label>
          </div>
        </section>

        <section className="admin-form-section admin-image-section">
          <div className="admin-form-section-heading"><span>02</span><div><h4>Customer images</h4><p>Add up to 5 images (maximum 5)</p></div></div>
          <input
            ref={imageInput}
            className="sr-only"
            id="admin-product-images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={displayedPreviews.length >= 5}
            onChange={chooseImages}
          />
          {displayedPreviews.length ? (
            <div className="admin-image-dropzone has-images">
              <div className="admin-image-previews">
                {displayedPreviews.map((preview, index) => (
                  <div className={`admin-image-preview ${index === primaryImageIndex ? "is-primary" : ""}`} key={preview.file ? `file-${preview.file.name}-${preview.file.lastModified}-${index}` : `url-${preview.url}-${index}`}>
                    <button className="admin-image-select" type="button" onClick={() => setPrimaryImageIndex(index)} aria-label={`Use image ${index + 1} as the primary image`} aria-pressed={index === primaryImageIndex}>
                      <Image src={preview.url} alt={`Product preview ${index + 1}`} fill unoptimized sizes="180px" />
                      <small>{index === primaryImageIndex ? "PRIMARY" : "SET PRIMARY"}</small>
                    </button>
                    <button
                      className="admin-image-remove"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removeImage(index);
                      }}
                      aria-label={`Delete photo ${index + 1}`}
                      title="Delete this photo"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
                {displayedPreviews.length < 5 && (
                  <label className="admin-image-add-card" htmlFor="admin-product-images" title={`Add more images (${5 - displayedPreviews.length} slots left)`}>
                    <strong>＋</strong>
                    <span>Add image</span>
                    <small>{displayedPreviews.length}/5 added</small>
                  </label>
                )}
              </div>
              <div className="admin-image-controls">
                <p><strong>Image {primaryImageIndex + 1}</strong> will appear on collection cards and at the top of the product gallery.</p>
                {displayedPreviews.length < 5
                  ? <label className="admin-image-add-button" htmlFor="admin-product-images">＋ ADD MORE IMAGES ({displayedPreviews.length}/5)</label>
                  : <span className="is-full">5 IMAGE LIMIT REACHED</span>}
              </div>
            </div>
          ) : (
            <label className="admin-image-dropzone" htmlFor="admin-product-images">
              <strong>＋</strong>
              <span>Add product images</span>
              <small>Add up to 5 images (maximum 5) · 8 MB each</small>
            </label>
          )}
        </section>

        <section className="admin-form-section admin-form-section-full">
          <div className="admin-form-section-heading"><span>03</span><div><h4>Story & details</h4><p>Give the product page its character</p></div></div>
          <div className="admin-field-grid admin-field-grid-story">
            <label className="admin-field admin-field-wide"><span>Lead statement</span><input name="lead" value={fields.lead} onChange={updateField} placeholder="e.g. Radiant. Modern. Magnetic." required maxLength={255} /></label>
            <label className="admin-field admin-field-wide"><span>Description</span><textarea name="description" value={fields.description} onChange={updateField} placeholder="Describe the fragrance, its mood and composition…" required maxLength={3000} rows={5} /></label>
            <label className="admin-field"><span>Notes</span><input name="notes" value={fields.notes} onChange={updateField} placeholder="Rose, amber, cedar" required maxLength={255} /></label>
            <label className="admin-field"><span>Character</span><input name="character" value={fields.character} onChange={updateField} placeholder="Warm, expressive, refined" required maxLength={255} /></label>
            <label className="admin-field admin-field-wide"><span>Best for</span><input name="bestFor" value={fields.bestFor} onChange={updateField} placeholder="Evening occasions, memorable entrances" required maxLength={255} /></label>
          </div>
        </section>

        {fields.gender === "Bundles" ? (
          <section className="admin-form-section admin-form-section-full admin-bundle-pricing-section">
            <div className="admin-form-section-heading">
              <span>04</span>
              <div>
                <h4>Bundle Bottles Concentrations & Pricing</h4>
                <p>
                  Set separate concentrations and pricing for both bottles in this bundle.
                  Customers can independently choose their preferred concentration for each bottle (e.g. Nyra 40% with Arven 20%).
                </p>
              </div>
            </div>

            <div className="admin-bundle-bottle-cards-container">
              {bundleBottles.map((bottle, bottleIdx) => {
                const bottleName = bottle.name || `Bottle ${bottleIdx + 1}`;
                return (
                  <div key={bottleIdx} className="admin-bundle-bottle-editor-card">
                    <div className="admin-bundle-bottle-card-top">
                      <div className="admin-bundle-bottle-badge-row">
                        <span className="admin-bundle-bottle-idx-pill">BOTTLE {bottleIdx + 1}</span>
                        <h5>{bottleName}</h5>
                        <small>({bottle.volumeMl || fields.volumeMl || 50} ml each)</small>
                        {bundleBottles.length > 2 && (
                          <button
                            type="button"
                            style={{ marginLeft: "auto", padding: "4px 10px", background: "none", border: "1px solid #c0392b", color: "#c0392b", cursor: "pointer", fontSize: "11px" }}
                            onClick={() => removeBundleBottle(bottleIdx)}
                          >
                            Remove Bottle
                          </button>
                        )}
                      </div>

                      <div className="admin-bundle-bottle-inputs-row">
                        <label className="admin-field" style={{ margin: 0 }}>
                          <span>Fragrance Name</span>
                          <input
                            value={bottle.name}
                            onChange={(e) => updateBottleField(bottleIdx, "name", e.target.value)}
                            placeholder="e.g. Nyra"
                            required
                          />
                        </label>
                        <label className="admin-field" style={{ margin: 0 }}>
                          <span>Scent Notes / Tagline</span>
                          <input
                            value={bottle.tagline}
                            onChange={(e) => updateBottleField(bottleIdx, "tagline", e.target.value)}
                            placeholder="e.g. Luminous white florals, roasted coffee & vanilla"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="admin-variant-editor">
                      <div className="admin-variant-labels">
                        <span>Concentration</span>
                        <span>Original / Cut-off (Was)</span>
                        <span>Quick Discount</span>
                        <span>Bottle Price (Now)</span>
                        <span />
                      </div>

                      {bottle.concentrations.map((concItem, concIdx) => {
                        const comp = Number(concItem.compareAtPrice || 0);
                        const pr = Number(concItem.price || 0);
                        const hasDiscount = comp > 0 && pr > 0 && comp > pr;
                        const discountPercent = hasDiscount ? Math.round(((comp - pr) / comp) * 100) : 0;
                        const savingsAmount = hasDiscount ? comp - pr : 0;

                        return (
                          <div className="admin-variant-card" key={concItem.key || concIdx}>
                            <div className="admin-variant-row">
                              <label className="admin-variant-field admin-variant-concentration">
                                <span className="sr-only">Concentration</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  placeholder="20"
                                  value={concItem.concentrationPercent}
                                  onChange={(e) => updateBottleConc(bottleIdx, concItem.key, "concentrationPercent", e.target.value)}
                                  required
                                />
                                <small>%</small>
                              </label>

                              <label className="admin-variant-field admin-variant-cutoff">
                                <span className="sr-only">Original / Cut-off Price</span>
                                <small>WAS PKR</small>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="e.g. 4000"
                                  value={concItem.compareAtPrice || ""}
                                  onChange={(e) => updateBottleConc(bottleIdx, concItem.key, "compareAtPrice", e.target.value)}
                                />
                              </label>

                              <div className="admin-variant-presets-cell">
                                <div className="admin-variant-presets">
                                  {[10, 15, 20, 25].map((pct) => (
                                    <button
                                      key={pct}
                                      type="button"
                                      className={`admin-preset-tag ${discountPercent === pct ? "is-active" : ""}`}
                                      onClick={() => applyBottleDiscountPreset(bottleIdx, concItem.key, pct)}
                                      title={`Set ${pct}% discount`}
                                    >
                                      {pct}%
                                    </button>
                                  ))}
                                  {hasDiscount && (
                                    <button
                                      type="button"
                                      className="admin-preset-clear"
                                      onClick={() => updateBottleConc(bottleIdx, concItem.key, "compareAtPrice", "")}
                                      title="Clear discount cut-off"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>

                              <label className="admin-variant-field admin-variant-price">
                                <span className="sr-only">Bottle Price</span>
                                <small>NOW PKR</small>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  placeholder="3500"
                                  value={concItem.price}
                                  onChange={(e) => updateBottleConc(bottleIdx, concItem.key, "price", e.target.value)}
                                  required
                                />
                              </label>

                              <button
                                className="admin-variant-remove"
                                type="button"
                                onClick={() => removeBottleConc(bottleIdx, concItem.key)}
                                disabled={bottle.concentrations.length === 1}
                                aria-label="Remove concentration"
                                title="Remove concentration"
                              >
                                ×
                              </button>
                            </div>

                            {hasDiscount && (
                              <div className="admin-variant-discount-banner">
                                <span className="admin-variant-discount-badge">{discountPercent}% OFF</span>
                                <span className="admin-variant-discount-text">
                                  Cut-off active: Was <s>PKR {comp.toLocaleString()}</s> → Now <strong>PKR {pr.toLocaleString()}</strong> (Customer saves PKR {savingsAmount.toLocaleString()})
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <button
                        className="admin-add-variant"
                        type="button"
                        onClick={() => addBottleConc(bottleIdx)}
                        style={{ marginTop: "12px" }}
                      >
                        ＋ ADD ANOTHER CONCENTRATION FOR {bottleName.toUpperCase()}
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                style={{ padding: "8px 16px", background: "none", border: "1px dashed rgba(57, 70, 63, 0.4)", color: "var(--ink)", cursor: "pointer", fontSize: "11px", letterSpacing: "0.08em", alignSelf: "flex-start" }}
                onClick={addBundleBottle}
              >
                ＋ Add Another Bottle to Bundle
              </button>
            </div>

            {/* Bundle Discount and Live Simulator */}
            <div className="admin-bundle-combo-simulator-box">
              <div className="admin-bundle-simulator-header">
                <div>
                  <h5>Bundle Set Special Discount & Live Simulator</h5>
                  <p>
                    Set the special discount when bought together as a bundle, and preview any combination (e.g. Nyra 40% + Arven 20%).
                  </p>
                </div>
                <label className="admin-bundle-discount-input-label">
                  <span>Bundle Set Discount</span>
                  <div className="admin-bundle-discount-input-wrap">
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={bundleDiscountPercent}
                      onChange={(e) => setBundleDiscountPercent(Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
                    />
                    <small>% OFF</small>
                  </div>
                </label>
              </div>

              {/* Live combination preview */}
              <div className="admin-bundle-live-tester">
                <span className="admin-bundle-tester-title">REAL-TIME COMBINATION SIMULATOR:</span>
                <div className="admin-bundle-tester-selectors">
                  {bundleBottles.map((bottle, bIdx) => (
                    <div key={bIdx} className="admin-bundle-tester-selector-col">
                      <label>{bottle.name || `Bottle ${bIdx + 1}`} Selection:</label>
                      <select
                        value={simulatedSelections[bIdx] || bottle.concentrations[0]?.concentrationPercent || 20}
                        onChange={(e) => {
                          const next = [...simulatedSelections];
                          next[bIdx] = Number(e.target.value);
                          setSimulatedSelections(next);
                        }}
                      >
                        {bottle.concentrations.map((c) => (
                          <option key={c.concentrationPercent} value={c.concentrationPercent}>
                            {c.concentrationPercent}% — PKR {Number(c.price || 0).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Calculation results */}
                <div className="admin-bundle-calc-results-pill">
                  <div className="admin-bundle-calc-names">
                    <strong>
                      {bundleBottles.map((b, i) => `${b.name || `Bottle ${i + 1}`} (${simulatedSelections[i] || b.concentrations[0]?.concentrationPercent || 20}%)`).join(" + ")}
                    </strong>
                    <span>Combined individual bottles: PKR {simTotalStandard.toLocaleString()}</span>
                  </div>
                  <div className="admin-bundle-calc-price">
                    {bundleDiscountPercent > 0 && <s>PKR {simTotalStandard.toLocaleString()}</s>}
                    <strong>PKR {simTotalDiscounted.toLocaleString()}</strong>
                    {bundleDiscountPercent > 0 && <span className="admin-badge-discount">{bundleDiscountPercent}% BUNDLE SAVING</span>}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="admin-form-section admin-form-section-full">
            <div className="admin-form-section-heading">
              <span>04</span>
              <div>
                <h4>Concentrations & Pricing</h4>
                <p>Set selling price and optional cut-off pricing (e.g. was PKR 5,500, now with 15% discount)</p>
              </div>
            </div>
            <div className="admin-variant-editor">
              <div className="admin-variant-labels">
                <span>Concentration</span>
                <span>Original / Cut-off (Was)</span>
                <span>Quick Discount</span>
                <span>Selling Price (Now)</span>
                <span />
              </div>
              {variants.map((variant, index) => {
                const comp = Number(variant.compareAtPrice || 0);
                const pr = Number(variant.price || 0);
                const hasDiscount = comp > 0 && pr > 0 && comp > pr;
                const discountPercent = hasDiscount ? Math.round(((comp - pr) / comp) * 100) : 0;
                const savingsAmount = hasDiscount ? comp - pr : 0;

                return (
                  <div className="admin-variant-card" key={variant.key}>
                    <div className="admin-variant-row">
                      <label className="admin-variant-field admin-variant-concentration">
                        <span className="sr-only">Concentration {index + 1}</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          placeholder="20"
                          value={variant.concentrationPercent}
                          onChange={(event) => updateVariant(variant.key, "concentrationPercent", event.target.value)}
                          required
                        />
                        <small>%</small>
                      </label>

                      <label className="admin-variant-field admin-variant-cutoff">
                        <span className="sr-only">Original / Cut-off Price (PKR) {index + 1}</span>
                        <small>WAS PKR</small>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="e.g. 5500"
                          value={variant.compareAtPrice || ""}
                          onChange={(event) => handleCompareAtChange(variant.key, event.target.value)}
                        />
                      </label>

                      <div className="admin-variant-presets-cell">
                        <div className="admin-variant-presets">
                          {[10, 15, 20, 25].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              className={`admin-preset-tag ${discountPercent === pct ? "is-active" : ""}`}
                              onClick={() => applyDiscountPreset(variant.key, pct)}
                              title={`Set ${pct}% discount`}
                            >
                              {pct}%
                            </button>
                          ))}
                          {hasDiscount && (
                            <button
                              type="button"
                              className="admin-preset-clear"
                              onClick={() => clearCutoff(variant.key)}
                              title="Clear discount cut-off"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <label className="admin-variant-field admin-variant-price">
                        <span className="sr-only">Selling Price {index + 1}</span>
                        <small>NOW PKR</small>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="3500"
                          value={variant.price}
                          onChange={(event) => handlePriceChange(variant.key, event.target.value)}
                          required
                        />
                      </label>

                      <button
                        className="admin-variant-remove"
                        type="button"
                        onClick={() => removeVariant(variant.key)}
                        disabled={variants.length === 1}
                        aria-label={`Remove concentration ${index + 1}`}
                        title="Remove variant"
                      >
                        ×
                      </button>
                    </div>

                    {hasDiscount && (
                      <div className="admin-variant-discount-banner">
                        <span className="admin-variant-discount-badge">{discountPercent}% OFF</span>
                        <span className="admin-variant-discount-text">
                          Cut-off active: Was <s>PKR {comp.toLocaleString()}</s> → Now <strong>PKR {pr.toLocaleString()}</strong> (Customer saves PKR {savingsAmount.toLocaleString()})
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <button className="admin-add-variant" type="button" onClick={addVariant} disabled={variants.length >= 10}>
                ＋ ADD ANOTHER CONCENTRATION
              </button>
            </div>
          </section>
        )}
      </div>

      <div className="admin-product-form-actions">
        <p className={status ? "is-visible" : ""} role="status">{status || (isEditing ? "Image additions and removals publish when you save changes." : "The product will publish immediately.")}</p>
        <div><button type="button" onClick={onCancel}>CANCEL</button><button type="submit" disabled={isSubmitting}>{isSubmitting ? "SAVING…" : (isEditing ? "SAVE CHANGES" : "PUBLISH PRODUCT")}</button></div>
      </div>
    </form>
  );
}

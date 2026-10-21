"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSidebar from "./admin-sidebar";
import AdminHeader from "./admin-header";
import AdminProductForm from "./admin-product-form";

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const money = (value) => `PKR ${number.format(Number(value || 0))}`;

export default function AdminProducts() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loadingProductId, setLoadingProductId] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [productPendingDeletion, setProductPendingDeletion] = useState(null);
  const [productMessage, setProductMessage] = useState("");
  const [productMessageType, setProductMessageType] = useState("success");
  const [productMessageTitle, setProductMessageTitle] = useState("Catalogue updated");

  // Filters & sorting
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/products", { credentials: "include", cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return null;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load products.");
      return payload;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    loadProducts().then((payload) => {
      if (active && payload) setData(payload);
    });
    return () => { active = false; };
  }, [loadProducts]);

  useEffect(() => {
    if (!productPendingDeletion) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape" && !deletingProductId) setProductPendingDeletion(null);
    }
    document.body.classList.add("is-locked");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("is-locked");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [deletingProductId, productPendingDeletion]);

  function productCreated(summary) {
    setData((current) => ({
      ...current,
      products: [...(current?.products || []), summary]
    }));
    setProductMessage(`${summary.name} has been created and published to the storefront.`);
    setProductMessageType("success");
    setProductMessageTitle("Product published");
    setShowProductForm(false);
  }

  function productUpdated(summary) {
    setData((current) => ({
      ...current,
      products: (current?.products || []).map((product) =>
        Number(product.id) === Number(summary.id) ? summary : product
      )
    }));
    setProductMessage(`${summary.name} has been updated everywhere customers see it.`);
    setProductMessageType("success");
    setProductMessageTitle("Product updated");
    setEditingProduct(null);
    setShowProductForm(false);
  }

  async function editProduct(product) {
    setLoadingProductId(product.id);
    setProductMessage("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { credentials: "include", cache: "no-store" });
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) throw new Error(payload.message || "Unable to load the fragrance for editing.");
      setEditingProduct(payload.product);
      setShowProductForm(true);
      window.requestAnimationFrame(() =>
        document.querySelector(".admin-product-form")?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    } catch (requestError) {
      setProductMessage(requestError.message);
      setProductMessageType("error");
      setProductMessageTitle("Unable to edit product");
    } finally {
      setLoadingProductId(null);
    }
  }

  async function deleteProduct() {
    if (!productPendingDeletion) return;
    const product = productPendingDeletion;
    setDeletingProductId(product.id);
    setProductMessage("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) throw new Error(payload.message || "Unable to delete the product.");

      setData((current) => ({
        ...current,
        products: (current?.products || []).filter((candidate) => Number(candidate.id) !== Number(product.id))
      }));

      if (Number(editingProduct?.id) === Number(product.id)) {
        setEditingProduct(null);
        setShowProductForm(false);
      }

      setProductMessage(payload.message || `${product.name} has been removed from the catalogue.`);
      setProductMessageType("success");
      setProductMessageTitle("Product deleted");
      setProductPendingDeletion(null);
    } catch (requestError) {
      setProductMessage(requestError.message);
      setProductMessageType("error");
      setProductMessageTitle("Unable to delete product");
      setProductPendingDeletion(null);
    } finally {
      setDeletingProductId(null);
    }
  }

  function toggleCreateProduct() {
    if (showProductForm) {
      setShowProductForm(false);
      setEditingProduct(null);
      return;
    }
    setEditingProduct(null);
    setProductMessage("");
    setShowProductForm(true);
  }

  const allProducts = data?.products || [];

  const countsByCategory = useMemo(() => {
    const counts = { all: allProducts.length, Men: 0, Women: 0, Unisex: 0 };
    for (const p of allProducts) {
      if (counts[p.gender] !== undefined) counts[p.gender]++;
    }
    return counts;
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = allProducts.filter((product) => {
      if (categoryFilter !== "all" && product.gender !== categoryFilter) return false;
      if (statusFilter === "active" && product.isActive === false) return false;
      if (statusFilter === "inactive" && product.isActive !== false) return false;
      if (!query) return true;

      const searchableText = [
        product.name,
        product.tagline,
        product.gender,
        product.notes,
        product.character,
        product.lead,
        product.description
      ].join(" ").toLowerCase();

      return searchableText.includes(query);
    });

    if (sortBy === "name-asc") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === "price-asc") {
      result = [...result].sort((a, b) => (Number(a.startingPrice || a.price) || 0) - (Number(b.startingPrice || b.price) || 0));
    } else if (sortBy === "price-desc") {
      result = [...result].sort((a, b) => (Number(b.startingPrice || b.price) || 0) - (Number(a.startingPrice || a.price) || 0));
    }

    return result;
  }, [allProducts, search, categoryFilter, statusFilter, sortBy]);

  if (loading && !data && !error) {
    return (
      <main className="admin-loading">
        <div className="admin-loading-mark">XL</div>
        <p>Loading fragrance catalogue…</p>
      </main>
    );
  }

  return (
    <main className="admin-dashboard-page">
      <AdminSidebar activeTab="products" />

      <div className="admin-dashboard-content">
        <AdminHeader title="FRAGRANCE CATALOGUE" adminEmail={data?.admin?.email} />

        <div className="admin-dashboard-main">
          {error ? (
            <section className="admin-error-panel">
              <p className="admin-eyebrow">CATALOGUE UNAVAILABLE</p>
              <h1>We could not load fragrances.</h1>
              <p>{error}</p>
              <button type="button" onClick={() => window.location.reload()}>TRY AGAIN</button>
            </section>
          ) : (
            <>
              <section className="admin-welcome">
                <div>
                  <p className="admin-eyebrow">CATALOGUE ARCHITECTURE</p>
                  <h1>Fragrance Management</h1>
                  <p>Design, edit, and organize all bespoke fragrances displayed in the Xura Lab storefront.</p>
                </div>
                <div className="admin-welcome-actions">
                  <Link href="/admin">← OVERVIEW</Link>
                  <button className="admin-primary-btn" type="button" onClick={toggleCreateProduct}>
                    {showProductForm ? "CLOSE FORM" : "＋ ADD FRAGRANCE"}
                  </button>
                </div>
              </section>

              <section className="admin-stat-grid" aria-label="Catalogue statistics">
                <article className="admin-stat-card">
                  <div><span>01</span><p>Total fragrances</p></div>
                  <strong>{number.format(allProducts.length)}</strong>
                  <small>Active & draft perfumes</small>
                </article>
                <article className="admin-stat-card">
                  <div><span>02</span><p>Unisex collection</p></div>
                  <strong>{number.format(countsByCategory.Unisex)}</strong>
                  <small>Signature shared accords</small>
                </article>
                <article className="admin-stat-card">
                  <div><span>03</span><p>Men collection</p></div>
                  <strong>{number.format(countsByCategory.Men)}</strong>
                  <small>Crisp & woody blends</small>
                </article>
                <article className="admin-stat-card">
                  <div><span>04</span><p>Women collection</p></div>
                  <strong>{number.format(countsByCategory.Women)}</strong>
                  <small>Luminous floral bouquets</small>
                </article>
              </section>

              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-eyebrow">STORE CATALOGUE</p>
                    <h2>Catalogue Products</h2>
                  </div>
                  <div className="admin-product-heading-actions">
                    <span>{filteredProducts.length} of {allProducts.length} fragrances shown</span>
                    <button type="button" onClick={toggleCreateProduct}>
                      {showProductForm ? "CLOSE" : "＋ ADD PRODUCT"}
                    </button>
                  </div>
                </div>

                {/* Inline Product Form for Creating / Editing */}
                {showProductForm && (
                  <AdminProductForm
                    key={editingProduct ? `edit-${editingProduct.id}` : "create-product"}
                    product={editingProduct}
                    onCancel={() => { setShowProductForm(false); setEditingProduct(null); }}
                    onCreated={productCreated}
                    onUpdated={productUpdated}
                  />
                )}

                {productMessage && (
                  <div className={`admin-product-success ${productMessageType === "error" ? "is-error" : ""}`} role="status">
                    <span>{productMessageType === "error" ? "!" : "✓"}</span>
                    <p><strong>{productMessageTitle}</strong> {productMessage}</p>
                    {productMessageType !== "error" && <Link href="/#collection" target="_blank">VIEW STOREFRONT ↗</Link>}
                  </div>
                )}

                {/* Filter Toolbar */}
                <div className="admin-filter-bar">
                  <div className="admin-search-wrap">
                    <span className="admin-search-icon" aria-hidden="true">🔍</span>
                    <input
                      className="admin-search-input"
                      type="search"
                      placeholder="Search fragrances by name, notes, character, mood…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button className="admin-search-clear" type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>
                    )}
                  </div>

                  <div className="admin-select-wrap">
                    <label htmlFor="admin-status-filter" className="sr-only">Status filter</label>
                    <select
                      id="admin-status-filter"
                      className="admin-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      <option value="active">Active only</option>
                      <option value="inactive">Inactive only</option>
                    </select>
                  </div>

                  <div className="admin-select-wrap">
                    <label htmlFor="admin-sort-by" className="sr-only">Sort fragrances</label>
                    <select
                      id="admin-sort-by"
                      className="admin-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="default">Default ordering</option>
                      <option value="name-asc">Name (A–Z)</option>
                      <option value="name-desc">Name (Z–A)</option>
                      <option value="price-asc">Price (Low to High)</option>
                      <option value="price-desc">Price (High to Low)</option>
                    </select>
                  </div>
                </div>

                {/* Category tabs */}
                <div className="admin-status-tabs" role="tablist" aria-label="Filter by gender category">
                  {[
                    { id: "all", label: "All Fragrances" },
                    { id: "Unisex", label: "Unisex" },
                    { id: "Men", label: "Men" },
                    { id: "Women", label: "Women" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={categoryFilter === tab.id}
                      className={`admin-status-tab ${categoryFilter === tab.id ? "is-active" : ""}`}
                      onClick={() => setCategoryFilter(tab.id)}
                    >
                      <span>{tab.label}</span>
                      <small>({countsByCategory[tab.id] || 0})</small>
                    </button>
                  ))}
                </div>

                {/* Products list */}
                <div className="admin-product-list">
                  {filteredProducts.length ? (
                    filteredProducts.map((product, index) => (
                      <article key={product.id}>
                        <span className="admin-product-index">{String(index + 1).padStart(2, "0")}</span>
                        <div className="admin-product-identity">
                          <span className="admin-product-thumbnail">
                            <Image src={product.imageUrl} alt="" fill sizes="48px" />
                          </span>
                          <div>
                            <strong>{product.name}</strong>
                            <small>{product.gender} · {product.volumeMl || 50} ml</small>
                            {product.notes && <small className="admin-product-notes">Notes: {product.notes}</small>}
                          </div>
                        </div>

                        <div className="admin-product-variants-summary">
                          <p>{product.variantCount || product.variants?.length || 3} concentrations</p>
                          <div className="admin-variant-chips">
                            {product.variants?.map((v) => (
                              <span key={v.id || v.concentrationPercent}>
                                {v.concentrationPercent}%: {money(v.price)}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p>From {money(product.startingPrice || product.price)}</p>
                          {product.images?.length > 1 && (
                            <small className="admin-image-count-badge">
                              {product.images.length} images
                            </small>
                          )}
                        </div>

                        <div className="admin-product-row-actions">
                          <span className={`admin-status ${product.isActive !== false ? "admin-status-active" : "admin-status-cancelled"}`}>
                            {product.isActive !== false ? "Active" : "Inactive"}
                          </span>
                          <button
                            type="button"
                            onClick={() => editProduct(product)}
                            disabled={loadingProductId === product.id}
                          >
                            {loadingProductId === product.id ? "LOADING…" : "EDIT"}
                          </button>
                          <button
                            className="admin-delete-product-button"
                            type="button"
                            onClick={() => setProductPendingDeletion(product)}
                            disabled={loadingProductId !== null || deletingProductId !== null}
                            aria-label={`Delete ${product.name}`}
                          >
                            DELETE
                          </button>
                          <Link
                            className="admin-view-storefront-btn"
                            href={`/products/${product.slug}`}
                            target="_blank"
                            title="View on storefront"
                          >
                            ↗
                          </Link>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="admin-empty-state">
                      <span>00</span>
                      <h3>No fragrances found.</h3>
                      <p>Try adjusting your search query or gender filter.</p>
                      {(search || categoryFilter !== "all" || statusFilter !== "all") && (
                        <button
                          className="admin-clear-filter-btn"
                          type="button"
                          onClick={() => { setSearch(""); setCategoryFilter("all"); setStatusFilter("all"); }}
                        >
                          RESET FILTERS
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {productPendingDeletion && (
        <div
          className="admin-confirmation-backdrop"
          onMouseDown={() => { if (!deletingProductId) setProductPendingDeletion(null); }}
        >
          <section
            className="admin-confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            aria-describedby="delete-product-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="admin-eyebrow">DELETE PRODUCT</p>
            <h2 id="delete-product-title">Remove {productPendingDeletion.name}?</h2>
            <p id="delete-product-description">
              This fragrance will disappear from the storefront and cannot be edited again. Existing order history will remain safe.
            </p>
            <div>
              <button
                type="button"
                onClick={() => setProductPendingDeletion(null)}
                disabled={Boolean(deletingProductId)}
                autoFocus
              >
                KEEP PRODUCT
              </button>
              <button
                className="is-danger"
                type="button"
                onClick={deleteProduct}
                disabled={Boolean(deletingProductId)}
              >
                {deletingProductId ? "DELETING…" : "YES, DELETE"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

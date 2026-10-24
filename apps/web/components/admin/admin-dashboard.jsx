"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminSidebar from "./admin-sidebar";
import AdminHeader from "./admin-header";
import AdminProductForm from "./admin-product-form";

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const money = (value) => `PKR ${number.format(Number(value || 0))}`;

function StatCard({ label, value, detail, index }) {
  return (
    <article className="admin-stat-card">
      <div><span>{String(index).padStart(2, "0")}</span><p>{label}</p></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function displayPayment(method) {
  return {
    card: "Card",
    "bank-transfer": "Bank transfer",
    "cash-on-delivery": "Cash on Delivery"
  }[method] || method;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [productMessage, setProductMessage] = useState("");
  const [productMessageType, setProductMessageType] = useState("success");
  const [productMessageTitle, setProductMessageTitle] = useState("Catalogue updated");
  const [editingProduct, setEditingProduct] = useState(null);
  const [loadingProductId, setLoadingProductId] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [productPendingDeletion, setProductPendingDeletion] = useState(null);

  const loadDashboard = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { credentials: "include", cache: "no-store" });
    const payload = await response.json();
    if (response.status === 401) {
      router.replace("/admin/login");
      return null;
    }
    if (!response.ok) throw new Error(payload.message || "Unable to load the dashboard.");
    return payload;
  }, [router]);

  useEffect(() => {
    let active = true;
    loadDashboard()
      .then((payload) => {
        if (active && payload) setData(payload);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => { active = false; };
  }, [loadDashboard]);

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
      stats: { ...current.stats, totalProducts: current.stats.totalProducts + 1 },
      products: [...current.products, summary]
    }));
    setProductMessage(`${summary.name} has been published and is now visible to customers.`);
    setProductMessageType("success");
    setProductMessageTitle("Catalogue updated");
    setShowProductForm(false);
  }

  function productUpdated(summary) {
    setData((current) => ({
      ...current,
      products: current.products.map((product) => Number(product.id) === Number(summary.id) ? summary : product)
    }));
    setProductMessage(`${summary.name} has been updated everywhere customers see it.`);
    setProductMessageType("success");
    setProductMessageTitle("Catalogue updated");
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
      if (!response.ok) throw new Error(payload.message || "Unable to load the product for editing.");
      setEditingProduct(payload.product);
      setShowProductForm(true);
      window.requestAnimationFrame(() => document.querySelector(".admin-product-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
        stats: { ...current.stats, totalProducts: Math.max(0, current.stats.totalProducts - 1) },
        products: current.products.filter((candidate) => Number(candidate.id) !== Number(product.id))
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

  if (!data && !error) {
    return (
      <main className="admin-loading">
        <div className="admin-loading-mark">XL</div>
        <p>Preparing your dashboard…</p>
      </main>
    );
  }

  return (
    <main className="admin-dashboard-page">
      <AdminSidebar activeTab="overview" />

      <div className="admin-dashboard-content">
        <AdminHeader title="ADMIN WORKSPACE" adminEmail={data?.admin?.email} />

        <div className="admin-dashboard-main" id="overview">
          {error ? (
            <section className="admin-error-panel">
              <p className="admin-eyebrow">DASHBOARD UNAVAILABLE</p>
              <h1>We could not load the administration data.</h1>
              <p>{error}</p>
              <button type="button" onClick={() => window.location.reload()}>TRY AGAIN</button>
            </section>
          ) : (
            <>
              <section className="admin-welcome">
                <div>
                  <p className="admin-eyebrow">STORE OVERVIEW</p>
                  <h1>Good to see you.</h1>
                  <p>Here is what is happening across Xura Lab today.</p>
                </div>
                <div className="admin-welcome-actions">
                  <Link href="/admin/promos">PROMO CODES →</Link>
                  <Link href="/" target="_blank">OPEN STOREFRONT <span>↗</span></Link>
                </div>
              </section>

              {data.source === "local" && (
                <div className="admin-data-notice"><span>Local catalogue mode</span> New products are saved on this machine. Connect MySQL before production for shared catalogue and order storage.</div>
              )}

              <section className="admin-stat-grid" aria-label="Store statistics">
                <StatCard index={1} label="Total revenue" value={money(data.stats.revenue)} detail="Across all recorded orders" />
                <StatCard index={2} label="Orders" value={number.format(data.stats.totalOrders)} detail="All customer orders" />
                <StatCard index={3} label="Pending" value={number.format(data.stats.pendingOrders)} detail="Awaiting confirmation" />
                <StatCard index={4} label="Products" value={number.format(data.stats.totalProducts)} detail="Active fragrances" />
                <StatCard index={5} label="Promo codes" value={number.format(data.stats.totalPromos || 0)} detail={`${data.stats.activePromos || 0} active campaigns`} />
              </section>

              <section className="admin-panel" id="orders">
                <div className="admin-panel-heading">
                  <div><p className="admin-eyebrow">ORDERS</p><h2>Recent orders</h2></div>
                  <div className="admin-heading-actions-wrap">
                    <span>{data.recentOrders.length} shown</span>
                    <Link className="admin-panel-view-all-btn" href="/admin/orders">VIEW ALL ORDERS →</Link>
                  </div>
                </div>
                {data.recentOrders.length ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                      <tbody>
                        {data.recentOrders.map((order) => (
                          <tr key={order.id}>
                            <td><strong>#{order.id}</strong></td>
                            <td><strong>{order.customerName}</strong><small>{order.email}</small></td>
                            <td>{displayPayment(order.paymentMethod)}</td>
                            <td>{money(order.total)}</td>
                            <td><span className={`admin-status admin-status-${order.status}`}>{order.status}</span></td>
                            <td>{new Intl.DateTimeFormat("en-PK", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(order.createdAt))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="admin-empty-state"><span>01</span><h3>No orders yet.</h3><p>New checkout orders will appear here automatically.</p></div>
                )}
              </section>

              <section className="admin-panel" id="products">
                <div className="admin-panel-heading">
                  <div><p className="admin-eyebrow">CATALOGUE</p><h2>Product overview</h2></div>
                  <div className="admin-product-heading-actions">
                    <Link className="admin-panel-view-all-btn" href="/admin/products">MANAGE ALL ({data.products.length}) →</Link>
                    <button type="button" onClick={toggleCreateProduct}>
                      {showProductForm ? "CLOSE" : "＋ ADD PRODUCT"}
                    </button>
                  </div>
                </div>
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
                    <span>{productMessageType === "error" ? "!" : "✓"}</span><p><strong>{productMessageTitle}</strong>{productMessage}</p>{productMessageType !== "error" && <Link href="/#collection" target="_blank">VIEW STOREFRONT ↗</Link>}
                  </div>
                )}
                <div className="admin-product-list">
                  {data.products.length ? data.products.map((product, index) => (
                    <article key={product.id}>
                      <span className="admin-product-index">{String(index + 1).padStart(2, "0")}</span>
                      <div className="admin-product-identity">
                        <span className="admin-product-thumbnail"><Image src={product.imageUrl || "/images/xura-hero-4k.jpg"} alt="" fill sizes="48px" unoptimized={Boolean(product.imageUrl && (product.imageUrl.startsWith("/uploads/") || product.imageUrl.startsWith("blob:")))} /></span>
                        <span><strong>{product.name}</strong><small>{product.gender}</small></span>
                      </div>
                      <p>{product.variantCount} concentrations</p>
                      <div className="admin-product-price-cell">
                        <p>
                          From {money(product.startingPrice)}
                          {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.startingPrice) && (
                            <s className="admin-price-cutoff">{money(product.compareAtPrice)}</s>
                          )}
                        </p>
                      </div>
                      <div className="admin-product-row-actions">
                        <span className={`admin-status ${product.isActive ? "admin-status-active" : "admin-status-cancelled"}`}>{product.isActive ? "Active" : "Inactive"}</span>
                        <button type="button" onClick={() => editProduct(product)} disabled={loadingProductId === product.id}>
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
                      </div>
                    </article>
                  )) : (
                    <div className="admin-empty-state"><span>00</span><h3>No products in the catalogue.</h3><p>Add a fragrance when you are ready to publish it.</p></div>
                  )}
                </div>
              </section>

              <section className="admin-panel" id="promos">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-eyebrow">MARKETING & DISCOUNTS</p>
                    <h2>Promo Codes</h2>
                  </div>
                  <div className="admin-heading-actions-wrap">
                    <span>{data.stats.totalPromos || 0} configured campaigns</span>
                    <Link className="admin-panel-view-all-btn" href="/admin/promos">MANAGE ALL PROMOS →</Link>
                  </div>
                </div>
                <div style={{ padding: "26px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", flexWrap: "wrap", background: "rgba(255, 255, 255, 0.4)" }}>
                  <div>
                    <strong style={{ display: "block", fontSize: "14px", color: "var(--ink)", marginBottom: "4px" }}>
                      Manage discount codes, fragrance restrictions & spending limits
                    </strong>
                    <p style={{ margin: 0, fontSize: "12.5px", color: "#666" }}>
                      Create fixed PKR or percentage discount codes, define minimum/maximum spend thresholds, and restrict promo codes to Arven, Velor, or Nyra.
                    </p>
                  </div>
                  <Link
                    href="/admin/promos"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "11px 20px",
                      background: "var(--ink)",
                      color: "var(--paper)",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      textDecoration: "none"
                    }}
                  >
                    OPEN PROMOS PAGE →
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

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
            <p id="delete-product-description">This fragrance will disappear from the storefront and cannot be edited again. Existing order history will remain safe.</p>
            <div>
              <button type="button" onClick={() => setProductPendingDeletion(null)} disabled={Boolean(deletingProductId)} autoFocus>KEEP PRODUCT</button>
              <button className="is-danger" type="button" onClick={deleteProduct} disabled={Boolean(deletingProductId)}>
                {deletingProductId ? "DELETING…" : "YES, DELETE"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

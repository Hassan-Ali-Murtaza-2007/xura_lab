"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminProductForm from "@/components/admin-product-form";

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const money = (value) => `PKR ${number.format(Number(value || 0))}`;

function DashboardIcon({ name }) {
  const paths = {
    overview: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    orders: <><path d="M6 3h12l2 5-2 13H6L4 8l2-5Z" /><path d="M4 8h16M9 12h6" /></>,
    products: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z" /><path d="M12 11v10" /></>,
    store: <><path d="M4 10h16M6 10v10h12V10M3 10l2-6h14l2 6" /><path d="M9 20v-6h6v6" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

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

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    router.replace("/admin/login");
  }

  if (!data && !error) {
    return (
      <main className="admin-loading">
        <div className="admin-loading-mark">XL</div>
        <p>Preparing your dashboard…</p>
      </main>
    );
  }

  const today = new Intl.DateTimeFormat("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <main className="admin-dashboard-page">
      <aside className="admin-sidebar">
        <Link className="admin-sidebar-brand" href="/admin">
          <span>XURA LAB</span><small>ADMIN</small>
        </Link>
        <nav aria-label="Admin navigation">
          <a className="is-active" href="#overview"><DashboardIcon name="overview" /><span>Overview</span></a>
          <a href="#orders"><DashboardIcon name="orders" /><span>Orders</span></a>
          <a href="#products"><DashboardIcon name="products" /><span>Products</span></a>
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/" target="_blank"><DashboardIcon name="store" /><span>View store</span></Link>
          <button type="button" onClick={logout}><DashboardIcon name="logout" /><span>Sign out</span></button>
        </div>
      </aside>

      <div className="admin-dashboard-content">
        <header className="admin-dashboard-header">
          <button className="admin-mobile-brand" type="button" aria-label="Admin menu">XL</button>
          <div>
            <p>{today}</p>
            <span>ADMIN WORKSPACE</span>
          </div>
          <div className="admin-profile">
            <span>HA</span>
            <div><strong>Store administrator</strong><small>{data?.admin?.email || "Administrator"}</small></div>
          </div>
        </header>

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
                <Link href="/" target="_blank">OPEN STOREFRONT <span>↗</span></Link>
              </section>

              {data.source === "local" && (
                <div className="admin-data-notice"><span>Local catalogue mode</span> New products are saved on this machine. Connect MySQL before production for shared catalogue and order storage.</div>
              )}

              <section className="admin-stat-grid" aria-label="Store statistics">
                <StatCard index={1} label="Total revenue" value={money(data.stats.revenue)} detail="Across all recorded orders" />
                <StatCard index={2} label="Orders" value={number.format(data.stats.totalOrders)} detail="All customer orders" />
                <StatCard index={3} label="Pending" value={number.format(data.stats.pendingOrders)} detail="Awaiting confirmation" />
                <StatCard index={4} label="Products" value={number.format(data.stats.totalProducts)} detail="Active fragrances" />
              </section>

              <section className="admin-panel" id="orders">
                <div className="admin-panel-heading">
                  <div><p className="admin-eyebrow">ORDERS</p><h2>Recent orders</h2></div>
                  <span>{data.recentOrders.length} shown</span>
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
                    <span>{data.products.length} fragrances</span>
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
                        <span className="admin-product-thumbnail"><Image src={product.imageUrl} alt="" fill sizes="48px" /></span>
                        <span><strong>{product.name}</strong><small>{product.gender}</small></span>
                      </div>
                      <p>{product.variantCount} concentrations</p>
                      <p>From {money(product.startingPrice)}</p>
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

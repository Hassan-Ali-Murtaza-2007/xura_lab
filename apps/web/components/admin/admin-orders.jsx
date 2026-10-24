"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSidebar from "./admin-sidebar";
import AdminHeader from "./admin-header";

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const money = (value) => `PKR ${number.format(Number(value || 0))}`;

function displayPayment(method) {
  return {
    card: "Card",
    "bank-transfer": "Bank transfer",
    "cash-on-delivery": "Cash on Delivery"
  }[method] || method;
}

export default function AdminOrders() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/orders", { credentials: "include", cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return null;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load orders.");
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
    loadOrders().then((payload) => {
      if (active && payload) setData(payload);
    });
    return () => { active = false; };
  }, [loadOrders]);

  useEffect(() => {
    if (!selectedOrder) return;
    function closeOnEscape(event) {
      if (event.key === "Escape" && !updatingStatus) setSelectedOrder(null);
    }
    document.body.classList.add("is-locked");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("is-locked");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedOrder, updatingStatus]);

  async function updateOrderStatus(orderId, nextStatus) {
    setUpdatingStatus(true);
    setStatusFeedback("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to update order status.");

      setData((current) => {
        if (!current) return current;
        const updatedOrders = current.orders.map((o) =>
          Number(o.id) === Number(orderId) ? { ...o, status: nextStatus } : o
        );
        const pendingCount = updatedOrders.filter((o) => o.status === "pending").length;
        const deliveredCount = updatedOrders.filter((o) => o.status === "delivered").length;
        return {
          ...current,
          orders: updatedOrders,
          stats: {
            ...current.stats,
            pendingOrders: pendingCount,
            deliveredOrders: deliveredCount
          }
        };
      });

      if (selectedOrder && Number(selectedOrder.id) === Number(orderId)) {
        setSelectedOrder((prev) => ({ ...prev, status: nextStatus }));
      }
      setStatusFeedback(payload.message || `Order #${orderId} updated to ${nextStatus}.`);
    } catch (err) {
      setStatusFeedback(`Error: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  }

  const allOrders = data?.orders || [];

  const countsByStatus = useMemo(() => {
    const counts = { all: allOrders.length, pending: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0 };
    for (const o of allOrders) {
      if (counts[o.status] !== undefined) counts[o.status]++;
    }
    return counts;
  }, [allOrders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allOrders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (paymentFilter !== "all" && order.paymentMethod !== paymentFilter) return false;
      if (!query) return true;

      const searchableText = [
        `#${order.id}`,
        String(order.id),
        order.customerName,
        order.email,
        order.phone,
        order.city,
        ...(order.items || []).map((item) => `${item.productName} ${item.concentrationPercent}%`)
      ].join(" ").toLowerCase();

      return searchableText.includes(query);
    });
  }, [allOrders, search, statusFilter, paymentFilter]);

  if (loading && !data && !error) {
    return (
      <main className="admin-loading">
        <div className="admin-loading-mark">XL</div>
        <p>Loading orders catalogue…</p>
      </main>
    );
  }

  return (
    <main className="admin-dashboard-page">
      <AdminSidebar activeTab="orders" />

      <div className="admin-dashboard-content">
        <AdminHeader title="ORDERS MANAGEMENT" adminEmail={data?.admin?.email} />

        <div className="admin-dashboard-main">
          {error ? (
            <section className="admin-error-panel">
              <p className="admin-eyebrow">ORDERS UNAVAILABLE</p>
              <h1>We could not load store orders.</h1>
              <p>{error}</p>
              <button type="button" onClick={() => window.location.reload()}>TRY AGAIN</button>
            </section>
          ) : (
            <>
              <section className="admin-welcome">
                <div>
                  <p className="admin-eyebrow">STORE OPERATIONS</p>
                  <h1>Customer Orders</h1>
                  <p>Track, filter, and fulfill customer fragrance orders across Pakistan.</p>
                </div>
                <Link href="/admin">← BACK TO OVERVIEW</Link>
              </section>

              <section className="admin-stat-grid" aria-label="Order statistics">
                <article className="admin-stat-card">
                  <div><span>01</span><p>Total orders</p></div>
                  <strong>{number.format(data?.stats?.totalOrders || allOrders.length)}</strong>
                  <small>Recorded store checkouts</small>
                </article>
                <article className="admin-stat-card">
                  <div><span>02</span><p>Pending fulfillment</p></div>
                  <strong>{number.format(data?.stats?.pendingOrders || countsByStatus.pending)}</strong>
                  <small>Awaiting confirmation</small>
                </article>
                <article className="admin-stat-card">
                  <div><span>03</span><p>Delivered orders</p></div>
                  <strong>{number.format(data?.stats?.deliveredOrders || countsByStatus.delivered)}</strong>
                  <small>Successfully completed</small>
                </article>
                <article className="admin-stat-card">
                  <div><span>04</span><p>Gross revenue</p></div>
                  <strong>{money(data?.stats?.revenue || allOrders.reduce((s, o) => s + (Number(o.total) || 0), 0))}</strong>
                  <small>Total order volume</small>
                </article>
              </section>

              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-eyebrow">ORDER MANAGEMENT</p>
                    <h2>Catalogue of Orders</h2>
                  </div>
                  <span>{filteredOrders.length} of {allOrders.length} orders shown</span>
                </div>

                {statusFeedback && (
                  <div className="admin-product-success" role="status">
                    <span>✓</span>
                    <p>{statusFeedback}</p>
                  </div>
                )}

                {/* Filters toolbar */}
                <div className="admin-filter-bar">
                  <div className="admin-search-wrap">
                    <span className="admin-search-icon" aria-hidden="true">🔍</span>
                    <input
                      className="admin-search-input"
                      type="search"
                      placeholder="Search by order #, customer, email, phone, city…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button className="admin-search-clear" type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>
                    )}
                  </div>

                  <div className="admin-select-wrap">
                    <label htmlFor="admin-payment-filter" className="sr-only">Payment method</label>
                    <select
                      id="admin-payment-filter"
                      className="admin-select"
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value)}
                    >
                      <option value="all">All payment methods</option>
                      <option value="cash-on-delivery">Cash on Delivery</option>
                      <option value="bank-transfer">Bank transfer</option>
                      <option value="card">Card payment</option>
                    </select>
                  </div>
                </div>

                {/* Status tabs */}
                <div className="admin-status-tabs" role="tablist" aria-label="Filter by order status">
                  {[
                    { id: "all", label: "All" },
                    { id: "pending", label: "Pending" },
                    { id: "confirmed", label: "Confirmed" },
                    { id: "shipped", label: "Shipped" },
                    { id: "delivered", label: "Delivered" },
                    { id: "cancelled", label: "Cancelled" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={statusFilter === tab.id}
                      className={`admin-status-tab ${statusFilter === tab.id ? "is-active" : ""}`}
                      onClick={() => setStatusFilter(tab.id)}
                    >
                      <span>{tab.label}</span>
                      <small>({countsByStatus[tab.id] || 0})</small>
                    </button>
                  ))}
                </div>

                {filteredOrders.length ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table admin-orders-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Date</th>
                          <th>Customer</th>
                          <th>Items</th>
                          <th>Payment</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => (
                          <tr key={order.id} className="admin-order-row">
                            <td>
                              <strong>#{order.id}</strong>
                            </td>
                            <td>
                              <span className="admin-date-primary">
                                {new Intl.DateTimeFormat("en-PK", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(order.createdAt))}
                              </span>
                              <small className="admin-date-time">
                                {new Intl.DateTimeFormat("en-PK", { hour: "2-digit", minute: "2-digit" }).format(new Date(order.createdAt))}
                              </small>
                            </td>
                            <td>
                              <strong>{order.customerName}</strong>
                              <small>{order.email}</small>
                              <small>{order.phone} · {order.city}</small>
                            </td>
                            <td>
                              <div className="admin-order-items-preview">
                                {order.items?.length ? (
                                  order.items.map((it, i) => (
                                    <span key={i} className="admin-item-chip">
                                      {it.productName}{it.concentrationPercent ? ` (${it.concentrationPercent}%)` : ""} × {it.quantity}
                                    </span>
                                  ))
                                ) : (
                                  <small>Fragrance order</small>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="admin-payment-pill">{displayPayment(order.paymentMethod)}</span>
                            </td>
                            <td>
                              <strong>{money(order.total)}</strong>
                              {order.promoCode && (
                                <small className="admin-order-promo-label">
                                  🏷️ {order.promoCode} (-{money(order.discountAmount)})
                                </small>
                              )}
                              {Number(order.deliveryFee) === 0 && (
                                <small className="admin-order-free-ship-label">
                                  ✓ Free Delivery
                                </small>
                              )}
                            </td>
                            <td>
                              <span className={`admin-status admin-status-${order.status}`}>
                                {order.status}
                              </span>
                            </td>
                            <td>
                              <button
                                className="admin-row-action-btn"
                                type="button"
                                onClick={() => setSelectedOrder(order)}
                                aria-label={`View order #${order.id} details`}
                              >
                                VIEW DETAILS
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="admin-empty-state">
                    <span>00</span>
                    <h3>No orders matched your filters.</h3>
                    <p>Try clearing your search keyword or switching status tabs.</p>
                    {(search || statusFilter !== "all" || paymentFilter !== "all") && (
                      <button
                        className="admin-clear-filter-btn"
                        type="button"
                        onClick={() => { setSearch(""); setStatusFilter("all"); setPaymentFilter("all"); }}
                      >
                        RESET ALL FILTERS
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="admin-confirmation-backdrop" onMouseDown={() => { if (!updatingStatus) setSelectedOrder(null); }}>
          <section
            className="admin-order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="admin-dialog-header">
              <div>
                <p className="admin-eyebrow">ORDER DETAILS</p>
                <h2 id="order-dialog-title">Order #{selectedOrder.id}</h2>
                <p className="admin-dialog-subtitle">
                  Placed on {new Intl.DateTimeFormat("en-PK", { dateStyle: "full", timeStyle: "short" }).format(new Date(selectedOrder.createdAt))}
                </p>
              </div>
              <button
                className="admin-dialog-close"
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
              >
                ×
              </button>
            </div>

            <div className="admin-order-dialog-content">
              {/* Status updater */}
              <div className="admin-order-status-bar">
                <span>Current Status:</span>
                <span className={`admin-status admin-status-${selectedOrder.status}`}>
                  {selectedOrder.status}
                </span>
                <div className="admin-order-status-actions">
                  <label htmlFor="dialog-status-select" className="sr-only">Change status</label>
                  <select
                    id="dialog-status-select"
                    value={selectedOrder.status}
                    disabled={updatingStatus}
                    onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Customer & Shipping grid */}
              <div className="admin-order-details-grid">
                <div className="admin-order-info-card">
                  <h4>Customer</h4>
                  <p><strong>{selectedOrder.customerName}</strong></p>
                  <p>{selectedOrder.email}</p>
                  <p>{selectedOrder.phone}</p>
                </div>

                <div className="admin-order-info-card">
                  <h4>Delivery Address</h4>
                  <p>{selectedOrder.deliveryAddress || `${selectedOrder.addressLine1 || ""}, ${selectedOrder.city}`}</p>
                  {selectedOrder.orderNote && (
                    <div className="admin-order-note">
                      <strong>Customer note:</strong> {selectedOrder.orderNote}
                    </div>
                  )}
                </div>

                <div className="admin-order-info-card">
                  <h4>Payment & Delivery</h4>
                  <p><strong>Method:</strong> {displayPayment(selectedOrder.paymentMethod)}</p>
                  <p>
                    <strong>Shipping:</strong>{" "}
                    {Number(selectedOrder.deliveryFee) === 0
                      ? "Free Delivery (Advance Payment)"
                      : `Standard courier (${money(selectedOrder.deliveryFee || 370)})`}
                  </p>
                  {selectedOrder.promoCode && (
                    <p>
                      <strong>Promo code:</strong>{" "}
                      <span className="admin-order-code-badge">{selectedOrder.promoCode}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="admin-order-items-section">
                <h4>Purchased Fragrances</h4>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Fragrance</th>
                        <th>Concentration</th>
                        <th>Unit Price</th>
                        <th>Qty</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td><strong>{item.productName}</strong></td>
                          <td>{item.concentrationPercent ? `${item.concentrationPercent}%` : (item.bundleDetails || "Custom Bundle")}</td>
                          <td>{money(item.unitPrice)}</td>
                          <td>× {item.quantity}</td>
                          <td><strong>{money(item.lineTotal)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="admin-order-financials">
                  <div><span>Subtotal</span><strong>{money(selectedOrder.subtotal)}</strong></div>
                  {selectedOrder.promoCode && (
                    <div style={{ color: "#234b35" }}>
                      <span>Promo Discount ({selectedOrder.promoCode})</span>
                      <strong>- {money(selectedOrder.discountAmount)}</strong>
                    </div>
                  )}
                  <div>
                    <span>Delivery</span>
                    <strong>
                      {Number(selectedOrder.deliveryFee) === 0 ? "FREE" : money(selectedOrder.deliveryFee || 370)}
                    </strong>
                  </div>
                  <div className="is-grand-total"><span>Grand Total</span><strong>{money(selectedOrder.total)}</strong></div>
                </div>
              </div>
            </div>

            <div className="admin-dialog-footer">
              <button type="button" onClick={() => setSelectedOrder(null)}>CLOSE</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

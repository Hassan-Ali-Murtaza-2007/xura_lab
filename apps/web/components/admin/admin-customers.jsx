"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSidebar from "./admin-sidebar";
import AdminHeader from "./admin-header";

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const money = (value) => `PKR ${number.format(Number(value || 0))}`;

function StatCard({ label, value, detail, index }) {
  return (
    <article className="admin-stat-card">
      <div>
        <span>{String(index).padStart(2, "0")}</span>
        <p>{label}</p>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function getInitials(name) {
  if (!name) return "XL";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(isoString) {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch {
    return isoString;
  }
}

export default function AdminCustomers() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "gmail" | "orders"
  const [copiedEmail, setCopiedEmail] = useState("");
  const [bannerFeedback, setBannerFeedback] = useState("");
  const [inspectingCustomer, setInspectingCustomer] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [customerOrders, setCustomerOrders] = useState([]);

  const loadCustomers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/customers", {
        credentials: "include",
        cache: "no-store"
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return null;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load customer directory.");
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
    loadCustomers().then((payload) => {
      if (active && payload) setData(payload);
    });
    return () => {
      active = false;
    };
  }, [loadCustomers]);

  const allCustomers = useMemo(() => data?.customers || [], [data]);

  const filteredCustomers = useMemo(() => {
    let list = allCustomers;

    if (filter === "gmail") {
      list = list.filter((c) => c.isGmail);
    } else if (filter === "orders") {
      list = list.filter((c) => Number(c.orderCount) > 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allCustomers, filter, search]);

  async function openCustomerModal(customer) {
    setInspectingCustomer(customer);
    setLoadingDetails(true);
    setCustomerOrders([]);
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        credentials: "include",
        cache: "no-store"
      });
      if (response.ok) {
        const payload = await response.json();
        setCustomerOrders(payload.customer?.orders || []);
      }
    } catch {
      // Keep modal open even if orders fail
    } finally {
      setLoadingDetails(false);
    }
  }

  function copySingleEmail(email, event) {
    event?.stopPropagation();
    navigator.clipboard?.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(""), 2000);
  }

  function copyAllEmails() {
    if (!filteredCustomers.length) return;
    const emails = filteredCustomers.map((c) => c.email).join(", ");
    navigator.clipboard?.writeText(emails);
    setBannerFeedback(`Copied ${filteredCustomers.length} customer email${filteredCustomers.length === 1 ? "" : "s"} to clipboard!`);
    setTimeout(() => setBannerFeedback(""), 3500);
  }

  function exportCSV() {
    if (!filteredCustomers.length) return;
    const headers = ["ID", "Name", "Email", "Provider", "Phone", "Orders Count", "Total Spent (PKR)", "Registered Date"];
    const rows = filteredCustomers.map((c) => [
      c.id,
      `"${(c.name || "").replace(/"/g, '""')}"`,
      `"${c.email}"`,
      c.provider || (c.isGmail ? "Gmail" : "Other"),
      `"${c.phone || ""}"`,
      c.orderCount,
      c.totalSpent,
      `"${c.createdAt || ""}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `xura_customers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading && !data && !error) {
    return (
      <main className="admin-loading">
        <div className="admin-loading-mark">XL</div>
        <p>Loading customer accounts…</p>
      </main>
    );
  }

  return (
    <main className="admin-dashboard-page">
      <AdminSidebar activeTab="customers" />

      <div className="admin-dashboard-content">
        <AdminHeader title="CUSTOMER ACCOUNTS" adminEmail={data?.admin?.email} />

        <div className="admin-dashboard-main">
          {error ? (
            <section className="admin-error-panel">
              <p className="admin-eyebrow">DIRECTORY UNAVAILABLE</p>
              <h1>We could not load customer accounts.</h1>
              <p>{error}</p>
              <button type="button" onClick={() => window.location.reload()}>
                TRY AGAIN
              </button>
            </section>
          ) : (
            <>
              <section className="admin-welcome">
                <div>
                  <p className="admin-eyebrow">CUSTOMER ACCOUNTS & DIRECTORY</p>
                  <h1>Registered Shoppers</h1>
                  <p>
                    Track all customer registrations, Gmail accounts, phone numbers, and purchase activity in one place.
                  </p>
                </div>
                <div className="admin-welcome-actions">
                  <button className="admin-primary-btn" type="button" onClick={copyAllEmails} disabled={!filteredCustomers.length}>
                    📋 COPY {filteredCustomers.length} {filter === "gmail" ? "GMAILS" : "EMAILS"}
                  </button>
                  <button className="admin-secondary-btn" type="button" onClick={exportCSV} disabled={!filteredCustomers.length}>
                    📥 EXPORT CSV
                  </button>
                </div>
              </section>

              {bannerFeedback && (
                <div className="admin-product-success" role="status">
                  <span>✓</span>
                  <p>{bannerFeedback}</p>
                </div>
              )}

              {/* Statistics Overview */}
              <section className="admin-stat-grid" aria-label="Customer statistics">
                <StatCard
                  index={1}
                  label="Registered Shoppers"
                  value={number.format(data?.stats?.totalCustomers || 0)}
                  detail="Total accounts on Xura Lab"
                />
                <StatCard
                  index={2}
                  label="Gmail Users"
                  value={number.format(data?.stats?.gmailCustomers || 0)}
                  detail="Accounts created with @gmail.com"
                />
                <StatCard
                  index={3}
                  label="Active Buyers"
                  value={number.format(data?.stats?.customersWithOrders || 0)}
                  detail="Accounts with 1+ orders placed"
                />
                <StatCard
                  index={4}
                  label="Customer Revenue"
                  value={money(data?.stats?.totalRevenue || 0)}
                  detail="Lifetime registered spend"
                />
              </section>

              {/* Customer Directory Table Section */}
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-eyebrow">DIRECTORY</p>
                    <h2>Customer Accounts & Gmails</h2>
                  </div>
                  <span>
                    {filteredCustomers.length} of {allCustomers.length} customers shown
                  </span>
                </div>

                {/* Filters toolbar */}
                <div className="admin-filter-bar">
                  <div className="admin-search-wrap">
                    <span className="admin-search-icon" aria-hidden="true">
                      🔍
                    </span>
                    <input
                      className="admin-search-input"
                      type="search"
                      placeholder="Search by Gmail, email address, name, or phone number…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        className="admin-search-clear"
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="admin-quick-actions-bar">
                    <button
                      type="button"
                      className="admin-action-pill-btn"
                      onClick={copyAllEmails}
                      disabled={!filteredCustomers.length}
                      title="Copy all currently filtered emails to clipboard (comma-separated)"
                    >
                      📋 Copy All Filtered Emails
                    </button>
                  </div>
                </div>

                {/* Status / Category tabs */}
                <div className="admin-status-tabs" role="tablist" aria-label="Filter customer accounts">
                  <button
                    type="button"
                    className={`admin-status-tab ${filter === "all" ? "is-active" : ""}`}
                    onClick={() => setFilter("all")}
                  >
                    All Accounts <small>({allCustomers.length})</small>
                  </button>
                  <button
                    type="button"
                    className={`admin-status-tab ${filter === "gmail" ? "is-active" : ""}`}
                    onClick={() => setFilter("gmail")}
                  >
                    ✉️ Gmail Only <small>({data?.stats?.gmailCustomers || 0})</small>
                  </button>
                  <button
                    type="button"
                    className={`admin-status-tab ${filter === "orders" ? "is-active" : ""}`}
                    onClick={() => setFilter("orders")}
                  >
                    🛍️ Placed Orders <small>({data?.stats?.customersWithOrders || 0})</small>
                  </button>
                </div>

                {filteredCustomers.length ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Email Address / Gmail</th>
                          <th>WhatsApp / Phone</th>
                          <th>Orders</th>
                          <th>Total Spent</th>
                          <th>Registered On</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map((customer) => {
                          const isCopied = copiedEmail === customer.email;
                          const cleanPhone = (customer.phone || "").replace(/[^\d+]/g, "");
                          const waPhone = cleanPhone.startsWith("0") ? "92" + cleanPhone.slice(1) : cleanPhone;

                          return (
                            <tr
                              key={customer.id}
                              style={{ cursor: "pointer" }}
                              onClick={() => openCustomerModal(customer)}
                            >
                              <td>
                                <div className="admin-customer-identity-cell">
                                  <div className="admin-customer-avatar">
                                    {getInitials(customer.name)}
                                  </div>
                                  <div>
                                    <strong className="admin-customer-name">{customer.name}</strong>
                                    <small className="admin-customer-id">Account #{customer.id}</small>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <div className="admin-customer-email-cell">
                                  <a
                                    className="admin-email-link"
                                    href={`mailto:${customer.email}`}
                                    onClick={(e) => e.stopPropagation()}
                                    title={`Send email to ${customer.email}`}
                                  >
                                    {customer.email}
                                  </a>
                                  {customer.isGmail ? (
                                    <span className="admin-badge-gmail" title="Registered with Gmail">
                                      GMAIL
                                    </span>
                                  ) : (
                                    <span className="admin-badge-provider">
                                      {customer.provider}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    className={`admin-email-copy-btn ${isCopied ? "is-copied" : ""}`}
                                    onClick={(e) => copySingleEmail(customer.email, e)}
                                    title="Copy email to clipboard"
                                  >
                                    {isCopied ? "✓ Copied" : "Copy"}
                                  </button>
                                </div>
                              </td>

                              <td>
                                {customer.phone ? (
                                  <div className="admin-customer-phone-cell" onClick={(e) => e.stopPropagation()}>
                                    <a className="admin-phone-link" href={`tel:${customer.phone}`}>
                                      {customer.phone}
                                    </a>
                                    {cleanPhone && (
                                      <a
                                        className="admin-whatsapp-btn"
                                        href={`https://wa.me/${waPhone}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Chat on WhatsApp"
                                      >
                                        WhatsApp ↗
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: "#999" }}>—</span>
                                )}
                              </td>

                              <td>
                                {customer.orderCount > 0 ? (
                                  <span className="admin-status admin-status-confirmed">
                                    {customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"}
                                  </span>
                                ) : (
                                  <span className="admin-status" style={{ opacity: 0.65 }}>
                                    No orders yet
                                  </span>
                                )}
                              </td>

                              <td>
                                <strong>{money(customer.totalSpent)}</strong>
                              </td>

                              <td>
                                <span className="admin-date-text">{formatDate(customer.createdAt)}</span>
                              </td>

                              <td style={{ textAlign: "right" }}>
                                <div className="admin-row-action-btns" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="admin-icon-pill-btn"
                                    onClick={() => openCustomerModal(customer)}
                                  >
                                    View Details
                                  </button>
                                  <a
                                    className="admin-icon-pill-btn"
                                    href={`mailto:${customer.email}?subject=Exclusive Offer from Xura Lab`}
                                  >
                                    Email
                                  </a>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="admin-empty-state">
                    <span>01</span>
                    <h3>No customer accounts found.</h3>
                    <p>
                      {search
                        ? `No customer accounts matching "${search}". Try searching for another name, Gmail address, or phone number.`
                        : "As shoppers register or sign in with their Gmail, their account details and emails will automatically be catalogued here."}
                    </p>
                    {search && (
                      <button
                        className="admin-clear-filter-btn"
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Customer Inspection Drawer / Modal */}
      {inspectingCustomer && (
        <div className="admin-modal-backdrop" onClick={() => setInspectingCustomer(null)}>
          <div className="admin-customer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-customer-modal-header">
              <div className="admin-customer-modal-title">
                <div className="admin-customer-avatar large">
                  {getInitials(inspectingCustomer.name)}
                </div>
                <div>
                  <h2>{inspectingCustomer.name}</h2>
                  <div className="admin-customer-modal-meta">
                    <span className="admin-customer-modal-email">{inspectingCustomer.email}</span>
                    {inspectingCustomer.isGmail && <span className="admin-badge-gmail">GMAIL</span>}
                    <button
                      type="button"
                      className="admin-email-copy-btn"
                      onClick={(e) => copySingleEmail(inspectingCustomer.email, e)}
                    >
                      {copiedEmail === inspectingCustomer.email ? "✓ Copied" : "Copy Email"}
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setInspectingCustomer(null)}
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            <div className="admin-customer-modal-body">
              <div className="admin-customer-info-grid">
                <div className="admin-customer-info-box">
                  <small>Phone / WhatsApp</small>
                  <strong>{inspectingCustomer.phone || "Not provided"}</strong>
                  {inspectingCustomer.phone && (
                    <a
                      className="admin-modal-wa-link"
                      href={`https://wa.me/${(inspectingCustomer.phone || "").replace(/[^\d+]/g, "").replace(/^0/, "92")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open WhatsApp Chat ↗
                    </a>
                  )}
                </div>
                <div className="admin-customer-info-box">
                  <small>Registration Date</small>
                  <strong>{formatDate(inspectingCustomer.createdAt)}</strong>
                </div>
                <div className="admin-customer-info-box">
                  <small>Total Orders</small>
                  <strong>{inspectingCustomer.orderCount} orders</strong>
                </div>
                <div className="admin-customer-info-box">
                  <small>Lifetime Spent</small>
                  <strong>{money(inspectingCustomer.totalSpent)}</strong>
                </div>
              </div>

              <div className="admin-customer-orders-section">
                <h3>Order History</h3>
                {loadingDetails ? (
                  <p style={{ color: "#777", padding: "16px 0" }}>Loading order records…</p>
                ) : customerOrders.length > 0 ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Order #</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Payment</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerOrders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <strong>#{order.id}</strong>
                            </td>
                            <td>{formatDate(order.createdAt)}</td>
                            <td>
                              <span className={`admin-status admin-status-${order.status}`}>
                                {order.status}
                              </span>
                            </td>
                            <td>{order.paymentMethod || "COD"}</td>
                            <td>
                              <strong>{money(order.total)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="admin-empty-state" style={{ padding: "24px 0" }}>
                    <p>This customer hasn't placed any orders yet.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-customer-modal-footer">
              <a
                className="admin-primary-btn"
                href={`mailto:${inspectingCustomer.email}?subject=Message from Xura Lab`}
              >
                Send Email to {inspectingCustomer.email}
              </a>
              <button
                type="button"
                className="admin-secondary-btn"
                onClick={() => setInspectingCustomer(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

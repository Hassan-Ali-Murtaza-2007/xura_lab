"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSidebar from "./admin-sidebar";
import AdminHeader from "./admin-header";

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const money = (value) => `PKR ${number.format(Number(value || 0))}`;

export default function AdminPromos() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Available store products for selection
  const [availableProducts, setAvailableProducts] = useState([]);

  // Search and filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Form inputs
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [appliesTo, setAppliesTo] = useState("all"); // "all" | "specific"
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxOrderAmount, setMaxOrderAmount] = useState("");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Deletion modal state
  const [deletingPromo, setDeletingPromo] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback toast
  const [feedback, setFeedback] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  const loadPromos = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/promos", { credentials: "include", cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return null;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load promo codes.");
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
    loadPromos().then((payload) => {
      if (active && payload) setData(payload);
    });
    return () => { active = false; };
  }, [loadPromos]);

  // Load available products for the product picker
  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((resData) => {
        if (resData?.products && Array.isArray(resData.products)) {
          setAvailableProducts(resData.products);
        }
      })
      .catch(() => {});
  }, []);

  // Lock scroll when modal is open
  useEffect(() => {
    if (isModalOpen || deletingPromo) {
      document.body.classList.add("is-locked");
    } else {
      document.body.classList.remove("is-locked");
    }
    return () => {
      document.body.classList.remove("is-locked");
    };
  }, [isModalOpen, deletingPromo]);

  function showToast(msg) {
    setFeedback(msg);
    setTimeout(() => {
      setFeedback("");
    }, 3500);
  }

  function handleCopy(promoCode) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(promoCode);
      setCopiedCode(promoCode);
      showToast(`Promo code "${promoCode}" copied to clipboard!`);
      setTimeout(() => setCopiedCode(""), 2000);
    }
  }

  function openCreateModal() {
    setEditingPromo(null);
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("");
    setAppliesTo("all");
    setSelectedProductIds([]);
    setMinOrderAmount("0");
    setMaxOrderAmount("");
    setMaxDiscountAmount("");
    setUsageLimit("");
    setExpiresAt("");
    setIsActive(true);
    setFormError("");
    setIsModalOpen(true);
  }

  function openEditModal(promo) {
    setEditingPromo(promo);
    setCode(promo.code);
    setDiscountType(promo.discountType);
    setDiscountValue(String(promo.discountValue));
    setAppliesTo(promo.appliesTo || "all");
    setSelectedProductIds(
      Array.isArray(promo.applicableProductIds) ? promo.applicableProductIds.map(Number) : []
    );
    setMinOrderAmount(String(promo.minOrderAmount || 0));
    setMaxOrderAmount(
      promo.maxOrderAmount !== null && promo.maxOrderAmount !== undefined
        ? String(promo.maxOrderAmount)
        : ""
    );
    setMaxDiscountAmount(promo.maxDiscountAmount ? String(promo.maxDiscountAmount) : "");
    setUsageLimit(promo.usageLimit ? String(promo.usageLimit) : "");
    if (promo.expiresAt) {
      const d = new Date(promo.expiresAt);
      const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setExpiresAt(localIso);
    } else {
      setExpiresAt("");
    }
    setIsActive(Boolean(promo.isActive));
    setFormError("");
    setIsModalOpen(true);
  }

  function toggleProductSelection(productId) {
    const id = Number(productId);
    setSelectedProductIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function handleToggleActive(promo) {
    try {
      const response = await fetch(`/api/admin/promos/${promo.id}/toggle`, {
        method: "PATCH",
        credentials: "include"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not toggle promo status.");

      setData((current) => {
        if (!current) return current;
        const updated = current.promos.map((p) =>
          p.id === promo.id ? { ...p, isActive: !p.isActive } : p
        );
        const activeCount = updated.filter(
          (p) => p.isActive && (!p.expiresAt || new Date(p.expiresAt) > new Date())
        ).length;
        return {
          ...current,
          promos: updated,
          stats: { ...current.stats, active: activeCount }
        };
      });

      showToast(result.message);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  }

  async function handleSavePromo(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    if (appliesTo === "specific" && selectedProductIds.length === 0) {
      setFormError("Please select at least one fragrance product for this promo code.");
      setSaving(false);
      return;
    }

    const minSpend = Number(minOrderAmount || 0);
    const maxSpend = maxOrderAmount ? Number(maxOrderAmount) : null;
    if (maxSpend !== null && maxSpend < minSpend) {
      setFormError("Maximum spending limit cannot be less than minimum spending.");
      setSaving(false);
      return;
    }

    const payload = {
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      appliesTo,
      applicableProductIds: appliesTo === "specific" ? selectedProductIds : [],
      minOrderAmount: minSpend,
      maxOrderAmount: maxSpend,
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      isActive
    };

    try {
      const url = editingPromo ? `/api/admin/promos/${editingPromo.id}` : "/api/admin/promos";
      const method = editingPromo ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to save promo code.");

      const fresh = await loadPromos();
      if (fresh) setData(fresh);

      setIsModalOpen(false);
      showToast(result.message);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePromo() {
    if (!deletingPromo) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/promos/${deletingPromo.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to delete promo code.");

      setData((current) => {
        if (!current) return current;
        const updated = current.promos.filter((p) => p.id !== deletingPromo.id);
        const activeCount = updated.filter(
          (p) => p.isActive && (!p.expiresAt || new Date(p.expiresAt) > new Date())
        ).length;
        const totalUsed = updated.reduce((s, p) => s + (Number(p.usedCount) || 0), 0);
        return {
          ...current,
          promos: updated,
          stats: { total: updated.length, active: activeCount, usedCount: totalUsed }
        };
      });

      setDeletingPromo(null);
      showToast(result.message);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  }

  const allPromos = data?.promos || [];
  const now = new Date();

  const countsByStatus = useMemo(() => {
    const counts = { all: allPromos.length, active: 0, inactive: 0, expired: 0 };
    for (const p of allPromos) {
      const isExpired = p.expiresAt && new Date(p.expiresAt) <= now;
      if (isExpired) {
        counts.expired++;
      } else if (p.isActive) {
        counts.active++;
      } else {
        counts.inactive++;
      }
    }
    return counts;
  }, [allPromos]);

  const filteredPromos = useMemo(() => {
    const term = search.trim().toUpperCase();
    return allPromos.filter((p) => {
      if (term && !p.code.includes(term)) return false;
      const isExpired = p.expiresAt && new Date(p.expiresAt) <= now;
      if (statusFilter === "active" && (!p.isActive || isExpired)) return false;
      if (statusFilter === "inactive" && (p.isActive || isExpired)) return false;
      if (statusFilter === "expired" && !isExpired) return false;
      return true;
    });
  }, [allPromos, search, statusFilter]);

  if (loading && !data && !error) {
    return (
      <main className="admin-loading">
        <div className="admin-loading-mark">XL</div>
        <p>Loading promo codes…</p>
      </main>
    );
  }

  return (
    <main className="admin-dashboard-page">
      <AdminSidebar activeTab="promos" />

      <div className="admin-dashboard-content">
        <AdminHeader title="PROMO CODES & DISCOUNTS" adminEmail={data?.admin?.email} />

        <div className="admin-dashboard-main">
          {error ? (
            <section className="admin-error-panel">
              <p className="admin-eyebrow">PROMOS UNAVAILABLE</p>
              <h1>We could not load promo codes.</h1>
              <p>{error}</p>
              <button type="button" onClick={() => window.location.reload()}>TRY AGAIN</button>
            </section>
          ) : (
            <>
              {/* Welcome & Actions */}
              <section className="admin-welcome">
                <div>
                  <p className="admin-eyebrow">MARKETING & DISCOUNTS</p>
                  <h1>Promo Codes</h1>
                  <p>Create discount codes, configure product applicability, and manage spending limits.</p>
                </div>
                <div className="admin-welcome-actions">
                  <Link href="/admin">← BACK TO OVERVIEW</Link>
                  <button
                    className="admin-primary-btn"
                    type="button"
                    onClick={openCreateModal}
                  >
                    ＋ CREATE PROMO CODE
                  </button>
                </div>
              </section>

              {/* Promo Statistics Grid */}
              <section className="admin-stat-grid" aria-label="Promo statistics">
                <article className="admin-stat-card">
                  <div><span>01</span><p>Total promos</p></div>
                  <strong>{number.format(data?.stats?.total || allPromos.length)}</strong>
                  <small>Configured campaigns</small>
                </article>
                <article className="admin-stat-card">
                  <div><span>02</span><p>Active promos</p></div>
                  <strong style={{ color: "#234b35" }}>
                    {number.format(data?.stats?.active || countsByStatus.active)}
                  </strong>
                  <small>Available at checkout</small>
                </article>
                <article className="admin-stat-card">
                  <div><span>03</span><p>Total redemptions</p></div>
                  <strong>{number.format(data?.stats?.usedCount || 0)}</strong>
                  <small>Customer checkouts redeemed</small>
                </article>
              </section>

              {/* Panel Container */}
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-eyebrow">DISCOUNT CAMPAIGNS</p>
                    <h2>Catalogue of Promo Codes</h2>
                  </div>
                  <span>{filteredPromos.length} of {allPromos.length} promos shown</span>
                </div>

                {feedback && (
                  <div className="admin-product-success" role="status" style={{ margin: "16px 26px 0" }}>
                    <span>✓</span>
                    <p>{feedback}</p>
                  </div>
                )}

                {/* Filter Toolbar */}
                <div className="admin-filter-bar">
                  <div className="admin-search-wrap">
                    <span className="admin-search-icon" aria-hidden="true">🔍</span>
                    <input
                      className="admin-search-input"
                      type="search"
                      placeholder="Search by code (e.g. WELCOME, SUMMER)…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search promo codes"
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

                  <div className="admin-select-wrap">
                    <label htmlFor="promo-status-filter" className="sr-only">Status</label>
                    <select
                      id="promo-status-filter"
                      className="admin-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All statuses ({allPromos.length})</option>
                      <option value="active">Active ({countsByStatus.active})</option>
                      <option value="inactive">Inactive ({countsByStatus.inactive})</option>
                      <option value="expired">Expired ({countsByStatus.expired})</option>
                    </select>
                  </div>
                </div>

                {/* Status Tabs */}
                <div className="admin-status-tabs" role="tablist" aria-label="Filter by promo status">
                  {[
                    { id: "all", label: "All" },
                    { id: "active", label: "Active" },
                    { id: "inactive", label: "Inactive" },
                    { id: "expired", label: "Expired" }
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

                {/* Promo Codes Table */}
                {filteredPromos.length > 0 ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table admin-orders-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Discount</th>
                          <th>Applies To</th>
                          <th>Spending Limits</th>
                          <th>Redemptions</th>
                          <th>Expires</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPromos.map((promo) => {
                          const isExpired = promo.expiresAt && new Date(promo.expiresAt) <= now;
                          const isMaxReached = promo.usageLimit !== null && promo.usedCount >= promo.usageLimit;
                          const isValidNow = promo.isActive && !isExpired && !isMaxReached;
                          const specificCount = promo.applicableProducts?.length || promo.applicableProductIds?.length || 0;

                          return (
                            <tr key={promo.id} className="admin-order-row">
                              <td>
                                <div className="admin-promo-code-cell">
                                  <strong className="admin-promo-code-title">{promo.code}</strong>
                                  <button
                                    type="button"
                                    className="admin-promo-copy-btn"
                                    onClick={() => handleCopy(promo.code)}
                                    title="Copy code to share with customer"
                                  >
                                    {copiedCode === promo.code ? "COPIED!" : "COPY"}
                                  </button>
                                </div>
                              </td>

                              <td>
                                <div className="admin-promo-discount-cell">
                                  <strong>
                                    {promo.discountType === "percentage"
                                      ? `${promo.discountValue}% OFF`
                                      : `${money(promo.discountValue)} OFF`}
                                  </strong>
                                  {promo.discountType === "percentage" && promo.maxDiscountAmount && (
                                    <small className="admin-promo-cap-hint">
                                      Max deduction: {money(promo.maxDiscountAmount)}
                                    </small>
                                  )}
                                </div>
                              </td>

                              <td>
                                {promo.appliesTo === "specific" ? (
                                  <div className="admin-promo-applicable-box">
                                    <span className="admin-promo-specific-pill">
                                      {specificCount} {specificCount === 1 ? "Fragrance" : "Fragrances"}
                                    </span>
                                    <small className="admin-promo-specific-names">
                                      {(promo.applicableProducts || []).map((p) => p.name).join(", ") ||
                                        `${specificCount} selected`}
                                    </small>
                                  </div>
                                ) : (
                                  <span className="admin-promo-all-pill">All Fragrances</span>
                                )}
                              </td>

                              <td>
                                <div className="admin-promo-spend-cell">
                                  <small>
                                    <strong>Min:</strong> {promo.minOrderAmount > 0 ? money(promo.minOrderAmount) : "None"}
                                  </small>
                                  <small>
                                    <strong>Max:</strong> {promo.maxOrderAmount ? money(promo.maxOrderAmount) : "None"}
                                  </small>
                                </div>
                              </td>

                              <td>
                                <span>
                                  <strong>{promo.usedCount || 0}</strong>
                                  <small style={{ color: "#777", marginLeft: "4px" }}>
                                    / {promo.usageLimit !== null ? promo.usageLimit : "∞"}
                                  </small>
                                </span>
                              </td>

                              <td>
                                {promo.expiresAt ? (
                                  <div>
                                    <span style={{ color: isExpired ? "#a43e3e" : "inherit" }}>
                                      {new Intl.DateTimeFormat("en-PK", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                      }).format(new Date(promo.expiresAt))}
                                    </span>
                                    {isExpired && (
                                      <small style={{ display: "block", color: "#a43e3e", fontWeight: 600 }}>
                                        Expired
                                      </small>
                                    )}
                                  </div>
                                ) : (
                                  <small style={{ color: "#777" }}>Never</small>
                                )}
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className={`admin-status-toggle-pill ${isValidNow ? "is-active" : "is-inactive"}`}
                                  onClick={() => handleToggleActive(promo)}
                                  title="Click to toggle active status"
                                >
                                  {isValidNow ? "ACTIVE" : isExpired ? "EXPIRED" : "INACTIVE"}
                                </button>
                              </td>

                              <td>
                                <div className="admin-promo-actions">
                                  <button
                                    className="admin-row-action-btn"
                                    type="button"
                                    onClick={() => openEditModal(promo)}
                                  >
                                    EDIT
                                  </button>
                                  <button
                                    className="admin-row-delete-btn"
                                    type="button"
                                    onClick={() => setDeletingPromo(promo)}
                                  >
                                    DELETE
                                  </button>
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
                    <span>00</span>
                    <h3>No promo codes found.</h3>
                    <p>
                      {search || statusFilter !== "all"
                        ? "No promo codes matched your filter criteria."
                        : "You haven't created any promo codes yet."}
                    </p>
                    {search || statusFilter !== "all" ? (
                      <button
                        className="admin-clear-filter-btn"
                        type="button"
                        onClick={() => { setSearch(""); setStatusFilter("all"); }}
                      >
                        RESET FILTERS
                      </button>
                    ) : (
                      <button
                        className="admin-primary-btn"
                        type="button"
                        onClick={openCreateModal}
                        style={{ marginTop: "16px" }}
                      >
                        ＋ CREATE FIRST PROMO CODE
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Promo Modal */}
      {isModalOpen && (
        <div className="admin-confirmation-backdrop" onMouseDown={() => { if (!saving) setIsModalOpen(false); }}>
          <section
            className="admin-order-modal admin-promo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="admin-dialog-header">
              <div>
                <p className="admin-eyebrow">
                  {editingPromo ? "EDIT PROMOTION" : "NEW PROMOTION"}
                </p>
                <h2 id="promo-dialog-title">
                  {editingPromo ? `Edit "${editingPromo.code}"` : "Create Promo Code"}
                </h2>
                <p className="admin-dialog-subtitle">
                  Configure discount rules, product applicability, and spending limits.
                </p>
              </div>
              <button
                className="admin-dialog-close"
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSavePromo}>
              <div className="admin-order-dialog-content">
                {formError && (
                  <div className="admin-form-error-banner" role="alert">
                    {formError}
                  </div>
                )}

                <div className="admin-promo-form-grid">
                  <label className="admin-field-group admin-field-span-2">
                    <span>PROMO CODE</span>
                    <input
                      type="text"
                      className="admin-text-input"
                      placeholder="e.g. ARVEN15, VELOR20, EID500"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                      required
                      autoFocus
                    />
                    <small>Customers will enter this exact code at checkout.</small>
                  </label>

                  <label className="admin-field-group">
                    <span>DISCOUNT TYPE</span>
                    <select
                      className="admin-text-input"
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                    >
                      <option value="percentage">Percentage (%) Discount</option>
                      <option value="fixed">Fixed Amount (PKR) Discount</option>
                    </select>
                  </label>

                  <label className="admin-field-group">
                    <span>
                      {discountType === "percentage" ? "DISCOUNT PERCENTAGE (%)" : "DISCOUNT VALUE (PKR)"}
                    </span>
                    <input
                      type="number"
                      className="admin-text-input"
                      placeholder={discountType === "percentage" ? "e.g. 10" : "e.g. 500"}
                      min="1"
                      max={discountType === "percentage" ? "100" : undefined}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      required
                    />
                  </label>

                  {/* Applicable Products Selection */}
                  <div className="admin-field-group admin-field-span-2">
                    <span>APPLICABLE FRAGRANCES</span>
                    <div className="admin-applies-selector">
                      <label className={`admin-applies-card ${appliesTo === "all" ? "is-selected" : ""}`}>
                        <input
                          type="radio"
                          name="appliesTo"
                          value="all"
                          checked={appliesTo === "all"}
                          onChange={() => setAppliesTo("all")}
                        />
                        <div>
                          <strong>All Fragrances</strong>
                          <small>Discount applies to every fragrance in the customer's cart.</small>
                        </div>
                      </label>

                      <label className={`admin-applies-card ${appliesTo === "specific" ? "is-selected" : ""}`}>
                        <input
                          type="radio"
                          name="appliesTo"
                          value="specific"
                          checked={appliesTo === "specific"}
                          onChange={() => setAppliesTo("specific")}
                        />
                        <div>
                          <strong>Specific Fragrances Only</strong>
                          <small>Discount reduces only from the sum of the selected fragrances.</small>
                        </div>
                      </label>
                    </div>

                    {appliesTo === "specific" && (
                      <div className="admin-product-picker-box">
                        <p className="admin-product-picker-title">
                          Select which fragrances qualify ({selectedProductIds.length} selected):
                        </p>
                        <div className="admin-product-picker-grid">
                          {availableProducts.map((prod) => {
                            const isSelected = selectedProductIds.includes(Number(prod.id));
                            return (
                              <button
                                key={prod.id}
                                type="button"
                                className={`admin-picker-item ${isSelected ? "is-selected" : ""}`}
                                onClick={() => toggleProductSelection(prod.id)}
                              >
                                <span className="admin-picker-check">{isSelected ? "✓" : "+"}</span>
                                {prod.imageUrl && (
                                  <img
                                    src={prod.imageUrl}
                                    alt={prod.name}
                                    className="admin-picker-img"
                                  />
                                )}
                                <div className="admin-picker-text">
                                  <strong>{prod.name}</strong>
                                  <small>{prod.gender || "Fragrance"} · {prod.volumeMl || 50}ml</small>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {selectedProductIds.length === 0 && (
                          <small className="admin-field-error-hint">
                            ⚠️ Please click on at least one fragrance above to include in this promotion.
                          </small>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Spending Limits */}
                  <label className="admin-field-group">
                    <span>MINIMUM SPENDING (PKR)</span>
                    <input
                      type="number"
                      className="admin-text-input"
                      placeholder="0 for no minimum"
                      min="0"
                      value={minOrderAmount}
                      onChange={(e) => setMinOrderAmount(e.target.value)}
                    />
                    <small>Cart must have at least this amount to apply code.</small>
                  </label>

                  <label className="admin-field-group">
                    <span>MAXIMUM SPENDING LIMIT (PKR) <small style={{ fontWeight: 400 }}>(Optional)</small></span>
                    <input
                      type="number"
                      className="admin-text-input"
                      placeholder="Leave blank for no limit"
                      min="1"
                      value={maxOrderAmount}
                      onChange={(e) => setMaxOrderAmount(e.target.value)}
                    />
                    <small>Carts exceeding this subtotal cannot use this code.</small>
                  </label>

                  {discountType === "percentage" && (
                    <label className="admin-field-group">
                      <span>MAXIMUM DISCOUNT CAP (PKR) <small style={{ fontWeight: 400 }}>(Optional)</small></span>
                      <input
                        type="number"
                        className="admin-text-input"
                        placeholder="e.g. 1500 (leave blank for unlimited)"
                        min="1"
                        value={maxDiscountAmount}
                        onChange={(e) => setMaxDiscountAmount(e.target.value)}
                      />
                      <small>Caps the maximum deduction for high-value orders.</small>
                    </label>
                  )}

                  <label className="admin-field-group">
                    <span>USAGE LIMIT <small style={{ fontWeight: 400 }}>(Optional)</small></span>
                    <input
                      type="number"
                      className="admin-text-input"
                      placeholder="e.g. 100 (leave blank for unlimited)"
                      min="1"
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(e.target.value)}
                    />
                    <small>Total times this promo code can be redeemed storewide.</small>
                  </label>

                  <label className="admin-field-group">
                    <span>EXPIRATION DATE & TIME <small style={{ fontWeight: 400 }}>(Optional)</small></span>
                    <input
                      type="datetime-local"
                      className="admin-text-input"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                    <small>Leave blank if this promo code should never expire.</small>
                  </label>

                  <div className="admin-field-group admin-field-span-2" style={{ marginTop: "12px" }}>
                    <label className="admin-checkbox-label">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <span>
                        <strong>Enable promo code immediately</strong>
                        <small style={{ display: "block", color: "#666" }}>
                          When enabled, customers can apply this code during checkout right away.
                        </small>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="admin-dialog-footer">
                <button
                  type="button"
                  className="admin-dialog-cancel-btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "SAVING…" : editingPromo ? "UPDATE PROMO CODE" : "CREATE PROMO CODE"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPromo && (
        <div className="admin-confirmation-backdrop" onMouseDown={() => { if (!isDeleting) setDeletingPromo(null); }}>
          <div
            className="admin-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="admin-eyebrow" style={{ color: "#7b453c" }}>CONFIRM DELETION</p>
            <h2 id="delete-dialog-title">Delete Promo Code?</h2>
            <p>
              Are you sure you want to delete promo code <strong>"{deletingPromo.code}"</strong>?
              Customers will no longer be able to use it at checkout.
            </p>
            <div>
              <button
                type="button"
                onClick={() => setDeletingPromo(null)}
                disabled={isDeleting}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={handleDeletePromo}
                disabled={isDeleting}
              >
                {isDeleting ? "DELETING…" : "DELETE PROMO CODE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

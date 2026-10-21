"use client";

export default function AdminHeader({ title = "ADMIN WORKSPACE", adminEmail = "Administrator" }) {
  const today = new Intl.DateTimeFormat("en-PK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());

  return (
    <header className="admin-dashboard-header">
      <button className="admin-mobile-brand" type="button" aria-label="Admin menu">XL</button>
      <div>
        <p>{today}</p>
        <span>{title}</span>
      </div>
      <div className="admin-profile">
        <span>HA</span>
        <div>
          <strong>Store administrator</strong>
          <small>{adminEmail || "admin@xuralab.com"}</small>
        </div>
      </div>
    </header>
  );
}

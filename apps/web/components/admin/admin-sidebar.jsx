"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function DashboardIcon({ name }) {
  const paths = {
    overview: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    orders: (
      <>
        <path d="M6 3h12l2 5-2 13H6L4 8l2-5Z" />
        <path d="M4 8h16M9 12h6" />
      </>
    ),
    products: (
      <>
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z" />
        <path d="M12 11v10" />
      </>
    ),
    store: (
      <>
        <path d="M4 10h16M6 10v10h12V10M3 10l2-6h14l2 6" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
      </>
    )
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function AdminSidebar({ activeTab = "overview" }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    router.replace("/admin/login");
  }

  return (
    <aside className="admin-sidebar">
      <Link className="admin-sidebar-brand" href="/admin">
        <span>XURA LAB</span>
        <small>ADMIN</small>
      </Link>
      <nav aria-label="Admin navigation">
        <Link className={activeTab === "overview" ? "is-active" : ""} href="/admin">
          <DashboardIcon name="overview" />
          <span>Overview</span>
        </Link>
        <Link className={activeTab === "orders" ? "is-active" : ""} href="/admin/orders">
          <DashboardIcon name="orders" />
          <span>Orders</span>
        </Link>
        <Link className={activeTab === "products" ? "is-active" : ""} href="/admin/products">
          <DashboardIcon name="products" />
          <span>Products</span>
        </Link>
      </nav>
      <div className="admin-sidebar-bottom">
        <Link href="/" target="_blank">
          <DashboardIcon name="store" />
          <span>View store</span>
        </Link>
        <button type="button" onClick={logout}>
          <DashboardIcon name="logout" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

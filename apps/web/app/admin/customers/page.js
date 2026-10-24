import AdminCustomers from "@/components/admin/admin-customers";

export const metadata = {
  title: "Customers & Accounts — Xura Lab Admin",
  description: "View customer registrations, Gmail accounts, order histories, and contact information."
};

export default function Page() {
  return <AdminCustomers />;
}

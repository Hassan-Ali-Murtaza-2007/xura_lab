import PolicyPageView from "@/components/pages/policy-page";

export const metadata = {
  title: "Website Policies & Client Care — Xura Lab",
  description: "Official policies of Xura Lab: Privacy Policy, Return & Refund Policy, Shipping Policy, and Terms & Conditions."
};

export default function PoliciesPage() {
  return <PolicyPageView initialSlug="privacy-policy" />;
}

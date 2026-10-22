import PolicyPageView from "@/components/pages/policy-page";
import { POLICIES_DATA } from "@/data/policies";

export const metadata = {
  title: POLICIES_DATA["shipping-policy"].metaTitle,
  description: POLICIES_DATA["shipping-policy"].metaDescription
};

export default function ShippingPolicyPage() {
  return <PolicyPageView initialSlug="shipping-policy" />;
}

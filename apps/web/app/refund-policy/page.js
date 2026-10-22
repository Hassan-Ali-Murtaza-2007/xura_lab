import PolicyPageView from "@/components/pages/policy-page";
import { POLICIES_DATA } from "@/data/policies";

export const metadata = {
  title: POLICIES_DATA["refund-policy"].metaTitle,
  description: POLICIES_DATA["refund-policy"].metaDescription
};

export default function RefundPolicyPage() {
  return <PolicyPageView initialSlug="refund-policy" />;
}

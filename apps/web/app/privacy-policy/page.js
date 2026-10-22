import PolicyPageView from "@/components/pages/policy-page";
import { POLICIES_DATA } from "@/data/policies";

export const metadata = {
  title: POLICIES_DATA["privacy-policy"].metaTitle,
  description: POLICIES_DATA["privacy-policy"].metaDescription
};

export default function PrivacyPolicyPage() {
  return <PolicyPageView initialSlug="privacy-policy" />;
}

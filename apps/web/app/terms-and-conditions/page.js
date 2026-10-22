import PolicyPageView from "@/components/pages/policy-page";
import { POLICIES_DATA } from "@/data/policies";

export const metadata = {
  title: POLICIES_DATA["terms-of-service"].metaTitle,
  description: POLICIES_DATA["terms-of-service"].metaDescription
};

export default function TermsAndConditionsPage() {
  return <PolicyPageView initialSlug="terms-of-service" />;
}

import { notFound } from "next/navigation";
import PolicyPageView from "@/components/pages/policy-page";
import { POLICIES_DATA } from "@/data/policies";

const SLUG_ALIASES = {
  "privacy": "privacy-policy",
  "privacy-policy": "privacy-policy",
  "return-policy": "refund-policy",
  "returns": "refund-policy",
  "refund-policy": "refund-policy",
  "shipping": "shipping-policy",
  "shipping-policy": "shipping-policy",
  "delivery-policy": "shipping-policy",
  "terms": "terms-of-service",
  "terms-and-conditions": "terms-of-service",
  "terms-of-service": "terms-of-service"
};

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const canonicalSlug = SLUG_ALIASES[slug];
  const policy = POLICIES_DATA[canonicalSlug];

  if (!policy) {
    return {
      title: "Policies — Xura Lab",
      description: "Xura Lab website policies and client care guidelines."
    };
  }

  return {
    title: policy.metaTitle,
    description: policy.metaDescription
  };
}

export function generateStaticParams() {
  return [
    { slug: "privacy-policy" },
    { slug: "refund-policy" },
    { slug: "shipping-policy" },
    { slug: "terms-of-service" },
    { slug: "terms-and-conditions" },
    { slug: "return-policy" }
  ];
}

export default async function PolicyDetailPage({ params }) {
  const { slug } = await params;
  const canonicalSlug = SLUG_ALIASES[slug];

  if (!canonicalSlug || !POLICIES_DATA[canonicalSlug]) {
    notFound();
  }

  return <PolicyPageView initialSlug={canonicalSlug} />;
}

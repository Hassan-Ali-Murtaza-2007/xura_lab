import { notFound } from "next/navigation";
import ProductDetail from "@/components/storefront/product-detail";
import { getProductBySlug, productCatalog } from "@/data/products";

async function getProduct(slug) {
  const fallback = getProductBySlug(slug);
  try {
    const response = await fetch(`${process.env.API_URL || "http://localhost:4000"}/api/products/${encodeURIComponent(slug)}`, {
      cache: "no-store"
    });
    if (response.ok) return (await response.json()).product;
  } catch {
    // The bundled catalogue keeps the original products available if the API is temporarily offline.
  }
  return fallback;
}

export function generateStaticParams() {
  return productCatalog.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  return {
    title: `${product.name} — Xura Lab`,
    description: `${product.tagline} ${product.description}`
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}

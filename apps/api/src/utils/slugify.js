import { getLocalCatalogue } from "../local-product-store.js";

export function slugify(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "fragrance"
  );
}

export async function availableSlug(name, pool) {
  const base = slugify(name);
  const existing = new Set();
  if (pool) {
    const [rows] = await pool.query("SELECT slug FROM products WHERE slug = ? OR slug LIKE ?", [
      base,
      `${base}-%`
    ]);
    rows.forEach((row) => existing.add(row.slug));
  } else {
    (await getLocalCatalogue({ includeInactive: true })).forEach((product) =>
      existing.add(product.slug)
    );
  }
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

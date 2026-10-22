# Xura Lab Storefront

A faithful full-stack implementation of the supplied Xura Lab landing-page design.

## Stack

- Next.js + React storefront (`apps/web`)
- Express API (`apps/api`)
- MySQL schema and order persistence (`database/schema.sql`)

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the storefront and API together:

   ```bash
   npm run dev
   ```

3. Open `http://localhost:3007`.

The product catalogue works without a database by using the API's persistent local catalogue. Products created in the admin panel are stored in `apps/api/data` and their uploaded images are stored in `apps/web/public/uploads/products`. To enable shared production catalogue and order storage, create a MySQL database, run `database/schema.sql`, copy `apps/api/.env.example` to `apps/api/.env`, and set your credentials. Then run `npm run db:seed`.

If the database was created before the dedicated checkout page was added, run `database/migrations/001_checkout_fields.sql` once to add the contact, delivery, billing, consent, and order-note fields. Then run `database/migrations/002_payment_options.sql` to enable Advance bank/card payments and Cash on Delivery.

For an existing database, also run `database/migrations/003_product_content_and_images.sql` before using admin product creation. It adds customer-facing product details and the product image gallery.

### Repair checkout after upgrading an existing database

The promotion feature also requires migrations 004 and 005. Checkout writes `orders.promo_code` and `orders.discount_amount` even when the customer has not entered a promo code. Deploying the new API without these columns causes orders to fail with "The order could not be saved. Please try again."

From the repository root, with the API's database environment variables configured for the intended database, run:

```bash
npm run db:repair-checkout -w @xura/api
```

This applies `database/migrations/006_checkout_promotion_repair.sql`, a repeatable repair covering the additions in 004 and 005. It creates missing promotion tables, adds missing checkout/promotion columns, and fixes the missing auto-increment attribute in the original 004 migration. Existing products, orders, and promo codes are retained. It does not run the product seed.

If using a database SQL console instead, select the application database and run the contents of that repair SQL file. No API restart is required for the database-only repair. Deploy the API change to enable detailed server-side order failure logging; database errors remain hidden from shoppers.

Verify the repair by placing an order. For local development, `npm run test:checkout -w @xura/api` exercises the repair and real order API in a disposable local MySQL database, including all three payment methods and repeat application of the repair.

## Product pages

- `http://localhost:3007/products/arven`
- `http://localhost:3007/products/velor`
- `http://localhost:3007/products/nyra`

Each product page supports 10%, 20%, and 40% concentration variants, quantity selection, cart persistence, and checkout.

## Collections

- Homepage preview: three products per desktop view with horizontal overflow for the remaining catalogue; mobile shows at most four products for the selected category.
- Full catalogue: `http://localhost:3007/collections` shows every available product with category, search, and sorting controls.

## Main endpoints

- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:slug`
- `POST /api/orders`
- `POST /api/admin/products` (authenticated multipart product creation)
- `DELETE /api/admin/products/:id` (authenticated product removal)

## Admin panel

- Login: `http://localhost:3007/admin/login`
- Dashboard: `http://localhost:3007/admin`

For local development only, the API falls back to `admin@xuralab.com` / `XuraLab@2026`. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a long random `ADMIN_SESSION_SECRET` in `apps/api/.env` before deployment. Production mode does not enable the fallback credentials.

The dashboard's product manager can create, edit, and safely delete both seeded and newly added fragrances. It supports identity, Men/Women/Unisex category, bottle size, product-page copy, 1–10 concentration/price variants, and up to five JPG, PNG, or WebP images (8 MB each). The administrator can select any uploaded image as the primary image used on collection cards and at the top of the product gallery. Changes publish to the storefront immediately, existing images are preserved during editing unless replacements are selected, and deletion removes the product from customer-facing pages while retaining completed order history.


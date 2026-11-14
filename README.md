# Gamebay Digital Marketplace

Gamebay is a responsive digital marketplace built with React, TypeScript, and Vite, backed by a PHP/PDO API and MySQL. Use XAMPP for local development, or the included Dockerfile to deploy the frontend and API together on Railway.

## Project layout

- `frontend/` — existing Vite application, API client, and frontend configuration.
- `backend/public/` — PHP API entry point and Apache rewrite rules.
- `backend/src/` — database configuration and marketplace query code.
- `backend/database/schema.sql` and `backend/database/migrations/` — tables, migrations, and clearly identified synthetic demo records.
- `Dockerfile` — multi-stage frontend build and Apache/PHP production image.
- `.gitignore` and `.dockerignore` — keep local secrets, generated files, and conversation archives out of Git and deployment build contexts.

## Requirements

- Node.js LTS and npm
- XAMPP with Apache, MySQL, and PHP 8.1+
- Docker (optional; required to build the production image locally)

## Local setup with XAMPP

1. Start **Apache** and **MySQL** from the XAMPP Control Panel.
2. In `httpd.conf`, ensure `mod_rewrite` is enabled. Add an Apache alias for the API, replacing the placeholder with this project's absolute path. Apache configuration on Windows uses forward slashes:

   ```apache
   Alias /eneba-api "C:/path/to/eneba/backend/public"
   <Directory "C:/path/to/eneba/backend/public">
       AllowOverride All
       Require all granted
   </Directory>
   ```

   Restart Apache after changing its configuration. The alias exposes only `backend/public`, not the backend configuration or source folders.

3. Open `http://localhost/phpmyadmin`, create a database named `eneba_marketplace` with `utf8mb4` collation, select that database, then import `backend/database/schema.sql`. It inserts the example catalog, sellers, offers, homepage content, and synthetic demo records. The schema and migration files operate on the database selected by the importer; they do not create or switch databases. After importing the schema, run `backend/database/migrations/003_product_media.sql`, `004_product_detail_content.sql`, `005_steam_reviews.sql`, `006_product_reviews.sql`, and `007_checkout_demo_keys.sql` in that order. If your existing database already has the previous homepage migration, run `002_homepage_banners.sql` once, then re-import the updated schema to add banners and the expanded sample catalog. For databases that predate `001_homepage_sections_and_discounts.sql`, run migrations `001` and `002` in order before importing the updated schema. Do not run migration `001` on a fresh database.
4. Copy `backend/.env.example` to `backend/.env` and set your local MySQL values. The default XAMPP MySQL username is often `root` with an empty password; use the values configured on your machine. The `.env` file is ignored by Git.
5. Copy `frontend/.env.example` to `frontend/.env.local`. The defaults match the Apache alias above. Change `VITE_API_PROXY_PREFIX` if you choose a different alias.
6. From the project root, install the locked frontend dependencies and start the dev server:

   ```powershell
   npm --prefix frontend ci
   npm --prefix frontend run dev
   ```

   Open the Vite URL printed in the terminal. Vite proxies `/api/v1` requests to the XAMPP API.

7. Check the API directly at `http://localhost/eneba-api/api/v1/health` and `http://localhost/eneba-api/api/v1/products`.

## API endpoints currently available

- `GET /api/v1/health` — verifies the API and MySQL connection.
- `GET /api/v1/auth/me` — returns the current account and a CSRF token for authenticated actions.
- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, and `POST /api/v1/auth/logout` — manage a PHP session using `HttpOnly`, `SameSite=Lax` cookies and CSRF tokens.
- `GET /api/v1/account` — returns the signed-in user's profile fields only.
- `GET /api/v1/account/orders` — returns only the signed-in user's orders and payment statuses. Digital keys are included only when the order is paid and its payment succeeded. The endpoint derives the user ID from the PHP session; it does not accept a client-supplied user ID.
- `POST /api/v1/checkout/simulate-payment` — requires a signed-in session and CSRF token. Accepts offer IDs and quantities only, re-reads current prices, and atomically records the order, simulated payment, and assigned keys. Retrying the same checkout request ID returns the same order.
- `GET /api/v1/products` — lists active products and their lowest active offer.
- `GET /api/v1/products/{slug}` — returns one active product, seller-specific platform/region offers, ordered gallery, recommendations, database-backed description sections, product metadata, and any recorded ratings.
- `GET /api/v1/products/{slug}/reviews` — returns cached Steam review statistics and a small sample for products with a verified Steam App ID.
- `GET /api/v1/products/{slug}/community-reviews` — returns Gamebay review averages, total count, 1–5-star distribution, review entries, and the signed-in user's review if one exists.
- `POST /api/v1/products/{slug}/community-reviews`, `PATCH /api/v1/products/{slug}/community-reviews/{reviewId}`, and `DELETE /api/v1/products/{slug}/community-reviews/{reviewId}` — create, edit, or delete the signed-in user's single review for a product. Mutations require the session CSRF token; the database enforces one review per user/product.
- `GET /api/v1/home/banner` — returns the banner text, artwork URL, and call-to-action from the homepage section record. `/home/hero` remains as a compatibility alias.
- `GET /api/v1/home/banners` — returns the active, ordered promotional slides for the homepage carousel.
- `GET /api/v1/home/best-sellers` — returns section metadata and curated products.
- `GET /api/v1/home/popular-games` — returns a separately curated popular-games shelf.
- `GET /api/v1/home/deals` — returns section metadata and products with active discounted offers.
- `GET /api/v1/home/trending` — returns section metadata and curated trending products.
- `GET /api/v1/home/new-arrivals` — returns section metadata and the newest curated products.
- `GET /api/v1/home/categories` — returns section metadata and category counts from the catalog.
- `GET /api/v1/home/platforms` — returns section metadata and platform counts from active offers.

The homepage requests each section independently, so a failed section can show its own error without hiding the rest of the page. Section titles, subtitles, banner actions, and curated product lists come from MySQL; category and platform counts are queried from catalog data.

The Store page and the global header search both query `GET /api/v1/products`. It accepts `q`, `platform`, `region`, `minPrice`, `maxPrice`, `sort`, `limit`, and `offset`. Product-name search supports partial matches, common title acronyms, and a bounded edit-distance fallback for simple typos. The header offers backend-powered suggestions that can be selected or submitted with Enter. Store filters appear in a left sidebar on desktop and behind a collapsible filter button on smaller screens. Sort values are `popular`, `price-asc`, `price-desc`, and `name`. The frontend requests one extra result to determine whether another 12-item page is available.

Product cards and search suggestions open `/products/{slug}`. The detail endpoint returns seller offers as purchasable product versions, a media gallery, related products, description sections, and product facts. Product ratings now come from the `product_reviews` table: the API calculates the average, total count, and star distribution from stored rows. Registered users can submit one review per product and edit or delete only their own review. Six seeded entries are marked `is_demo`, shown with a demo badge and disclaimer, and are not customer feedback; their placeholder accounts cannot sign in. Existing Steam review mappings/cache and the `/reviews` endpoint remain available separately, but the product page uses Gamebay community reviews. Run migrations `003_product_media.sql`, `004_product_detail_content.sql`, `005_steam_reviews.sql`, `006_product_reviews.sql`, and `007_checkout_demo_keys.sql` on an existing database. Metadata for Steam titles is based on their Steam Store entries; Minecraft metadata is based on the Xbox Store listing. Review ratings and seller cashback remain nullable and are not fabricated for the demo catalog. Adding an offer to the cart preserves that offer's ID, seller, platform, region, and displayed price; quantities are adjustable in the cart. Registration and login store passwords using PHP `password_hash()` and verify them with `password_verify()`; the unique email constraint prevents duplicate registrations. Authenticated routes provide account details and order/payment history, and the API derives ownership from the current PHP session. `/account`, `/orders`, and `/checkout` redirect signed-out visitors to login and return them to the requested route after sign-in. Order history displays order/payment statuses; assigned keys are returned only for the current user's paid orders with successful payment. Checkout revalidates active offers and prices on the backend, then uses row locks and one database transaction to simulate a successful payment, mark the order paid, and assign each selected offer's unique available keys. It rejects insufficient inventory without a partial order; the same checkout request ID is idempotent. The cart is held in frontend state. Seeded keys are plainly labeled synthetic and non-redeemable; no real payment method, credentials, or money are involved. Purchased test keys are shown only in that signed-in user's order history.

The header language switcher supports English (ENG) and Lithuanian (LTU), and the currency switcher displays prices in EUR or USD. Preferences persist in the browser. USD is a display-only estimate; backend offers and simulated orders remain stored in EUR. Interface text is translated, while product titles, catalog descriptions, and user reviews remain in their stored language.

## Configuration and sample data

- Keep database credentials in `backend/.env` or the server environment, never in React code. `backend/.env.example` contains placeholders only.
- Frontend `VITE_` variables are public build-time settings; do not put credentials in them.
- Sample products/offers, promotional copy, banner image URLs, homepage sections, and product media are stored in MySQL, not hardcoded in the frontend. Steam games use cover art and screenshots returned by the Steam Store API; Minecraft media comes from the official Xbox/Microsoft Store listing. Promotional backgrounds use official Steam Store page artwork.
- The example catalog uses real, recognizable games rather than placeholder game titles. Seeded offer prices and sellers remain synthetic demo data.
- Steam and Microsoft artwork and trademarks belong to their respective rights holders. Gamebay is an independent demo and is not affiliated with Valve/Steam or Microsoft; review the [Steam API Terms of Use](https://steamcommunity.com/dev/apiterms) and applicable image terms before reusing these assets outside this demo.
- Any digital key rows in the SQL seed are conspicuously fake test values and must never be treated as redeemable keys.

## Checks and manual testing

There is currently no automated test runner configured. From the project root, run the production frontend build:

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
```

If PHP is available on `PATH` (or use the PHP executable under your XAMPP installation), lint the backend files:

```powershell
Get-ChildItem backend -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }
```

For a manual smoke test, confirm `/api/v1/health` and `/api/v1/products` return data, then browse/filter/search the Store, use a partial or misspelled global search, open a product and compare offers, register and log in, add an offer to the cart, and complete the simulated checkout. Verify the paid order and synthetic key in order history, then test that a signed-out visitor is redirected and a second account cannot see the first account's order. No real payment is made. Repeat the main navigation and cart flows at narrow mobile, tablet, and desktop viewport sizes.

## GitHub preparation

The root `.gitignore` excludes `.env` files, dependencies, build output, local caches, database exports, and private-key files while allowing the safe `.env.example` templates. The two local AI conversation archives are deliberately ignored so private prompts and responses are not published with the source. `.dockerignore` applies the same secret/archive protections to container builds and excludes SQL imports from the runtime image; the database scripts remain in the GitHub repository for manual import.

This working folder does not yet have a Git repository or remote. To create a GitHub repository, create an empty repository in GitHub, then run these commands from the project root:

```powershell
git init -b main
git add .
git status --short
git diff --cached --name-only
```

Before committing, confirm that `backend/.env`, any other `.env` files, private keys, and generated dependency/build folders are absent from the staged file list. Then add the repository remote and push:

```powershell
git commit -m "Prepare Gamebay marketplace"
git remote add origin https://github.com/<your-account>/<your-repository>.git
git push -u origin main
```

Do not use `git add -f` on secrets or local conversation archives.

## Railway deployment

The included Dockerfile builds the React app and serves its static files and PHP API from the same Apache/PHP service. This keeps authentication same-origin; the PHP session cookie remains `HttpOnly`, `SameSite=Lax`, and is marked `Secure` when Railway forwards HTTPS. MySQL runs as a separate private Railway service. No database or payment credential belongs in the React `VITE_` variables.

1. Push the repository to GitHub using the steps above. Create a Railway account and project, add a **MySQL** database service, and add a service connected to the GitHub repository. Use the repository root as the service root so Railway detects the root `Dockerfile`.
2. In the application service's **Variables** tab, add database references using your exact MySQL service name (shown here as `MySQL`):

   ```text
   DB_HOST=${{ MySQL.MYSQLHOST }}
   DB_PORT=${{ MySQL.MYSQLPORT }}
   DB_NAME=${{ MySQL.MYSQLDATABASE }}
   DB_USER=${{ MySQL.MYSQLUSER }}
   DB_PASSWORD=${{ MySQL.MYSQLPASSWORD }}
   ```

   Railway injects `PORT`; the container entrypoint configures Apache to listen on it. Do not expose MySQL with a public domain for normal app traffic.
3. In the app service's **Settings > Networking**, generate a Railway domain. Set `APP_ALLOWED_ORIGIN` in the app service to the exact origin, such as `https://<generated-domain>` (no trailing slash). Set the app's healthcheck path to `/api/v1/health`, then deploy.
4. Initialize the hosted database once. Railway MySQL is private by default. For an import from your computer, temporarily enable its TCP public networking, connect using a MySQL client such as MySQL Workbench or HeidiSQL with the host, port, user, password, and database shown by Railway, select that database, and import `backend/database/schema.sql` followed by migrations `003` through `007` in order. Disable the public TCP endpoint after the import. Keep the database service and its storage; deleting it deletes the marketplace data.
5. Open `https://<generated-domain>/api/v1/health` and `/api/v1/products`, then test registration/login, product browsing, global search, cart and simulated checkout, and order history in the public site. Confirm that a delivered key is one of the clearly synthetic, non-redeemable demo keys.

Railway's free trial currently provides a one-time usage credit, and its Free plan has a small monthly usage allowance; this is not a guaranteed permanently free always-on host. Usage can exceed included credits. Check [Railway's current pricing](https://railway.com/pricing) before deploying. Official setup references: [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [MySQL](https://docs.railway.com/databases/mysql), [variables](https://docs.railway.com/variables), [public networking](https://docs.railway.com/networking/public-networking), and [healthchecks](https://docs.railway.com/deployments/healthchecks).

The SQL schema is intended for import into a fresh, selected database. Re-importing it will not delete existing data.


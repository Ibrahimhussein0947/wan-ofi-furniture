# Wan Ofi Furniture — Business Management System

A full-stack **MERN** application that runs a furniture business end to end: a public storefront and customer portal, plus an internal ERP for orders, custom furniture, production, quality control, inventory, suppliers, deliveries, accounting, reporting and administration.

| Layer | Technology |
| --- | --- |
| Database | MongoDB (Mongoose 8) — replica set / Atlas for transactions |
| API | Node.js + Express 4, Zod validation, JWT + rotating refresh tokens |
| Client | React 18 + Vite, React Router, TanStack Query, React Hook Form + Zod, Tailwind CSS, Recharts, Lucide |
| Tests | Jest + Supertest + mongodb-memory-server (API), Vitest + Testing Library (client) |

---

## Quick start (no database install needed)

Requires **Node.js 18+**.

```bash
npm run install:all      # installs root, server and client dependencies
npm run dev:memory       # embedded MongoDB + seeded data + API (5050) + client (5173)
```

Open **http://localhost:5173**. The first run seeds realistic data (a year of orders, payments, production, expenses). Data persists in `server/.devdb`; reset it with:

```bash
npm run dev:memory --prefix server -- --reset
```

### Development logins

All seeded accounts share the password **`Password123!`** (development only — set `SEED_DEFAULT_PASSWORD` to change it).

| Role | Email |
| --- | --- |
| Owner / administrator | `owner@wanofi.com` |
| Accountant | `accountant@wanofi.com`, `accountant2@wanofi.com` |
| Production supervisor | `supervisor@wanofi.com` |
| Carpenter | `carpenter@wanofi.com`, `carpenter2@wanofi.com` |
| Upholsterer / Assembler / Painter / Finisher | `upholsterer@`, `assembler@`, `painter@`, `finisher@wanofi.com` |
| Designer | `designer@wanofi.com` |
| Installer (deliveries) | `installer@wanofi.com` |
| Customers | `amina@example.com`, `john@example.com`, `fatma@example.com`, `emmanuel@example.com`, `halima@example.com` |

> The seed script refuses to run when `NODE_ENV=production`. Never use these passwords outside development.

---

## Running against your own MongoDB

1. Start MongoDB **as a replica set** so multi-document transactions are available (Atlas clusters already are):
   ```bash
   docker compose up -d mongo
   ```
2. Configure the API:
   ```bash
   cp server/.env.example server/.env   # then edit the values
   ```
   For the compose database use `MONGO_URI=mongodb://127.0.0.1:27017/wanofi?directConnection=true`.
   Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
3. Seed (erases the database) and run:
   ```bash
   npm run seed
   npm run dev          # API on :5050, client on :5173 (Vite proxies /api and /uploads)
   ```

A standalone (non-replica-set) MongoDB also works: the API detects it and falls back to atomic conditional updates, but you lose all-or-nothing rollback across documents. Use a replica set in production.

### Environment variables (`server/.env`)

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` / `production` |
| `PORT` | API port (default `5050`) |
| `MONGO_URI` | MongoDB connection string |
| `CLIENT_URL` | Allowed browser origin(s) for CORS, comma-separated |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | 32+ character secrets |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_DAYS` | Access-token lifetime (`15m`) and refresh-token lifetime in days (`7`) |
| `COOKIE_SAMESITE` | `lax` when client and API share a site; `none` when on different domains (requires HTTPS) |
| `STORAGE_DRIVER` | `local` (files in `server/uploads`) or `s3` (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | Object storage settings |
| `MAX_UPLOAD_MB` | Per-file upload limit (default 5) |
| `APP_URL` | Public web-app URL used in email links (defaults to the first `CLIENT_URL`) |
| `EMAIL_DRIVER`, `EMAIL_FROM`, `SMTP_*` | `console` prints emails to the log; `smtp` sends through any SMTP provider (Gmail Workspace, SendGrid, Mailgun, Zoho…) |
| `SMS_DRIVER`, `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` | `console` or `africastalking` (Africa's Talking; use username `sandbox` to test) |
| `PAYMENT_PROVIDER` | `manual` (staff record/verify payments), `sandbox` (simulated mobile money, development only) or `azampay` |
| `PAYMENT_WEBHOOK_SECRET` | Secret path segment of the payment callback URL (required for online payments) |
| `AZAMPAY_ENV`, `AZAMPAY_APP_NAME`, `AZAMPAY_CLIENT_ID`, `AZAMPAY_CLIENT_SECRET`, `AZAMPAY_API_KEY` | AzamPay credentials — M-Pesa, Mixx by Yas (Tigo Pesa), Airtel Money, HaloPesa |
| `ENABLE_CRON` | Background alerts (low stock, delays, deadlines, payment reminders) |

The API refuses to start in production with `PAYMENT_PROVIDER=sandbox`, or with online payments enabled but no webhook secret.

The client only needs `VITE_API_URL` when the API is hosted on a different origin (see `client/.env.example`).

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run install:all` | Install all dependencies |
| `npm run dev` | API (nodemon) + client (Vite) against `MONGO_URI` |
| `npm run dev:memory` | Same, with an embedded persistent MongoDB and automatic seeding |
| `npm run seed` | **Erase** and reseed the database in `MONGO_URI` |
| `npm test` | API tests (Jest) then client tests (Vitest) |
| `npm run build` | Production build of the client into `client/dist` |
| `npm start` | Start the API (serves `client/dist` when `NODE_ENV=production`) |

---

## Deployment

### Option A — one container (API serves the React build)

```bash
docker build -t wanofi .
docker run -p 5050:5050 \
  -e MONGO_URI="mongodb+srv://USER:PASS@cluster.mongodb.net/wanofi" \
  -e JWT_SECRET=... -e JWT_REFRESH_SECRET=... \
  -e CLIENT_URL=https://erp.example.com \
  -e STORAGE_DRIVER=s3 -e S3_BUCKET=... -e S3_REGION=... -e S3_ACCESS_KEY_ID=... -e S3_SECRET_ACCESS_KEY=... -e S3_PUBLIC_URL=https://cdn.example.com \
  wanofi
```

Or locally with the bundled database: `JWT_SECRET=... JWT_REFRESH_SECRET=... docker compose --profile app up --build`.

### Option B — separate hosting

- **Database:** MongoDB Atlas (M10+ recommended; any Atlas tier supports transactions). Allow-list your API host.
- **API:** Render / Railway / Fly.io / a VPS with `npm ci --omit=dev && npm start` in `server/`. Set the variables above; use `COOKIE_SAMESITE=none` and HTTPS if the client is on another domain.
- **Client:** `npm run build` in `client/` with `VITE_API_URL=https://api.example.com`, then deploy `client/dist` to Netlify / Vercel / S3+CloudFront with an SPA fallback to `index.html`.
- **Uploads:** use `STORAGE_DRIVER=s3` in production — container disks are ephemeral and the repository must never hold user files.

Production checklist: strong unique secrets, HTTPS everywhere, `NODE_ENV=production`, object storage, Atlas backups enabled, a reverse proxy that forwards `X-Forwarded-For` (the app trusts one proxy hop for rate limiting).

---

## Architecture

```
server/
├── config/        env validation, DB connection, constants, roles & permissions
├── models/        26 Mongoose models (+ soft-delete plugin, counters)
├── services/      business logic (orders, payments, production, inventory, reports…)
├── controllers/   thin HTTP handlers
├── routes/        routers per module with auth/permission/validation middleware
├── validators/    Zod schemas for every request body/query
├── middleware/    auth, RBAC, validation, sanitisation, uploads, rate limits, errors
├── jobs/          scheduled alerts (node-cron)
├── utils/         money maths, pagination/query helpers, transactions, errors
├── scripts/       seed data, embedded dev database
├── tests/         Jest API tests
├── app.js         Express app
└── server.js      bootstrap / graceful shutdown

client/src/
├── api/           Axios client (token refresh) + endpoint modules
├── components/    UI kit (buttons, forms, tables, modals, badges, charts…)
├── context/       Auth and cart providers
├── hooks/         URL-synced list state, mutation helpers
├── layouts/       Public site, staff app shell, customer portal
├── pages/         public/, auth/, account/ (customers), staff/ (ERP), shared/
├── routes/        route guards
├── utils/         formatting, constants, CSV/PDF export
└── test/          Vitest tests
```

### Roles and permissions

- **OWNER** — every permission (`*`), including settings, users/permissions and audit logs.
- **ACCOUNTANT** — payments, refunds, discounts, invoices, expenses, ledger, financial reports, suppliers and purchasing. Cannot change settings or manage users.
- **WORKER** — assigned production jobs only. Their **position** controls which stages they may move a job into (e.g. carpenters → *In production / Assembly*, painters → *Finishing / Quality check*). **Supervisors** additionally assign work, issue materials, run quality control and manage deliveries; **installers** update their deliveries; **designers** handle custom requests.
- **CUSTOMER** — their own orders, custom requests, invoices, receipts, payments, messages and notifications.

The owner can grant individual extra permissions per user. Every rule is enforced by the API (`requireAuth`, `requireRole`, `requirePermission`, plus ownership checks in services); the client only hides what a user cannot use.

### Business rules enforced by the API

- `TOTAL = subtotal − discount + delivery fee`; `BALANCE = total − paid`; `LOW STOCK = quantity ≤ minimum`.
- Prices always come from the database; client-sent prices, discounts and totals are ignored.
- Payments above the remaining balance are rejected (configurable). Payment writes use optimistic concurrency and MongoDB transactions.
- Paying the deposit (default 40%, configurable) confirms an order automatically: in-stock items are deducted from stock, the rest become production jobs with materials calculated from the bill of materials.
- Stock never changes silently: every movement (sale, purchase receipt, production issue/return, damage, adjustment) writes an inventory transaction with the balance after.
- Every financial event writes an immutable general-ledger entry. Approved expenses cannot be edited or deleted; expenses above the approval threshold wait for the owner.
- Production cannot start until materials are issued; items reach *Ready for delivery* only by passing the 10-point quality check; failed checks send the job back for rework.
- Orders cannot be cancelled after production has started. Delivery dispatch requires full payment (configurable).
- Important actions (logins, payments, refunds, status changes, stock changes, permission changes, approvals) are written to the audit log.

### Customer accounts, notifications and payments

- **Email verification:** new customers get a confirmation link; ordering, custom requests and payments are blocked until they confirm (switchable in Settings). Staff accounts created by the owner are verified automatically.
- **Password reset:** "Forgot password?" emails a single-use link valid for 1 hour. The response never reveals whether an account exists, and a completed reset signs the user out everywhere.
- **Email & SMS:** important events (order confirmed, payment received, production started/completed, ready, delivered, quotes, payment reminders; low stock, approvals, delays for staff; new jobs by SMS for workers) go out by email and/or SMS. Each user can opt out per channel on their profile page. Delivery runs in the background and never blocks the action.
- **Live updates:** notifications and messages arrive instantly over Server-Sent Events, with slow polling as a fallback. The event bus runs in-process, so one API instance is assumed. Run several only after switching it to a shared broker such as Redis pub/sub.
- **Mobile money:** with `PAYMENT_PROVIDER=azampay`, customers pay from the order page. They choose the network, get a PIN prompt on their phone, and the payment is applied automatically when AzamPay calls back. Callbacks are idempotent, amount-checked, and protected by the secret URL. If money arrives but can't be applied (for example, the order was paid meanwhile), the accounts team is alerted to refund it. The AzamPay adapter follows AzamPay's published API but has **not been exercised against a live AzamPay account**, so test it in their sandbox before going live.
- **VAT:** the tax rate in Settings (18% in the seed data) is added to the discounted goods value on new orders. Each order and invoice keeps the rate it was created with.
- **Branches:** orders, expenses and staff belong to a branch (showroom/workshop). Order and expense lists and the sales, product-sales and expense reports can be filtered by branch. Stock is shared across branches.

### Custom furniture workflow

`Customer request → Review → Estimate → Price proposal → Customer approval → Order + deposit → Production → Quality check → Delivery → Completion`

---

## Security

bcrypt password hashing (cost 12) · short-lived JWT access tokens held in memory · httpOnly refresh-token cookies with rotation and reuse detection · account lockout after 5 failed logins · rate limiting (API, auth, public forms) · Helmet security headers and CSP · strict CORS · Zod validation with unknown fields stripped · MongoDB operator-injection and HTML-tag sanitisation · upload type/extension/magic-byte/size validation with random file names · centralised error handling that never leaks stack traces in production · soft deletion for master data · secrets only from environment variables.

---

## Testing

```bash
npm test --prefix server   # 79 API tests: auth, password reset, email verification, authorization, products, uploads, inventory, orders, tax, payments, mobile money, production, QC, custom orders, accounting, notifications, branches, live events
npm test --prefix client   # 37 UI tests: login & guards, dashboards, checkout, payments, worker stage updates, product creation, validation, password reset, mobile money, and axe accessibility checks
npm run lint               # ESLint for both apps (client includes jsx-a11y accessibility rules)
```

API tests run against an in-memory MongoDB replica set, so transactions are exercised exactly as in production.

---

## API documentation

See [docs/API.md](docs/API.md). Every response uses the envelope:

```json
{ "success": true, "message": "Operation completed successfully", "data": {}, "pagination": {} }
```

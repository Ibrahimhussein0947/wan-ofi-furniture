# Wan Ofi API reference

Base URL: `/api` · JSON in, JSON out · Authenticated requests send `Authorization: Bearer <accessToken>`.

## Conventions

**Success**

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 70,
    "pages": 4,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Error**

```json
{
  "success": false,
  "message": "Payment exceeds remaining balance (270,000).",
  "errors": [{ "field": "amount", "message": "…" }]
}
```

| Status | Meaning                                                              |
| ------ | -------------------------------------------------------------------- |
| 400    | Validation failed or a business rule was broken                      |
| 401    | Not logged in / session expired                                      |
| 403    | Logged in but not permitted                                          |
| 404    | Not found (also returned for other customers' records)               |
| 409    | Conflict: duplicate value, insufficient inventory, concurrent update |
| 422    | Product unavailable                                                  |
| 429    | Rate limited                                                         |

**List endpoints** accept `page`, `limit` (≤100), `search`, `sort` (`field` or `-field`, whitelisted), `from`/`to` (ISO dates), plus the filters listed. Comma-separated values mean "any of" (e.g. `status=READY,DELIVERED`).

**File uploads** use `multipart/form-data`: files in the named field, other fields as a JSON string in `data`. Images only (JPG/PNG/WEBP/GIF), ≤ `MAX_UPLOAD_MB` each.

Permission names used below are defined in `server/config/permissions.js`. "Customer-scoped" endpoints let customers see only their own records.

---

## Auth — `/api/auth`

| Method | Path                   | Access                | Body / notes                                                                                             |
| ------ | ---------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| POST   | `/register`            | Public (rate limited) | `{ name, email, password, phone?, address? }` → customer account + session                               |
| POST   | `/login`               | Public (rate limited) | `{ email, password }` → `{ user, accessToken }` and an httpOnly refresh cookie                           |
| POST   | `/refresh`             | Refresh cookie        | Rotates the refresh token; returns a new access token. Replaying an old token revokes the session family |
| POST   | `/logout`              | Any                   | Revokes the refresh token                                                                                |
| GET    | `/me`                  | Logged in             | User (+ customer profile)                                                                                |
| PATCH  | `/profile`             | Logged in             | `{ name?, phone?, address?, company?, notificationPrefs?: { email?, sms? } }`                            |
| POST   | `/forgot-password`     | Public (rate limited) | `{ email }` — always the same reply; emails a 1-hour single-use link if the account exists               |
| POST   | `/reset-password`      | Public (rate limited) | `{ token, password }` — signs out all sessions                                                           |
| POST   | `/verify-email`        | Public                | `{ token }` from the confirmation email                                                                  |
| POST   | `/resend-verification` | Logged in             | Sends a new confirmation link                                                                            |
| PATCH  | `/password`            | Logged in             | `{ currentPassword, newPassword }` — signs out other sessions                                            |

## Public

| Method | Path                  | Notes                                                                                                                         |
| ------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----- | ------ | ---- | ----------------------------------------- |
| GET    | `/public/settings`    | Company name, contacts, currency, deposit %, payment instructions, active bank accounts customers pay into                    |
| POST   | `/public/contact`     | `{ name, email, phone?, subject?, message }` → notifies the owner                                                             |
| GET    | `/categories`         | Active categories with product counts                                                                                         |
| GET    | `/products`           | Filters: `category` (id or slug), `search`, `minPrice`, `maxPrice`, `color`, `material`, `featured`, `inStock`, `sort=popular | price | -price | name | newest`. Staff also: `status`, `lowStock` |
| GET    | `/products/:idOrSlug` | Public view hides cost and stock thresholds; staff view includes the BOM                                                      |

## Catalog administration

| Method                | Path                             | Permission                                                                                |
| --------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| POST / PATCH / DELETE | `/categories[/:id]`              | `categories:write`                                                                        |
| POST                  | `/products` (multipart `images`) | `products:write` — `quantity` = opening stock (ledgered); `allowLoss` to price below cost |
| PATCH                 | `/products/:id` (multipart)      | `products:write` — stock cannot be edited here                                            |
| DELETE                | `/products/:id`                  | `products:write` — soft delete; blocked while on open orders                              |

## People

| Method                | Path                                             | Permission                                                                                                                                                   |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET                   | `/users`, `/users/:id`, `/users/permissions`     | `users:read`                                                                                                                                                 |
| POST                  | `/users`                                         | `users:write` — staff accounts; `{ name, email, password, role, workerRole?, permissions?, worker? }`                                                        |
| PATCH                 | `/users/:id`                                     | `users:write`; changing `role`, `workerRole` or `permissions` needs `permissions:manage`                                                                     |
| DELETE                | `/users/:id`                                     | `users:write` — cannot remove yourself or the last owner                                                                                                     |
| GET                   | `/customers` (`withDebt=true`), `/customers/:id` | `customers:read` — detail includes balance, orders, payments, invoices and the customer's own `bankAccounts`                                                 |
| POST / PATCH / DELETE | `/customers[/:id]`                               | `customers:write` — POST/PATCH accept `bankAccounts[]` (`bankName`, `accountName`, `accountNumber`, `branch?`, `notes?`; up to 5) for refunding the customer |
| GET                   | `/workers` (`position`), `/workers/:id`          | `workers:read` — detail includes jobs, payments, performance                                                                                                 |
| GET                   | `/workers/payroll?month=YYYY-MM`                 | `payments:read` — the system counts each worker's earnings from their wage type, withholds the admin-set tax and reports net due plus the tax level reached  |
| PATCH                 | `/workers/:id`                                   | `workers:write` — accepts `wageType`, `wageRate` and `taxRate` (0–100, percent of earnings withheld as tax)                                                  |

## Inventory, materials, suppliers

| Method                | Path                                                                  | Permission                                                                                 |
| --------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------- | ------- | ------ | ----------------------------- |
| GET                   | `/materials` (`category`, `supplier`, `lowStock`), `/materials/:id`   | `materials:read`                                                                           |
| POST / PATCH / DELETE | `/materials[/:id]`                                                    | `materials:write`                                                                          |
| GET                   | `/inventory`                                                          | `inventory:read` — products + materials with values and low-stock flags                    |
| GET                   | `/inventory/transactions` (`itemType`, `type`, `product`, `material`) | `inventory:read`                                                                           |
| POST                  | `/inventory/adjust`                                                   | `inventory:write` — `{ itemType, itemId, type: STOCK_IN                                    | STOCK_OUT  | DAMAGED | RETURN | ADJUSTMENT, quantity, note }` |
| GET                   | `/bom`, `/bom/:productId`, `/bom/:productId/calculate?quantity=N`     | `bom:read`                                                                                 |
| PUT                   | `/bom/:productId`                                                     | `bom:write` — `{ items: [{ material, quantity, wastePercent? }], laborHours?, notes? }`    |
| GET                   | `/suppliers` (`withBalance`), `/suppliers/:id`                        | `suppliers:read`                                                                           |
| POST / PATCH / DELETE | `/suppliers[/:id]`                                                    | `suppliers:write`                                                                          |
| GET                   | `/purchases`, `/purchases/:id`                                        | `purchases:read`                                                                           |
| POST                  | `/purchases`                                                          | `purchases:write` — `{ supplier, items: [{ material, quantity, unitCost }], status?: DRAFT | ORDERED }` |
| POST                  | `/purchases/:id/place`, `/purchases/:id/cancel`                       | `purchases:write`                                                                          |
| POST                  | `/purchases/:id/receive`                                              | `purchases:write` — `{ items?: [{ itemId, quantity }] }`; adds stock and supplier balance  |

## Orders

| Method | Path                                                                                                           | Access                                                                                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- | ------------------------------------------------- |
| GET    | `/orders` (`status`, `paymentStatus`, `deliveryStatus`, `orderType`, `customer`, `withBalance`), `/orders/:id` | Customer-scoped or `orders:read`                                                                                                                                                                            |
| POST   | `/orders`                                                                                                      | Customer: `{ items: [{ product, quantity, color?, size? }], deliveryMethod, deliveryAddress?, notes? }`. Staff (`orders:write`): also `customer`, `discount`, `deliveryFee`, `internalNotes`, `autoConfirm` |
| PATCH  | `/orders/:id`                                                                                                  | `orders:write` — notes, dates, address                                                                                                                                                                      |
| POST   | `/orders/:id/confirm`                                                                                          | `orders:approve`                                                                                                                                                                                            |
| POST   | `/orders/:id/status`                                                                                           | `orders:write` — `{ status: READY                                                                                                                                                                           | DELIVERED | COMPLETED | CANCELLED, note? }` (pickup handover, completion) |
| POST   | `/orders/:id/cancel`                                                                                           | Customer (pending only) or `orders:write` — `{ reason }`; blocked once production started                                                                                                                   |
| POST   | `/orders/:id/discount`                                                                                         | `discounts:write` — `{ discount, reason }`                                                                                                                                                                  |
| PUT    | `/orders/:id/items`                                                                                            | `orders:write` — `{ items, reason }`; pending orders only, totals recalculated, invoices voided                                                                                                             |

## Custom furniture — `/api/custom-orders`

| Method | Path                                                        | Access                                                                                                                                                                         |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/`, `/:id`                                                 | Customer-scoped, or `custom-requests:manage` / `orders:read` (customers never see estimates)                                                                                   |
| POST   | `/` (multipart `referenceImages`)                           | Customer — `{ furnitureType, description, dimensions?, preferredMaterial?, preferredColor?, fabric?, designRequirements?, quantity, budget?, requiredDate?, deliveryMethod? }` |
| POST   | `/:id/review`, `/:id/estimate`, `/:id/quote`, `/:id/reject` | `custom-requests:manage`                                                                                                                                                       |
| POST   | `/:id/respond`                                              | Customer — `{ approve, note? }`; approval creates a CUSTOM order                                                                                                               |
| POST   | `/:id/cancel`                                               | Customer                                                                                                                                                                       |

## Production, tasks, quality, deliveries

| Method                      | Path                                                                                                  | Permission                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ | -------------------------- |
| GET                         | `/production` (`stage`, `order`, `worker`, `mine`, `overdue`), `/production/board`, `/production/:id` | `production:read` (workers see only assigned jobs)                                                     |
| PATCH                       | `/production/:id`                                                                                     | `production:manage` — instructions, due date, priority, required materials                             |
| POST                        | `/production/:id/stage`                                                                               | `production:update` — `{ stage, note? }`; allowed stages depend on worker position                     |
| POST                        | `/production/:id/assign`                                                                              | `production:manage` — `{ workerIds, supervisorId?, expectedCompletionDate?, priority? }`               |
| POST                        | `/production/:id/issue-materials`                                                                     | `materials:issue` — `{ items? }` (default: everything outstanding)                                     |
| POST                        | `/production/:id/return-materials`                                                                    | `production:update` — `{ items: [{ material, quantity }] }`                                            |
| POST                        | `/production/:id/material-requests`                                                                   | `production:update` — `{ material, quantity, reason? }`                                                |
| POST                        | `/production/:id/material-requests/:requestId`                                                        | `materials:issue` — `{ approve }`                                                                      |
| POST                        | `/production/:id/notes`, `/images` (multipart), `/problems`                                           | `production:update`                                                                                    |
| POST                        | `/production/:id/problems/:problemId/resolve`                                                         | `production:manage`                                                                                    |
| GET / POST / PATCH / DELETE | `/tasks[/:id]`                                                                                        | read: `production:read`; create/delete: `production:manage`; workers may update their own task status  |
| GET                         | `/quality` (`status`), `/quality/:id`                                                                 | `quality:manage`                                                                                       |
| POST                        | `/quality/:id/inspect` (multipart `images`)                                                           | `quality:manage` — `{ checklist, status: PASSED                                                        | FAILED | REWORK_REQUIRED, notes? }` |
| GET                         | `/deliveries` (`status`, `deliveryPerson`, `order`), `/deliveries/:id`                                | `deliveries:read` or `orders:read` (installers see their own)                                          |
| POST                        | `/deliveries`                                                                                         | `deliveries:manage` — `{ order, scheduledDate?, deliveryPerson?, address?, phone?, vehicle?, notes? }` |
| PATCH                       | `/deliveries/:id`                                                                                     | `deliveries:update` — `{ status?, scheduledDate?, failureReason?, receivedBy?, … }`                    |
| POST                        | `/deliveries/:id/proof` (multipart `images`, `kind=signature`)                                        | `deliveries:update`                                                                                    |

## Finance

| Method         | Path                                                                                                                       | Permission                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------------------- |
| GET            | `/payments` (`category`, `method`, `status`, `kind`, `order`, `customer`, `supplier`, `worker`), `/payments/:id` (receipt) | Customer-scoped or `payments:read`                                                                                                         |
| POST           | `/payments/customer`                                                                                                       | `payments:write` — `{ order, amount, method, reference?, notes?, paidAt? }`                                                                |
| POST           | `/payments/submit`                                                                                                         | Customer — reports a transfer for verification; accepts multipart with one `screenshot` image (transfer receipt) alongside the JSON `data` |
| POST           | `/payments/mobile`                                                                                                         | Customer (verified) — `{ order, amount, network: TELEBIRR\|CBE_BIRR\|AMOLE\|MPESA\|BYBILS, phone }`; sends a PIN prompt                    |
| GET            | `/payments/mobile/:reference`                                                                                              | Customer-scoped or `payments:read` — status `PENDING\|PROCESSING\|SUCCEEDED\|FAILED`                                                       |
| POST           | `/payments/webhooks/:gateway/:secret`                                                                                      | Public, secret in URL — provider callback (idempotent)                                                                                     |
| POST           | `/payments/:id/verify`                                                                                                     | `payments:write` — `{ approve, reason? }`                                                                                                  |
| POST           | `/payments/supplier`                                                                                                       | `payments:write` — `{ supplier, purchaseOrder?, amount, method }`                                                                          |
| POST           | `/payments/worker`                                                                                                         | `payments:write` — `{ worker, amount, method, kind: WAGE                                                                                   | BONUS | ADVANCE, period? }` |
| POST           | `/payments/refund`                                                                                                         | `refunds:write` — `{ order, amount, method, reason }`                                                                                      |
| GET            | `/invoices` (`status`, `customer`, `order`, `overdue`), `/invoices/:id`                                                    | Customer-scoped or `invoices:read`                                                                                                         |
| POST           | `/invoices`                                                                                                                | `invoices:write` (customers may generate the invoice for their own order) — `{ order, dueDate?, notes? }`                                  |
| POST           | `/invoices/:id/void`                                                                                                       | `invoices:write` — `{ reason }`                                                                                                            |
| GET            | `/expenses` (`category`, `status`, `method`), `/expenses/:id`                                                              | `expenses:read`                                                                                                                            |
| POST           | `/expenses` (multipart `receipt`)                                                                                          | `expenses:write` — large amounts wait for approval                                                                                         |
| PATCH / DELETE | `/expenses/:id`                                                                                                            | `expenses:write` — booked amounts are immutable                                                                                            |
| POST           | `/expenses/:id/decision`                                                                                                   | `expenses:approve` — `{ approve, reason? }`                                                                                                |
| GET            | `/accounting/transactions` (`type`, `direction`, `method`, `customer`, `order`, `supplier`)                                | `accounting:read`                                                                                                                          |
| POST           | `/accounting/income`                                                                                                       | `accounting:write` — other income                                                                                                          |

## Reports & dashboards

| Method | Path                                                                                                                                                                                                                                        | Permission                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------- | ------------------- |
| GET    | `/dashboard`                                                                                                                                                                                                                                | Logged in — role-specific (owner, accountant, worker, customer)                                      |
| GET    | `/dashboard/analytics`                                                                                                                                                                                                                      | `analytics:read` — 12-month trends, top products, material use, completion, growth, collection, debt |
| GET    | `/reports/sales` (`period=daily                                                                                                                                                                                                             | weekly                                                                                               | monthly | annual`, `customer`, `product`, `branch`) | `reports:financial` |
| GET    | `/reports/product-sales`, `/profit-loss` (`period`), `/expenses` (`category`, `method`), `/payments` (`method`, `category`, `customer`), `/transactions` (`type`, `method`, `customer`), `/customer-debts`, `/supplier-debts`, `/customers` | `reports:financial`                                                                                  |
| GET    | `/reports/production`, `/reports/inventory`                                                                                                                                                                                                 | `reports:operations`                                                                                 |

All reports accept `from` / `to`.

## Notifications, messages, administration

| Method                      | Path                                                   | Permission                                                                                                                                              |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| GET                         | `/notifications` (`unread`), `/notifications/unread`   | Own                                                                                                                                                     |
| POST                        | `/notifications/:id/read`, `/notifications/read-all`   | Own                                                                                                                                                     |
| GET                         | `/messages`, `/messages/contacts`, `/messages/:userId` | Own conversations                                                                                                                                       |
| POST                        | `/messages`                                            | `{ receiver?, body?, order? }` plus up to 4 images in `attachments` (multipart) — customers ↔ company, workers ↔ supervisors/owner, accountants ↔ owner |
| GET                         | `/audit-logs` (`action`, `entity`, `user`, `userRole`) | `audit:read`                                                                                                                                            |
| GET / PATCH                 | `/settings`                                            | `settings:manage` — PATCH accepts `bankAccounts[]` (`type: BANK                                                                                         | MOBILE_WALLET`, `bankName`, `accountName`, `accountNumber`, `branch?`, `notes?`, `isActive?`; required fields enforced, up to 10). Account numbers are format-checked; IBAN-shaped values get ISO 13616 length + mod-97 checksum verification. Customers only ever see the active accounts |
| GET                         | `/search?q=`                                           | Staff — searches only modules the user can read                                                                                                         |
| POST                        | `/uploads/categories                                   | misc                                                                                                                                                    | avatars`                                                                                                                                                                                                                                                                                   | Staff |
| GET / POST / PATCH / DELETE | `/branches[/:id]`                                      | list: staff; write: `settings:manage` (delete blocked once used)                                                                                        |
| POST                        | `/events/ticket`                                       | Logged in — one-time ticket (60 s) for the live event stream                                                                                            |
| GET                         | `/events/stream?ticket=`                               | Server-Sent Events: `update` events `{ kind: notification\|message }`                                                                                   |
| GET                         | `/health`                                              | Public                                                                                                                                                  |

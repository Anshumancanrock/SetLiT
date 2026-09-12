# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
# Development
bun dev              # Start Next.js dev server

# Build & lint
bun run build        # Production build
bun run lint         # ESLint
bun run format       # Prettier (writes in place)

# Database
bun run db:generate  # Regenerate Prisma client after schema changes (required before build)
bun run db:migrate   # Apply pending migrations (dev)
bun run db:push      # Push schema without migrations (rapid iteration)
bun run db:studio    # Prisma Studio GUI
bun run db:seed      # Seed demo data
```

Tests run on bun's built-in runner (`bun test`), so there is no separate test framework to install. Specs live in `tests/` and cover pure logic only: amount conversion, the split-recipient invariant, settlement-mint gating, wallet signature verification, and site-origin normalisation. Anything needing a database or an RPC endpoint is currently untested.

The package manager is **bun** — do not use npm or yarn.

## Environment Variables

Copy `.env.example` to `.env.local`. Required keys:

| Variable                            | Purpose                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | PostgreSQL connection string (Aiven in production)                                |
| `NEXT_PUBLIC_SOLANA_NETWORK`        | `mainnet-beta` or `devnet`                                                        |
| `NEXT_PUBLIC_SOLANA_RPC_URL`        | Client-side RPC endpoint                                                          |
| `SOLANA_RPC_URL`                    | Server-side RPC endpoint                                                          |
| `JUPITER_API_KEY`                   | Jupiter Swap v2 API key                                                           |
| `AUTH_SECRET`                       | JWT signing secret (`openssl rand -base64 32`)                                    |
| `RESEND_API_KEY`                    | Transactional email (Resend)                                                      |
| `SUBSCRIPTION_RELAYER_KEYPAIR_JSON` | Hot wallet keypair JSON array for subscription renewals — must be funded with SOL |
| `CRON_SECRET`                       | Shared secret for `/api/cron/process-renewals`                                    |
| `NEXT_PUBLIC_SITE_URL`              | Public origin of the deployment — required in production                          |

`lib/site-url.ts` is the single source of truth for the deployment origin. Import `SITE_URL` or `SITE_HOST` from it rather than reading `NEXT_PUBLIC_SITE_URL` directly or hardcoding a domain; it normalises the value and falls back to localhost when unset. Because the variable is `NEXT_PUBLIC_`, it is inlined at build time and must be present when the production build runs.

## Architecture

### Route Groups

The app uses three Next.js route groups with separate layouts:

- **`(pay)/`** — Public, unauthenticated buyer-facing pages: landing, payment link checkout (`/pay/[id]`), invoice checkout (`/invoice/[id]`), subscription signup (`/subscribe/[id]`), merchant personal pay page (`/pay/u/[merchantId]`), docs.
- **`(site)/`** — Authenticated merchant dashboard (`/dashboard/*`) and wallet auth (`/auth`). Protected by `requireAuth` middleware.
- **`embed/[id]/`** — Stripped iframe target for the embeddable checkout widget. No nav chrome.
- **`api/`** — All API routes. Auth is handled per-route via `requireAuth` or `requireSession` from `lib/auth/require-auth.ts`.

### Authentication

Two auth layers share the same `requireAuth(req)` call in `lib/auth/require-auth.ts`:

1. **Session cookie** — Wallet-signature flow: client requests a nonce from `/api/auth/nonce`, signs it with their Solana wallet, POSTs to `/api/auth/login`. Server verifies the Ed25519 signature (`lib/auth/verify-signature.ts`), issues a 24-hour `HS256` JWT (`jose`) stored as an httpOnly cookie (`setlit_session`).
2. **Bearer API key** — `Authorization: Bearer <key>`. Key is SHA-256 hashed and looked up in `ApiKey` table. Takes priority over session cookie.

**Which to use:**
- `requireSession` — cookie only. Use for all standard webapp/dashboard routes (browser-only access).
- `requireAuth` — cookie **or** Bearer API key. Use only for routes that intentionally expose headless/programmatic access (e.g. a merchant integrating via API key).

**Nonce store** (`lib/auth/nonce-store.ts`) is the `AuthNonce` table with a 5-minute TTL. It is in Postgres rather than memory because the instance serving `/api/auth/nonce` is usually not the one serving `/api/auth/login`. Consumption is a single conditional `deleteMany`, so a nonce can only be redeemed once even under concurrent logins.

### Payment Flows

Every payment goes through one of two on-chain paths:

**Jupiter swap path** (buyer pays a different token than the settlement token):

1. Client requests a quote: `GET /api/checkout/pay/quote` → `lib/services/jupiter-quote.service.ts` → `lib/solana/jupiter.ts::getExactOutQuote()`
2. Client requests an assembled transaction: `GET /api/checkout/pay/order` → `getExactOutOrder()` — uses Jupiter Swap v2 `swapMode=ExactOut` so the merchant receives the exact amount specified.
3. Client signs and submits the transaction through Jupiter: `POST /api/checkout/pay/execute`
4. Client confirms on-chain, then calls `POST /api/checkout/pay/submit` to record the execution in the database.

**Direct settlement path** (buyer pays the same token the merchant requested):
Mirrors the above but replaces the Jupiter call with `lib/solana/txBuilder.ts::buildDirectSettlementPaymentTx()`, which builds a standard SPL `transferChecked` with an on-chain memo embedding the link ID.

Both paths converge at `lib/services/payment-submit.service.ts::processSubmitTx()`, which verifies the on-chain transaction, upserts a `PaymentExecution` record (idempotent on `clientExecutionId`), fires the merchant webhook, and sends email receipts.

Transfer paths (personal pay page) mirror the above under `app/api/checkout/transfer/`.

### Solana Pay QR

The Solana Pay path is handled separately. The buyer QR-scans a link that encodes a `GET /api/pay/[id]/solana-pay/[mint]/[session]` URL. The wallet fetches a pre-built transaction from that endpoint and submits it. A session is written to the `SolanaPaySession` table (`lib/realtime/solana-pay-session-store.ts`) so the buyer's browser can poll `/api/links/[id]/payment-status` for confirmation.

**Confirmation is poll-driven.** Each status poll runs one bounded scan of the merchant's recent signatures via `lib/services/solana-pay-watch.service.ts`, and records the payment when it finds a settling transaction. There is deliberately no background watcher: the previous design started a 3-minute loop with `void` after the response was returned, which serverless terminates immediately. Keep confirmation work inside the request that polls for it.

### Subscription Renewals

`SubscriptionPlan` → `Subscriber` → `SubscriptionRenewal` → `PaymentExecution`.

Renewals are triggered by a cron endpoint (`/api/cron/process-renewals`, secured by `CRON_SECRET`). `GET` is for Vercel Cron, which sends `Authorization: Bearer <CRON_SECRET>`; `POST` is for manual or external schedulers, which send `X-Cron-Secret`. `processDueRenewals` only does work at UTC hours 22, 23 and 0 (three retry attempts around midnight UTC), so `vercel.json` schedules it at exactly those hours. The relayer keypair (`SUBSCRIPTION_RELAYER_KEYPAIR_JSON`) signs renewal transactions on behalf of the subscriber — the subscriber must have pre-authorized the relayer to spend their tokens. Logic lives in `lib/services/subscription-renewal.service.ts` and `lib/solana/subscriptionTxBuilder.ts`.

### Database

Prisma 7 with the `@prisma/adapter-pg` driver (PostgreSQL). The generated client is output to `lib/generated/prisma/` — **run `bun run db:generate` after any schema change** before writing code that uses new models or fields.

`lib/db.ts` exports a singleton `prisma` instance (dev: persisted on `globalThis` to survive HMR).

**Key invariants enforced at the service layer, not the DB schema:**

- `PaymentExecution`: exactly one of `linkId`, `invoiceId`, `renewalId`, or `merchantId` is non-null, matching `source`.
- `PaymentExecution.onDelete: Restrict` on all parent relations — execution records are payment proof and must never be deleted. Parents use soft-delete (`archivedAt` / `cancelledAt`).
- `clientExecutionId` (`@unique`) is the idempotency key — the submit endpoint is safe to retry.
- `SplitRecipient.basisPoints` across all recipients must sum to 10000. The rule is `isValidSplit` in `lib/validation/links.ts`, applied by `app/api/links/route.ts` (max 10 recipients).

### Services Layer

Business logic lives in `lib/services/`. Route handlers are thin — they validate input (Zod schemas in `lib/validation/`), call a service, and return a response. Key services:

- `payment-submit.service.ts` — on-chain tx verification + `PaymentExecution` upsert, webhook delivery, email receipt
- `payment-webhook.service.ts` — HMAC-SHA256 signed webhook delivery (`X-SetLiT-Signature: sha256=...`)
- `distribute.service.ts` — batch split payment distribution
- `subscription-renewal.service.ts` — cron-driven renewal loop
- `jupiter-quote.service.ts` / `jupiter-order.service.ts` — thin wrappers around `lib/solana/jupiter.ts`

### Embeddable Checkout Widget

`public/checkout.js` is a self-contained IIFE. It auto-detects the SetL iT origin from its own `src` attribute, opens an iframe pointing to `/embed/[linkId]`, and communicates with the parent page via `postMessage`. API: `SetLiT.open({ linkId, metadata, onSuccess, onClose })` / `SetLiT.close()`.

### Settlement Token

Currently only USDC is allowed as the settlement token (`lib/solana/constants.ts::isAllowedSettlementMint`). The `PaymentLink.token` and `Invoice.token` fields are present for future multi-stablecoin support.

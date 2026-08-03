# 11 — Stripe Setup

**Product:** Jojan One · **Companion docs:** [Runbooks & Go-Live](./09-Runbooks-and-Go-Live.md), [TRD](./02-TRD.md)

How billing is wired, and the exact steps to connect a Stripe account. Test and live
mode are entirely separate: everything below is done once per mode.

---

## 1. How it fits together

Packages are designed in the app, not in Stripe. An operator creates a package in
**Admin → Settings → Packages & pricing**; saving it creates the matching Stripe product
and price. Stripe is the payment rail, the package catalogue is the source of truth.

```
Admin designs package ──save──> Stripe product + price created
        │                                   │
        │ publish                           │ price id stored on the plan row
        ▼                                   ▼
  Public pricing page              Checkout uses that price
  (published packages only)                 │
                                            ▼
                              Webhook updates the workspace's plan
```

Three consequences worth internalising:

- **Prices are immutable in Stripe.** Changing a package's price creates a _new_ price and
  archives the old one. Existing subscribers stay on the price they bought — that is
  Stripe's model, not a workaround.
- **A priced package cannot be published without a Stripe price behind it.** This stops the
  public page ever advertising something that cannot be bought.
- **Free packages never touch Stripe.** Checkout is refused for them with
  "This package is free - no checkout is needed."

---

## 2. Environment variables

| Variable                | Required    | Where it comes from                                     |
| ----------------------- | ----------- | ------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Yes         | Developers → API keys → Secret key (`sk_test_…`)        |
| `STRIPE_WEBHOOK_SECRET` | Yes         | The signing secret of the event destination (`whsec_…`) |
| `NEXT_PUBLIC_APP_URL`   | Yes         | `https://app.jojanone.com` — checkout return URLs       |
| `STRIPE_PRICE_STARTER`  | No (legacy) | Fallback price id for the pre-designer `starter` plan   |
| `STRIPE_PRICE_GROWTH`   | No (legacy) | Fallback price id for the pre-designer `growth` plan    |

The two `STRIPE_PRICE_*` variables exist only for the two plans that predate the package
designer. Anything designed in the app carries its own price id, so leave them blank on new
environments.

`NEXT_PUBLIC_APP_URL` falls back to `http://localhost:3000`. That is correct locally and
wrong everywhere else — a paying customer would be returned to localhost after checkout.

**Never** put a secret key in client code or `NEXT_PUBLIC_*`. All Stripe calls are
server-side. `.env.local` is git-ignored and must stay that way.

---

## 3. Connecting a Stripe account

1. **Switch on Test mode** in the Stripe dashboard.
2. **Copy the secret key** — Developers → API keys → Secret key (`sk_test_…`).
3. **Create the event destination** (Stripe's newer name for a webhook):
   - Scope: **Your account**. _Not_ "Connected accounts" — that is for Stripe Connect
     platforms billing on behalf of other accounts, which Jojan One is not. Choosing it
     means the endpoint receives nothing.
   - API version: leave at the account default. The SDK is constructed without pinning
     `apiVersion`, so it follows the account.
   - Destination type: **Webhook endpoint**.
   - URL: `https://app.jojanone.com/api/billing/webhook`
     Use **app.**, not **www.** — the middleware 308-redirects everything except `/` from
     www to app, and a redirect breaks signed webhook delivery.
   - Events: exactly the seven in §4.
4. **Reveal the signing secret** on the destination's page (masked behind _Reveal_) and copy
   the `whsec_…` value.
5. **Set the variables** in Vercel → Settings → Environment Variables (Production _and_
   Preview), or `.env.local` for local work.
6. **Redeploy.** Vercel only picks up environment changes on a new deployment.

---

## 4. Webhook events

The handler processes exactly these and ignores everything else, so select only these when
creating the destination:

| Event                           | Effect                                     |
| ------------------------------- | ------------------------------------------ |
| `checkout.session.completed`    | Links the Stripe customer to the workspace |
| `customer.subscription.created` | Records the subscription and its plan      |
| `customer.subscription.updated` | Re-derives canonical subscription state    |
| `customer.subscription.deleted` | Marks the subscription ended               |
| `invoice.paid`                  | Records a successful payment               |
| `invoice.payment_succeeded`     | As above (Stripe emits both on some flows) |
| `invoice.payment_failed`        | Flags the workspace's billing as failing   |

Events are **idempotent on `stripe_event_id`**, so replaying from Stripe is always safe.

### Why the signing secret is not optional

`/api/billing/webhook` verifies every event's signature against `STRIPE_WEBHOOK_SECRET`
before parsing the body — anyone can POST to a public URL. Without the secret the route
returns **503 `webhook not configured`** and rejects everything.

The failure mode is easy to misread: checkout appears to succeed and the customer is
charged, but their workspace never receives its plan, because that update only happens on
the webhook. Stripe's dashboard shows the failed deliveries under the endpoint.

---

## 5. Verifying the connection

1. **Admin → Health** — "Stripe (billing)" and "Stripe webhook" both read OK.
2. **Admin → Settings → Packages & pricing** — open a package and **Save package**. The red
   **"Not in Stripe"** badge clears, and a matching product and price appear in the Stripe
   dashboard. If the badge stays, the warning toast carries the Stripe error verbatim, and
   the attempt is recorded in the platform audit log under `plan.create` / `plan.update`.
3. **Buy something** from a tenant workspace's Billing page. Test card
   `4242 4242 4242 4242`, any future expiry, any CVC, any postcode. On a package with a free
   trial you should see the trial applied rather than an immediate charge
   (`trial_period_days` is passed on the subscription).
4. **Confirm the plan changed** on the workspace. If checkout succeeded but the plan did not
   change, the webhook is the thing to debug — see the runbook in
   [09-Runbooks-and-Go-Live](./09-Runbooks-and-Go-Live.md#runbook-stripe-webhook-failures).

### Local testing

The Stripe CLI forwards events to a local server and prints its own signing secret:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

That `whsec_…` is valid only for that CLI session. Do not put it in Vercel.

---

## 6. Gotchas

- **The Customer Portal needs enabling once.** "Manage billing" calls
  `billingPortal.sessions.create`, which fails until the portal configuration has been saved
  in Stripe under Settings → Billing → Customer portal. Test mode needs this too.
- **Signing secrets are per endpoint and per mode.** A test secret in production means every
  live event fails verification. If you roll a secret, update Vercel and redeploy.
- **A price change creates a second price** on the same product, with the old one archived.
  Seeing two prices is correct, not a duplicate.
- **A workspace on no package is unrestricted.** Trials, imported and legacy tenants keep
  full module access rather than being silently locked out; entitlements only bite once a
  workspace is actually on a package.

---

## 7. Going live

Same steps with live-mode keys, plus a **second event destination** pointing at the same URL
with live-mode credentials. Live and test are independent, so nothing done in test affects
production. Before switching, re-run §5 against the live account, and confirm the packages
you intend to sell are **published** — an unpublished package never reaches the pricing page.

# Commercial Enquiry Notification System — Setup Guide

This adds a full backend to your BUCKETS.COM site, running as **Netlify
Functions** (serverless — deploys alongside your existing static site,
no separate server to manage):

- `index.html` — the "Request a tailored quotation" form now submits
  to a serverless function instead of just showing a fake success
  message. It also collects **email** and **location**, which weren't
  in the original form but were required for the notifications.
- `netlify/functions/submit-enquiry.js` — receives the form, validates
  it, saves it, and triggers the WhatsApp + email alerts.
- `netlify/functions/lib/store.js` — saves/reads enquiries using
  **Netlify Blobs** (built into every Netlify site — nothing to sign
  up for).
- `netlify/functions/lib/whatsapp.js` — sends the WhatsApp alert via
  the official **Meta WhatsApp Cloud API**.
- `netlify/functions/lib/email.js` — sends the email alert via
  **Resend**.
- `admin.html` — password-protected dashboard listing every enquiry,
  newest first, with new/unread ones highlighted, and a status
  dropdown (New → Contacted → Quotation Sent → Negotiation → Won /
  Lost).
- `netlify/functions/admin-login.js`, `get-enquiries.js`,
  `update-enquiry.js` — back the admin dashboard. All credentials and
  tokens stay server-side; nothing sensitive ships to the browser.

## 1. Deploy

Push this folder to your Netlify site as usual (Git-connected deploy
or drag-and-drop). Netlify will detect `netlify.toml`, install
`@netlify/blobs` from `package.json`, and deploy the functions
automatically. No code changes are needed to go live once the
environment variables below are set — until then, the site keeps
working and notifications are simply skipped (with a warning logged),
so nothing breaks.

## 2. Environment variables to add

In **Netlify → Site settings → Environment variables**, add:

| Variable | Required for | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | Admin dashboard | Password for `/admin.html` |
| `SESSION_SECRET` | Admin dashboard | Random string, e.g. `openssl rand -hex 32` |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp alerts | From Meta for Developers |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp alerts | From Meta for Developers |
| `WHATSAPP_ADMIN_NUMBER` | WhatsApp alerts | Defaults to `919381566336` if unset |
| `WHATSAPP_TEMPLATE_NAME` | WhatsApp alerts (recommended) | See step 3 |
| `WHATSAPP_TEMPLATE_LANG` | WhatsApp alerts | e.g. `en` |
| `WHATSAPP_SEND_MODE` | WhatsApp alerts | `template` (recommended) or `text` |
| `RESEND_API_KEY` | Email alerts | From resend.com |
| `SALES_EMAIL` | Email alerts | Inbox that should receive alerts |
| `EMAIL_FROM` | Email alerts | Verified sender address |

A template of this list is also in `.env.example`.

**None of these ever touch the frontend** — they're only read inside
the serverless functions, which run on Netlify's servers.

## 3. Setting up WhatsApp (Meta Cloud API)

1. Create a Meta for Developers app and add the **WhatsApp** product.
2. Under **API Setup** you'll get a temporary access token, a **Phone
   Number ID**, and a test number to send from. For production, add
   your real WhatsApp Business number and generate a **permanent**
   access token (System User token) instead of the temporary one.
3. **Important — the 24-hour rule:** WhatsApp only allows free-form
   text messages if the recipient messaged your number within the
   last 24 hours. Since this is your site notifying *you*, that
   window usually won't be open. The reliable fix is to create an
   approved **Message Template** (Meta Business Manager → WhatsApp
   Manager → Message Templates) with this body:

   ```
   🔔 NEW COMMERCIAL ENQUIRY
   Company: {{1}}
   Customer: {{2}}
   Phone: {{3}}
   Email: {{4}}
   Product: {{5}}
   Quantity: {{6}}
   Location: {{7}}
   Message: {{8}}

   Please follow up with the customer.
   ```

   Submit it for approval (usually takes minutes to a few hours), then
   set `WHATSAPP_TEMPLATE_NAME` to its name and `WHATSAPP_TEMPLATE_LANG`
   to its language code. Until it's approved, you can test with
   `WHATSAPP_SEND_MODE=text`, but only after you've sent a message to
   your own WhatsApp Business number in the last 24 hours.

## 4. Setting up email (Resend)

1. Create a free account at resend.com and generate an API key →
   `RESEND_API_KEY`.
2. Verify a sending domain (or use their shared test sender for
   quick testing) and set `EMAIL_FROM` accordingly.
3. Set `SALES_EMAIL` to the inbox that should get new-enquiry alerts.

Prefer a different provider (SendGrid, SMTP, your own mail server)?
Swap the single `fetch` call in `netlify/functions/lib/email.js` — the
rest of the system doesn't need to change.

## 5. Using the admin dashboard

Visit `/admin.html` on your deployed site, log in with
`ADMIN_PASSWORD`, and you'll see every enquiry — newest first, with
**New** ones highlighted with an orange marker. Change the status
dropdown on any row to move it through New → Contacted → Quotation
Sent → Negotiation → Won/Lost; changes save immediately.

This login is a single shared password suited to one or a few
trusted staff. If you need individual logins or an audit trail later,
swap `netlify/functions/lib/auth.js` for Netlify Identity or another
auth provider — the rest of the dashboard doesn't need to change.

## 6. What happens if credentials aren't set yet

Everything degrades gracefully:

- No WhatsApp credentials → the enquiry still saves and the customer
  still sees the confirmation message; WhatsApp is just skipped (a
  warning is logged in the function logs).
- No email credentials → same — the enquiry saves, email is skipped.
- No `ADMIN_PASSWORD` / `SESSION_SECRET` → `/admin.html` login will
  show a clear error until you set them.

So you can deploy this immediately and add each credential whenever
it's ready, in any order.

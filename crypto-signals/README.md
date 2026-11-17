# Crypto Signals Website

Landing page for selling crypto indicators and signal alerts as a subscription.
Built with Vite + React + TypeScript + Tailwind.

## Run it locally

```bash
cd crypto-signals
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Make it yours: edit `src/config.ts`

Everything you need to change lives in one file:

| Setting | What it does |
| --- | --- |
| `brand` | Name, tagline, support email, social links (empty links are hidden) |
| `indicators` | The indicator cards |
| `tiers` | Plan names, prices, features and checkout links |
| `signals` | The public signal log |
| `SAMPLE_DATA` | While `true`, charts and signals show a "Sample" badge |
| `waitlistFormAction` | Where waitlist emails are sent |
| `faqs` | FAQ questions and answers |

## Launch checklist

1. **Take payments with Stripe Payment Links (no backend needed).**
   In Stripe, create a Product per plan with monthly and yearly prices, then create a
   Payment Link for each one. Paste the links into `checkoutMonthly` / `checkoutYearly`.
   Until a link is set, its button scrolls to the waitlist.
2. **Turn on Stripe's customer portal** so members can cancel or update cards themselves.
3. **Save waitlist emails.** Create a free form endpoint (Formspree, Basin, etc.) or use your
   email tool's form URL, and paste it into `waitlistFormAction`. **Until you do this, emails
   are not saved anywhere.**
4. **Replace the sample signals** with your real track record, then set `SAMPLE_DATA = false`.
   Post losing trades too: an honest log builds trust and protects you legally.
5. **Grant access.** For TradingView invite-only scripts, add each buyer's username under
   your script's "Manage access". For Discord, tools like Whop, LaunchPass or a Stripe-linked
   role bot can automate member roles.
6. **Deploy** for free on Vercel, Netlify or Cloudflare Pages (build command `npm run build`,
   output folder `dist`, root directory `crypto-signals`), then connect your domain.
7. **Add Terms of Service, a Privacy Policy and a refund policy** before taking money,
   and keep the risk disclaimer in the footer.

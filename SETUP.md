# CoachAI — Setup Guide

## 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full contents of `supabase/migrations/001_initial.sql`
3. Grab your project URL and keys from **Settings → API**

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...   # optional until Stripe step
```

## 3. Deploy Edge Functions

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) then:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets (server-side only, never in .env)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PRICE_ID=price_...

# Deploy all three functions
supabase functions deploy generate-program
supabase functions deploy generate-checkin-feedback
supabase functions deploy create-checkout-session
```

## 4. Run Locally

```bash
npm install
npm run dev
```

App starts at http://localhost:5173

## 5. Stripe (optional, skip for now)

1. Create a product in [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a recurring price of €49/month
3. Copy the Price ID (`price_...`) → `STRIPE_PRICE_ID` secret
4. Add `VITE_STRIPE_PUBLISHABLE_KEY` to your `.env`

## Architecture

```
src/
├── lib/
│   ├── supabase.ts       Supabase client
│   └── types.ts          Shared TypeScript types
├── pages/
│   ├── Auth.tsx          Login / signup
│   ├── Dashboard.tsx     Stats + recent clients
│   ├── Clients.tsx       Client table + add modal
│   ├── ClientDetail.tsx  Client info, programs, check-ins
│   ├── CheckIn.tsx       Public check-in form (/checkin/:id)
│   └── Settings.tsx      Profile + Stripe upgrade
├── components/
│   ├── Layout.tsx        Sidebar navigation
│   ├── AddClientModal.tsx
│   └── ProgramView.tsx   Editable program table
supabase/
├── migrations/
│   └── 001_initial.sql   Schema + RLS policies
└── functions/
    ├── generate-program/         Claude → workout program
    ├── generate-checkin-feedback/ Claude → motivational feedback
    └── create-checkout-session/  Stripe Checkout
```

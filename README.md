# 🏠 Unit Booking Management System

A full-stack web app built with **Next.js 14**, **Neon Postgres**, and **Drizzle ORM** — deployable to Vercel's free tier.

---

## Features

- **Tomorrow view** — instantly see who's checking in/out tomorrow and the next 7 days
- **Dashboard** — revenue analytics, payment status, per-unit breakdown, outstanding balances
- **Booking management** — add, edit, delete bookings with live conflict detection
- **Payment tracking** — DP + full payment, auto-calculates remaining balance and status
- **Conflict detection** — warns you if a unit is double-booked

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Next.js 14 (App Router) + React |
| Styling | Tailwind CSS |
| Database | Neon Postgres (free tier) |
| ORM | Drizzle ORM |
| Deployment | Vercel (free tier) |

---

## 🚀 Deployment Guide (Step by Step)

### Step 1 — Set up your database on Neon

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Click **New Project**
3. Name it `unit-bookings` and click **Create Project**
4. Copy the **Connection string** (it looks like `postgresql://user:pass@host/dbname?sslmode=require`)
5. Save it — you'll need it in Step 4

### Step 2 — Push this code to GitHub

1. Create a new repository on [github.com](https://github.com) (call it `unit-bookings`)
2. In your terminal, inside this folder:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/unit-bookings.git
git push -u origin main
```

### Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Select your `unit-bookings` repository
4. Click **Deploy** (Vercel auto-detects Next.js — no config needed)

### Step 4 — Connect your database

1. In Vercel, go to your project → **Settings → Environment Variables**
2. Add a new variable:
   - **Name:** `DATABASE_URL`
   - **Value:** paste your Neon connection string from Step 1
3. Click **Save**
4. Go to **Deployments** → click the three dots → **Redeploy**

### Step 5 — Create your database tables

On your local machine (with `DATABASE_URL` set in `.env.local`):

```bash
npm install
npm run db:push
```

This creates all the tables in Neon automatically.

### Step 6 — (Optional) Import your existing bookings

```bash
npx tsx src/scripts/seed.ts
```

This imports the bookings from your original Excel file.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local and add your DATABASE_URL
cp .env.example .env.local
# Edit .env.local and paste your Neon connection string

# 3. Push schema to database
npm run db:push

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Dashboard (/)
│   ├── tomorrow/page.tsx     # Tomorrow view (/tomorrow)
│   ├── bookings/page.tsx     # All bookings (/bookings)
│   ├── api/
│   │   ├── bookings/route.ts        # GET all, POST new
│   │   ├── bookings/[id]/route.ts   # GET, PUT, DELETE one
│   │   ├── dashboard/route.ts       # Analytics data
│   │   └── conflicts/route.ts       # Conflict checker
│   ├── layout.tsx            # Nav + root layout
│   └── globals.css           # Tailwind + custom classes
├── components/
│   └── BookingForm.tsx       # Add/edit booking modal
├── lib/
│   ├── db.ts                 # Neon + Drizzle connection
│   ├── schema.ts             # Database table definitions
│   └── utils.ts              # Helpers, constants
└── scripts/
    └── seed.ts               # Import initial bookings
```

---

## Units Managed

- Unit 1116
- Unit 1118
- Unit 1558
- Unit 1845

## Payment Methods

- GCash
- Cash
- Bank Transfer

## Staff

- SIR JAMES
- SIR MIKE
- RIEMAR

---

## Vercel Free Tier Limits

| Resource | Limit |
|---|---|
| Bandwidth | 100 GB/month |
| Serverless function invocations | 100,000/month |
| Neon storage | 0.5 GB |
| Neon compute | 190 compute hours/month |

More than enough for this use case.

---

## Adding More Units or Staff

Edit `src/lib/utils.ts`:

```ts
export const UNITS = ["1116", "1118", "1558", "1845", "YOUR_NEW_UNIT"];
export const STAFF = ["SIR JAMES", "SIR MIKE", "RIEMAR", "NEW_STAFF"];
```

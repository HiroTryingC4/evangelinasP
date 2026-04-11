# 🚀 Deployment Guide — Vercel + Neon Postgres

Follow these steps exactly, in order.

---

## PART 1 — Run it locally first (VS Code)

### Step 1 — Open the project
Unzip `unit-booking-system.zip`, then in VS Code:
```
File → Open Folder → select the booking-app folder
```

### Step 2 — Install dependencies
Open the terminal (`Ctrl + ~`) and run:
```bash
npm install
```
Wait for it to finish (1–2 minutes).

### Step 3 — Create your Neon database (free)
1. Go to **https://neon.tech** → Sign up for free (no credit card needed)
2. Click **New Project**
3. Name it `unit-bookings`
4. Select the region closest to you (e.g. Singapore, or any Asia region)
5. Click **Create Project**
6. On the next screen, find **Connection Details**
7. Click **Connection string** tab → Copy the full string
   It looks like: `postgresql://alex:AbcXyz@ep-cool-name-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

### Step 4 — Set up your .env.local file
In VS Code, create a new file called `.env.local` in the root of the project:
```
DATABASE_URL="postgresql://YOUR_CONNECTION_STRING_HERE"
```
Replace with your actual connection string from Step 3.

> ⚠️ Never share this file or commit it to GitHub. It's already in .gitignore.

### Step 5 — Create the database tables
```bash
npm run db:push
```
You'll see output like:
```
[✓] Changes applied
```
If it asks "Are you sure?" — type `y` and press Enter.

### Step 6 — Import your existing bookings
```bash
npm run db:seed
```
You should see:
```
🌱 Seeding database...
✅ Inserted 11 bookings successfully.
```

### Step 7 — Start the app
```bash
npm run dev
```
Open your browser at **http://localhost:3000**

---

## PART 2 — Deploy to Vercel (free)

### Step 8 — Push your code to GitHub
1. Go to **https://github.com** → Sign in → Click **New** (green button)
2. Name it `unit-bookings`, set to **Private**, click **Create repository**
3. In VS Code terminal, run these commands one by one:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/unit-bookings.git
git push -u origin main
```
Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

### Step 9 — Deploy on Vercel
1. Go to **https://vercel.com** → Sign in with GitHub
2. Click **Add New… → Project**
3. Find `unit-bookings` in the list → click **Import**
4. Leave all settings as default (Vercel auto-detects Next.js)
5. Click **Deploy**
6. Wait ~2 minutes for the build to finish
7. ✅ Your app is live! (but the database isn't connected yet — next step)

### Step 10 — Connect Neon database INSIDE Vercel (easiest option)

This is the built-in way — Vercel will set DATABASE_URL automatically.

1. In your Vercel project, click the **Storage** tab (top menu)
2. Click **Create Database**
3. Select **Neon Postgres** → click **Continue**
4. Choose **Free** plan → click **Create**
5. Vercel automatically creates a Neon account + database and sets `DATABASE_URL` for you
6. Go to **Deployments** tab → click the 3 dots on your latest deployment → **Redeploy**

> ℹ️ Alternative: If you already made a Neon account in Step 3, go to
> **Settings → Environment Variables → Add**
> Name: `DATABASE_URL`
> Value: paste your connection string
> Then redeploy.

### Step 11 — Create tables on the live database
On your local machine, update your `.env.local` with the new Vercel/Neon connection string
(find it in Vercel → Storage → your DB → `.env.local` tab), then run:

```bash
npm run db:push
npm run db:seed
```

That's it! Your app is fully live. 🎉

---

## Summary of commands

| Command | What it does |
|---|---|
| `npm install` | Install all packages |
| `npm run dev` | Start local server at localhost:3000 |
| `npm run db:push` | Create/update database tables |
| `npm run db:seed` | Import your existing bookings |
| `npm run db:studio` | Open visual database browser |
| `npm run build` | Test production build locally |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `DATABASE_URL is not set` | Make sure `.env.local` exists with the correct value |
| `relation "bookings" does not exist` | Run `npm run db:push` first |
| `npm run db:seed` fails | Make sure `npm run db:push` ran successfully first |
| Port 3000 already in use | Run `npm run dev -- --port 3001` |
| Vercel build fails | Check that `DATABASE_URL` is set in Vercel Environment Variables |
| `Cannot find module` | Run `npm install` again |

---

## Updating your app later

After making changes locally:
```bash
git add .
git commit -m "describe your change"
git push
```
Vercel automatically redeploys within ~1 minute. No manual steps needed.

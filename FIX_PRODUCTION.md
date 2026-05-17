# 🔧 Fix Manual Expenses in Production

## Problem
Manual expenses work on localhost but not on your live site (Vercel). This is because the `manual_expenses` table doesn't exist in your production database yet.

## Solution

### Option 1: Run the Migration Script (Recommended)

**Step 1: Get your Production Database URL**

1. Go to your Vercel dashboard: https://vercel.com
2. Click on your project (`evangelinasP` or `unit-bookings`)
3. Go to **Settings** → **Environment Variables**
4. Find `DATABASE_URL` and copy its value
   - OR go to **Storage** tab → click your database → copy the connection string

**Step 2: Update your local .env.local**

Open `.env.local` and temporarily replace the DATABASE_URL with your production URL:

```
DATABASE_URL="postgresql://your-production-connection-string-here"
```

**Step 3: Run the Migration Script**

In your terminal:
```bash
npx tsx src/scripts/create-manual-expenses-prod.ts
```

The script will:
- Show you which database it's connecting to
- Ask for confirmation (type `yes`)
- Create the `manual_expenses` table if it doesn't exist
- Create the index for faster queries
- Test that inserts work
- Clean up test data

**Step 4: Restore your local DATABASE_URL**

After the script completes, restore your `.env.local` to use your local database URL.

**Step 5: Test on Production**

1. Go to your live site
2. Navigate to the Source Report page
3. Add a manual expense
4. Refresh the page
5. The expense should now persist! ✅

---

### Option 2: Let Vercel Create It Automatically

The code already has `ensureManualExpensesTable()` which should create the table automatically on first use. However, this might fail if:

1. **Vercel's serverless functions timeout** - The first request might take too long
2. **Database permissions** - The connection might not have CREATE TABLE permissions

To trigger it:
1. Go to your live site
2. Open browser console (F12)
3. Navigate to Source Report
4. Try adding an expense
5. Check the Network tab for any errors

If you see errors, use **Option 1** instead.

---

### Option 3: Use Vercel's Database Dashboard

If your Neon database is connected through Vercel:

1. Go to Vercel → **Storage** tab
2. Click on your Neon database
3. Click **Query** or **Data** tab
4. Run this SQL:

```sql
CREATE TABLE IF NOT EXISTS manual_expenses (
  id SERIAL PRIMARY KEY,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  receiver TEXT NOT NULL,
  amount INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_expenses_week_receiver 
ON manual_expenses(week_start, week_end, receiver);
```

5. Click **Run** or **Execute**

---

## Verification

After running any of the above options, verify it worked:

### Check via API:
Visit: `https://your-site.vercel.app/api/test-db`

You should see:
```json
{
  "success": true,
  "tableExists": true,
  "tableData": {
    "count": { "count": "0" }
  }
}
```

### Check via Debug Endpoint:
Visit: `https://your-site.vercel.app/api/manual-expenses/debug`

You should see:
```json
{
  "total": { "count": "0" },
  "expenses": []
}
```

---

## Why This Happened

The `manual_expenses` table is new and wasn't included in your original database setup. When you run `npm run db:push` locally, it only affects your local database, not production.

For production, you need to either:
1. Run migrations against the production database (Option 1)
2. Use Vercel's database tools (Option 3)
3. Let the auto-creation happen (Option 2, but less reliable)

---

## Recommended: Use Option 1

It's the safest and most reliable method. The script will:
- Confirm you're targeting the right database
- Check if the table already exists
- Create it if needed
- Test that it works
- Give you clear feedback

Run:
```bash
npx tsx src/scripts/create-manual-expenses-prod.ts
```

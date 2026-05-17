# 🧪 Test Production Manual Expenses

## Wait for Vercel Deployment
First, wait 2-3 minutes for Vercel to finish deploying the latest code.

Check deployment status: https://vercel.com/dashboard

---

## Step 1: Test Database Connection

Open this URL in your browser:
```
https://evangelinas-p.vercel.app/api/test-manual-expenses
```

**Expected Result:**
```json
{
  "success": true,
  "message": "All tests passed!",
  "tests": {
    "connection": { "time": "..." },
    "tableExists": { "exists": true },
    "inserted": { "id": ..., "receiver": "TEST_API", ... },
    "fetched": [...],
    "deleted": [...]
  }
}
```

**If you see an error**, copy the entire error message and share it with me.

---

## Step 2: Check Current Week Data

Open this URL:
```
https://evangelinas-p.vercel.app/api/check-week?weekStart=2026-05-17&weekEnd=2026-05-23
```

**Expected Result:**
```json
{
  "weekStart": "2026-05-17",
  "weekEnd": "2026-05-23",
  "recordsForWeek": [],
  "totalRecordsInDatabase": "2"
}
```

This shows what's actually in the database for the current week.

---

## Step 3: Test Adding an Expense

1. Go to: https://evangelinas-p.vercel.app/source-report
2. Open browser console (F12)
3. Add a manual expense:
   - Amount: 123
   - Comment: "production test"
4. Click "Add expense"

**Check Console Logs:**
Look for:
```
📝 POST /api/manual-expenses - Ensuring table exists...
💾 Inserting expense: { ... }
✅ Expense created: { id: ..., ... }
```

**If you see an error**, copy it and share it.

---

## Step 4: Verify It Was Saved

Refresh this URL:
```
https://evangelinas-p.vercel.app/api/check-week?weekStart=2026-05-17&weekEnd=2026-05-23
```

**Expected Result:**
```json
{
  "recordsForWeek": [
    {
      "id": ...,
      "week_start": "2026-05-17",
      "week_end": "2026-05-23",
      "receiver": "...",
      "amount": 123,
      "comment": "production test"
    }
  ]
}
```

If `recordsForWeek` is still empty, the POST is failing.

---

## Step 5: Test Deleting

1. On the source-report page, click "Remove" on the expense
2. Check browser console for logs
3. Refresh the page

**Check if it's really deleted:**
```
https://evangelinas-p.vercel.app/api/check-week?weekStart=2026-05-17&weekEnd=2026-05-23
```

Should show `recordsForWeek: []`

---

## Common Issues

### Issue 1: Different Database in Production
**Symptom:** Tests pass locally but fail on Vercel

**Solution:** Check Vercel environment variables:
1. Go to Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Verify `DATABASE_URL` matches your .env.local

### Issue 2: Vercel Using Old Code
**Symptom:** No console logs appear

**Solution:** Force redeploy:
1. Go to Vercel Dashboard → Deployments
2. Click the latest deployment → "Redeploy"

### Issue 3: API Route Timeout
**Symptom:** Requests take too long and fail

**Solution:** The `ensureManualExpensesTable()` might be timing out on first call. Try calling the test endpoint first to initialize the table.

---

## What to Share With Me

If it still doesn't work, share:

1. **Output from test endpoint:**
   `https://evangelinas-p.vercel.app/api/test-manual-expenses`

2. **Output from check-week endpoint:**
   `https://evangelinas-p.vercel.app/api/check-week?weekStart=2026-05-17&weekEnd=2026-05-23`

3. **Browser console logs** when adding/removing expenses

4. **Any error messages** you see

This will help me identify exactly what's failing!

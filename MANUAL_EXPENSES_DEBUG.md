# Manual Expenses Debugging Guide

## Problem
Manual expenses are being added but disappear after page refresh. The data is not persisting to the database.

## Changes Made

### 1. Enhanced Logging
Added detailed console logging to track the entire flow:

- **POST /api/manual-expenses**: Logs when table is ensured, what data is received, and what is saved
- **GET /api/manual-expenses/week**: Logs when fetching, what parameters are used, and what is returned
- **ensureManualExpensesTable()**: Logs table creation and index creation

### 2. Debug Endpoints Created

#### `/api/test-db` - Database Connection Test
Tests:
- Database connection
- Whether manual_expenses table exists
- Count of records in the table
- Sample data from the table

**How to use:**
Open in browser: `http://localhost:3000/api/test-db`

#### `/api/manual-expenses/debug` - View All Expenses
Shows:
- Total count of all manual expenses
- Last 50 expenses ordered by creation date

**How to use:**
Open in browser: `http://localhost:3000/api/manual-expenses/debug`

### 3. Cache Busting
Added timestamp parameter to the fetch request to prevent any browser or Next.js caching:
```typescript
const url = `/api/manual-expenses/week?weekStart=${week.startDate}&weekEnd=${week.endDate}&_t=${Date.now()}`;
```

## How to Test

### Step 1: Check Database Connection
1. Open: `http://localhost:3000/api/test-db`
2. You should see:
   - `success: true`
   - `tableExists: true` (or false if table doesn't exist yet)
   - `tableData` with count and sample records

### Step 2: Add a Manual Expense
1. Go to: `http://localhost:3000/source-report`
2. Add a manual expense (e.g., Amount: 100, Comment: "test expense")
3. Click "Add expense"
4. **Check the browser console** (F12) for logs
5. **Check the terminal** where `npm run dev` is running for server logs

### Step 3: Verify Data Was Saved
1. Open: `http://localhost:3000/api/manual-expenses/debug`
2. You should see your expense in the list
3. Note the `week_start` and `week_end` values

### Step 4: Refresh the Page
1. Refresh the source-report page (F5)
2. Check if the expense is still there
3. **Check browser console** for "Fetched expenses:" log
4. **Check terminal** for server logs

## Expected Logs

### When Adding an Expense (Terminal):
```
📝 POST /api/manual-expenses - Ensuring table exists...
✅ Table ensured (or 🔨 Creating manual_expenses table if not exists...)
📦 Received body: { weekStart: '2026-05-17', weekEnd: '2026-05-23', receiver: 'RIEMAR', amount: 100, comment: 'test' }
💾 Inserting expense: { weekStart: '2026-05-17', weekEnd: '2026-05-23', receiver: 'RIEMAR', amount: 100, comment: 'test' }
✅ Expense created: { id: 1, weekStart: '2026-05-17', ... }
```

### When Fetching Expenses (Terminal):
```
📖 GET /api/manual-expenses/week - Ensuring table exists...
✅ Table ensured
🔍 Fetching expenses for: { weekStart: '2026-05-17', weekEnd: '2026-05-23' }
✅ Found 1 expenses: [{ id: 1, weekStart: '2026-05-17', ... }]
```

### Browser Console:
```
Fetching expenses from: /api/manual-expenses/week?weekStart=2026-05-17&weekEnd=2026-05-23&_t=1234567890
Fetched expenses: [{ id: 1, weekStart: '2026-05-17', ... }]
```

## Troubleshooting

### If table doesn't exist:
The `ensureManualExpensesTable()` function should create it automatically on first API call. Check terminal for:
```
🔨 Creating manual_expenses table if not exists...
✅ manual_expenses table created/verified
✅ Index created/verified
```

### If POST returns error:
Check terminal for error details. Common issues:
- Database connection problem
- Missing required fields
- Type conversion error

### If GET returns empty array but POST succeeded:
This could mean:
- Week dates don't match (check the exact values being saved vs fetched)
- Timezone issue
- Query condition problem

Check the debug endpoint to see what's actually in the database.

## Next Steps

After testing, please share:
1. Output from `/api/test-db`
2. Output from `/api/manual-expenses/debug` after adding an expense
3. Browser console logs when adding and fetching
4. Terminal logs from the dev server

This will help identify exactly where the issue is occurring.

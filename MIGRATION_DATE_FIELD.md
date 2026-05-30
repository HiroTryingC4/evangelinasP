# ⚠️ DATABASE MIGRATION REQUIRED - Add Date Field

## Issue
Manual expenses need a specific date field to track when the expense occurred within the week.

## Solution
Run this SQL migration in your Neon SQL Editor:

```sql
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS expense_date TEXT;
```

## What This Does
- Adds an optional `expense_date` column to store the specific date (YYYY-MM-DD format)
- Allows users to select a date within the week when adding manual expenses
- Date picker is restricted to the current week (Sunday to Saturday)
- If no date is selected, defaults to the week start date

## Changes Made
1. ✅ Added date picker input field (restricted to current week)
2. ✅ Updated schema to include `expenseDate` field
3. ✅ Updated API POST to save the selected date
4. ✅ Updated Finances sync to use the specific date
5. ✅ Changed table header from "Week" to "Date"
6. ✅ Table now shows the specific date instead of week range

## After Migration
Once you run the SQL migration:
1. Date picker will appear in the form (between Type and Add button)
2. Users can select any date within the current week
3. The date is restricted to Sunday-Saturday of the selected week
4. Table will show the specific date for each expense
5. Finances entries will use the selected date

## Testing
After running the migration, test by:
1. Adding a manual expense with a specific date
2. Verify the date shows in the table
3. Check Finances to confirm the date is correct
4. Try selecting dates outside the week (should be disabled)

# ⚠️ DATABASE MIGRATION REQUIRED

## Issue
The "Failed to add expense" error occurs because the database doesn't have the `type` column in the `manual_expenses` table yet.

## Solution
You need to run this SQL migration in your Neon SQL Editor:

```sql
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';
```

## What This Does
- Adds a new `type` column to the `manual_expenses` table
- Sets the default value to 'expense' for all existing rows
- Allows new manual expenses to be categorized as:
  - 💰 **Expense** → Goes to Finances > Expenses
  - 👤 **Wage** → Goes to Finances > Wages  
  - 💳 **Bill** → Goes to Finances > Bills

## Changes Made
1. ✅ Updated API to use comment directly (not prefixed with "Manual Weekly")
2. ✅ Fixed DELETE handler to search by comment and type
3. ✅ Fixed PUT handler to search by comment and type
4. ✅ Added type field to ManualExpenseEntry TypeScript type
5. ✅ Edit modal already shows where the expense syncs to

## After Migration
Once you run the SQL migration:
1. Manual expenses will work correctly
2. You can choose between Expense, Wage, or Bill when adding
3. Each type will sync to the correct Finances table
4. The Type column will show color-coded badges:
   - 💰 Expense (purple)
   - 👤 Wage (blue)
   - 💳 Bill (red)

## Testing
After running the migration, test by:
1. Adding a new manual expense (should work)
2. Adding a new manual wage (should work)
3. Adding a new manual bill (should work)
4. Editing an existing entry (should work)
5. Deleting an entry (should work)

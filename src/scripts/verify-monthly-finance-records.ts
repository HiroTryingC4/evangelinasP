import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

function asMonthDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0));
}

async function main() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = asMonthDate(y, m, 1);
  const next = asMonthDate(y, m + 1, 1);

  const bills = await db.execute(sql`
    select description, amount, bill_date, due_date, category
    from bills
    where bill_date >= ${start} and bill_date < ${next}
    order by bill_date, description
  `);

  const expenses = await db.execute(sql`
    select description, amount, expense_date, due_date, category
    from expenses
    where expense_date >= ${start} and expense_date < ${next}
      and description ilike '%netflix%'
    order by expense_date, description
  `);

  const wages = await db.execute(sql`
    select employee_name, amount, pay_date, due_date, notes
    from wages
    where pay_date >= ${start} and pay_date < ${next}
      and employee_name = 'Salary (JJ)'
    order by pay_date
  `);

  console.log("Bills (current month):");
  console.table(bills.rows);
  console.log("Netflix expense (current month):");
  console.table(expenses.rows);
  console.log("Salary (JJ) wage (current month):");
  console.table(wages.rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

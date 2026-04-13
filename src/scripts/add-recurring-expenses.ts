import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, gte, lt } from "drizzle-orm";

type ExpenseSeed = {
  description: string;
  amount: number;
  day: number;
  category: string;
  notes: string;
};

function asMonthDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0));
}

async function seedRecurringExpenses() {
  const { db } = await import("../lib/db");
  const { expenses } = await import("../lib/schema");

  const now = new Date();
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  const monthStart = asMonthDate(year, monthIndex, 1);
  const nextMonthStart = asMonthDate(year, monthIndex + 1, 1);

  const recurring: ExpenseSeed[] = [
    { description: "Amortization - Unit 1118", amount: 18300.26, day: 12, category: "amortization", notes: "Recurring every 12th day of month" },
    { description: "Amortization - Unit 1116", amount: 18300.26, day: 12, category: "amortization", notes: "Recurring every 12th day of month" },
    { description: "Amortization - Unit 1845", amount: 14686.26, day: 12, category: "amortization", notes: "Recurring every 12th day of month" },
    { description: "Amortization - Unit 1558", amount: 17430.5, day: 12, category: "amortization", notes: "Recurring every 12th day of month" },

    { description: "Internet - Total", amount: 1798, day: 30, category: "utilities", notes: "Recurring every 30th day of month" },

    { description: "Assoc Dues - Unit 1118", amount: 979.5, day: 30, category: "association dues", notes: "Recurring every 30th day of month" },
    { description: "Assoc Dues - Unit 1116", amount: 979.5, day: 30, category: "association dues", notes: "Recurring every 30th day of month" },
    { description: "Assoc Dues - Unit 1845", amount: 1036.5, day: 30, category: "association dues", notes: "Recurring every 30th day of month" },
    { description: "Assoc Dues - Unit 1558", amount: 1036.5, day: 30, category: "association dues", notes: "Recurring every 30th day of month" },

    { description: "Electricity - Unit 1118", amount: 4744.09, day: 2, category: "utilities", notes: "Due every 2nd day of month" },
    { description: "Electricity - Unit 1116", amount: 5708.24, day: 2, category: "utilities", notes: "Due every 2nd day of month" },
    { description: "Electricity - Unit 1845", amount: 4200.02, day: 2, category: "utilities", notes: "Due every 2nd day of month" },
    { description: "Electricity - Unit 1558", amount: 4017.25, day: 2, category: "utilities", notes: "Due every 2nd day of month" },

    { description: "Water - Unit 1118", amount: 626.9, day: 20, category: "utilities", notes: "Recurring every 20th day of month" },
    { description: "Water - Unit 1116", amount: 441.5, day: 20, category: "utilities", notes: "Recurring every 20th day of month" },
    { description: "Water - Unit 1845", amount: 534.2, day: 20, category: "utilities", notes: "Recurring every 20th day of month" },
    { description: "Water - Unit 1558", amount: 441.5, day: 20, category: "utilities", notes: "Recurring every 20th day of month" },

    { description: "Salary (JJ)", amount: 18000, day: 30, category: "salary", notes: "Monthly salary total (or 4500 per week)" },
  ];

  const existingForMonth = await db
    .select({ id: expenses.id, description: expenses.description, expenseDate: expenses.expenseDate })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, monthStart), lt(expenses.expenseDate, nextMonthStart)));

  const existingByKey = new Map(
    existingForMonth.map((row) => {
      const date = new Date(row.expenseDate);
      return [`${row.description}__${date.getUTCDate()}`, row.id] as const;
    })
  );

  let inserted = 0;
  let updated = 0;

  for (const item of recurring) {
    const key = `${item.description}__${item.day}`;
    const expenseDate = asMonthDate(year, monthIndex, item.day);

    const existingId = existingByKey.get(key);
    if (existingId) {
      await db
        .update(expenses)
        .set({
          amount: item.amount,
          dueDate: expenseDate,
          category: item.category,
          notes: item.notes,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, existingId));
      updated += 1;
      continue;
    }

    const insertedRow = await db
      .insert(expenses)
      .values({
        description: item.description,
        amount: item.amount,
        expenseDate,
        dueDate: expenseDate,
        category: item.category,
        status: "pending",
        notes: item.notes,
      })
      .returning({ id: expenses.id });

    inserted += 1;
    if (insertedRow[0]) {
      existingByKey.set(key, insertedRow[0].id);
    }
  }

  return { inserted, updated };
}

seedRecurringExpenses()
  .then(({ inserted, updated }) => {
    console.log(`Inserted ${inserted} recurring expenses and updated ${updated} existing records for current month.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed to add recurring expenses:", err);
    process.exit(1);
  });

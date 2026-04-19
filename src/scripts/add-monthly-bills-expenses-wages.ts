import { config } from "dotenv";
import { and, eq, gte, lt } from "drizzle-orm";

config({ path: ".env.local" });

type BillSeed = {
  description: string;
  amount: number;
  day: number;
  category: string;
  notes: string;
};

type ExpenseSeed = {
  description: string;
  amount: number;
  day: number;
  category: string;
  notes: string;
};

type WageSeed = {
  employeeName: string;
  amount: number;
  day: number;
  notes: string;
};

function asMonthDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0));
}

async function main() {
  const { db } = await import("../lib/db");
  const { bills, expenses, wages } = await import("../lib/schema");

  const now = new Date();
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  const monthStart = asMonthDate(year, monthIndex, 1);
  const nextMonthStart = asMonthDate(year, monthIndex + 1, 1);

  const billSeeds: BillSeed[] = [
    { description: "Amortization - Unit 1118", amount: 18300.26, day: 12, category: "amortization", notes: "Every 12th day of month" },
    { description: "Amortization - Unit 1116", amount: 18300.26, day: 12, category: "amortization", notes: "Every 12th day of month" },
    { description: "Amortization - Unit 1845", amount: 14686.26, day: 12, category: "amortization", notes: "Every 12th day of month" },
    { description: "Amortization - Unit 1558", amount: 17430.5, day: 12, category: "amortization", notes: "Every 12th day of month" },

    { description: "Internet - Total", amount: 1798, day: 30, category: "utilities", notes: "Every 30th day of month" },

    { description: "Assoc Dues - Unit 1118", amount: 979.5, day: 30, category: "association dues", notes: "Every 30th day of month" },
    { description: "Assoc Dues - Unit 1116", amount: 979.5, day: 30, category: "association dues", notes: "Every 30th day of month" },
    { description: "Assoc Dues - Unit 1845", amount: 1036.5, day: 30, category: "association dues", notes: "Every 30th day of month" },
    { description: "Assoc Dues - Unit 1558", amount: 1036.5, day: 30, category: "association dues", notes: "Every 30th day of month" },

    { description: "Electricity - Unit 1118", amount: 4744.09, day: 2, category: "utilities", notes: "Due every 2nd day of month" },
    { description: "Electricity - Unit 1116", amount: 5708.24, day: 2, category: "utilities", notes: "Due every 2nd day of month" },
    { description: "Electricity - Unit 1845", amount: 4200.02, day: 2, category: "utilities", notes: "Due every 2nd day of month" },
    { description: "Electricity - Unit 1558", amount: 4017.25, day: 2, category: "utilities", notes: "Due every 2nd day of month" },

    { description: "Water - Unit 1118", amount: 626.9, day: 20, category: "utilities", notes: "Every 20th day of month" },
    { description: "Water - Unit 1116", amount: 441.5, day: 20, category: "utilities", notes: "Every 20th day of month" },
    { description: "Water - Unit 1845", amount: 534.2, day: 20, category: "utilities", notes: "Every 20th day of month" },
    { description: "Water - Unit 1558", amount: 441.5, day: 20, category: "utilities", notes: "Every 20th day of month" },
  ];

  const expenseSeeds: ExpenseSeed[] = [
    {
      description: "Netflix Subscription (279 x 4)",
      amount: 1116,
      day: 30,
      category: "subscription",
      notes: "Monthly Netflix subscription",
    },
  ];

  const wageSeeds: WageSeed[] = [
    {
      employeeName: "Salary (JJ)",
      amount: 18000,
      day: 30,
      notes: "Monthly salary total (or 4500 per week)",
    },
  ];

  const existingBills = await db
    .select({ id: bills.id, description: bills.description, billDate: bills.billDate })
    .from(bills)
    .where(and(gte(bills.billDate, monthStart), lt(bills.billDate, nextMonthStart)));

  const existingExpenses = await db
    .select({ id: expenses.id, description: expenses.description, expenseDate: expenses.expenseDate })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, monthStart), lt(expenses.expenseDate, nextMonthStart)));

  const existingWages = await db
    .select({ id: wages.id, employeeName: wages.employeeName, payDate: wages.payDate })
    .from(wages)
    .where(and(gte(wages.payDate, monthStart), lt(wages.payDate, nextMonthStart)));

  const billKeyToId = new Map(
    existingBills.map((row) => {
      const d = new Date(row.billDate).getUTCDate();
      return [`${row.description}__${d}`, row.id] as const;
    })
  );

  const expenseKeyToId = new Map(
    existingExpenses.map((row) => {
      const d = new Date(row.expenseDate).getUTCDate();
      return [`${row.description}__${d}`, row.id] as const;
    })
  );

  const wageKeyToId = new Map(
    existingWages.map((row) => {
      const d = new Date(row.payDate).getUTCDate();
      return [`${row.employeeName}__${d}`, row.id] as const;
    })
  );

  let insertedBills = 0;
  let updatedBills = 0;
  for (const item of billSeeds) {
    const key = `${item.description}__${item.day}` as const;
    const date = asMonthDate(year, monthIndex, item.day);
    const amountRounded = Math.round(item.amount);
    const existingId = billKeyToId.get(key);

    if (existingId) {
      await db
        .update(bills)
        .set({
          amount: amountRounded,
          billDate: date,
          dueDate: date,
          category: item.category,
          notes: item.notes,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, existingId));
      updatedBills += 1;
    } else {
      await db.insert(bills).values({
        description: item.description,
        amount: amountRounded,
        billDate: date,
        dueDate: date,
        category: item.category,
        notes: item.notes,
        status: "pending",
      });
      insertedBills += 1;
    }
  }

  let insertedExpenses = 0;
  let updatedExpenses = 0;
  for (const item of expenseSeeds) {
    const key = `${item.description}__${item.day}` as const;
    const date = asMonthDate(year, monthIndex, item.day);
    const existingId = expenseKeyToId.get(key);

    if (existingId) {
      await db
        .update(expenses)
        .set({
          amount: item.amount.toFixed(2),
          expenseDate: date,
          dueDate: date,
          category: item.category,
          notes: item.notes,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, existingId));
      updatedExpenses += 1;
    } else {
      await db.insert(expenses).values({
        description: item.description,
        amount: item.amount.toFixed(2),
        expenseDate: date,
        dueDate: date,
        category: item.category,
        notes: item.notes,
        status: "pending",
      });
      insertedExpenses += 1;
    }
  }

  let insertedWages = 0;
  let updatedWages = 0;
  for (const item of wageSeeds) {
    const key = `${item.employeeName}__${item.day}` as const;
    const date = asMonthDate(year, monthIndex, item.day);
    const existingId = wageKeyToId.get(key);

    if (existingId) {
      await db
        .update(wages)
        .set({
          amount: Math.round(item.amount),
          payDate: date,
          dueDate: date,
          notes: item.notes,
          updatedAt: new Date(),
        })
        .where(eq(wages.id, existingId));
      updatedWages += 1;
    } else {
      await db.insert(wages).values({
        employeeName: item.employeeName,
        amount: Math.round(item.amount),
        payDate: date,
        dueDate: date,
        notes: item.notes,
        status: "pending",
      });
      insertedWages += 1;
    }
  }

  console.log(
    `Bills inserted=${insertedBills}, updated=${updatedBills} | Expenses inserted=${insertedExpenses}, updated=${updatedExpenses} | Wages inserted=${insertedWages}, updated=${updatedWages}`
  );
}

main().catch((err) => {
  console.error("Failed to add monthly bills/expenses/wages:", err);
  process.exit(1);
});

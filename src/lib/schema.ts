import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  real,
} from "drizzle-orm/pg-core";

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),

  // Guest info
  guestName:  text("guest_name").notNull(),
  contactNo:  text("contact_no"),

  // Unit & schedule
  unit:         text("unit").notNull(),           // "1116", "1118", etc.
  checkIn:      timestamp("check_in", { mode: "date" }).notNull(),
  checkInTime:  text("check_in_time").notNull().default("2:00 PM"),
  checkOut:     timestamp("check_out", { mode: "date" }).notNull(),
  checkOutTime: text("check_out_time").notNull().default("12:00 PM"),
  hoursStayed:  real("hours_stayed").notNull().default(0),

  // Fees
  totalFee: integer("total_fee").notNull().default(0),

  // Down payment
  dpAmount:     integer("dp_amount").notNull().default(0),
  dpDate:       timestamp("dp_date", { mode: "date" }),
  dpMethod:     text("dp_method"),
  dpReceivedBy: text("dp_received_by"),

  // Full payment
  fpAmount:     integer("fp_amount").notNull().default(0),
  fpDate:       timestamp("fp_date", { mode: "date" }),
  fpMethod:     text("fp_method"),
  fpReceivedBy: text("fp_received_by"),

  // Computed fields (stored for quick querying)
  remainingBalance: integer("remaining_balance").notNull().default(0),
  paymentStatus:    text("payment_status").notNull().default("No DP"),
  hasConflict:      text("has_conflict").notNull().default("OK"),

  // Timestamps
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const unitConfigs = pgTable("unit_configs", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const receiverPersons = pgTable("receiver_persons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  billDate: timestamp("bill_date", { mode: "date" }).notNull(),
  dueDate: timestamp("due_date", { mode: "date" }),
  paidDate: timestamp("paid_date", { mode: "date" }),
  paymentMethod: text("payment_method"), // cash, transfer, gcash, etc.
  status: text("status").notNull().default("pending"), // pending, paid, overdue
  category: text("category"), // utilities, supplies, maintenance, etc.
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const wages = pgTable("wages", {
  id: serial("id").primaryKey(),
  employeeName: text("employee_name").notNull(),
  amount: integer("amount").notNull(),
  payDate: timestamp("pay_date", { mode: "date" }).notNull(),
  dueDate: timestamp("due_date", { mode: "date" }),
  paymentMethod: text("payment_method"), // cash, transfer, gcash, etc.
  status: text("status").notNull().default("pending"), // pending, paid
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  expenseDate: timestamp("expense_date", { mode: "date" }).notNull(),
  dueDate: timestamp("due_date", { mode: "date" }),
  category: text("category"), // supplies, maintenance, utilities, food, etc.
  paymentMethod: text("payment_method"), // cash, check, transfer, etc.
  status: text("status").notNull().default("pending"), // pending, paid
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export type Booking    = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Bill       = typeof bills.$inferSelect;
export type NewBill    = typeof bills.$inferInsert;
export type Wage       = typeof wages.$inferSelect;
export type NewWage    = typeof wages.$inferInsert;
export type Expense    = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

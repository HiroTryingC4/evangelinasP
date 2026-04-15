import { db } from "@/lib/db";
import { bookings, receiverPersons } from "@/lib/schema";
import { and, eq, ne, sql } from "drizzle-orm";

async function main() {
  // Keep bookings on original RIEMAR (not RIEMAR ACCOUNT)
  await db
    .update(bookings)
    .set({ dpReceivedBy: "RIEMAR" })
    .where(eq(bookings.dpReceivedBy, "RIEMAR ACCOUNT"));

  await db
    .update(bookings)
    .set({ fpReceivedBy: "RIEMAR" })
    .where(eq(bookings.fpReceivedBy, "RIEMAR ACCOUNT"));

  // Ensure canonical names for bookings
  await db
    .update(bookings)
    .set({ dpReceivedBy: "RIEMAR" })
    .where(eq(bookings.dpReceivedBy, "REIEMAR"));

  await db
    .update(bookings)
    .set({ fpReceivedBy: "RIEMAR" })
    .where(eq(bookings.fpReceivedBy, "REIEMAR"));

  await db
    .update(bookings)
    .set({ dpReceivedBy: "SIR JAMES" })
    .where(eq(bookings.dpReceivedBy, "SR JAMES"));

  await db
    .update(bookings)
    .set({ fpReceivedBy: "SIR JAMES" })
    .where(eq(bookings.fpReceivedBy, "SR JAMES"));

  await db
    .update(bookings)
    .set({ dpReceivedBy: "SIR MIKE" })
    .where(eq(bookings.dpReceivedBy, "SR MIKE"));

  await db
    .update(bookings)
    .set({ fpReceivedBy: "SIR MIKE" })
    .where(eq(bookings.fpReceivedBy, "SR MIKE"));

  // Ensure receiver list includes these four exact entries
  const required = [
    "SIR JAMES",
    "RIEMAR",
    "SIR MIKE",
    "RIEMAR ACCOUNT",
  ];

  for (const name of required) {
    await db.execute(sql`
      insert into receiver_persons (name, role, sort_order)
      select ${name}, 'employee', 999
      where not exists (
        select 1 from receiver_persons where name = ${name}
      )
    `);
  }

  // Remove trial account if present
  await db.delete(receiverPersons).where(eq(receiverPersons.name, "trial 1 riemar"));

  // Remove unsupported receiver names from receiver_persons list
  await db
    .delete(receiverPersons)
    .where(
      and(
        ne(receiverPersons.name, "SIR JAMES"),
        ne(receiverPersons.name, "RIEMAR"),
        ne(receiverPersons.name, "SIR MIKE"),
        ne(receiverPersons.name, "RIEMAR ACCOUNT")
      )
    );

  const receivers = await db.execute(
    sql`select name from receiver_persons order by name`
  );
  const dp = await db.execute(
    sql`select coalesce(dp_received_by,'') as name, count(*)::int as c from bookings group by coalesce(dp_received_by,'') order by c desc, name`
  );
  const fp = await db.execute(
    sql`select coalesce(fp_received_by,'') as name, count(*)::int as c from bookings group by coalesce(fp_received_by,'') order by c desc, name`
  );

  console.log("receiver_persons:");
  console.table(receivers.rows);
  console.log("bookings.dp_received_by:");
  console.table(dp.rows);
  console.log("bookings.fp_received_by:");
  console.table(fp.rows);
}

main().catch((e) => {
  console.error("Failed enforcing receiver list:", e);
  process.exit(1);
});

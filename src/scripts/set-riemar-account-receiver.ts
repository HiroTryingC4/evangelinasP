import { db } from "@/lib/db";
import { bookings, persons, receiverPersons } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  // Normalize booking receiver labels
  await db
    .update(bookings)
    .set({ dpReceivedBy: "RIEMAR ACCOUNT" })
    .where(eq(bookings.dpReceivedBy, "RIEMAR"));

  await db
    .update(bookings)
    .set({ fpReceivedBy: "RIEMAR ACCOUNT" })
    .where(eq(bookings.fpReceivedBy, "RIEMAR"));

  // Normalize receiver list label
  await db
    .update(receiverPersons)
    .set({ name: "RIEMAR ACCOUNT" })
    .where(eq(receiverPersons.name, "RIEMAR"));

  // Normalize person/account labels used by transfers
  await db
    .update(persons)
    .set({ name: "riemar account" })
    .where(eq(persons.name, "riemar"));

  // Remove accidental duplicate if both rows exist after rename (keep older id)
  await db.execute(sql`
    delete from persons p
    using persons keep
    where p.name = 'riemar account'
      and keep.name = 'riemar account'
      and p.id > keep.id
  `);

  const dpRows = await db.execute(
    sql`select coalesce(dp_received_by,'') as name, count(*)::int as c from bookings group by coalesce(dp_received_by,'') order by c desc, name`
  );
  const fpRows = await db.execute(
    sql`select coalesce(fp_received_by,'') as name, count(*)::int as c from bookings group by coalesce(fp_received_by,'') order by c desc, name`
  );
  const receiverRows = await db.execute(
    sql`select id, name, role from receiver_persons order by name`
  );

  console.log("receiver_persons:");
  console.table(receiverRows.rows);
  console.log("bookings.dp_received_by:");
  console.table(dpRows.rows);
  console.log("bookings.fp_received_by:");
  console.table(fpRows.rows);
}

main().catch((error) => {
  console.error("Failed to set RIEMAR ACCOUNT receiver:", error);
  process.exit(1);
});

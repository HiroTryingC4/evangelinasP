import { db } from "@/lib/db";
import { bookings, persons, receiverPersons } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";

async function getPersonIdByName(name: string) {
  const rows = await db.select().from(persons).where(eq(persons.name, name));
  return rows[0]?.id ?? null;
}

async function getOrCreatePersonId(name: string, type: "sender" | "recipient" = "recipient") {
  const existingId = await getPersonIdByName(name);
  if (existingId) return existingId;
  const inserted = await db
    .insert(persons)
    .values({ name, type, balance: "0.00" })
    .returning({ id: persons.id });
  return inserted[0].id;
}

async function getReceiverIdByName(name: string) {
  const rows = await db.select().from(receiverPersons).where(eq(receiverPersons.name, name));
  return rows[0]?.id ?? null;
}

async function main() {
  console.log("Merging receiver aliases...");

  // 1) Bookings aliases -> canonical labels
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
    .set({ dpReceivedBy: "RIEMAR" })
    .where(sql`${bookings.dpReceivedBy} in ('REIEMAR', 'REIMAR')`);

  await db
    .update(bookings)
    .set({ fpReceivedBy: "RIEMAR" })
    .where(sql`${bookings.fpReceivedBy} in ('REIEMAR', 'REIMAR')`);

  await db
    .update(bookings)
    .set({ dpReceivedBy: "SIR MILE" })
    .where(sql`${bookings.dpReceivedBy} in ('SR MIKE', 'SIR MIKE', 'sir mike')`);

  await db
    .update(bookings)
    .set({ fpReceivedBy: "SIR MILE" })
    .where(sql`${bookings.fpReceivedBy} in ('SR MIKE', 'SIR MIKE', 'sir mike')`);

  // 2) receiver_persons canonical labels
  const sirJamesId = await getReceiverIdByName("SIR JAMES");
  const srJamesId = await getReceiverIdByName("SR JAMES");
  if (!sirJamesId && srJamesId) {
    await db.update(receiverPersons).set({ name: "SIR JAMES" }).where(eq(receiverPersons.id, srJamesId));
  } else if (sirJamesId && srJamesId) {
    await db.delete(receiverPersons).where(eq(receiverPersons.id, srJamesId));
  }

  const riemarId = await getReceiverIdByName("RIEMAR");
  const reiemarId = await getReceiverIdByName("REIEMAR");
  const reimarId = await getReceiverIdByName("REIMAR");
  if (!riemarId && reiemarId) {
    await db.update(receiverPersons).set({ name: "RIEMAR" }).where(eq(receiverPersons.id, reiemarId));
  }
  if (!riemarId && reimarId) {
    await db.update(receiverPersons).set({ name: "RIEMAR" }).where(eq(receiverPersons.id, reimarId));
  }
  const riemarIdNow = await getReceiverIdByName("RIEMAR");
  const reiemarIdNow = await getReceiverIdByName("REIEMAR");
  const reimarIdNow = await getReceiverIdByName("REIMAR");
  if (riemarIdNow && reiemarIdNow && riemarIdNow !== reiemarIdNow) {
    await db.delete(receiverPersons).where(eq(receiverPersons.id, reiemarIdNow));
  }
  if (riemarIdNow && reimarIdNow && riemarIdNow !== reimarIdNow) {
    await db.delete(receiverPersons).where(eq(receiverPersons.id, reimarIdNow));
  }

  const sirMileId = await getReceiverIdByName("SIR MILE");
  const sirMikeId = await getReceiverIdByName("SIR MIKE");
  const srMikeId = await getReceiverIdByName("SR MIKE");
  if (!sirMileId && sirMikeId) {
    await db.update(receiverPersons).set({ name: "SIR MILE" }).where(eq(receiverPersons.id, sirMikeId));
  }
  const sirMileIdNow = await getReceiverIdByName("SIR MILE");
  const sirMikeIdNow = await getReceiverIdByName("SIR MIKE");
  const srMikeIdNow = await getReceiverIdByName("SR MIKE");
  if (sirMileIdNow && sirMikeIdNow && sirMileIdNow !== sirMikeIdNow) {
    await db.delete(receiverPersons).where(eq(receiverPersons.id, sirMikeIdNow));
  }
  if (sirMileIdNow && srMikeIdNow && sirMileIdNow !== srMikeIdNow) {
    await db.delete(receiverPersons).where(eq(receiverPersons.id, srMikeIdNow));
  }

  // Remove trial account from receiver list
  await db.delete(receiverPersons).where(eq(receiverPersons.name, "trial 1 riemar"));

  // 3) persons table canonical labels (lowercase in this table)
  const canonicalRiemarId = await getOrCreatePersonId("riemar");
  const canonicalSirJamesId = await getOrCreatePersonId("sir james");
  const canonicalSirMileId = await getOrCreatePersonId("sir mile");

  const aliasToCanonical: Array<{ alias: string; canonicalId: number }> = [
    { alias: "reiemar", canonicalId: canonicalRiemarId },
    { alias: "reimar", canonicalId: canonicalRiemarId },
    { alias: "trial 1 riemar", canonicalId: canonicalRiemarId },
    { alias: "sr james", canonicalId: canonicalSirJamesId },
    { alias: "sr mike", canonicalId: canonicalSirMileId },
    { alias: "sir mike", canonicalId: canonicalSirMileId },
  ];

  for (const row of aliasToCanonical) {
    const aliasId = await getPersonIdByName(row.alias);
    if (!aliasId || aliasId === row.canonicalId) continue;

    await db.delete(persons).where(eq(persons.id, aliasId));
  }

  // Remove trial person if still present
  await db.delete(persons).where(eq(persons.name, "trial 1 riemar"));

  // 4) Verify current canonical names
  const receiverRows = await db.execute(
    sql`select id, name, role from receiver_persons order by name`
  );
  const dpRows = await db.execute(
    sql`select coalesce(dp_received_by,'') as name, count(*)::int as c from bookings group by coalesce(dp_received_by,'') order by c desc, name`
  );
  const fpRows = await db.execute(
    sql`select coalesce(fp_received_by,'') as name, count(*)::int as c from bookings group by coalesce(fp_received_by,'') order by c desc, name`
  );

  console.log("\nreceiver_persons after merge:");
  console.table(receiverRows.rows);
  console.log("bookings.dp_received_by after merge:");
  console.table(dpRows.rows);
  console.log("bookings.fp_received_by after merge:");
  console.table(fpRows.rows);

  console.log("\nDone. Aliases merged and trial account removed.");
}

main().catch((err) => {
  console.error("Merge failed:", err);
  process.exit(1);
});

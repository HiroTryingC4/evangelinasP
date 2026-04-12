import { toYMD } from "@/lib/utils";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const [{ eq }, { db }, { bookings }] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db"),
    import("@/lib/schema"),
  ]);

  const rows = await db
    .select({
      id: bookings.id,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      checkInDateKey: bookings.checkInDateKey,
      checkOutDateKey: bookings.checkOutDateKey,
    })
    .from(bookings);

  let updatedCount = 0;

  for (const row of rows) {
    const checkInDateKey = toYMD(row.checkIn);
    const checkOutDateKey = toYMD(row.checkOut);

    if (row.checkInDateKey === checkInDateKey && row.checkOutDateKey === checkOutDateKey) {
      continue;
    }

    await db
      .update(bookings)
      .set({ checkInDateKey, checkOutDateKey })
      .where(eq(bookings.id, row.id));

    updatedCount += 1;
  }

  console.log(`Backfill complete: ${updatedCount} row(s) updated out of ${rows.length}.`);
}

main().catch((error) => {
  console.error("Failed to backfill booking date keys", error);
  process.exit(1);
});

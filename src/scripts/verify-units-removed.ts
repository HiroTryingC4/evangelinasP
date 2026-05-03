import { db } from "@/lib/db";
import { bookings, unitConfigs } from "@/lib/schema";
import { eq, or } from "drizzle-orm";

async function main() {
  console.log("Verifying units 1245, 2208, and 2209 are removed...\n");

  // Check bookings
  const remainingBookings = await db
    .select()
    .from(bookings)
    .where(
      or(
        eq(bookings.unit, "1245"),
        eq(bookings.unit, "2208"),
        eq(bookings.unit, "2209")
      )
    );

  console.log(`Bookings for removed units: ${remainingBookings.length}`);
  if (remainingBookings.length > 0) {
    console.log("Found bookings:");
    remainingBookings.forEach((b) => {
      console.log(`  - ${b.guestName} (Unit ${b.unit})`);
    });
  }

  // Check unit configs
  const unitConfigsData = await db.select().from(unitConfigs);
  console.log(`\nUnit configs in database:`);
  unitConfigsData.forEach((u) => {
    console.log(`  - ${u.code}`);
  });

  // Check all unique units in bookings
  const allBookings = await db.select().from(bookings);
  const uniqueUnits = Array.from(
    new Set(allBookings.map((b) => String(b.unit).replace(/^Unit\s*/i, "").trim()))
  ).sort();
  
  console.log(`\nAll unique units in bookings table:`);
  uniqueUnits.forEach((u) => {
    const count = allBookings.filter(
      (b) => String(b.unit).replace(/^Unit\s*/i, "").trim() === u
    ).length;
    console.log(`  - ${u}: ${count} bookings`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });

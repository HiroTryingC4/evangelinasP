import { config } from "dotenv";

// Load environment variables FIRST before any other imports
config({ path: ".env.local" });

import { db } from "../lib/db";
import { bookings } from "../lib/schema";

async function verifyMigration() {
  console.log("Verifying booking source migration...\n");

  try {
    const allBookings = await db.select().from(bookings);
    
    // Group by booking source
    const sourceCount: Record<string, number> = {};
    
    allBookings.forEach(booking => {
      const source = booking.bookingSource || "NULL";
      sourceCount[source] = (sourceCount[source] || 0) + 1;
    });

    console.log("Current booking sources in database:");
    Object.entries(sourceCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count} bookings`);
      });

    console.log(`\nTotal bookings: ${allBookings.length}`);

    // Show a few sample bookings
    console.log("\nSample bookings:");
    allBookings.slice(0, 5).forEach(b => {
      console.log(`  ID ${b.id}: ${b.guestName} - Source: "${b.bookingSource}"`);
    });

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

verifyMigration()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });

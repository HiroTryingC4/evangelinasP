import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";

async function checkMay4Payments() {
  console.log("Checking May 4, 2026 bookings for SIR JAMES...\n");

  const may4Bookings = await db
    .select()
    .from(bookings)
    .where(
      and(
        gte(bookings.checkIn, new Date("2026-05-04T00:00:00")),
        lte(bookings.checkIn, new Date("2026-05-04T23:59:59"))
      )
    );

  console.log(`Found ${may4Bookings.length} bookings on May 4, 2026:\n`);

  for (const booking of may4Bookings) {
    console.log(`Booking ID: ${booking.id}`);
    console.log(`Guest: ${booking.guestName}`);
    console.log(`Unit: ${booking.unit}`);
    console.log(`Booked by: ${booking.bookingSource}`);
    console.log(`Platform: ${booking.bookingPlatform}`);
    console.log(`Total Fee: ₱${booking.totalFee}`);
    console.log(`\nDeposit Payment:`);
    console.log(`  - Amount: ₱${booking.dpAmount}`);
    console.log(`  - Method: ${booking.dpMethod}`);
    console.log(`  - Received by: ${booking.dpReceivedBy}`);
    console.log(`\nFull Payment:`);
    console.log(`  - Amount: ₱${booking.fpAmount}`);
    console.log(`  - Method: ${booking.fpMethod}`);
    console.log(`  - Received by: ${booking.fpReceivedBy}`);
    console.log(`\nPayment Status: ${booking.paymentStatus}`);
    console.log(`Remaining Balance: ₱${booking.remainingBalance}`);
    console.log("\n" + "=".repeat(60) + "\n");
  }

  // Filter for SIR JAMES payments
  const jamesBookings = may4Bookings.filter(
    (b) => b.dpReceivedBy === "SIR JAMES" || b.fpReceivedBy === "SIR JAMES"
  );

  console.log(`\nBookings where SIR JAMES received payment: ${jamesBookings.length}\n`);

  let totalCash = 0;
  let totalGCash = 0;
  let totalBank = 0;

  for (const booking of jamesBookings) {
    if (booking.dpReceivedBy === "SIR JAMES") {
      const method = (booking.dpMethod || "").toLowerCase();
      if (method === "cash") totalCash += booking.dpAmount || 0;
      else if (method === "gcash") totalGCash += booking.dpAmount || 0;
      else if (method === "bank transfer") totalBank += booking.dpAmount || 0;
    }

    if (booking.fpReceivedBy === "SIR JAMES") {
      const method = (booking.fpMethod || "").toLowerCase();
      if (method === "cash") totalCash += booking.fpAmount || 0;
      else if (method === "gcash") totalGCash += booking.fpAmount || 0;
      else if (method === "bank transfer") totalBank += booking.fpAmount || 0;
    }
  }

  console.log("\nSIR JAMES Payment Totals for May 4:");
  console.log(`Cash: ₱${totalCash}`);
  console.log(`GCash: ₱${totalGCash}`);
  console.log(`Bank Transfer: ₱${totalBank}`);
  console.log(`Total: ₱${totalCash + totalGCash + totalBank}`);
}

checkMay4Payments()
  .then(() => {
    console.log("\n✅ Check complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });

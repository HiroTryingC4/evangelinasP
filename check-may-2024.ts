import { db } from "./src/lib/db";
import { bookings } from "./src/lib/schema";
import { sql } from "drizzle-orm";

function getCollectedForBooking(booking: any): number {
  return (booking.dpAmount || 0) + (booking.fpAmount || 0) + (booking.apAmount || 0);
}

async function checkMay2024() {
  console.log("🔍 Checking May 2024 bookings specifically...\n");

  const may2024Bookings = await db
    .select()
    .from(bookings)
    .where(
      sql`EXTRACT(MONTH FROM ${bookings.checkIn}) = 5 
          AND EXTRACT(YEAR FROM ${bookings.checkIn}) = 2024`
    )
    .orderBy(bookings.checkIn);

  if (may2024Bookings.length === 0) {
    console.log("✅ No bookings found in May 2024");
    return;
  }

  console.log(`Found ${may2024Bookings.length} booking(s) in May 2024:\n`);

  let totalRevenue = 0;
  let totalIncoming = 0;
  let totalWaiting = 0;

  may2024Bookings.forEach((booking, index) => {
    const collected = getCollectedForBooking(booking);
    const waiting = Math.max(0, booking.totalFee - collected);
    
    totalRevenue += booking.totalFee;
    totalIncoming += collected;
    totalWaiting += waiting;

    if (waiting > 0) {
      console.log(`${index + 1}. Guest: ${booking.guestName}`);
      console.log(`   Unit: ${booking.unit}`);
      console.log(`   Check-in: ${booking.checkIn.toLocaleDateString()}`);
      console.log(`   Total Fee: ₱${booking.totalFee.toLocaleString()}`);
      console.log(`   Collected: ₱${collected.toLocaleString()}`);
      console.log(`   Waiting: ₱${waiting.toLocaleString()}`);
      console.log(`   Booking Source: ${booking.bookingSource}`);
      console.log("");
    }
  });

  console.log(`\n📊 May 2024 Summary:`);
  console.log(`   Total Revenue: ₱${totalRevenue.toLocaleString()}`);
  console.log(`   Incoming Payment: ₱${totalIncoming.toLocaleString()}`);
  console.log(`   Waiting Payment: ₱${totalWaiting.toLocaleString()}`);
  console.log(`   Total Bookings: ${may2024Bookings.length}`);
}

checkMay2024()
  .then(() => {
    console.log("\n✅ Check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

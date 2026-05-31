import { db } from "./src/lib/db";
import { bookings } from "./src/lib/schema";
import { sql } from "drizzle-orm";

function getCollectedForBooking(booking: any): number {
  return (booking.dpAmount || 0) + (booking.fpAmount || 0) + (booking.apAmount || 0);
}

async function checkMayWaiting() {
  console.log("🔍 Checking May bookings (all years) for waiting payment...\n");

  // Query all bookings with check-in in May (any year)
  const mayBookings = await db
    .select()
    .from(bookings)
    .where(sql`EXTRACT(MONTH FROM ${bookings.checkIn}) = 5`)
    .orderBy(bookings.checkIn);

  if (mayBookings.length === 0) {
    console.log("✅ No bookings found in May");
    return;
  }

  console.log(`Found ${mayBookings.length} booking(s) in May:\n`);

  let totalRevenue = 0;
  let totalIncoming = 0;
  let totalWaiting = 0;

  mayBookings.forEach((booking, index) => {
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
      console.log(`   Collected: ₱${collected.toLocaleString()} (DP: ₱${booking.dpAmount}, FP: ₱${booking.fpAmount}${booking.apAmount ? `, AP: ₱${booking.apAmount}` : ''})`);
      console.log(`   Waiting: ₱${waiting.toLocaleString()}`);
      console.log(`   Payment Status: ${booking.paymentStatus}`);
      console.log(`   Booking Source: ${booking.bookingSource}`);
      console.log("");
    }
  });

  console.log(`\n📊 May Summary:`);
  console.log(`   Total Revenue: ₱${totalRevenue.toLocaleString()}`);
  console.log(`   Incoming Payment (Collected): ₱${totalIncoming.toLocaleString()}`);
  console.log(`   Waiting Payment: ₱${totalWaiting.toLocaleString()}`);
  console.log(`\n   Total Bookings: ${mayBookings.length}`);
}

checkMayWaiting()
  .then(() => {
    console.log("\n✅ Check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

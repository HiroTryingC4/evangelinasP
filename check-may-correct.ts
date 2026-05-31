import { db } from "./src/lib/db";
import { bookings } from "./src/lib/schema";
import { sql } from "drizzle-orm";

function getCollectedForBooking(booking: any): number {
  return (booking.dpAmount || 0) + (booking.fpAmount || 0) + (booking.apAmount || 0);
}

async function checkMayCorrect() {
  console.log("🔍 Checking ONLY May bookings (month 5, not month 6)...\n");

  // Get all bookings
  const allBookings = await db.select().from(bookings);
  
  // Filter for May check-ins (month index 4 in JavaScript Date)
  const mayBookings = allBookings.filter(booking => {
    const checkInDate = new Date(booking.checkIn);
    const month = checkInDate.getMonth(); // 0-indexed: 0=Jan, 4=May, 5=June
    console.log(`Booking ${booking.guestName}: Check-in ${checkInDate.toLocaleDateString()}, Month index: ${month}`);
    return month === 4; // May is month index 4
  });

  console.log(`\n✅ Found ${mayBookings.length} booking(s) with check-in in May:\n`);

  if (mayBookings.length === 0) {
    console.log("No May bookings found");
    return;
  }

  let totalRevenue = 0;
  let totalIncoming = 0;
  let totalWaiting = 0;

  mayBookings.forEach((booking, index) => {
    const collected = getCollectedForBooking(booking);
    const waiting = Math.max(0, booking.totalFee - collected);
    
    totalRevenue += booking.totalFee;
    totalIncoming += collected;
    totalWaiting += waiting;

    console.log(`${index + 1}. Guest: ${booking.guestName}`);
    console.log(`   Unit: ${booking.unit}`);
    console.log(`   Check-in: ${booking.checkIn.toLocaleDateString()}`);
    console.log(`   Total Fee: ₱${booking.totalFee.toLocaleString()}`);
    console.log(`   Collected: ₱${collected.toLocaleString()}`);
    console.log(`   Waiting: ₱${waiting.toLocaleString()}`);
    console.log(`   Payment Status: ${booking.paymentStatus}`);
    console.log(`   Booking Source: ${booking.bookingSource}`);
    console.log("");
  });

  console.log(`\n📊 May Summary:`);
  console.log(`   Total Revenue: ₱${totalRevenue.toLocaleString()}`);
  console.log(`   Incoming Payment: ₱${totalIncoming.toLocaleString()}`);
  console.log(`   Waiting Payment: ₱${totalWaiting.toLocaleString()}`);
  console.log(`   Total Bookings: ${mayBookings.length}`);
}

checkMayCorrect()
  .then(() => {
    console.log("\n✅ Check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

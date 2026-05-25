import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq, and, or, gte, lte } from "drizzle-orm";

async function validateJayjay() {
  try {
    const startDate = new Date("2026-05-17");
    const endDate = new Date("2026-05-23");

    // Query for Jayjay bookings that week
    const result = await db
      .select({
        id: bookings.id,
        guestName: bookings.guestName,
        unit: bookings.unit,
        bookingPlatform: bookings.bookingPlatform,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        totalFee: bookings.totalFee,
        dpMethod: bookings.dpMethod,
        dpAmount: bookings.dpAmount,
        dpDate: bookings.dpDate,
        dpReceivedBy: bookings.dpReceivedBy,
        fpMethod: bookings.fpMethod,
        fpAmount: bookings.fpAmount,
        fpDate: bookings.fpDate,
        fpReceivedBy: bookings.fpReceivedBy,
        apMethod: bookings.apMethod,
        apAmount: bookings.apAmount,
        apDate: bookings.apDate,
        apReceivedBy: bookings.apReceivedBy,
      })
      .from(bookings)
      .where(
        and(
          // Match Jayjay
          or(
            eq(bookings.guestName, "Jayjay"),
            eq(bookings.guestName, "JAYJAY"),
            eq(bookings.guestName, "jayjay")
          ),
          // During May 17-23 week
          or(
            and(gte(bookings.checkIn, startDate), lte(bookings.checkIn, endDate)),
            and(gte(bookings.dpDate, startDate), lte(bookings.dpDate, endDate)),
            and(gte(bookings.fpDate, startDate), lte(bookings.fpDate, endDate))
          )
        )
      );

    console.log("Jayjay Booking Records (May 17-23, 2026):");
    console.log("========================================");

    let totalCash = 0;
    let totalAllPayments = 0;

    result.forEach((booking) => {
      console.log(`\nBooking ID: ${booking.id}`);
      console.log(`Guest: ${booking.guestName}`);
      console.log(`Unit: ${booking.unit}`);
      console.log(`Platform: ${booking.bookingPlatform}`);
      console.log(`Total Fee: ₱${booking.totalFee}`);
      console.log(`Check-in: ${booking.checkIn}`);
      console.log(`Check-out: ${booking.checkOut}`);
      console.log("---");

      // DP details
      if (booking.dpAmount) {
        console.log(`  DP: ₱${booking.dpAmount} (${booking.dpMethod}) - ${booking.dpDate} - Received by: ${booking.dpReceivedBy}`);
        totalAllPayments += booking.dpAmount;
        if (booking.dpMethod?.toLowerCase() === "cash") {
          totalCash += booking.dpAmount;
        }
      }

      // FP details
      if (booking.fpAmount) {
        console.log(`  FP: ₱${booking.fpAmount} (${booking.fpMethod}) - ${booking.fpDate} - Received by: ${booking.fpReceivedBy}`);
        totalAllPayments += booking.fpAmount;
        if (booking.fpMethod?.toLowerCase() === "cash") {
          totalCash += booking.fpAmount;
        }
      }

      // AP details
      if (booking.apAmount) {
        console.log(`  AP: ₱${booking.apAmount} (${booking.apMethod}) - ${booking.apDate} - Received by: ${booking.apReceivedBy}`);
        totalAllPayments += booking.apAmount;
        if (booking.apMethod?.toLowerCase() === "cash") {
          totalCash += booking.apAmount;
        }
      }
    });

    console.log("\n========================================");
    console.log(`Total Bookings Found: ${result.length}`);
    console.log(`Total Cash Payments: ₱${totalCash}`);
    console.log(`Total All Payments: ₱${totalAllPayments}`);
    console.log("========================================\n");

    if (result.length === 0) {
      console.log("❌ No bookings found for Jayjay during May 17-23!");
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

validateJayjay();

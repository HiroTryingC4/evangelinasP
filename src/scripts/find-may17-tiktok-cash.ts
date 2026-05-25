import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq, and, or, gte, lte } from "drizzle-orm";

async function findTikTokCashBookings() {
  try {
    const startDate = new Date("2026-05-17");
    const endDate = new Date("2026-05-23");

    // Query for bookings that had cash payments during the week
    const result = await db
      .select({
        id: bookings.id,
        guestName: bookings.guestName,
        bookingPlatform: bookings.bookingPlatform,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
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
          eq(bookings.bookingPlatform, "TikTok"),
          or(
            // Cash received by RIEMAR during the week
            and(
              eq(bookings.dpReceivedBy, "RIEMAR"),
              eq(bookings.dpMethod, "cash"),
              gte(bookings.dpDate, startDate),
              lte(bookings.dpDate, endDate)
            ),
            and(
              eq(bookings.fpReceivedBy, "RIEMAR"),
              eq(bookings.fpMethod, "cash"),
              gte(bookings.fpDate, startDate),
              lte(bookings.fpDate, endDate)
            ),
            and(
              eq(bookings.apReceivedBy, "RIEMAR"),
              eq(bookings.apMethod, "cash"),
              gte(bookings.apDate, startDate),
              lte(bookings.apDate, endDate)
            )
          )
        )
      );

    console.log("TikTok Cash Bookings for RIEMAR (May 17-23, 2026):");
    console.log("========================================");

    result.forEach((booking) => {
      console.log(`\nGuest: ${booking.guestName}`);
      console.log(`Booking ID: ${booking.id}`);
      console.log(`Platform: ${booking.bookingPlatform}`);
      console.log(`Check-in: ${booking.checkIn}`);
      console.log(`Check-out: ${booking.checkOut}`);

      // Check down payment
      if (booking.dpReceivedBy === "RIEMAR" && booking.dpMethod === "cash") {
        console.log(`  - DP Cash: ₱${booking.dpAmount} (${booking.dpDate})`);
      }

      // Check full payment
      if (booking.fpReceivedBy === "RIEMAR" && booking.fpMethod === "cash") {
        console.log(`  - FP Cash: ₱${booking.fpAmount} (${booking.fpDate})`);
      }

      // Check additional payment
      if (booking.apReceivedBy === "RIEMAR" && booking.apMethod === "cash") {
        console.log(`  - AP Cash: ₱${booking.apAmount} (${booking.apDate})`);
      }
    });

    console.log("\n========================================");
    console.log(`Total bookings found: ${result.length}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

findTikTokCashBookings();

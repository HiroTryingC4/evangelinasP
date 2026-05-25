import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { and, or, gte, lte } from "drizzle-orm";

async function findRIEMARCash() {
  try {
    const startDate = new Date("2026-05-17");
    const endDate = new Date("2026-05-23");

    // Query for cash payments received by RIEMAR during the week
    const result = await db
      .select({
        id: bookings.id,
        guestName: bookings.guestName,
        unit: bookings.unit,
        bookingPlatform: bookings.bookingPlatform,
        checkIn: bookings.checkIn,
        checkInDateKey: bookings.checkInDateKey,
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
          or(
            // Cash DP received by RIEMAR during the week
            and(
              or(
                bookings.dpReceivedBy ? true : false,
                bookings.dpReceivedBy !== null
              ),
              bookings.dpMethod ? true : false,
              gte(bookings.dpDate, startDate),
              lte(bookings.dpDate, endDate)
            ),
            // Cash FP received by RIEMAR during the week
            and(
              or(
                bookings.fpReceivedBy ? true : false,
                bookings.fpReceivedBy !== null
              ),
              bookings.fpMethod ? true : false,
              gte(bookings.fpDate, startDate),
              lte(bookings.fpDate, endDate)
            ),
            // Cash AP received by RIEMAR during the week
            and(
              or(
                bookings.apReceivedBy ? true : false,
                bookings.apReceivedBy !== null
              ),
              bookings.apMethod ? true : false,
              gte(bookings.apDate, startDate),
              lte(bookings.apDate, endDate)
            )
          )
        )
      );

    console.log("RIEMAR Cash Payments (May 17-23, 2026):");
    console.log("========================================\n");

    let totalCash = 0;

    result.forEach((booking) => {
      console.log(`Guest: ${booking.guestName} | Unit: ${booking.unit} | Platform: ${booking.bookingPlatform}`);
      console.log(`Check-in: ${booking.checkInDateKey || booking.checkIn}`);
      
      // Check DP
      if (booking.dpReceivedBy?.toUpperCase() === "RIEMAR" && booking.dpMethod?.toLowerCase() === "cash" && booking.dpAmount) {
        console.log(`  ✓ DP Cash: ₱${booking.dpAmount} (${booking.dpDate})`);
        totalCash += booking.dpAmount;
      }

      // Check FP
      if (booking.fpReceivedBy?.toUpperCase() === "RIEMAR" && booking.fpMethod?.toLowerCase() === "cash" && booking.fpAmount) {
        console.log(`  ✓ FP Cash: ₱${booking.fpAmount} (${booking.fpDate})`);
        totalCash += booking.fpAmount;
      }

      // Check AP
      if (booking.apReceivedBy?.toUpperCase() === "RIEMAR" && booking.apMethod?.toLowerCase() === "cash" && booking.apAmount) {
        console.log(`  ✓ AP Cash: ₱${booking.apAmount} (${booking.apDate})`);
        totalCash += booking.apAmount;
      }

      console.log("");
    });

    console.log("========================================");
    console.log(`Total RIEMAR Cash Received: ₱${totalCash}`);
    console.log("========================================\n");

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

findRIEMARCash();

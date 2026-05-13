import { db } from "../lib/db";
import { bookings } from "../lib/schema";
import { toYMD, normalizeBookingSource } from "../lib/utils";

async function checkTikTokReceivers() {
  console.log("Checking TikTok bookings for week 04/27/2026...\n");

  const allBookings = await db.select().from(bookings);

  // Filter for the week of 04/27/2026 (Sunday) to 05/03/2026 (Saturday)
  const weekStart = "2026-04-26"; // Sunday
  const weekEnd = "2026-05-02";   // Saturday

  const weekBookings = allBookings.filter((b) => {
    const checkInKey = b.checkInDateKey || toYMD(b.checkIn);
    return checkInKey >= weekStart && checkInKey <= weekEnd;
  });

  // Filter for core units only
  const coreUnits = new Set(["1116", "1118", "1558", "1845"]);
  const coreBookings = weekBookings.filter((b) => {
    const unit = String(b.unit || "").replace(/^Unit\s*/i, "").trim();
    return coreUnits.has(unit);
  });

  // Filter for TikTok bookings
  const tiktokBookings = coreBookings.filter((b) => {
    const source = normalizeBookingSource(b.bookingSource);
    return source === "TikTok";
  });

  console.log(`Total TikTok bookings in this week: ${tiktokBookings.length}\n`);

  // Check which ones have RIEMAR as receiver
  const riemarBookings = tiktokBookings.filter((b) => {
    const dpReceiver = String(b.dpReceivedBy ?? "").trim().toLowerCase();
    const fpReceiver = String(b.fpReceivedBy ?? "").trim().toLowerCase();
    return dpReceiver === "riemar" || fpReceiver === "riemar";
  });

  console.log(`TikTok bookings with RIEMAR as receiver: ${riemarBookings.length}\n`);

  // Find the missing one(s)
  const missingFromRiemar = tiktokBookings.filter((b) => {
    const dpReceiver = String(b.dpReceivedBy ?? "").trim().toLowerCase();
    const fpReceiver = String(b.fpReceivedBy ?? "").trim().toLowerCase();
    return dpReceiver !== "riemar" && fpReceiver !== "riemar";
  });

  if (missingFromRiemar.length > 0) {
    console.log(`TikTok bookings NOT received by RIEMAR:\n`);
    missingFromRiemar.forEach((b) => {
      console.log(`  Guest: ${b.guestName}`);
      console.log(`  Unit: ${b.unit}`);
      console.log(`  Check-in: ${b.checkInDateKey || toYMD(b.checkIn)}`);
      console.log(`  Total Fee: ₱${b.totalFee}`);
      console.log(`  DP Receiver: ${b.dpReceivedBy || "N/A"}`);
      console.log(`  FP Receiver: ${b.fpReceivedBy || "N/A"}`);
      console.log(`  Payment Status: ${b.paymentStatus}`);
      console.log("");
    });
  } else {
    console.log("All TikTok bookings have RIEMAR as a receiver.");
  }

  // Show all TikTok bookings with their receivers
  console.log("\nAll TikTok bookings with receiver details:");
  tiktokBookings.forEach((b) => {
    console.log(`${b.guestName} (${b.unit}) - DP: ${b.dpReceivedBy || "N/A"}, FP: ${b.fpReceivedBy || "N/A"}`);
  });
}

checkTikTokReceivers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

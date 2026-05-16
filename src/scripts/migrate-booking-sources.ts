import { config } from "dotenv";

// Load environment variables FIRST before any other imports
config({ path: ".env.local" });

import { db } from "../lib/db";
import { bookings } from "../lib/schema";
import { eq, or } from "drizzle-orm";

async function migrateBookingSources() {
  console.log("Migrating booking sources from platforms to people...");

  try {
    // Get all bookings
    const allBookings = await db.select().from(bookings);
    console.log(`Found ${allBookings.length} total bookings`);

    let tiktokCount = 0;
    let airbnbCount = 0;
    let facebookCount = 0;
    let directCount = 0;

    // Update TikTok bookings to RIEMAR
    const tiktokBookings = allBookings.filter(b => 
      String(b.bookingSource || "").toLowerCase().includes("tiktok") ||
      String(b.bookingSource || "").toLowerCase().includes("tik tok")
    );
    
    for (const booking of tiktokBookings) {
      await db
        .update(bookings)
        .set({ bookingSource: "RIEMAR" })
        .where(eq(bookings.id, booking.id));
      tiktokCount++;
    }

    // Update Airbnb bookings to SIR JAMES
    const airbnbBookings = allBookings.filter(b => 
      String(b.bookingSource || "").toLowerCase().includes("airbnb") ||
      String(b.bookingSource || "").toLowerCase().includes("air bnb")
    );
    
    for (const booking of airbnbBookings) {
      await db
        .update(bookings)
        .set({ bookingSource: "SIR JAMES" })
        .where(eq(bookings.id, booking.id));
      airbnbCount++;
    }

    // Update Facebook bookings to SIR MIKE (you can change this)
    const facebookBookings = allBookings.filter(b => 
      String(b.bookingSource || "").toLowerCase().includes("facebook") ||
      String(b.bookingSource || "").toLowerCase() === "fb"
    );
    
    for (const booking of facebookBookings) {
      await db
        .update(bookings)
        .set({ bookingSource: "SIR MIKE" })
        .where(eq(bookings.id, booking.id));
      facebookCount++;
    }

    // Update Direct bookings to RIEMAR (you can change this)
    const directBookings = allBookings.filter(b => {
      const source = String(b.bookingSource || "").toLowerCase();
      return source === "direct" || source === "walk-in" || source === "walk in" || source === "";
    });
    
    for (const booking of directBookings) {
      await db
        .update(bookings)
        .set({ bookingSource: "RIEMAR" })
        .where(eq(bookings.id, booking.id));
      directCount++;
    }

    console.log("\n✅ Migration completed!");
    console.log(`   TikTok → RIEMAR: ${tiktokCount} bookings`);
    console.log(`   Airbnb → SIR JAMES: ${airbnbCount} bookings`);
    console.log(`   Facebook → SIR MIKE: ${facebookCount} bookings`);
    console.log(`   Direct → RIEMAR: ${directCount} bookings`);
    console.log(`   Total migrated: ${tiktokCount + airbnbCount + facebookCount + directCount} bookings`);

  } catch (error) {
    console.error("❌ Error during migration:", error);
    throw error;
  }
}

migrateBookingSources()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });

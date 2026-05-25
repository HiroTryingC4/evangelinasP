import { config } from "dotenv";
config({ path: ".env.local" });

async function updateRiemarToBusinessGcashJames() {
  try {
    const { db } = await import("./src/lib/db");
    const { bookings } = await import("./src/lib/schema");
    const { eq } = await import("drizzle-orm");
    
    console.log("Updating RIEMAR TikTok bookings to Business Gcash James...\n");
    
    // Get all TikTok bookings from May 17-23 where RIEMAR received payment
    const allBookings = await db.select().from(bookings);
    const riemarTikTok = allBookings.filter(b => {
      const key = b.checkInDateKey || String(b.checkIn).substring(0, 10);
      return b.bookingPlatform === "TikTok" && 
             key >= "2026-05-17" && 
             key <= "2026-05-23" &&
             (b.dpReceivedBy === "RIEMAR" || b.fpReceivedBy === "RIEMAR");
    });
    
    console.log(`Found ${riemarTikTok.length} RIEMAR TikTok bookings\n`);
    
    let updated = 0;
    for (const booking of riemarTikTok) {
      console.log(`Updating: ${booking.guestName} (Unit ${booking.unit})`);
      
      await db
        .update(bookings)
        .set({
          dpReceivedBy: booking.dpReceivedBy === "RIEMAR" ? "Business Gcash James" : booking.dpReceivedBy,
          fpReceivedBy: booking.fpReceivedBy === "RIEMAR" ? "Business Gcash James" : booking.fpReceivedBy,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, booking.id));
      
      updated++;
    }
    
    console.log(`\n✅ Updated ${updated} bookings: RIEMAR → Business Gcash James`);
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

updateRiemarToBusinessGcashJames();

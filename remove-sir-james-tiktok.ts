import { config } from "dotenv";
config({ path: ".env.local" });

async function removeSirJamesTikTok() {
  try {
    const { db } = await import("./src/lib/db");
    const { bookings } = await import("./src/lib/schema");
    const { eq } = await import("drizzle-orm");
    
    // SIR JAMES TikTok bookings to change to JAYJAY
    const fixedNames = [
      { name: "Kristel Mae Flores", unit: "1116" },
      { name: "Ajhay Morales Villacampa", unit: "1118" },
      { name: "Joielyn Salazar", unit: "1118" },
    ];
    
    console.log("Removing TikTok bookings from SIR JAMES record...\n");
    
    const allBookings = await db.select().from(bookings);
    
    for (const fix of fixedNames) {
      const booking = allBookings.find(b => 
        b.guestName.toLowerCase() === fix.name.toLowerCase() && b.unit === fix.unit
      );
      
      if (booking && booking.bookingPlatform === "TikTok") {
        console.log(`${booking.guestName} (Unit ${booking.unit}): SIR JAMES → JAYJAY`);
        
        await db
          .update(bookings)
          .set({
            dpReceivedBy: "JAYJAY",
            fpReceivedBy: "JAYJAY",
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, booking.id));
      }
    }
    
    console.log(`\n✅ Done - SIR JAMES TikTok bookings moved to JAYJAY`);
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

removeSirJamesTikTok();

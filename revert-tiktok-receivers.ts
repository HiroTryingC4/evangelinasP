import { config } from "dotenv";
config({ path: ".env.local" });

async function revertTikTokReceivers() {
  try {
    const { db } = await import("./src/lib/db");
    const { bookings } = await import("./src/lib/schema");
    const { eq } = await import("drizzle-orm");
    
    // Revert the changes - restore original receivers
    const fixes = [
      { name: "jayjay", unit: "1845", dp: "JAYJAY", fp: "JAYJAY" },
      { name: "Angel Nicole Biado", unit: "1845", dp: "JAYJAY", fp: "JAYJAY" },
      { name: "Penelope", unit: "1116", dp: "JAYJAY", fp: "JAYJAY" },
      { name: "Kristel Mae Flores", unit: "1116", dp: "SIR JAMES", fp: "JAYJAY" },
      { name: "Ajhay Morales Villacampa", unit: "1118", dp: "SIR JAMES", fp: "JAYJAY" },
      { name: "Joielyn Salazar", unit: "1118", dp: "SIR JAMES", fp: "JAYJAY" },
    ];
    
    console.log("Reverting TikTok bookings to original receivers...\n");
    
    const allBookings = await db.select().from(bookings);
    
    for (const fix of fixes) {
      const booking = allBookings.find(b => 
        b.guestName.toLowerCase() === fix.name.toLowerCase() && b.unit === fix.unit
      );
      
      if (booking) {
        console.log(`${fix.name} (Unit ${fix.unit}): JAYJAY/SIR JAMES`);
        
        await db
          .update(bookings)
          .set({
            dpReceivedBy: fix.dp,
            fpReceivedBy: fix.fp,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, booking.id));
      }
    }
    
    console.log(`\n✅ Reverted`);
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

revertTikTokReceivers();

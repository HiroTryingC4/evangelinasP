import { config } from "dotenv";
config({ path: ".env.local" });

async function fixJoielyns() {
  try {
    const { db } = await import("./src/lib/db");
    const { bookings } = await import("./src/lib/schema");
    const { eq } = await import("drizzle-orm");
    
    console.log("Fixing Joielyn Salazar (Unit 1118)...\n");
    
    // Get all bookings to find by ID
    const allBookings = await db.select().from(bookings);
    const joielyns = allBookings.filter(b => 
      b.guestName.toLowerCase().includes("joielyn") && b.unit === "1118"
    );
    
    for (const booking of joielyns) {
      console.log(`Found: ${booking.guestName} (Unit ${booking.unit})`);
      console.log(`  Before: dpReceivedBy=${booking.dpReceivedBy}, fpReceivedBy=${booking.fpReceivedBy}`);
      
      await db
        .update(bookings)
        .set({
          dpReceivedBy: "RIEMAR",
          fpReceivedBy: "RIEMAR",
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, booking.id));
      
      console.log(`  After:  dpReceivedBy=RIEMAR, fpReceivedBy=RIEMAR\n`);
    }
    
    console.log(`✅ Fixed`);
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

fixJoielyns();

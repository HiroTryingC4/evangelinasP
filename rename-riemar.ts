import { config } from "dotenv";
config({ path: ".env.local" });

async function renameRiemar() {
  try {
    const { db } = await import("./src/lib/db");
    const { receiverPersons } = await import("./src/lib/schema");
    const { eq } = await import("drizzle-orm");
    
    console.log("Renaming RIEMAR account to Business Gcash James...\n");
    
    // Update the receiver person name
    await db
      .update(receiverPersons)
      .set({ name: "Business Gcash James" })
      .where(eq(receiverPersons.name, "RIEMAR"));
    
    // Also update all bookings that reference RIEMAR
    const { bookings } = await import("./src/lib/schema");
    
    const allBookings = await db.select().from(bookings);
    const riemarBookings = allBookings.filter(b => 
      b.dpReceivedBy === "RIEMAR" || b.fpReceivedBy === "RIEMAR"
    );
    
    console.log(`Updating ${riemarBookings.length} bookings from RIEMAR to Business Gcash James...\n`);
    
    for (const booking of riemarBookings) {
      await db
        .update(bookings)
        .set({
          dpReceivedBy: booking.dpReceivedBy === "RIEMAR" ? "Business Gcash James" : booking.dpReceivedBy,
          fpReceivedBy: booking.fpReceivedBy === "RIEMAR" ? "Business Gcash James" : booking.fpReceivedBy,
        })
        .where(eq(bookings.id, booking.id));
    }
    
    console.log(`✅ Renamed: RIEMAR → Business Gcash James (${riemarBookings.length} bookings updated)`);
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

renameRiemar();

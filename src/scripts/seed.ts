/**
 * Seed script — imports your existing bookings into Neon Postgres.
 * Run once after db:push:
 *   npm run db:seed
 */
import { config } from "dotenv";
// Load .env.local for local runs
config({ path: ".env.local" });

const data = [
  { guestName: "Michelle Jordan",   contactNo: "09605921688", unit: "1245", checkIn: new Date("2026-03-27"), checkInTime: "2:00 PM",   checkOut: new Date("2026-03-28"), checkOutTime: "12:00 PM", hoursStayed: 24, totalFee: 1900, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 1400, fpMethod: "GCash", fpReceivedBy: "SIR MIKE",  remainingBalance: 0, paymentStatus: "Fully Paid", hasConflict: "OK" },
  { guestName: "John Mark Aducal",  contactNo: null,          unit: "1558", checkIn: new Date("2026-03-28"), checkInTime: "11:00 AM",  checkOut: new Date("2026-03-28"), checkOutTime: "11:00 PM", hoursStayed: 12, totalFee: 1400, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 900,  fpMethod: "GCash", fpReceivedBy: "SIR JAMES", remainingBalance: 0, paymentStatus: "Fully Paid", hasConflict: "OK" },
  { guestName: "Angel Lyn de vera", contactNo: "09394716119", unit: "1245", checkIn: new Date("2026-03-28"), checkInTime: "5:00 PM",   checkOut: new Date("2026-03-29"), checkOutTime: "2:00 PM",  hoursStayed: 24, totalFee: 1800, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 1300, fpMethod: "GCash", fpReceivedBy: "SIR MIKE",  remainingBalance: 0, paymentStatus: "Fully Paid", hasConflict: "OK" },
  { guestName: "Arjay Escleto",     contactNo: "09664313607", unit: "1558", checkIn: new Date("2026-03-29"), checkInTime: "9:00 AM",   checkOut: new Date("2026-03-29"), checkOutTime: "3:00 PM",  hoursStayed: 6,  totalFee: 1000, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 500,  fpMethod: "GCash", fpReceivedBy: "SIR JAMES", remainingBalance: 0, paymentStatus: "Fully Paid", hasConflict: "OK" },
  { guestName: "Venice Yu-Ann Violen", contactNo: "09319329384", unit: "1558", checkIn: new Date("2026-03-29"), checkInTime: "4:00 PM", checkOut: new Date("2026-03-30"), checkOutTime: "1:00 PM", hoursStayed: 24, totalFee: 1800, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 1300, fpMethod: "GCash", fpReceivedBy: "SIR JAMES", remainingBalance: 0, paymentStatus: "Fully Paid", hasConflict: "OK" },
  { guestName: "Claraine Alexa",    contactNo: "09506226768", unit: "1118", checkIn: new Date("2026-03-30"), checkInTime: "11:30 AM",  checkOut: new Date("2026-03-30"), checkOutTime: "11:30 PM", hoursStayed: 12, totalFee: 1300, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 800,  fpMethod: "GCash", fpReceivedBy: "SIR JAMES", remainingBalance: 0, paymentStatus: "Fully Paid", hasConflict: "OK" },
  { guestName: "Michaela",          contactNo: "09954282523", unit: "1116", checkIn: new Date("2026-03-30"), checkInTime: "5:00 PM",   checkOut: new Date("2026-03-31"), checkOutTime: "2:00 PM",  hoursStayed: 24, totalFee: 1500, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 1000, fpMethod: "GCash", fpReceivedBy: "SIR JAMES", remainingBalance: 0, paymentStatus: "Fully Paid", hasConflict: "OK" },
  { guestName: "Jamaica Angela",    contactNo: "09937675156", unit: "1118", checkIn: new Date("2026-03-31"), checkInTime: "7:00 PM",   checkOut: new Date("2026-04-01"), checkOutTime: "5:00 PM",  hoursStayed: 24, totalFee: 1500, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 1000, fpMethod: "GCash", fpReceivedBy: "SIR JAMES", remainingBalance: 0, paymentStatus: "Fully Paid", hasConflict: "OK" },
  { guestName: "April Lagas",       contactNo: null,          unit: "1245", checkIn: new Date("2026-03-31"), checkInTime: "8:00 AM",   checkOut: new Date("2026-03-31"), checkOutTime: "8:00 PM",  hoursStayed: 12, totalFee: 1300, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 800,  fpMethod: "Cash",  fpReceivedBy: "SIR MIKE",  remainingBalance: 0, paymentStatus: "Fully Paid", hasConflict: "OK" },
  { guestName: "Kazz Virtudez",     contactNo: "09154669572", unit: "1558", checkIn: new Date("2026-03-31"), checkInTime: "3:00 PM",   checkOut: new Date("2026-03-31"), checkOutTime: "9:00 PM",  hoursStayed: 6,  totalFee: 1000, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 500,  fpMethod: "GCash", fpReceivedBy: "SIR JAMES", remainingBalance: 0, paymentStatus: "Fully Paid", hasConflict: "OK" },
  { guestName: "Sample DP Guest",   contactNo: "09123456789", unit: "1116", checkIn: new Date("2026-04-15"), checkInTime: "2:00 PM",   checkOut: new Date("2026-04-16"), checkOutTime: "12:00 PM", hoursStayed: 24, totalFee: 2000, dpAmount: 500, dpMethod: "GCash", dpReceivedBy: "SIR JAMES", fpAmount: 0,    fpMethod: null,   fpReceivedBy: null,        remainingBalance: 1500, paymentStatus: "DP Paid", hasConflict: "OK" },
];

async function seed() {
  const { db } = await import("../lib/db");
  const { bookings } = await import("../lib/schema");

  console.log("🌱 Seeding database...");
  try {
    await db.insert(bookings).values(data);
    console.log(`✅ Inserted ${data.length} bookings successfully.`);
  } catch (e: any) {
    if (e.message?.includes("already exists") || e.code === "23505") {
      console.log("⚠️  Some records already exist — skipping duplicates.");
    } else {
      console.error("❌ Seed failed:", e.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

seed();

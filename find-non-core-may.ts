import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from './src/lib/db';
import { bookings } from './src/lib/schema';

const CORE_UNITS = new Set(['1116', '1118', '1558', '1845']);

async function findNonCoreMayBookings() {
  const all = await db.select().from(bookings);
  
  const mayBookings = all.filter(b => {
    const checkIn = b.checkInDateKey || b.checkIn.toISOString().split('T')[0];
    return checkIn >= '2026-05-01' && checkIn <= '2026-05-31';
  });
  
  const nonCore = mayBookings.filter(b => {
    const unit = String(b.unit || '').replace(/^Unit\s*/i, '').trim();
    return !CORE_UNITS.has(unit);
  });
  
  console.log('Non-core unit bookings in May 2026:');
  console.log('=====================================');
  
  nonCore.forEach(b => {
    const unit = String(b.unit || '').replace(/^Unit\s*/i, '').trim();
    const dp = Number(b.dpAmount || 0);
    const fp = Number(b.fpAmount || 0);
    const ap = Number(b.apAmount || 0);
    const paid = dp + fp + ap;
    const checkIn = b.checkInDateKey || b.checkIn.toISOString().split('T')[0];
    
    console.log(`\nGuest: ${b.guestName}`);
    console.log(`Unit: ${unit || '(empty)'}`);
    console.log(`Check-in: ${checkIn}`);
    console.log(`Total Paid: ₱${paid.toLocaleString()}`);
    console.log(`  - DP: ₱${dp.toLocaleString()}`);
    console.log(`  - FP: ₱${fp.toLocaleString()}`);
    console.log(`  - AP: ₱${ap.toLocaleString()}`);
  });
  
  const totalNonCore = nonCore.reduce((sum, b) => {
    return sum + Number(b.dpAmount || 0) + Number(b.fpAmount || 0) + Number(b.apAmount || 0);
  }, 0);
  
  console.log('\n=====================================');
  console.log(`Total bookings in non-core units: ${nonCore.length}`);
  console.log(`Total paid from non-core units: ₱${totalNonCore.toLocaleString()}`);
  console.log('=====================================');
  
  process.exit(0);
}

findNonCoreMayBookings().catch(console.error);

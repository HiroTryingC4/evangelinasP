import { config } from "dotenv";

config({ path: ".env.local" });

type BookingRow = {
  id: number;
  guestName: string;
  totalFee: number;
  dpAmount: number;
  fpAmount: number;
  dpReceivedBy: string | null;
  fpReceivedBy: string | null;
};

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

async function main() {
  const targetReceiver = String(process.argv[2] ?? "SIR JAMES").trim();
  if (!targetReceiver) {
    throw new Error("Target receiver name is required.");
  }

  const [{ db }, { bookings }, { eq }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/schema"),
    import("drizzle-orm"),
  ]);

  const rows: BookingRow[] = await db
    .select({
      id: bookings.id,
      guestName: bookings.guestName,
      totalFee: bookings.totalFee,
      dpAmount: bookings.dpAmount,
      fpAmount: bookings.fpAmount,
      dpReceivedBy: bookings.dpReceivedBy,
      fpReceivedBy: bookings.fpReceivedBy,
    })
    .from(bookings);

  let missingBefore = 0;
  let assignedNow = 0;
  let updatedRows = 0;

  for (const row of rows) {
    const total = Math.max(0, Number(row.totalFee ?? 0));
    const dpRaw = Math.max(0, Number(row.dpAmount ?? 0));
    const fpRaw = Math.max(0, Number(row.fpAmount ?? 0));

    const collectedTotal = Math.min(total, dpRaw + fpRaw);
    const dpCollected = Math.min(dpRaw, collectedTotal);
    const fpCollected = Math.min(fpRaw, Math.max(0, collectedTotal - dpCollected));

    const dpReceiver = normalizeName(row.dpReceivedBy);
    const fpReceiver = normalizeName(row.fpReceivedBy);

    let shouldUpdate = false;
    const patch: { dpReceivedBy?: string | null; fpReceivedBy?: string | null; updatedAt?: Date } = {};

    if (dpCollected > 0 && !dpReceiver) {
      missingBefore += dpCollected;
      assignedNow += dpCollected;
      patch.dpReceivedBy = targetReceiver;
      shouldUpdate = true;
    }

    if (fpCollected > 0 && !fpReceiver) {
      missingBefore += fpCollected;
      assignedNow += fpCollected;
      patch.fpReceivedBy = targetReceiver;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      patch.updatedAt = new Date();
      await db.update(bookings).set(patch).where(eq(bookings.id, row.id));
      updatedRows += 1;
      console.log(
        `Updated booking #${row.id} (${row.guestName}) -> assigned missing receiver fields to ${targetReceiver}`
      );
    }
  }

  console.log("\nDone.");
  console.log(`Target receiver: ${targetReceiver}`);
  console.log(`Bookings updated: ${updatedRows}`);
  console.log(`Missing before: ${missingBefore.toFixed(2)}`);
  console.log(`Assigned now: ${assignedNow.toFixed(2)}`);
}

main().catch((error) => {
  console.error("Failed to assign missing receivers:", error);
  process.exit(1);
});

import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { persons, receiverPersons, unitConfigs } from "@/lib/schema";
import { STAFF, UNITS } from "@/lib/utils";

export const dynamic = "force-dynamic";

function normalizeUnitCode(value: string): string {
  return value.trim().replace(/^Unit\s*/i, "");
}

function sanitizeUnits(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const unit = normalizeUnitCode(String(value ?? ""));
    if (!unit) continue;
    if (seen.has(unit)) continue;
    seen.add(unit);
    out.push(unit);
  }

  return out;
}

type ReceiverInput = { name: string; role: "employee" | "host" };

function sanitizeReceivers(values: unknown): ReceiverInput[] {
  if (!Array.isArray(values)) return [];

  const out: ReceiverInput[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    let name = "";
    let role: "employee" | "host" = "employee";

    if (typeof value === "string") {
      name = value.trim();
    } else if (value && typeof value === "object") {
      const v = value as { name?: unknown; role?: unknown };
      name = String(v.name ?? "").trim();
      role = String(v.role ?? "employee").toLowerCase() === "host" ? "host" : "employee";
    }

    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, role });
  }

  return out;
}

export async function GET() {
  try {
    const [units, receivers] = await Promise.all([
      db.select({ code: unitConfigs.code }).from(unitConfigs).orderBy(asc(unitConfigs.sortOrder), asc(unitConfigs.id)),
      db
        .select({ name: receiverPersons.name, role: receiverPersons.role })
        .from(receiverPersons)
        .orderBy(asc(receiverPersons.sortOrder), asc(receiverPersons.id)),
    ]);

    const configuredUnits = units.map((u) => u.code);
    const mergedUnits = [...configuredUnits, ...UNITS.filter((code) => !configuredUnits.includes(code))];

    return NextResponse.json({
      units: mergedUnits,
      receivers: receivers.length > 0 ? receivers.map((r) => r.name) : STAFF,
      receiverPersons: receivers.length > 0 ? receivers : STAFF.map((name) => ({ name, role: "employee" })),
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (e) {
    console.error("[GET /api/settings]", e);
    return NextResponse.json({ error: "Failed to fetch settings" }, {
      status: 500,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const units = sanitizeUnits(body.units);
    const receivers = sanitizeReceivers(body.receivers);

    if (units.length === 0) {
      return NextResponse.json({ error: "At least one unit is required" }, { status: 400 });
    }
    if (receivers.length === 0) {
      return NextResponse.json({ error: "At least one receiver person is required" }, { status: 400 });
    }

    for (let i = 0; i < units.length; i++) {
      const code = units[i];
      await db
        .insert(unitConfigs)
        .values({ code, sortOrder: i })
        .onConflictDoUpdate({
          target: unitConfigs.code,
          set: { sortOrder: i },
        });
    }

    const existingUnits = await db.select({ code: unitConfigs.code }).from(unitConfigs);
    const incomingUnitSet = new Set(units);
    for (const row of existingUnits) {
      if (!incomingUnitSet.has(row.code)) {
        await db.delete(unitConfigs).where(eq(unitConfigs.code, row.code));
      }
    }

    for (let i = 0; i < receivers.length; i++) {
      const person = receivers[i];
      await db
        .insert(receiverPersons)
        .values({ name: person.name, role: person.role, sortOrder: i })
        .onConflictDoUpdate({
          target: receiverPersons.name,
          set: { role: person.role, sortOrder: i },
        });
    }

    const existingReceivers = await db.select({ name: receiverPersons.name }).from(receiverPersons);
    const incomingReceiverSet = new Set(receivers.map((r) => r.name.trim().toLowerCase()));
    for (const row of existingReceivers) {
      if (!incomingReceiverSet.has(String(row.name).trim().toLowerCase())) {
        await db.delete(receiverPersons).where(eq(receiverPersons.name, row.name));
      }
    }

    // Keep `persons` in sync so newly added receivers are available
    // in transfer/payment database flows that read from this table.
    for (const person of receivers) {
      await db
        .insert(persons)
        .values({
          name: person.name.trim().toLowerCase(),
          type: "recipient",
          balance: "0",
        })
        .onConflictDoUpdate({
          target: persons.name,
          set: {
            type: "recipient",
            balance: "0",
          },
        });
    }

    const [savedUnits, savedReceivers] = await Promise.all([
      db.select({ code: unitConfigs.code }).from(unitConfigs).orderBy(asc(unitConfigs.sortOrder), asc(unitConfigs.id)),
      db.select({ name: receiverPersons.name, role: receiverPersons.role }).from(receiverPersons).orderBy(asc(receiverPersons.sortOrder), asc(receiverPersons.id)),
    ]);

    return NextResponse.json({
      units: savedUnits.map((u) => u.code),
      receivers: savedReceivers.map((r) => r.name),
      receiverPersons: savedReceivers,
    });
  } catch (e) {
    console.error("[PUT /api/settings]", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Failed to save settings", detail: message }, { status: 500 });
  }
}

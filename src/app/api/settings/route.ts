import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { receiverPersons, unitConfigs } from "@/lib/schema";
import { STAFF, UNITS } from "@/lib/utils";

function normalizeUnitCode(value: string): string {
  return value.trim().replace(/^Unit\s*/i, "");
}

function sanitizeList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out = values
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(out));
}

export async function GET() {
  try {
    const [units, receivers] = await Promise.all([
      db.select({ code: unitConfigs.code }).from(unitConfigs).orderBy(asc(unitConfigs.sortOrder), asc(unitConfigs.id)),
      db.select({ name: receiverPersons.name }).from(receiverPersons).orderBy(asc(receiverPersons.sortOrder), asc(receiverPersons.id)),
    ]);

    return NextResponse.json({
      units: units.length > 0 ? units.map((u) => u.code) : UNITS,
      receivers: receivers.length > 0 ? receivers.map((r) => r.name) : STAFF,
    });
  } catch (e) {
    console.error("[GET /api/settings]", e);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const units = sanitizeList(body.units).map(normalizeUnitCode);
    const receivers = sanitizeList(body.receivers);

    if (units.length === 0) {
      return NextResponse.json({ error: "At least one unit is required" }, { status: 400 });
    }
    if (receivers.length === 0) {
      return NextResponse.json({ error: "At least one receiver person is required" }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await tx.delete(unitConfigs);
      await tx.delete(receiverPersons);

      await tx.insert(unitConfigs).values(
        units.map((code, i) => ({ code, sortOrder: i }))
      );

      await tx.insert(receiverPersons).values(
        receivers.map((name, i) => ({ name, sortOrder: i }))
      );
    });

    return NextResponse.json({ units, receivers });
  } catch (e) {
    console.error("[PUT /api/settings]", e);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

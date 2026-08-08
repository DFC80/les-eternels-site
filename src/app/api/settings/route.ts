export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PUBLIC_KEYS = ["paymentMethods"];

export async function GET() {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
  const data: Record<string, unknown> = {};
  for (const row of rows) {
    try { data[row.key] = JSON.parse(row.value); } catch { data[row.key] = row.value; }
  }
  if (!data.paymentMethods) data.paymentMethods = ["especes"];
  return NextResponse.json(data);
}

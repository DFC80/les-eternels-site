import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULTS: Record<string, string> = {
  description: "Une association à but non lucratif réunissant les passionnés de jeux de plateau, jeux de rôle et airsoft.",
};

export async function GET() {
  const rows = await prisma.siteSetting.findMany();
  const settings = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  return NextResponse.json(settings);
}

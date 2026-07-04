import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const DEFAULTS: Record<string, string> = {
  nomAssociation: "Les Éternels",
  anneeCopyright: String(new Date().getFullYear()),
  description: "Une association à but non lucratif réunissant les passionnés de jeux de plateau, jeux de rôle et airsoft.",
};

async function ensureDefaults() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  await ensureDefaults();
  const rows = await prisma.siteSetting.findMany();
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const body = await request.json() as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") {
      await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
  }
  revalidatePath("/", "layout");
  const rows = await prisma.siteSetting.findMany();
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

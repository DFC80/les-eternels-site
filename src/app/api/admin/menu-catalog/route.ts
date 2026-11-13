export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const items = await prisma.menuCatalog.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const { label, stock, maxPerPerson, mealType, seasons, months } = await request.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Le libellé est requis." }, { status: 400 });
  }
  const last = await prisma.menuCatalog.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const item = await prisma.menuCatalog.create({
    data: {
      label: label.trim(),
      stock: stock != null && stock !== "" ? Number(stock) : null,
      maxPerPerson: maxPerPerson != null && maxPerPerson !== "" ? Number(maxPerPerson) : null,
      mealType: mealType?.trim() || null,
      seasons: Array.isArray(seasons) && seasons.length > 0 ? JSON.stringify(seasons) : null,
      months: Array.isArray(months) && months.length > 0 ? JSON.stringify(months) : null,
      order: (last?.order ?? 0) + 1,
    },
  });
  return NextResponse.json(item, { status: 201 });
}

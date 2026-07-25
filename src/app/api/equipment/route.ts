import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const equipment = await prisma.equipment.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { associations: { select: { itemId: true, quantity: true } } },
  });
  return NextResponse.json(
    equipment.map((e) => ({
      ...e,
      associations: e.associations.map((a) => ({ itemId: a.itemId, quantity: a.quantity })),
    }))
  );
}

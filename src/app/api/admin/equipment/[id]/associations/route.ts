import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "equipements")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { items } = (await request.json()) as { items: { itemId: string; quantity: number }[] };

  await prisma.equipmentAssociation.deleteMany({ where: { replicaId: params.id } });

  if (items.length > 0) {
    await prisma.equipmentAssociation.createMany({
      data: items.map(({ itemId, quantity }) => ({ replicaId: params.id, itemId, quantity: Math.max(1, quantity) })),
    });
  }

  return NextResponse.json({ ok: true });
}

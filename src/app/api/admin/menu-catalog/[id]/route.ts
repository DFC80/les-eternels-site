export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const { label, stock, order } = await request.json();
  if (label !== undefined && !label?.trim()) {
    return NextResponse.json({ error: "Le libellé est requis." }, { status: 400 });
  }
  const item = await prisma.menuCatalog.update({
    where: { id: params.id },
    data: {
      ...(label !== undefined ? { label: label.trim() } : {}),
      ...(stock !== undefined ? { stock: stock !== "" && stock != null ? Number(stock) : null } : {}),
      ...(order !== undefined ? { order: Number(order) } : {}),
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  await prisma.menuCatalog.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

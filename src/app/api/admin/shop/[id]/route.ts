import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user as never, "boutique")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const item = await prisma.shopItem.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        include: {
          order: {
            include: {
              user: { select: { id: true, firstName: true, name: true, email: true } },
            },
          },
        },
        orderBy: { order: { createdAt: "desc" } },
      },
    },
  });

  if (!item) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user as never, "boutique")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, price, stock, isPublished, showOnHome, photos } = body;

  const item = await prisma.shopItem.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(price !== undefined && { price: Math.round(Number(price)) }),
      ...(stock !== undefined && { stock: Math.round(Number(stock)) }),
      ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
      ...(showOnHome !== undefined && { showOnHome: Boolean(showOnHome) }),
      ...(photos !== undefined && { photos }),
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user as never, "boutique")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.shopItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

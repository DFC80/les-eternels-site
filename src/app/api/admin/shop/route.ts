import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user as never, "boutique")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const items = await prisma.shopItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: true } } },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user as never, "boutique")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, price, stock, isPublished, showOnHome, photos } = body;

  if (!title?.trim() || !description?.trim() || price == null || stock == null) {
    return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
  }

  const item = await prisma.shopItem.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      price: Math.round(Number(price)),
      stock: Math.round(Number(stock)),
      isPublished: Boolean(isPublished),
      showOnHome: Boolean(showOnHome),
      photos: photos ?? "",
    },
  });

  return NextResponse.json(item, { status: 201 });
}

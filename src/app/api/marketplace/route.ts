export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const listings = await prisma.marketListing.findMany({
    where: {
      OR: [
        { userId },
        { status: "ACTIVE" },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, firstName: true, name: true } },
    },
  });

  return NextResponse.json(listings);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const body = await request.json() as {
    type?: string;
    title?: string;
    description?: string;
    price?: number | null;
    photos?: string | null;
    category?: string | null;
  };

  const { type, title, description, price, photos, category } = body;

  if (!type || !["VENTE", "ECHANGE", "RECHERCHE"].includes(type)) {
    return NextResponse.json({ error: "Type invalide." }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "Le titre est requis." }, { status: 400 });
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: "La description est requise." }, { status: 400 });
  }

  const listing = await prisma.marketListing.create({
    data: {
      userId: (session.user as { id: string }).id,
      type,
      title: title.trim(),
      description: description.trim(),
      price: type === "VENTE" && price != null ? Math.round(Number(price)) : null,
      photos: photos || null,
      category: category || null,
    },
    include: {
      user: { select: { id: true, firstName: true, name: true } },
    },
  });

  return NextResponse.json(listing, { status: 201 });
}

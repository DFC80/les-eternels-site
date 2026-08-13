export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Retourne les clés d'activités actives pour un userId (cotisation payée) */
async function getUserActivityKeys(userId: string): Promise<string[]> {
  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { extraActivities: true },
  });
  if (!membership || !membership.isPaid) return [];

  const keys: string[] = [];
  if (membership.wantsBoardGames) keys.push("JEUX_DE_PLATEAU");
  if (membership.wantsRolePlay) keys.push("JEUX_DE_ROLE");
  if (membership.wantsAirsoft) keys.push("AIRSOFT");
  for (const ea of membership.extraActivities) keys.push(ea.activityKey);
  return keys;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userActivityKeys = await getUserActivityKeys(userId);

  const listings = await prisma.marketListing.findMany({
    where: {
      OR: [
        // Toujours voir ses propres annonces
        { userId },
        // Annonces visibles par tous
        { status: "ACTIVE", visibility: "ALL" },
        // Annonces réservées aux membres d'une activité
        ...(userActivityKeys.length > 0
          ? [{ status: "ACTIVE", visibility: "ACTIVITY", activityKey: { in: userActivityKeys } }]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, firstName: true, name: true } },
      _count: { select: { comments: true } },
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
    activityKey?: string | null;
    visibility?: string;
  };

  const { type, title, description, price, photos, category, activityKey, visibility } = body;

  if (!type || !["VENTE", "ECHANGE", "RECHERCHE"].includes(type)) {
    return NextResponse.json({ error: "Type invalide." }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "Le titre est requis." }, { status: 400 });
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: "La description est requise." }, { status: 400 });
  }

  const resolvedVisibility = visibility === "ACTIVITY" && activityKey ? "ACTIVITY" : "ALL";

  const listing = await prisma.marketListing.create({
    data: {
      userId: (session.user as { id: string }).id,
      type,
      title: title.trim(),
      description: description.trim(),
      price: type === "VENTE" && price != null ? Math.round(Number(price)) : null,
      photos: photos || null,
      category: category || null,
      activityKey: resolvedVisibility === "ACTIVITY" ? (activityKey ?? null) : null,
      visibility: resolvedVisibility,
    },
    include: {
      user: { select: { id: true, firstName: true, name: true } },
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json(listing, { status: 201 });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  // Récupérer les clés d'activités de la cotisation de l'utilisateur
  const membership = await prisma.membership.findUnique({
    where: { userId: session.user.id },
    include: { extraActivities: true },
  });

  const userActivityKeys: string[] = [];
  if (membership) {
    if (membership.wantsBoardGames) userActivityKeys.push("JEUX_DE_PLATEAU");
    if (membership.wantsRolePlay) userActivityKeys.push("JEUX_DE_ROLE");
    if (membership.wantsAirsoft) userActivityKeys.push("AIRSOFT");
    membership.extraActivities.forEach((a) => userActivityKeys.push(a.activityKey));
  }

  const products = await prisma.product.findMany({
    where: {
      stock: { gt: 0 },
      OR: [
        // Produit sans restriction d'activité → visible par tous
        { activities: { none: {} } },
        // Produit lié à au moins une activité de l'utilisateur
        ...(userActivityKeys.length > 0
          ? [{ activities: { some: { activityKey: { in: userActivityKeys } } } }]
          : []),
      ],
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(products);
}

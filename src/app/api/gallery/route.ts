import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityType = searchParams.get("activityType");
  const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";

  const session = await getServerSession(authOptions);

  // Récupère l'adhésion en cours si l'utilisateur est connecté
  let membership: { wantsBoardGames: boolean; wantsRolePlay: boolean; wantsAirsoft: boolean } | null = null;
  if (session) {
    const currentYear = new Date().getFullYear();
    const m = await prisma.membership.findUnique({ where: { userId: session.user.id } });
    if (m && m.year === currentYear) membership = m;
  }

  // Détermine quelles activités le membre a accès pour les photos MEMBERS_ONLY
  function canSeeMembersOnly(activity: string): boolean {
    if (!membership) return false;
    if (activity === "AUTRE") return true; // toute adhésion suffit
    if (activity === "JEUX_DE_PLATEAU") return membership.wantsBoardGames;
    if (activity === "JEUX_DE_ROLE") return membership.wantsRolePlay;
    if (activity === "AIRSOFT") return membership.wantsAirsoft;
    return false;
  }

  const allPhotos = await prisma.galleryPhoto.findMany({
    where: activityType && activityType !== "ALL" ? { activityType } : undefined,
    orderBy: { date: sort },
  });

  const filtered = allPhotos.filter(
    (p) => p.visibility === "PUBLIC" || canSeeMembersOnly(p.activityType)
  );

  return NextResponse.json(filtered);
}

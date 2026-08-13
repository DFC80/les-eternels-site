export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityType = searchParams.get("activityType");
  const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";

  const activityWhere: Prisma.GalleryPhotoWhereInput =
    activityType && activityType !== "ALL" ? { activityType } : {};

  // Non-featured photos require membership in the related activity.
  // isFavorite photos are always visible (they appear on the public homepage).
  let visibilityWhere: Prisma.GalleryPhotoWhereInput | null = null;

  let seeAll = false;
  if (userId) {
    if (isFullAdmin(role)) {
      seeAll = true;
    } else {
      const bureauRole = await prisma.userBureauRole.findFirst({ where: { userId } });
      if (bureauRole) {
        seeAll = true;
      } else {
        const membership = await prisma.membership.findUnique({
          where: { userId },
          select: { wantsBoardGames: true, wantsRolePlay: true, wantsAirsoft: true },
        });

        const or: Prisma.GalleryPhotoWhereInput[] = [
          { isFavorite: true },
          { isFavorite: false, activityType: "AUTRE" },
        ];
        if (membership?.wantsBoardGames) or.push({ isFavorite: false, activityType: "JEUX_DE_PLATEAU" });
        if (membership?.wantsRolePlay) or.push({ isFavorite: false, activityType: "JEUX_DE_ROLE" });
        if (membership?.wantsAirsoft) or.push({ isFavorite: false, activityType: "AIRSOFT" });
        visibilityWhere = { OR: or };
      }
    }
  } else {
    // Not logged in: only homepage (featured) photos
    visibilityWhere = { OR: [{ isFavorite: true }] };
  }

  const where: Prisma.GalleryPhotoWhereInput = seeAll
    ? activityWhere
    : { AND: [activityWhere, visibilityWhere!] };

  const photos = await prisma.galleryPhoto.findMany({
    where,
    orderBy: { date: sort },
    include: { _count: { select: { comments: true } } },
  });

  return NextResponse.json(photos);
}

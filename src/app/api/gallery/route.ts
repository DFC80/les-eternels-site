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
  const categoryId = searchParams.get("categoryId");
  const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";

  // Base filter by activity key and/or category
  const activityWhere: Prisma.GalleryPhotoWhereInput = {};
  if (activityType && activityType !== "ALL") {
    activityWhere.activities = { some: { activityKey: activityType } };
  }
  if (categoryId && categoryId !== "ALL") {
    activityWhere.categories = { some: { categoryId } };
  }

  // Visibility: isFavorite photos are always public.
  // Non-featured photos require at least one matching membership activity.
  // Photos with no activities tagged are visible to all members.
  let seeAll = false;
  let visibilityWhere: Prisma.GalleryPhotoWhereInput | null = null;

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
          { isFavorite: false, activities: { none: {} } }, // no activities = visible to all members
        ];
        if (membership?.wantsBoardGames) or.push({ isFavorite: false, activities: { some: { activityKey: "JEUX_DE_PLATEAU" } } });
        if (membership?.wantsRolePlay) or.push({ isFavorite: false, activities: { some: { activityKey: "JEUX_DE_ROLE" } } });
        if (membership?.wantsAirsoft) or.push({ isFavorite: false, activities: { some: { activityKey: "AIRSOFT" } } });
        visibilityWhere = { OR: or };
      }
    }
  } else {
    // Not logged in: only homepage (featured) photos
    visibilityWhere = { OR: [{ isFavorite: true }] };
  }

  const andClauses: Prisma.GalleryPhotoWhereInput[] = [];
  if (activityWhere.activities) andClauses.push({ activities: activityWhere.activities });
  if (activityWhere.categories) andClauses.push({ categories: activityWhere.categories });
  if (!seeAll && visibilityWhere) andClauses.push(visibilityWhere);

  const where: Prisma.GalleryPhotoWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

  const photos = await prisma.galleryPhoto.findMany({
    where,
    orderBy: { date: sort },
    include: {
      activities: true,
      categories: { include: { category: true } },
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json(photos);
}

export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const photos = await prisma.galleryPhoto.findMany({
    where: { isFavorite: true, visibility: "PUBLIC" },
    orderBy: { date: "desc" },
    select: { id: true, url: true, comment: true, activityType: true, date: true },
  });
  return NextResponse.json(photos);
}

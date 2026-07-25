import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityType = searchParams.get("activityType");
  const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";

  const photos = await prisma.galleryPhoto.findMany({
    where: activityType && activityType !== "ALL" ? { activityType } : undefined,
    orderBy: { date: sort },
  });

  return NextResponse.json(photos);
}

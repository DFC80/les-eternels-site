export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint — returns all gallery categories (no auth required)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityKey = searchParams.get("activityKey");

  const categories = await prisma.galleryCategory.findMany({
    where: activityKey ? { activityKey } : undefined,
    orderBy: [{ activityKey: "asc" }, { order: "asc" }, { label: "asc" }],
  });

  return NextResponse.json(categories);
}

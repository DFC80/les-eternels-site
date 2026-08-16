import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const isMember = !!session;

  const locations = await prisma.gameLocation.findMany({
    where: {
      isActive: true,
      ...(isMember ? {} : { isPublic: true }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      photos: true,
      isPublic: true,
      activity: { select: { label: true, emoji: true } },
    },
  });

  return NextResponse.json(locations);
}

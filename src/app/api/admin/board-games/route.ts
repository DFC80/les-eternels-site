import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  if (!sessionHasAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const games = await prisma.boardGame.findMany({
    where: { isPublic: true },
    orderBy: { name: "asc" },
    include: { owner: { select: { firstName: true, name: true } } },
  });

  return NextResponse.json(games);
}

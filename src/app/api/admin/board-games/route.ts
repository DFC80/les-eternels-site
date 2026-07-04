import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const games = await prisma.boardGame.findMany({
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { firstName: true, name: true } } },
  });

  return NextResponse.json(games);
}

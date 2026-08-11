export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const history = await prisma.membershipHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { year: "desc" },
  });

  return NextResponse.json(
    history.map((h) => ({
      ...h,
      activityKeys: JSON.parse(h.activityKeys) as string[],
    }))
  );
}

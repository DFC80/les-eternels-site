export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role))
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const poll = await prisma.poll.findUnique({
    where: { id: params.id },
    include: {
      options: {
        orderBy: { order: "asc" },
        include: { votes: { select: { userId: true } } },
      },
    },
  });

  if (!poll) return NextResponse.json({ error: "Sondage introuvable." }, { status: 404 });

  const userIds = [...new Set(poll.options.flatMap((o) => o.votes.map((v) => v.userId)))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const result = poll.options.map((opt) => ({
    id: opt.id,
    label: opt.label,
    voters: opt.votes.map((v) => userMap[v.userId]).filter(Boolean),
  }));

  return NextResponse.json(result);
}

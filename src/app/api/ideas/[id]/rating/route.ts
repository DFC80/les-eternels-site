export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const { rating } = (await request.json()) as { rating?: number };
  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Note invalide (1 à 5)." }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;

  await prisma.ideaRating.upsert({
    where: { ideaId_userId: { ideaId: params.id, userId } },
    update: { rating },
    create: { ideaId: params.id, userId, rating },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  await prisma.ideaRating.deleteMany({
    where: { ideaId: params.id, userId },
  });

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { sendMemberActionToAdmin } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

const URGENCY_ORDER: Record<string, number> = { HAUTE: 0, MOYENNE: 1, BASSE: 2 };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  const ideas = await prisma.idea.findMany({
    include: {
      user: { select: { firstName: true, name: true } },
      ratings: { select: { userId: true, rating: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const sorted = [...ideas].sort((a, b) => {
    const ua = URGENCY_ORDER[a.urgency] ?? 3;
    const ub = URGENCY_ORDER[b.urgency] ?? 3;
    if (ua !== ub) return ua - ub;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const categories = [...new Set(ideas.map((i) => i.category).filter(Boolean))].sort();

  const enriched = sorted.map(({ ratings, _count, ...rest }) => {
    const ratingCount = ratings.length;
    const avgRating = ratingCount > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratingCount
      : null;
    const myRating = ratings.find((r) => r.userId === userId)?.rating ?? null;
    return { ...rest, ratingCount, avgRating, myRating, commentCount: _count.comments };
  });

  return NextResponse.json({ ideas: enriched, categories });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const body = await request.json();
  const { title, description, category, urgency } = body as {
    title?: string;
    description?: string;
    category?: string;
    urgency?: string;
  };

  if (!title?.trim() || !description?.trim() || !category?.trim()) {
    return NextResponse.json({ error: "Titre, description et catégorie sont requis." }, { status: 400 });
  }

  if (!["HAUTE", "MOYENNE", "BASSE"].includes(urgency ?? "")) {
    return NextResponse.json({ error: "Urgence invalide." }, { status: 400 });
  }

  const idea = await prisma.idea.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      urgency: urgency!,
      userId: (session.user as { id: string }).id,
    },
    include: { user: { select: { firstName: true, name: true } } },
  });

  const role = (session.user as { role?: string }).role ?? "";
  if (!isFullAdmin(role)) {
    const urgencyLabels: Record<string, string> = { HAUTE: "Haute", MOYENNE: "Moyenne", BASSE: "Basse" };
    sendMemberActionToAdmin({
      memberName: (session.user as { name?: string | null }).name ?? "Membre",
      memberEmail: (session.user as { email?: string | null }).email ?? "",
      action: "Nouvelle idée",
      details: [
        { label: "Titre", value: title.trim() },
        { label: "Catégorie", value: category.trim() },
        { label: "Urgence", value: urgencyLabels[urgency!] ?? urgency! },
      ],
    }).catch(() => {});
  }

  return NextResponse.json(idea, { status: 201 });
}

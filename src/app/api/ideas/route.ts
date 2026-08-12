export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const URGENCY_ORDER: Record<string, number> = { HAUTE: 0, MOYENNE: 1, BASSE: 2 };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const ideas = await prisma.idea.findMany({
    include: { user: { select: { firstName: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const sorted = [...ideas].sort((a, b) => {
    const ua = URGENCY_ORDER[a.urgency] ?? 3;
    const ub = URGENCY_ORDER[b.urgency] ?? 3;
    if (ua !== ub) return ua - ub;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Derive unique categories for the datalist
  const categories = [...new Set(ideas.map((i) => i.category).filter(Boolean))].sort();

  return NextResponse.json({ ideas: sorted, categories });
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

  return NextResponse.json(idea, { status: 201 });
}

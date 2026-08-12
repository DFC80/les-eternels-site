export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function requireAdmin() {
  return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) return requireAdmin();

  const notes = await prisma.adminNote.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { position: "asc" } } },
  });
  return NextResponse.json(notes);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) return requireAdmin();

  const { title, description, isActive, type, items } = (await request.json()) as {
    title?: string;
    description?: string;
    isActive?: boolean;
    type?: string;
    items?: { label: string }[];
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Le titre est requis." }, { status: 400 });
  }

  const noteType = type === "LIST" ? "LIST" : "NOTE";

  const note = await prisma.adminNote.create({
    data: {
      title: title.trim(),
      description: description?.trim() ?? "",
      isActive: isActive ?? true,
      type: noteType,
      items:
        noteType === "LIST" && items?.length
          ? {
              create: items.map((item, i) => ({
                label: item.label.trim(),
                position: i,
              })),
            }
          : undefined,
    },
    include: { items: { orderBy: { position: "asc" } } },
  });

  return NextResponse.json(note, { status: 201 });
}

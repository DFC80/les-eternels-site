export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const canSeePrivate = sessionHasAccess(session.user as never, "documents");

  const docs = await prisma.assocDocument.findMany({
    where: canSeePrivate ? {} : { visibility: "PUBLIC" },
    select: { id: true, name: true, description: true, mime: true, size: true, visibility: true, category: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(docs);
}

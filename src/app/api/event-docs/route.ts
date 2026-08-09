export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId requis." }, { status: 400 });

  const canSeePrivate = sessionHasAccess(session.user as never, "documents");

  const links = await prisma.eventAssocDocument.findMany({
    where: {
      eventId,
      ...(canSeePrivate ? {} : { document: { visibility: "PUBLIC" } }),
    },
    include: {
      document: { select: { id: true, name: true, mime: true } },
    },
    orderBy: { document: { name: "asc" } },
  });

  return NextResponse.json(links.map((l) => l.document));
}

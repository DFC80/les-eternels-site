export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse(null, { status: 401 });

  const doc = await prisma.assocDocument.findUnique({
    where: { id: params.id },
    select: { content: true, mime: true, name: true, visibility: true },
  });

  if (!doc) return new NextResponse(null, { status: 404 });

  if (doc.visibility === "PRIVATE" && !sessionHasAccess(session.user as never, "documents")) {
    return new NextResponse(null, { status: 403 });
  }

  const filename = encodeURIComponent(doc.name);
  return new NextResponse(doc.content, {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

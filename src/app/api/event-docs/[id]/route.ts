export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const doc = await prisma.eventDocument.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, content: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  return new Response(new Uint8Array(doc.content), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name)}.pdf"`,
      "Content-Length": String(doc.content.length),
    },
  });
}

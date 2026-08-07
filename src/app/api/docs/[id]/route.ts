import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "activity-docs");

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const doc = await prisma.activityDocument.findUnique({ where: { id: params.id } });
  if (!doc) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  if (!isFullAdmin(session.user.role)) {
    const currentYear = new Date().getFullYear();
    const membership = await prisma.membership.findUnique({
      where: { userId: session.user.id },
      include: { extraActivities: true },
    });

    const validMembership = membership && membership.year === currentYear;
    let covered = false;

    if (validMembership) {
      if (doc.activityKey === "JEUX_DE_PLATEAU") covered = membership.wantsBoardGames;
      else if (doc.activityKey === "JEUX_DE_ROLE") covered = membership.wantsRolePlay;
      else if (doc.activityKey === "AIRSOFT") covered = membership.wantsAirsoft;
      else covered = membership.extraActivities.some((a) => a.activityKey === doc.activityKey);
    }

    if (!covered) {
      return NextResponse.json(
        { error: "Cotisation requise pour cette activité." },
        { status: 403 }
      );
    }
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(path.join(UPLOAD_DIR, doc.filename));
  } catch {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name)}.pdf"`,
      "Content-Length": String(buffer.length),
    },
  });
}

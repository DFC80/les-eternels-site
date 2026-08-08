export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "reunions")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { type, date, location, agenda, notes, isPublished } = body as {
    type?: string;
    date?: string;
    location?: string;
    agenda?: string;
    notes?: string;
    isPublished?: boolean;
  };

  if (!type || !["BUREAU", "ASSEMBLEE_GENERALE"].includes(type)) {
    return NextResponse.json({ error: "Type invalide." }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: "Date requise." }, { status: 400 });
  }

  const meeting = await prisma.meeting.update({
    where: { id: params.id },
    data: {
      type,
      date: new Date(date),
      location: location || "",
      agenda: agenda || null,
      notes: notes || null,
      isPublished: isPublished ?? false,
    },
  });

  return NextResponse.json(meeting);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "reunions")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.meeting.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}

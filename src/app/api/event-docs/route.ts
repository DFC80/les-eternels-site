export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId requis." }, { status: 400 });
  }

  const docs = await prisma.eventDocument.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json(docs);
}

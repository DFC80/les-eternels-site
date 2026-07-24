import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityKey = searchParams.get("activityKey");
  if (!activityKey) {
    return NextResponse.json({ error: "activityKey requis." }, { status: 400 });
  }

  const onlyEvents = searchParams.get("showInEvents") === "true";

  const docs = await prisma.activityDocument.findMany({
    where: { activityKey, ...(onlyEvents ? { showInEvents: true } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json(docs);
}

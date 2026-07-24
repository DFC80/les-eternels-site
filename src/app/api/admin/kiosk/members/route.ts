import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "kiosque")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const members = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ firstName: "asc" }, { name: "asc" }],
    select: { id: true, firstName: true, name: true, balance: true },
  });

  return NextResponse.json(members);
}
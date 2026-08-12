export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function requireAdmin() {
  return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "notes")) return requireAdmin();

  const { isChecked, label } = (await request.json()) as {
    isChecked?: boolean;
    label?: string;
  };

  const item = await prisma.adminNoteItem.update({
    where: { id: params.itemId },
    data: {
      ...(isChecked !== undefined && { isChecked }),
      ...(label !== undefined && { label: label.trim() }),
    },
  });

  return NextResponse.json(item);
}

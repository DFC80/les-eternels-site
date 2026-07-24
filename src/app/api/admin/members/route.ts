import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "members")) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const members = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isPending: true,
      createdAt: true,
      bureauRoles: { select: { bureauRole: { select: { id: true, label: true, order: true } } } },
      _count: { select: { registrations: true } },
      membership: {
        select: {
          year: true,
          wantsBoardGames: true,
          wantsRolePlay: true,
          wantsAirsoft: true,
          amount: true,
          isPaid: true,
          paidAt: true,
          paidAmount: true,
          extraActivities: { select: { activityKey: true } },
        },
      },
    },
  });

  const currentYear = new Date().getFullYear();
  const withExpiry = members.map((m) => ({
    ...m,
    bureauRoles: m.bureauRoles.map((r) => r.bureauRole),
    membership: m.membership
      ? { ...m.membership, expired: m.membership.year !== currentYear }
      : null,
  }));

  return NextResponse.json(withExpiry);
}


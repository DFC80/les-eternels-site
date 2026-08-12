export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, FULL_ADMIN_ROLES, HARDCODED_SECTION_MAP, type AdminSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin((session.user as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const [bureauRoles, dbPerms] = await Promise.all([
    prisma.bureauRole.findMany({ orderBy: { order: "asc" } }),
    prisma.rolePermission.findMany(),
  ]);

  // Regrouper les permissions DB par rôle : { section → level }
  const dbByRole = new Map<string, Record<string, string>>();
  for (const p of dbPerms) {
    if (!dbByRole.has(p.roleLabel)) dbByRole.set(p.roleLabel, {});
    dbByRole.get(p.roleLabel)![p.section] = p.level ?? "write";
  }

  // Exclure les rôles full admin (ils ont toujours accès à tout)
  const roles = bureauRoles
    .filter((r) => !FULL_ADMIN_ROLES.includes(r.label))
    .map((r) => {
      const fromDb = dbByRole.has(r.label);
      const permissions: Record<string, string> = fromDb
        ? dbByRole.get(r.label)!
        : Object.fromEntries((HARDCODED_SECTION_MAP[r.label] ?? []).map((s) => [s, "write"]));
      return { label: r.label, permissions, fromDb };
    });

  return NextResponse.json({ roles });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin((session.user as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { permissions } = (await request.json()) as {
    permissions: Array<{ role: string; entries: Array<{ section: string; level: string }> }>;
  };

  if (!Array.isArray(permissions)) {
    return NextResponse.json({ error: "Format invalide." }, { status: 400 });
  }

  // Remplacer toutes les permissions en transaction
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({
      where: { roleLabel: { in: permissions.map((p) => p.role) } },
    }),
    prisma.rolePermission.createMany({
      data: permissions.flatMap(({ role, entries }) =>
        entries.map(({ section, level }) => ({
          roleLabel: role,
          section: section as AdminSection,
          level: level === "read" ? "read" : "write",
        }))
      ),
    }),
  ]);

  return NextResponse.json({ ok: true });
}

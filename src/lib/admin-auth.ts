import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { isFullAdmin, canAccessSection, AdminSection } from "./permissions";

/** Accès complet (ADMIN, Président, Vice-président) */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) return null;
  return session;
}

/** Accès à une section spécifique (full admin OU rôle bureau autorisé) */
export async function requireAccess(section: AdminSection) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const role = session.user.role ?? "";
  if (!isFullAdmin(role) && !canAccessSection(role, section)) return null;
  return session;
}

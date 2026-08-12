import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { tokenHasAccess, isFullAdmin, type AdminSection } from "@/lib/permissions";

// Correspondance URL → section admin
const ADMIN_SECTION_MAP: { prefix: string; section: AdminSection; fullAdminOnly?: boolean }[] = [
  { prefix: "/admin/members",      section: "members" },
  { prefix: "/admin/events",       section: "events" },
  { prefix: "/admin/comptabilite", section: "comptabilite" },
  { prefix: "/admin/equipements",  section: "equipements" },
  { prefix: "/admin/galerie",      section: "galerie" },
  { prefix: "/admin/produits",     section: "produits" },
  { prefix: "/admin/kiosque",      section: "kiosque" },
  { prefix: "/admin/activites",    section: "activites" },
  { prefix: "/admin/bureau",       section: "bureau" },
  { prefix: "/admin/jeux",         section: "jeux" },
  { prefix: "/admin/actualites",   section: "content" },
  { prefix: "/admin/sondages",     section: "sondages" },
  { prefix: "/admin/reunions",     section: "reunions" },
  { prefix: "/admin/documents",    section: "documents" },
  { prefix: "/admin/notes",        section: "notes" },
  { prefix: "/admin/parametres",   section: "parametres" },
  { prefix: "/admin/permissions",  section: "parametres", fullAdminOnly: true },
];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = (req.nextauth.token?.role as string) ?? "";

    // Bloquer les membres purs de toutes les pages admin
    if (pathname.startsWith("/admin") && (role === "MEMBER" || !role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Vérifier l'accès à la section spécifique
    const match = ADMIN_SECTION_MAP.find((m) => pathname.startsWith(m.prefix));
    if (match) {
      if (match.fullAdminOnly && !isFullAdmin(role)) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      if (!match.fullAdminOnly) {
        const allowedSections = req.nextauth.token?.allowedSections as string[] | null | undefined;
        if (!tokenHasAccess(role, allowedSections, match.section)) {
          return NextResponse.redirect(new URL("/admin", req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/mon-compte/:path*", "/profil/:path*", "/comptoir/:path*", "/comptoir"],
};

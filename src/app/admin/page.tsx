import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess, isFullAdmin, type AdminSection } from "@/lib/permissions";

type Card = {
  href: string;
  icon: string;
  title: string;
  description: string;
  section: AdminSection;
  fullAdminOnly?: boolean;
};

const CARDS: Card[] = [
  { href: "/admin/members",      icon: "👥", title: "Membres",                section: "members",      description: "Voir la liste des membres, gérer les rôles et l'activation des comptes." },
  { href: "/admin/events",       icon: "📅", title: "Événements",             section: "events",       description: "Créer, modifier ou supprimer des événements du calendrier." },
  { href: "/admin/comptabilite", icon: "💶", title: "Comptabilité",           section: "comptabilite", description: "Suivre les gains et dépenses des événements et les dépenses générales." },
  { href: "/admin/equipements",  icon: "🔫", title: "Équipements Airsoft",    section: "equipements",  description: "Gérer les répliques et équipements disponibles à la location." },
  { href: "/admin/galerie",      icon: "🖼️", title: "Galerie photo",          section: "galerie",      description: "Ajouter et gérer les photos de l'association." },
  { href: "/admin/jeux",         icon: "🎲", title: "Jeux de société",        section: "jeux",         description: "Gérer le stock des jeux de société prêtés par les membres." },
  { href: "/admin/produits",     icon: "🍬", title: "Friandises & boissons",  section: "produits",     description: "Gérer le stock, les prix et les photos des friandises et boissons." },
  { href: "/admin/kiosque",      icon: "🛒", title: "Comptoir (tablette)",    section: "kiosque",      description: "Page tactile pour vendre friandises et boissons pendant les soirées jeux." },
  { href: "/admin/activites",    icon: "📝", title: "Pages d'activités",      section: "activites",    description: "Modifier le texte de présentation des activités affiché sur le site." },
  { href: "/admin/bureau",       icon: "🏛️", title: "Bureau",                 section: "bureau",       description: "Gérer les rôles du bureau et assigner des membres à ces postes." },
  { href: "/admin/actualites",   icon: "📰", title: "Actualités",             section: "content",      description: "Créer et gérer les articles d'actualité publiés sur le site." },
  { href: "/admin/sondages",     icon: "📊", title: "Sondages",               section: "sondages",     description: "Créer des sondages et consulter les résultats des votes membres." },
  { href: "/admin/reunions",     icon: "📋", title: "Réunions & AG",           section: "reunions",     description: "Gérer les réunions de bureau et les assemblées générales de l'association." },
  { href: "/admin/documents",    icon: "📁", title: "Documents",               section: "documents",    description: "Gérer les documents de l'association (statuts, CR, formulaires…). Visibilité publique ou privée." },
  { href: "/admin/parametres",   icon: "⚙️", title: "Paramètres",             section: "parametres",   description: "Modifier le descriptif de l'association affiché sur la page d'accueil." },
  { href: "/admin/permissions",  icon: "🔐", title: "Permissions",            section: "parametres",   description: "Configurer les sections admin accessibles pour chaque rôle de bureau.", fullAdminOnly: true },
  { href: "/admin/notes",        icon: "📝", title: "Notes admin",            section: "notes",        description: "Espace de notes interne réservé aux administrateurs." },
];

export default async function AdminHome() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "MEMBER";
  const fullAdmin = isFullAdmin(role);
  const user = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;

  const visibleCards = CARDS.filter(
    (c) => !c.fullAdminOnly && sessionHasAccess(user, c.section)
  ).concat(fullAdmin ? CARDS.filter((c) => c.fullAdminOnly) : []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Administration</h1>
      <p className="mt-2 text-slate-400">Gérez les membres et les événements de l'association.</p>

      {visibleCards.length === 0 && (
        <p className="mt-8 text-slate-400">Vous n'avez accès à aucune section d'administration.</p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {visibleCards.map((card) => {
          const canWrite = card.fullAdminOnly || sessionHasWriteAccess(user, card.section);
          return (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-xl border border-primary-800 bg-primary-900/40 p-6 shadow-lg shadow-black/30 hover:border-primary-400"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg text-silver-100">{card.icon} {card.title}</h2>
                {!canWrite && (
                  <span className="mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-sky-900/60 text-sky-300">
                    👁 Lecture
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-400">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

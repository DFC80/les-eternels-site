export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import HomePollWidget from "@/components/HomePollWidget";
import HomeCarouselWidget from "@/components/HomeCarouselWidget";
import HomeMarketWidget from "@/components/HomeMarketWidget";
import { canAccessAdmin, isFullAdmin } from "@/lib/permissions";

async function getLatestArticle() {
  return prisma.newsArticle.findFirst({
    where: { published: true },
    orderBy: { date: "desc" },
    include: { _count: { select: { comments: true } } },
  });
}


async function getLatestPublishedAG() {
  return prisma.meeting.findFirst({
    where: { type: "ASSEMBLEE_GENERALE", isPublished: true },
    orderBy: { date: "desc" },
  });
}

async function getUpcomingEvents() {
  return prisma.event.findMany({
    where: { startsAt: { gt: new Date() }, bureauOnly: false, showOnHome: true },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      activityType: true,
      location: true,
      startsAt: true,
      capacity: true,
      _count: { select: { registrations: true } },
    },
  });
}

async function getHomeIdeas() {
  return prisma.idea.findMany({
    where: { showOnHome: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, category: true, urgency: true },
  });
}

async function getSettings() {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ["description", "logoVersion"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    description: map.description ?? "Une association à but non lucratif réunissant les passionnés de jeux de plateau, jeux de rôle et airsoft.",
    logoSrc: `/logo.jpg${map.logoVersion ? `?v=${map.logoVersion}` : ""}`,
  };
}

export default async function HomePage() {
  const [session, { description, logoSrc }, latestArticle, latestAG, upcomingEvents, homeIdeas] = await Promise.all([
    getServerSession(authOptions),
    getSettings(),
    getLatestArticle(),
    getLatestPublishedAG(),
    getUpcomingEvents(),
    getHomeIdeas(),
  ]);

  const userHasMembership = session
    ? !!(await prisma.membership.findUnique({ where: { userId: session.user.id }, select: { id: true } }))
    : false;

  const isBureau = session ? canAccessAdmin(session.user.role ?? "") : false;
  const isAdmin = session ? isFullAdmin(session.user.role ?? "") : false;

  const adminNotes = isAdmin
    ? await prisma.adminNote.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        include: { items: { orderBy: { position: "asc" } } },
      })
    : [];

  const bureauMeetings = isBureau
    ? await prisma.meeting.findMany({
        where: { type: "BUREAU" },
        orderBy: { date: "desc" },
        take: 3,
      })
    : [];

  return (
    <div>
      <section className="relative overflow-hidden bg-radial-glow">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <Image
            src={logoSrc}
            unoptimized
            alt="Logo Les Éternels"
            width={200}
            height={127}
            className="mx-auto rounded-lg shadow-2xl shadow-black/50"
            priority
          />
          <h1 className="mt-5 font-brand text-4xl text-silver-100 sm:text-5xl lg:text-6xl">Les Éternels</h1>
          <p className="mx-auto mt-3 max-w-2xl font-display text-lg tracking-wide text-silver-300">
            {description}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-4">
            {session ? (
              <Link
                href="/mon-compte"
                className="rounded-md bg-primary-400 px-5 py-2.5 font-semibold text-primary-950 hover:bg-silver-300"
              >
                Mon adhésion
              </Link>
            ) : (
              <Link
                href="/register"
                className="rounded-md bg-primary-400 px-5 py-2.5 font-semibold text-primary-950 hover:bg-silver-300"
              >
                Rejoindre l'association
              </Link>
            )}
            <Link
              href="/calendar"
              className="rounded-md border border-silver-400 px-5 py-2.5 font-semibold text-silver-200 hover:bg-primary-900"
            >
              Voir les événements
            </Link>
          </div>
        </div>
      </section>


      {upcomingEvents.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-silver-100">Prochains événements</h2>
            <Link href="/calendar" className="text-sm text-primary-300 hover:text-silver-200 hover:underline">
              Voir le calendrier →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {upcomingEvents.map((ev) => {
              const isFull = ev.capacity != null && ev._count.registrations >= ev.capacity;
              return (
                <Link
                  key={ev.id}
                  href={`/calendar?event=${ev.id}`}
                  className="rounded-xl border border-primary-800 bg-primary-900/50 p-4 transition hover:border-primary-600 hover:bg-primary-800/60"
                >
                  <h3 className="mt-2 font-display text-base text-silver-100">{ev.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    📅{" "}
                    {new Date(ev.startsAt).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    {" · "}
                    {new Date(ev.startsAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {ev.location && (
                    <p className="mt-1 text-xs text-slate-500">📍 {ev.location}</p>
                  )}
                  {ev.capacity != null && (
                    <p className={`mt-2 text-xs font-medium ${isFull ? "text-red-400" : "text-slate-500"}`}>
                      {isFull ? "Complet" : `${ev._count.registrations} / ${ev.capacity} inscrit${ev._count.registrations > 1 ? "s" : ""}`}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {homeIdeas.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-silver-100">💡 Idées des membres</h2>
            {session && (
              <Link href="/idees" className="text-sm text-primary-300 hover:text-silver-200 hover:underline">
                Voir toutes les idées →
              </Link>
            )}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {homeIdeas.map((idea) => {
              const urgencyClass =
                idea.urgency === "HAUTE"
                  ? "bg-red-950/60 text-red-300"
                  : idea.urgency === "MOYENNE"
                    ? "bg-amber-950/60 text-amber-300"
                    : "bg-emerald-950/60 text-emerald-300";
              const urgencyLabel =
                idea.urgency === "HAUTE" ? "🔴 Haute" : idea.urgency === "MOYENNE" ? "🟡 Moyenne" : "🟢 Basse";
              return (
                <Link key={idea.id} href="/idees" className="rounded-xl border border-primary-800 bg-primary-900/40 p-4 transition hover:border-primary-600 hover:bg-primary-800/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${urgencyClass}`}>
                      {urgencyLabel}
                    </span>
                    <span className="rounded bg-primary-800/60 px-2 py-0.5 text-xs text-slate-400">
                      {idea.category}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-base text-silver-100">{idea.title}</h3>
                  <p className="mt-1 line-clamp-3 text-sm text-slate-400">{idea.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {userHasMembership && <HomePollWidget />}

      {isBureau && bureauMeetings.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-silver-100">🏢 Réunions de bureau</h2>
            <Link
              href="/admin/reunions"
              className="rounded-md border border-primary-700 px-3 py-1.5 text-sm text-primary-300 hover:bg-primary-900"
            >
              Gérer les réunions →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {bureauMeetings.map((m) => {
              const isPast = new Date(m.date) < new Date();
              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-primary-800 bg-primary-900/50 p-4"
                >
                  {isPast ? (
                    <span className="inline-block rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                      Passée
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-primary-900 px-2 py-0.5 text-xs font-semibold text-primary-300 border border-primary-700">
                      À venir
                    </span>
                  )}
                  <p className="mt-1.5 text-sm font-semibold text-silver-100">
                    {new Date(m.date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(m.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    {m.location && <span className="ml-2">· 📍 {m.location}</span>}
                  </p>
                  {m.agenda && (
                    <p className="mt-2 line-clamp-3 text-xs text-slate-300 leading-relaxed">
                      {m.agenda}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isAdmin && adminNotes.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-silver-100">📝 Notes admin</h2>
            <Link
              href="/admin/notes"
              className="rounded-md border border-primary-700 px-3 py-1.5 text-sm text-primary-300 hover:bg-primary-900"
            >
              Gérer les notes →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {adminNotes.map((note) => {
              const checkedCount = note.items.filter((i: { isChecked: boolean }) => i.isChecked).length;
              return (
                <Link
                  key={note.id}
                  href={`/admin/notes/${note.id}/print`}
                  className="block rounded-xl border border-primary-800 bg-primary-900/50 p-4 transition hover:border-primary-600 hover:bg-primary-900/80"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{note.type === "LIST" ? "🛒" : "📝"}</span>
                    <p className="font-display text-sm text-silver-100">{note.title}</p>
                    {note.type === "LIST" && note.items.length > 0 && (
                      <span className="ml-auto rounded-full bg-primary-800/60 px-2 py-0.5 text-xs text-slate-400">
                        {checkedCount}/{note.items.length}
                      </span>
                    )}
                  </div>
                  {note.type === "NOTE" && note.description && (
                    <p className="mt-2 line-clamp-3 text-xs text-slate-400 leading-relaxed">
                      {note.description}
                    </p>
                  )}
                  {note.type === "LIST" && note.items.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {note.items.slice(0, 5).map((item: { id: string; label: string; isChecked: boolean }) => (
                        <li key={item.id} className="flex items-center gap-2 text-xs">
                          <span className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center text-[9px] ${item.isChecked ? "border-emerald-500 bg-emerald-500 text-white" : "border-primary-600"}`}>
                            {item.isChecked ? "✓" : ""}
                          </span>
                          <span className={item.isChecked ? "text-slate-500 line-through" : "text-slate-300"}>
                            {item.label}
                          </span>
                        </li>
                      ))}
                      {note.items.length > 5 && (
                        <li className="text-xs text-slate-500">+{note.items.length - 5} autre(s)…</li>
                      )}
                    </ul>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {session && <HomeMarketWidget />}
      <HomeCarouselWidget />

      {(latestAG || latestArticle) && (
        <div className={`mx-auto max-w-6xl px-4 py-6 ${latestAG && latestArticle ? "grid gap-6 sm:grid-cols-2" : ""}`}>
          {latestAG && (
            <div>
              <h2 className="font-display text-xl text-silver-100">
                🏛️ AG {new Date(latestAG.date).getFullYear()}
              </h2>
              <div className="mt-3 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4">
                <p className="text-sm font-medium text-amber-300">
                  📅{" "}
                  {new Date(latestAG.date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {latestAG.location && (
                    <span className="ml-3 text-amber-400/70">📍 {latestAG.location}</span>
                  )}
                </p>
                {latestAG.agenda && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordre du jour</p>
                    <p className="mt-1 text-sm text-slate-300 leading-relaxed line-clamp-4">
                      {latestAG.agenda}
                    </p>
                  </div>
                )}
                {latestAG.notes && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compte-rendu</p>
                    <p className="mt-1 text-sm text-slate-300 leading-relaxed line-clamp-4">
                      {latestAG.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {latestArticle && (
            <div>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl text-silver-100">Dernière actualité</h2>
                <Link href="/actualites" className="text-sm text-primary-300 hover:underline">Toutes →</Link>
              </div>
              <Link href={`/actualites/${latestArticle.id}`}
                className="mt-3 flex gap-3 rounded-xl border border-primary-800 bg-primary-900/50 p-4 transition hover:border-primary-600 hover:bg-primary-800/60">
                {latestArticle.photos?.split("\n").find((u) => u.trim()) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={latestArticle.photos.split("\n").find((u) => u.trim())!} alt=""
                    className="h-20 w-20 flex-shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0">
                  <h3 className="font-display text-base text-silver-100 line-clamp-2">{latestArticle.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(latestArticle.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    {" · "}{latestArticle._count.comments} commentaire{latestArticle._count.comments !== 1 ? "s" : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-300 line-clamp-3">
                    {latestArticle.content}
                  </p>
                </div>
              </Link>
            </div>
          )}
        </div>
      )}

      {!session && (
        <section className="border-t border-primary-800 bg-primary-900/40 py-10">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h2 className="font-display text-3xl text-silver-100">Envie de nous rejoindre ?</h2>
            <p className="mt-4 text-slate-400">
              Créez votre compte membre pour vous inscrire aux événements et suivre l'actualité de
              l'association.
            </p>
            <div className="mt-6">
              <Link
                href="/register"
                className="rounded-md bg-primary-400 px-5 py-2.5 font-semibold text-primary-950 hover:bg-silver-300"
              >
                Créer mon compte
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

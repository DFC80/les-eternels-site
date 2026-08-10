export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CORE_ACTIVITIES } from "@/lib/activity-colors";
import HomePollWidget from "@/components/HomePollWidget";
import HomeCarouselWidget from "@/components/HomeCarouselWidget";
import HomeMarketWidget from "@/components/HomeMarketWidget";
import { canAccessAdmin } from "@/lib/permissions";

async function getLatestArticle() {
  return prisma.newsArticle.findFirst({
    where: { published: true },
    orderBy: { date: "desc" },
    include: { _count: { select: { comments: true } } },
  });
}

async function getActivities() {
  for (const a of CORE_ACTIVITIES) {
    await prisma.activity.upsert({ where: { key: a.key }, update: { label: a.label }, create: a });
    await prisma.activity.updateMany({ where: { key: a.key, price: 0 }, data: { price: a.price } });
  }
  return prisma.activity.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
}

async function getLatestPublishedAG() {
  return prisma.meeting.findFirst({
    where: { type: "ASSEMBLEE_GENERALE", isPublished: true },
    orderBy: { date: "desc" },
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
  const [session, activities, { description, logoSrc }, latestArticle, latestAG] = await Promise.all([
    getServerSession(authOptions),
    getActivities(),
    getSettings(),
    getLatestArticle(),
    getLatestPublishedAG(),
  ]);

  const userHasMembership = session
    ? !!(await prisma.membership.findUnique({ where: { userId: session.user.id }, select: { id: true } }))
    : false;

  const isBureau = session ? canAccessAdmin(session.user.role ?? "") : false;

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
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <Image
            src={logoSrc}
            unoptimized
            alt="Logo Les Éternels"
            width={260}
            height={165}
            className="mx-auto rounded-lg shadow-2xl shadow-black/50"
            priority
          />
          <h1 className="mt-8 font-brand text-4xl text-silver-100 sm:text-5xl lg:text-6xl">Les Éternels</h1>
          <p className="mx-auto mt-4 max-w-2xl font-display text-lg tracking-wide text-silver-300">
            {description}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
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

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center font-display text-3xl text-silver-100">Nos activités</h2>
        <div className={`mt-10 grid gap-6 ${activities.length <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
          {activities.map((a) => (
            <Link
              key={a.key}
              href={`/activites?activite=${a.key}`}
              className="rounded-xl border border-primary-800 bg-primary-900/60 p-4 shadow-lg shadow-black/30 transition hover:border-primary-600 hover:bg-primary-800/60 sm:p-6"
            >
              <div className="text-4xl">{a.emoji}</div>
              <h3 className="mt-4 font-display text-lg text-silver-100">{a.label}</h3>
            </Link>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/activites" className="font-medium text-primary-300 hover:text-silver-200 hover:underline">
            En savoir plus sur nos activités →
          </Link>
        </div>
      </section>

      {userHasMembership && <HomePollWidget />}

      {isBureau && bureauMeetings.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-8 pt-2">
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

      {session && <HomeMarketWidget />}
      <HomeCarouselWidget />

      {latestAG && (
        <section className="mx-auto max-w-6xl px-4 pb-4 pt-2">
          <h2 className="font-display text-2xl text-silver-100">
            🏛️ Assemblée Générale {new Date(latestAG.date).getFullYear()}
          </h2>
          <div className="mt-4 rounded-xl border border-amber-800/50 bg-amber-950/20 p-5">
            <p className="text-sm font-medium text-amber-300">
              📅{" "}
              {new Date(latestAG.date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {latestAG.location && (
                <span className="ml-4 text-amber-400/70">📍 {latestAG.location}</span>
              )}
            </p>
            {latestAG.agenda && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordre du jour</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300 leading-relaxed line-clamp-4">
                  {latestAG.agenda}
                </p>
              </div>
            )}
            {latestAG.notes && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compte-rendu</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300 leading-relaxed line-clamp-4">
                  {latestAG.notes}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {latestArticle && (
        <section className="mx-auto max-w-6xl px-4 pb-4 pt-2">
          <h2 className="font-display text-2xl text-silver-100">Dernière actualité</h2>
          <Link href={`/actualites/${latestArticle.id}`}
            className="mt-4 flex flex-col gap-3 rounded-xl border border-primary-800 bg-primary-900/50 p-4 transition hover:border-primary-600 hover:bg-primary-800/60 sm:flex-row sm:gap-5 sm:p-5">
            {latestArticle.photos?.split("\n").find((u) => u.trim()) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={latestArticle.photos.split("\n").find((u) => u.trim())!} alt=""
                className="h-44 w-full rounded-lg object-cover sm:h-28 sm:w-28 sm:flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="font-display text-lg text-silver-100">{latestArticle.title}</h3>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(latestArticle.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                {" · "}
                {latestArticle._count.comments} commentaire{latestArticle._count.comments !== 1 ? "s" : ""}
              </p>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                {latestArticle.content.length > 200 ? latestArticle.content.slice(0, 200) + "…" : latestArticle.content}
              </p>
            </div>
          </Link>
          <div className="mt-3 text-right">
            <Link href="/actualites" className="text-sm text-primary-300 hover:underline">Toutes les actualités →</Link>
          </div>
        </section>
      )}

      {!session && (
        <section className="border-t border-primary-800 bg-primary-900/40 py-16">
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

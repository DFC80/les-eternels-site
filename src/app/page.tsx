import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CORE_ACTIVITIES } from "@/lib/activity-colors";

async function getActivities() {
  for (const a of CORE_ACTIVITIES) {
    await prisma.activity.upsert({ where: { key: a.key }, update: {}, create: a });
    await prisma.activity.updateMany({ where: { key: a.key, price: 0 }, data: { price: a.price } });
  }
  return prisma.activity.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
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
  const [session, activities, { description, logoSrc }] = await Promise.all([
    getServerSession(authOptions),
    getActivities(),
    getSettings(),
  ]);

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
          <h1 className="mt-8 font-brand text-5xl text-silver-100 sm:text-6xl">Les Éternels</h1>
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
              className="rounded-xl border border-primary-800 bg-primary-900/60 p-6 shadow-lg shadow-black/30 transition hover:border-primary-600 hover:bg-primary-800/60"
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

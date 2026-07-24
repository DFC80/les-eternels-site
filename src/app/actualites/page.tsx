import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

async function getArticles() {
  return prisma.newsArticle.findMany({
    where: { published: true },
    orderBy: { date: "desc" },
    include: { _count: { select: { comments: true } } },
  });
}

export default async function ActualitesPage() {
  const articles = await getArticles();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Actualités</h1>

      {articles.length === 0 ? (
        <p className="mt-8 text-slate-400">Aucune actualité publiée pour le moment.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {articles.map((a) => {
            const firstPhoto = a.photos?.split("\n").find((u) => u.trim());
            const dateLabel = new Date(a.date).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
            });
            const excerpt = a.content.length > 200 ? a.content.slice(0, 200) + "…" : a.content;
            return (
              <Link key={a.id} href={`/actualites/${a.id}`}
                className="flex flex-col gap-3 rounded-xl border border-primary-800 bg-primary-900/50 p-4 transition hover:border-primary-600 hover:bg-primary-800/60 sm:flex-row sm:gap-5 sm:p-5">
                {firstPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={firstPhoto} alt="" className="h-44 w-full rounded-lg object-cover sm:h-28 sm:w-28 sm:flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h2 className="font-display text-lg text-silver-100">{a.title}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {dateLabel} · {a._count.comments} commentaire{a._count.comments !== 1 ? "s" : ""}
                  </p>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">{excerpt}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

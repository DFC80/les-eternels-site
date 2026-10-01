"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatCentsToEuros } from "@/lib/money";

type Listing = {
  id: string;
  type: "VENTE" | "ECHANGE" | "RECHERCHE";
  title: string;
  description: string;
  price: number | null;
  photos: string | null;
  category: string | null;
  activityKey: string | null;
  status: "ACTIVE" | "VENDU" | "CLOS";
  createdAt: string;
  user: { id: string; firstName: string; name: string };
};

const TYPE_INFO: Record<string, { label: string; color: string; bg: string }> = {
  VENTE:     { label: "Vente",     color: "text-emerald-300", bg: "bg-emerald-900/60" },
  ECHANGE:   { label: "Échange",   color: "text-blue-300",    bg: "bg-blue-900/60" },
  RECHERCHE: { label: "Recherche", color: "text-amber-300",   bg: "bg-amber-900/60" },
};

const TYPE_ICON: Record<string, string> = {
  VENTE: "🏷️", ECHANGE: "🔄", RECHERCHE: "🔍",
};

const VISIBLE = 3;
const MAX_DOTS = 12;

export default function HomeMarketCarousel() {
  const { data: session } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch("/api/marketplace")
      .then((r) => (r.ok ? r.json() : []))
      .then((all: Listing[]) => setListings(all.filter((l) => l.status === "ACTIVE")));
  }, [session]);

  const prev = useCallback(
    () => setIndex((i) => (i - 1 + listings.length) % listings.length),
    [listings.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % listings.length),
    [listings.length]
  );

  useEffect(() => {
    if (listings.length <= VISIBLE || paused) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [listings.length, paused, next]);

  if (!session) return null;

  const count = Math.min(VISIBLE, listings.length);
  const canNavigate = listings.length > VISIBLE;

  const visibleListings = Array.from({ length: count }, (_, i) => ({
    listing: listings[(index + i) % listings.length],
    slot: i,
  }));

  const showDots = listings.length > 1 && listings.length <= MAX_DOTS;
  const showCounter = listings.length > MAX_DOTS;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-silver-100">🛒 Brocante</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/marche"
            className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-semibold text-primary-950 hover:bg-primary-400"
          >
            + Déposer une annonce
          </Link>
          <Link
            href="/marche"
            className="rounded-md border border-primary-700 px-3 py-1.5 text-sm text-primary-300 hover:bg-primary-900"
          >
            Voir tout{listings.length > 0 ? ` (${listings.length})` : ""} →
          </Link>
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-xl border border-primary-800 bg-primary-900/50 py-8 text-center">
          <p className="text-slate-400">Aucune annonce active pour le moment.</p>
          <Link
            href="/marche"
            className="mt-3 inline-block rounded-md bg-primary-500 px-3 py-1.5 text-sm font-semibold text-primary-950 hover:bg-primary-400"
          >
            + Soyez le premier à déposer une annonce
          </Link>
        </div>
      ) : (
        <div
          className="group relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className={`grid gap-3 ${
              count === 1 ? "grid-cols-1" : count === 2 ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            {visibleListings.map(({ listing: l, slot }) => {
              const t = TYPE_INFO[l.type] ?? TYPE_INFO.VENTE;
              const firstPhoto = l.photos?.split("\n").find((u) => u.trim());

              return (
                <Link
                  key={`${l.id}-${slot}`}
                  href="/marche"
                  className="overflow-hidden rounded-xl border border-primary-800 bg-primary-900/50 transition hover:border-primary-600 hover:bg-primary-800/60"
                >
                  {firstPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={firstPhoto} alt="" className="h-36 w-full object-cover" />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-primary-800/60 text-4xl">
                      {TYPE_ICON[l.type] ?? "🏷️"}
                    </div>
                  )}
                  <div className="p-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${t.bg} ${t.color}`}
                    >
                      {t.label}
                    </span>
                    <h3 className="mt-1.5 line-clamp-2 font-display text-sm text-silver-100">
                      {l.title}
                    </h3>
                    {l.price != null && (
                      <p className="mt-0.5 text-sm font-semibold text-primary-300">
                        {formatCentsToEuros(l.price)}
                      </p>
                    )}
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{l.description}</p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {l.user.firstName} ·{" "}
                      {new Date(l.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {canNavigate && (
            <>
              <button
                onClick={prev}
                className="absolute left-2 top-[72px] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-xl text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/70"
                aria-label="Précédent"
              >
                ‹
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-[72px] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-xl text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/70"
                aria-label="Suivant"
              >
                ›
              </button>
            </>
          )}

          {showDots && (
            <div className="mt-3 flex justify-center gap-1.5">
              {listings.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index
                      ? "w-5 bg-primary-400"
                      : "w-1.5 bg-primary-700 hover:bg-primary-500"
                  }`}
                  aria-label={`Annonce ${i + 1}`}
                />
              ))}
            </div>
          )}

          {showCounter && (
            <p className="mt-3 text-center text-xs text-slate-500">
              {index + 1} – {Math.min(index + VISIBLE, listings.length)} / {listings.length}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

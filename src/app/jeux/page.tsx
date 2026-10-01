"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type BoardGame = {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  photos: string[];
  minPlayers: number;
  maxPlayers: number;
  durationMinutes: number | null;
  activityKey: string | null;
  mechanics: string[];
  themes: string[];
  owner: { firstName: string; name: string };
};

type Activity = { key: string; label: string; emoji: string };

type Lightbox = { photos: string[]; index: number; name: string };

export default function JeuxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [games, setGames] = useState<BoardGame[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filterKey, setFilterKey] = useState("");
  const [search, setSearch] = useState("");
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/jeux")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setGames(Array.isArray(data) ? data : []));
    fetch("/api/activities")
      .then((r) => r.json())
      .then((list: Activity[]) => setActivities(list.filter((a) => a.key)));
  }, [status]);

  const closeLightbox = useCallback(() => setLightbox(null), []);
  const navLightbox = useCallback((dir: 1 | -1) => {
    setLightbox((prev) => {
      if (!prev) return null;
      const next = (prev.index + dir + prev.photos.length) % prev.photos.length;
      return { ...prev, index: next };
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!lightbox) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") navLightbox(1);
      if (e.key === "ArrowLeft") navLightbox(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox, navLightbox]);

  if (status === "loading" || status === "unauthenticated") return null;

  const usedKeys = new Set(games.map((g) => g.activityKey).filter(Boolean));
  const tabActivities = activities.filter((a) => usedKeys.has(a.key));

  const filtered = games.filter((g) => {
    const matchActivity = !filterKey || g.activityKey === filterKey;
    const q = search.toLowerCase();
    const matchSearch = !q || g.name.toLowerCase().includes(q) ||
      (g.version ?? "").toLowerCase().includes(q) ||
      g.mechanics.some((m) => m.toLowerCase().includes(q)) ||
      g.themes.some((t) => t.toLowerCase().includes(q));
    return matchActivity && matchSearch;
  });

  const activityMap = Object.fromEntries(activities.map((a) => [a.key, a]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">🎲 Ludothèque</h1>
      <p className="mt-2 text-slate-400">
        Jeux disponibles prêtés par les membres de l'association.
      </p>

      {/* Filtres */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterKey("")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            filterKey === ""
              ? "bg-primary-400 text-primary-950"
              : "border border-primary-800 text-slate-400 hover:border-primary-600 hover:text-slate-200"
          }`}
        >
          Tous ({games.length})
        </button>
        {tabActivities.map((a) => {
          const count = games.filter((g) => g.activityKey === a.key).length;
          return (
            <button
              key={a.key}
              onClick={() => setFilterKey(a.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filterKey === a.key
                  ? "bg-primary-400 text-primary-950"
                  : "border border-primary-800 text-slate-400 hover:border-primary-600 hover:text-slate-200"
              }`}
            >
              {a.emoji} {a.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Recherche */}
      <div className="mt-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un jeu, une mécanique, un thème…"
          className="w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none sm:max-w-sm"
        />
      </div>

      {/* Grille */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-slate-400">Aucun jeu disponible.</p>
        )}
        {filtered.map((game) => {
          const act = game.activityKey ? activityMap[game.activityKey] : null;
          return (
            <div key={game.id} className="flex flex-col rounded-xl border border-primary-800 bg-primary-900/40 overflow-hidden">
              {/* Photos */}
              {game.photos.length > 0 ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={game.photos[0]}
                    alt={game.name}
                    className="h-44 w-full object-cover cursor-pointer"
                    onClick={() => setLightbox({ photos: game.photos, index: 0, name: game.name })}
                  />
                  {game.photos.length > 1 && (
                    <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                      +{game.photos.length - 1} photo{game.photos.length > 2 ? "s" : ""}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex h-44 items-center justify-center bg-primary-950/60 text-4xl">🎲</div>
              )}

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-100">{game.name}</p>
                    {game.version && <p className="text-xs text-slate-400">{game.version}</p>}
                  </div>
                  {act && (
                    <span className="shrink-0 rounded-full bg-amber-900/50 px-2 py-0.5 text-xs text-amber-300">
                      {act.emoji} {act.label}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-slate-400">
                  {game.minPlayers === game.maxPlayers
                    ? `${game.minPlayers} joueur(s)`
                    : `${game.minPlayers}–${game.maxPlayers} joueurs`}
                  {game.durationMinutes != null && ` · ${game.durationMinutes} min`}
                </p>
                {game.description && (
                  <p className="mt-1 text-sm text-slate-400 line-clamp-3">{game.description}</p>
                )}

                {(game.mechanics.length > 0 || game.themes.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {game.mechanics.map((m) => (
                      <span key={m} className="rounded-full border border-primary-800 bg-primary-900/80 px-2 py-0.5 text-xs text-primary-300">
                        {m}
                      </span>
                    ))}
                    {game.themes.map((t) => (
                      <span key={t} className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-auto pt-3 text-xs text-slate-500">
                  Prêté par {game.owner.firstName} {game.owner.name}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
          onClick={closeLightbox}
        >
          <button
            className="absolute right-4 top-4 text-2xl text-white/70 hover:text-white"
            onClick={closeLightbox}
          >
            ✕
          </button>
          {lightbox.photos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/80"
                onClick={(e) => { e.stopPropagation(); navLightbox(-1); }}
              >
                ◀
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/80"
                onClick={(e) => { e.stopPropagation(); navLightbox(1); }}
              >
                ▶
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.photos[lightbox.index]}
            alt={lightbox.name}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.photos.length > 1 && (
            <p className="absolute bottom-4 text-sm text-white/70">
              {lightbox.index + 1} / {lightbox.photos.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

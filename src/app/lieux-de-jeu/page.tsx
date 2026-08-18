"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type GameLocation = {
  id: string;
  title: string;
  description: string;
  photos: string;
  isPublic: boolean;
  activity: { label: string; emoji: string } | null;
};

type Lightbox = { photos: string[]; index: number; title: string };

export default function LieuxDeJeuPage() {
  const { data: session } = useSession();
  const [locations, setLocations] = useState<GameLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);

  useEffect(() => {
    fetch("/api/game-locations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setLocations(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [session]);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  const navLightbox = useCallback((dir: 1 | -1) => {
    setLightbox((prev) => {
      if (!prev) return null;
      const next = (prev.index + dir + prev.photos.length) % prev.photos.length;
      return { ...prev, index: next };
    });
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") navLightbox(1);
      if (e.key === "ArrowLeft") navLightbox(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox, navLightbox]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl text-silver-100">📍 Lieux de jeu</h1>
      <p className="mt-1 text-slate-400">
        Découvrez les lieux où se retrouve l'association pour ses activités.
      </p>

      {loading ? (
        <div className="mt-12 text-center text-slate-400">Chargement…</div>
      ) : locations.length === 0 ? (
        <div className="mt-12 text-center text-slate-400">
          <p className="text-lg">Aucun lieu de jeu disponible pour le moment.</p>
          {!session && (
            <p className="mt-2 text-sm">
              <Link href="/login" className="text-primary-300 hover:underline">
                Connectez-vous
              </Link>{" "}
              pour voir tous les lieux réservés aux membres.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {locations.map((loc) => {
            const photos = loc.photos ? loc.photos.split("\n").filter(Boolean) : [];
            const firstPhoto = photos[0];
            return (
              <div
                key={loc.id}
                className="overflow-hidden rounded-xl border border-primary-800 bg-primary-900/40 shadow-lg shadow-black/20"
              >
                {firstPhoto ? (
                  <button
                    type="button"
                    onClick={() => setLightbox({ photos, index: 0, title: loc.title })}
                    className="block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={firstPhoto}
                      alt={loc.title}
                      className="h-48 w-full object-cover transition hover:brightness-90"
                    />
                  </button>
                ) : (
                  <div className="flex h-48 items-center justify-center bg-primary-800 text-5xl">
                    📍
                  </div>
                )}

                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="font-display text-lg text-silver-100">{loc.title}</h2>
                    {!loc.isPublic && (
                      <span className="rounded bg-sky-900/60 px-2 py-0.5 text-xs font-medium text-sky-300">
                        Membres
                      </span>
                    )}
                  </div>

                  {loc.activity && (
                    <p className="mt-1 text-sm text-primary-300">
                      {loc.activity.emoji} {loc.activity.label}
                    </p>
                  )}

                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                    {loc.description}
                  </p>

                  {photos.length > 1 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      {photos.slice(1).map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightbox({ photos, index: i + 1, title: loc.title })}
                          className="flex-shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            className="h-16 w-16 rounded-lg object-cover border border-primary-700 transition hover:brightness-90 hover:border-primary-400"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!session && locations.length > 0 && (
        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/login" className="text-primary-300 hover:underline">
            Connectez-vous
          </Link>{" "}
          pour accéder aux lieux réservés aux membres.
        </p>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={closeLightbox}
        >
          {/* Toolbar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm text-slate-300 font-medium">{lightbox.title}</span>
            <div className="flex items-center gap-3">
              {lightbox.photos.length > 1 && (
                <span className="text-xs text-slate-500">
                  {lightbox.index + 1} / {lightbox.photos.length}
                </span>
              )}
              <button
                onClick={closeLightbox}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Image */}
          <div className="relative flex max-h-[80vh] max-w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.photos[lightbox.index]}
              alt={`${lightbox.title} – photo ${lightbox.index + 1}`}
              className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
          </div>

          {/* Nav arrows */}
          {lightbox.photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); navLightbox(-1); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 text-lg"
                aria-label="Photo précédente"
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navLightbox(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 text-lg"
                aria-label="Photo suivante"
              >
                ›
              </button>
            </>
          )}

          {/* Thumbnail strip */}
          {lightbox.photos.length > 1 && (
            <div className="absolute bottom-4 flex gap-2 overflow-x-auto max-w-[90vw] px-2" onClick={(e) => e.stopPropagation()}>
              {lightbox.photos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setLightbox((prev) => prev ? { ...prev, index: i } : null)}
                  className={`flex-shrink-0 h-12 w-12 rounded overflow-hidden border-2 transition ${
                    i === lightbox.index ? "border-primary-400" : "border-transparent opacity-60 hover:opacity-90"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

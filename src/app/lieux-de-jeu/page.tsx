"use client";

import { useEffect, useState } from "react";
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

export default function LieuxDeJeuPage() {
  const { data: session } = useSession();
  const [locations, setLocations] = useState<GameLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/game-locations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setLocations(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [session]);

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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={firstPhoto}
                    alt={loc.title}
                    className="h-48 w-full object-cover"
                  />
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
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="h-16 w-16 flex-shrink-0 rounded-lg object-cover border border-primary-700"
                        />
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
    </div>
  );
}

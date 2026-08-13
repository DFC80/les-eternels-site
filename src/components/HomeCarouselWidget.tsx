"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type CarouselPhoto = {
  id: string;
  url: string;
  comment: string | null;
  date: string;
};

const VISIBLE = 3;

export default function HomeCarouselWidget() {
  const [photos, setPhotos] = useState<CarouselPhoto[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetch("/api/gallery/carousel")
      .then((r) => r.ok ? r.json() : [])
      .then(setPhotos);
  }, []);

  const prev = useCallback(() => setIndex((i) => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    if (photos.length <= VISIBLE || paused) return;
    const id = setInterval(next, 4000);
    return () => clearInterval(id);
  }, [photos.length, paused, next]);

  if (photos.length === 0) return null;

  const count = Math.min(VISIBLE, photos.length);
  const visiblePhotos = Array.from({ length: count }, (_, i) => ({
    photo: photos[(index + i) % photos.length],
    slot: i,
  }));

  const canNavigate = photos.length > VISIBLE;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-2">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl text-silver-100">Notre galerie</h2>
        <Link href="/galerie" className="text-sm text-primary-300 hover:underline">
          Voir toutes les photos →
        </Link>
      </div>

      <div
        className="group relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className={`grid gap-3 ${count === 1 ? "grid-cols-1" : count === 2 ? "grid-cols-2" : "grid-cols-3"}`}
        >
          {visiblePhotos.map(({ photo, slot }) => (
            <div
              key={`${photo.id}-${slot}`}
              className="relative overflow-hidden rounded-xl border border-primary-800"
              style={{ aspectRatio: "4/3" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.comment ?? "Photo de la galerie"}
                className="h-full w-full object-cover"
              />
              {photo.comment && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                  <p className="line-clamp-2 text-xs text-slate-200">{photo.comment}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {canNavigate && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-xl text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/70"
              aria-label="Précédent"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-xl text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/70"
              aria-label="Suivant"
            >
              ›
            </button>
          </>
        )}

        {photos.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-primary-400" : "w-1.5 bg-primary-700 hover:bg-primary-500"
                }`}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

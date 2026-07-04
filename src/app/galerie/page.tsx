"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getColors } from "@/lib/activity-colors";

type ActivityMeta = { key: string; label: string; emoji: string; color: string };

type Photo = {
  id: string;
  url: string;
  date: string;
  comment: string | null;
  activityType: string;
};

function GalerieContent() {
  const searchParams = useSearchParams();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activityOptions, setActivityOptions] = useState<ActivityMeta[]>([]);
  const [activityFilter, setActivityFilter] = useState(() => searchParams.get("activite") ?? "ALL");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [selected, setSelected] = useState<Photo | null>(null);

  useEffect(() => {
    fetch("/api/activities")
      .then((r) => r.json())
      .then((data: ActivityMeta[]) =>
        setActivityOptions([...data, { key: "AUTRE", label: "Autre", emoji: "📌", color: "slate" }])
      );
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activityFilter !== "ALL") params.set("activityType", activityFilter);
    params.set("sort", sort);
    fetch(`/api/gallery?${params.toString()}`)
      .then((res) => res.json())
      .then(setPhotos);
  }, [activityFilter, sort]);

  function getBadge(activityType: string) {
    const act = activityOptions.find((a) => a.key === activityType);
    const c = getColors(act?.color ?? "slate");
    return { badge: `${c.bg} ${c.text} ${c.border}`, label: act ? `${act.emoji} ${act.label}` : activityType };
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Galerie photo</h1>
      <p className="mt-2 text-slate-400">
        Revivez les moments forts de l'association à travers nos jeux de plateau, soirées jeux de
        rôle et sorties airsoft.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
          className="rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="ALL">Toutes les activités</option>
          {activityOptions.map((a) => (
            <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "desc" | "asc")}
          className="rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="desc">Plus récentes d'abord</option>
          <option value="asc">Plus anciennes d'abord</option>
        </select>
      </div>

      {photos.length === 0 ? (
        <p className="mt-10 text-sm text-slate-400">Aucune photo pour ce filtre.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {photos.map((p) => {
            const { badge, label } = getBadge(p.activityType);
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="group overflow-hidden rounded-xl border border-primary-800 bg-primary-900/40 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.comment ?? "Photo de l'association"} className="h-48 w-full object-cover transition group-hover:scale-105" />
                <div className="p-3">
                  <span className={`inline-block rounded border px-2 py-0.5 text-xs ${badge}`}>{label}</span>
                  <p className="mt-1 text-xs text-slate-400">{new Date(p.date).toLocaleDateString("fr-FR")}</p>
                  {p.comment && <p className="mt-1 truncate text-sm text-slate-300">{p.comment}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (() => {
        const { badge, label } = getBadge(selected.activityType);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setSelected(null)}
          >
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-primary-700 bg-primary-950 p-4" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.url} alt={selected.comment ?? ""} className="max-h-[70vh] w-full rounded-lg object-contain" />
              <div className="mt-3">
                <span className={`inline-block rounded border px-2 py-0.5 text-xs ${badge}`}>{label}</span>
                <p className="mt-1 text-sm text-slate-400">{new Date(selected.date).toLocaleDateString("fr-FR")}</p>
                {selected.comment && <p className="mt-1 text-sm text-slate-300">{selected.comment}</p>}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="mt-4 rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-primary-900"
              >
                Fermer
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function GaleriePage() {
  return (
    <Suspense>
      <GalerieContent />
    </Suspense>
  );
}

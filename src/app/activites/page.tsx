"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getColors } from "@/lib/activity-colors";

type Activity = {
  key: string;
  label: string;
  emoji: string;
  color: string;
  isActive: boolean;
  content: string;
};

type Photo = { id: string; url: string; comment: string | null };
type Doc = { id: string; name: string };

function ActivitiesContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docMsg, setDocMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/activities")
      .then((r) => r.json())
      .then((data: Activity[]) => {
        setActivities(data);
        const key = searchParams.get("activite");
        if (key) toggleExpand(key);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleExpand(key: string) {
    if (expanded === key) {
      setExpanded(null);
      setDocs([]);
      return;
    }
    setExpanded(key);
    setDocs([]);
    setDocMsg(null);

    setLoadingPhotos(true);
    setLoadingDocs(true);

    const [pr, dr] = await Promise.all([
      fetch(`/api/gallery?activityType=${key}&sort=desc`),
      fetch(`/api/activity-docs?activityKey=${key}`),
    ]);

    if (pr.ok) setPhotos((await pr.json()).slice(0, 6));
    setLoadingPhotos(false);

    if (dr.ok) setDocs(await dr.json());
    setLoadingDocs(false);
  }

  async function openDoc(id: string) {
    if (!session) {
      setDocMsg("Connectez-vous pour accéder à ce document.");
      return;
    }
    const res = await fetch(`/api/docs/${id}`);
    if (res.status === 403) {
      setDocMsg("Une cotisation pour cette activité est requise pour accéder à ce document.");
      return;
    }
    if (!res.ok) {
      setDocMsg("Erreur lors du chargement du document.");
      return;
    }
    setDocMsg(null);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="font-display text-3xl text-silver-100">Nos activités</h1>
      <p className="mt-3 text-slate-400">
        Découvrez en détail les activités proposées par l'association. Cliquez sur une
        activité pour voir des photos.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {activities.map((a) => {
          const isExpanded = expanded === a.key;
          const colors = getColors(a.color);
          return (
            <div
              key={a.key}
              className={`rounded-2xl border-2 bg-primary-900/40 p-6 transition-all ${
                isExpanded ? `${colors.border} sm:col-span-3` : "border-primary-800 hover:border-primary-600"
              } ${!a.isActive ? "opacity-50" : ""}`}
            >
              <button onClick={() => toggleExpand(a.key)} className="w-full text-left">
                <div className="text-4xl">{a.emoji}</div>
                <h2 className={`mt-3 font-display text-xl ${isExpanded ? colors.text : "text-silver-100"}`}>
                  {a.label}
                  {!a.isActive && <span className="ml-2 text-xs font-normal text-slate-500">(inactif)</span>}
                </h2>
                {!isExpanded && (
                  <p className="mt-2 text-sm text-slate-400 line-clamp-3">{a.content}</p>
                )}
              </button>

              {isExpanded && (
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="leading-relaxed text-slate-300">{a.content}</p>

                    {(loadingDocs || docs.length > 0) && (
                      <div className="mt-5">
                        <p className="text-sm font-medium text-slate-300">Documents</p>
                        {loadingDocs ? (
                          <p className="mt-2 text-sm text-slate-500">Chargement...</p>
                        ) : (
                          <ul className="mt-2 space-y-1.5">
                            {docs.map((d) => (
                              <li key={d.id}>
                                <button
                                  onClick={() => openDoc(d.id)}
                                  className="flex items-center gap-2 text-sm text-primary-300 hover:underline"
                                >
                                  <span>📄</span>
                                  <span>{d.name}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {docMsg && (
                          <p className="mt-2 text-xs text-amber-400">{docMsg}</p>
                        )}
                        {!session && !loadingDocs && docs.length > 0 && !docMsg && (
                          <p className="mt-2 text-xs text-slate-500">
                            <Link href="/login" className="text-primary-300 hover:underline">
                              Connectez-vous
                            </Link>{" "}
                            pour accéder aux documents.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-300">Photos récentes</p>
                    {loadingPhotos ? (
                      <p className="mt-2 text-sm text-slate-500">Chargement...</p>
                    ) : photos.length > 0 ? (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {photos.map((p) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={p.id}
                            src={p.url}
                            alt={p.comment ?? a.label}
                            className="h-20 w-full rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">Aucune photo disponible.</p>
                    )}
                    <Link
                      href={`/galerie?activite=${a.key}`}
                      className="mt-3 inline-block text-sm font-medium text-primary-300 hover:text-silver-200 hover:underline"
                    >
                      Voir toute la galerie →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  return (
    <Suspense>
      <ActivitiesContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { getColors } from "@/lib/activity-colors";

type ActivityMeta = { key: string; label: string; emoji: string; color: string };

type Photo = {
  id: string;
  url: string;
  date: string;
  comment: string | null;
  activities: { activityKey: string }[];
  _count?: { comments: number };
};

type PhotoComment = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; firstName: string; name: string };
};

function CommentsSection({
  photoId,
  initialCount,
  currentUserId,
}: {
  photoId: string;
  initialCount: number;
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<PhotoComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [count, setCount] = useState(initialCount);

  async function loadComments() {
    setLoading(true);
    const res = await fetch(`/api/gallery/${photoId}/comments`);
    if (res.ok) {
      const data = (await res.json()) as PhotoComment[];
      setComments(data);
      setCount(data.length);
    }
    setLoading(false);
  }

  function toggle() {
    if (!open && comments === null) loadComments();
    setOpen((o) => !o);
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch(`/api/gallery/${photoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setPostError(d.error ?? "Erreur.");
      } else {
        setText("");
        await loadComments();
      }
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(commentId: string) {
    await fetch(`/api/gallery/${photoId}/comments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    await loadComments();
  }

  return (
    <div className="mt-3 border-t border-primary-800 pt-3">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
      >
        <span>💬</span>
        <span>{count} commentaire{count !== 1 ? "s" : ""}</span>
        <span className="text-slate-600">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading && <p className="text-xs text-slate-500">Chargement…</p>}

          {comments && comments.length === 0 && (
            <p className="text-xs text-slate-500">Aucun commentaire. Soyez le premier !</p>
          )}

          {comments && comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-primary-800 bg-primary-950/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-silver-200">{c.user.firstName} {c.user.name}</span>
                  <span className="text-xs text-slate-600">
                    {new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                {c.user.id === currentUserId && (
                  <button type="button" onClick={() => deleteComment(c.id)} className="text-xs text-red-500 hover:text-red-400">
                    Supprimer
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{c.content}</p>
            </div>
          ))}

          {currentUserId ? (
            <form onSubmit={postComment} className="flex flex-col gap-2">
              <textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Votre commentaire…"
                className="w-full rounded-lg border border-primary-800 bg-primary-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-primary-500 focus:outline-none"
              />
              {postError && <p className="text-xs text-red-400">{postError}</p>}
              <button
                type="submit"
                disabled={posting || !text.trim()}
                className="self-start rounded-md bg-primary-500 px-3 py-1.5 text-xs font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50"
              >
                {posting ? "Envoi…" : "Publier"}
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-500">Connectez-vous pour laisser un commentaire.</p>
          )}
        </div>
      )}
    </div>
  );
}

function GalerieContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
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

  function getActivityBadges(activityKeys: string[]) {
    if (activityKeys.length === 0) return [];
    return activityKeys.map((key) => {
      const act = activityOptions.find((a) => a.key === key);
      const c = getColors(act?.color ?? "slate");
      return { badge: `${c.bg} ${c.text} ${c.border}`, label: act ? `${act.emoji} ${act.label}` : key };
    });
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
            const badges = getActivityBadges(p.activities.map((a) => a.activityKey));
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="group overflow-hidden rounded-xl border border-primary-800 bg-primary-900/40 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.comment ?? "Photo de l'association"} className="h-48 w-full object-cover transition group-hover:scale-105" />
                <div className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {badges.map(({ badge, label }) => (
                      <span key={label} className={`inline-block rounded border px-2 py-0.5 text-xs ${badge}`}>{label}</span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{new Date(p.date).toLocaleDateString("fr-FR")}</p>
                  {p.comment && <p className="mt-1 truncate text-sm text-slate-300">{p.comment}</p>}
                  {(p._count?.comments ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-slate-500">💬 {p._count!.comments} commentaire{p._count!.comments !== 1 ? "s" : ""}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (() => {
        const badges = getActivityBadges(selected.activities.map((a) => a.activityKey));
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setSelected(null)}
          >
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-primary-700 bg-primary-950 p-4" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.url} alt={selected.comment ?? ""} className="max-h-[60vh] w-full rounded-lg object-contain" />
              <div className="mt-3">
                <div className="flex flex-wrap gap-1">
                  {badges.map(({ badge, label }) => (
                    <span key={label} className={`inline-block rounded border px-2 py-0.5 text-xs ${badge}`}>{label}</span>
                  ))}
                </div>
                <p className="mt-1 text-sm text-slate-400">{new Date(selected.date).toLocaleDateString("fr-FR")}</p>
                {selected.comment && <p className="mt-1 text-sm text-slate-300">{selected.comment}</p>}
              </div>
              <CommentsSection
                photoId={selected.id}
                initialCount={selected._count?.comments ?? 0}
                currentUserId={currentUserId}
              />
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

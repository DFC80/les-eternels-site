"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAllowedActivityTypes, sessionHasWriteAccess } from "@/lib/permissions";
import ImageUpload from "@/components/ImageUpload";
import DateInput from "@/components/DateInput";

type ActivityOption = { key: string; label: string; emoji: string };

type Photo = {
  id: string;
  url: string;
  date: string;
  comment: string | null;
  activities: { activityKey: string }[];
  isFavorite: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

const today = new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { url: "", date: today, comment: "", activityKeys: [] as string[] };

export default function AdminGaleriePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(sessionUser, "galerie");
  const allowedTypes = getAllowedActivityTypes(role);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingComment, setEditingComment] = useState<{ id: string; value: string } | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [editingActivity, setEditingActivity] = useState<{ id: string; keys: string[] } | null>(null);
  const [savingActivity, setSavingActivity] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/gallery");
    if (res.ok) setPhotos(await res.json());
  }

  useEffect(() => {
    load();
    fetch("/api/activities")
      .then((r) => r.json())
      .then((data: ActivityOption[]) =>
        setActivityOptions([...data, { key: "AUTRE", label: "Autre", emoji: "📌" }])
      );
  }, []);

  function toggleFormActivity(key: string) {
    setForm((f) => ({
      ...f,
      activityKeys: f.activityKeys.includes(key)
        ? f.activityKeys.filter((k) => k !== key)
        : [...f.activityKeys, key],
    }));
  }

  function toggleEditActivity(key: string) {
    if (!editingActivity) return;
    setEditingActivity({
      ...editingActivity,
      keys: editingActivity.keys.includes(key)
        ? editingActivity.keys.filter((k) => k !== key)
        : [...editingActivity.keys, key],
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/admin/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: form.url, date: form.date, comment: form.comment, activityKeys: form.activityKeys }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de l'ajout.");
      return;
    }

    setForm(EMPTY_FORM);
    await load();
  }

  async function removePhoto(id: string) {
    if (!confirm("Supprimer cette photo ?")) return;
    const res = await fetch(`/api/admin/gallery/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function saveComment(id: string, comment: string) {
    setSavingComment(true);
    const res = await fetch(`/api/admin/gallery/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment.trim() || null }),
    });
    setSavingComment(false);
    if (res.ok) {
      setEditingComment(null);
      await load();
    }
  }

  async function saveActivities(id: string, keys: string[]) {
    setSavingActivity(true);
    const res = await fetch(`/api/admin/gallery/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityKeys: keys }),
    });
    setSavingActivity(false);
    if (res.ok) {
      setEditingActivity(null);
      await load();
    }
  }

  async function toggleFavorite(photo: Photo) {
    const res = await fetch(`/api/admin/gallery/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !photo.isFavorite }),
    });
    if (res.ok) await load();
  }

  function resolveActivityLabels(keys: string[]): string {
    if (keys.length === 0) return "Toutes activités";
    return keys.map((k) => {
      const a = activityOptions.find((o) => o.key === k);
      return a ? `${a.emoji} ${a.label}` : k;
    }).join(", ");
  }

  const visiblePhotos = allowedTypes
    ? photos.filter((p) => p.activities.length === 0 || p.activities.some((a) => allowedTypes.includes(a.activityKey)))
    : photos;
  const visibleActivityOptions = allowedTypes
    ? activityOptions.filter((a) => allowedTypes.includes(a.key))
    : activityOptions;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Galerie photo</h1>
      <p className="mt-2 text-slate-400">Ajoutez des photos de l'association à la galerie publique.</p>

      {canWrite && <form onSubmit={handleSubmit} className="mt-8 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ImageUpload
            label="Photo"
            value={form.url}
            onChange={(url) => setForm({ ...form, url })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Date</label>
          <DateInput
            required
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Activités associées</label>
          <p className="mt-1 text-xs text-slate-500">Si aucune activité n'est cochée, la photo est visible par tous les adhérents.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {visibleActivityOptions.map((a) => (
              <label key={a.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary-700 bg-primary-950/60 px-3 py-2 text-sm text-slate-200 hover:border-primary-500">
                <input
                  type="checkbox"
                  checked={form.activityKeys.includes(a.key)}
                  onChange={() => toggleFormActivity(a.key)}
                  className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
                />
                {a.emoji} {a.label}
              </label>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300">Commentaire (optionnel)</label>
          <textarea
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            rows={2}
            placeholder="Ex: Tournoi annuel de jeux de plateau"
            className={inputClass}
          />
        </div>

        {error && <p className="sm:col-span-2 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="sm:col-span-2 rounded-md bg-primary-400 px-5 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
        >
          {saving ? "Ajout..." : "Ajouter la photo"}
        </button>
      </form>}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {visiblePhotos.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-xl border border-primary-800 bg-primary-900/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.comment ?? ""} className="h-40 w-full object-cover" />
            <div className="p-3">

              {/* Activity badges / edit */}
              {canWrite && editingActivity?.id === p.id ? (
                <div className="mb-2">
                  <p className="mb-1.5 text-xs text-slate-400">Activités associées :</p>
                  <div className="flex flex-wrap gap-2">
                    {visibleActivityOptions.map((a) => (
                      <label key={a.key} className="flex cursor-pointer items-center gap-1.5 rounded border border-primary-700 bg-primary-950/60 px-2 py-1 text-xs text-slate-200 hover:border-primary-500">
                        <input
                          type="checkbox"
                          checked={editingActivity.keys.includes(a.key)}
                          onChange={() => toggleEditActivity(a.key)}
                          className="h-3 w-3 rounded accent-primary-400"
                        />
                        {a.emoji} {a.label}
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => saveActivities(p.id, editingActivity.keys)}
                      disabled={savingActivity}
                      className="text-xs font-medium text-primary-400 hover:underline disabled:opacity-60"
                    >
                      {savingActivity ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button onClick={() => setEditingActivity(null)} className="text-xs text-slate-400 hover:underline">Annuler</button>
                  </div>
                </div>
              ) : (
                <div className="mb-2 flex items-start gap-1">
                  <p className="flex-1 text-xs text-slate-400">
                    {resolveActivityLabels(p.activities.map((a) => a.activityKey))} · {new Date(p.date).toLocaleDateString("fr-FR")}
                  </p>
                  {canWrite && (
                    <button
                      onClick={() => setEditingActivity({ id: p.id, keys: p.activities.map((a) => a.activityKey) })}
                      className="shrink-0 text-xs text-slate-600 hover:text-slate-300"
                      title="Modifier les activités"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )}

              {/* Comment edit */}
              {canWrite && editingComment?.id === p.id ? (
                <div className="mt-2">
                  <textarea
                    value={editingComment.value}
                    onChange={(e) => setEditingComment({ id: p.id, value: e.target.value })}
                    rows={2}
                    autoFocus
                    className="w-full rounded border border-primary-600 bg-primary-950 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary-400"
                    placeholder="Description de la photo…"
                  />
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => saveComment(p.id, editingComment.value)}
                      disabled={savingComment}
                      className="text-xs font-medium text-primary-400 hover:underline disabled:opacity-60"
                    >
                      {savingComment ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button onClick={() => setEditingComment(null)} className="text-xs text-slate-400 hover:underline">Annuler</button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 flex items-start gap-1">
                  <p className="flex-1 text-sm text-slate-300">{p.comment || <span className="italic text-slate-500">Aucune description</span>}</p>
                  {canWrite && (
                    <button
                      onClick={() => setEditingComment({ id: p.id, value: p.comment ?? "" })}
                      className="shrink-0 text-xs text-slate-400 hover:text-slate-200"
                      title="Modifier la description"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )}

              {canWrite && (
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => toggleFavorite(p)}
                    title={p.isFavorite ? "Retirer du carrousel d'accueil" : "Mettre en favori (carrousel d'accueil)"}
                    className={`text-base transition-transform hover:scale-110 ${p.isFavorite ? "opacity-100" : "opacity-30 hover:opacity-70"}`}
                  >
                    ⭐
                  </button>
                  <button onClick={() => removePhoto(p.id)} className="text-sm text-red-400 hover:underline">
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {photos.length === 0 && <p className="text-sm text-slate-400">Aucune photo dans la galerie.</p>}
      </div>
    </div>
  );
}

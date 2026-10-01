"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAllowedActivityTypes, sessionHasWriteAccess } from "@/lib/permissions";
import ImageUpload from "@/components/ImageUpload";
import DateInput from "@/components/DateInput";

type ActivityOption = { key: string; label: string; emoji: string };
type GalleryCategory = { id: string; activityKey: string; label: string; order: number };

type Photo = {
  id: string;
  url: string;
  date: string;
  comment: string | null;
  activities: { activityKey: string }[];
  categories: { categoryId: string; category: GalleryCategory }[];
  isFavorite: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

const today = new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { url: "", date: today, comment: "", activityKeys: [] as string[], categoryIds: [] as string[] };

export default function AdminGaleriePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(sessionUser, "galerie");
  const allowedTypes = getAllowedActivityTypes(role);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [allCategories, setAllCategories] = useState<GalleryCategory[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Category management state
  const [catActivityKey, setCatActivityKey] = useState("");
  const [catLabel, setCatLabel] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Inline edit state
  const [editingComment, setEditingComment] = useState<{ id: string; value: string } | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [editingActivity, setEditingActivity] = useState<{ id: string; keys: string[]; catIds: string[] } | null>(null);
  const [savingActivity, setSavingActivity] = useState(false);

  // Full edit modal state
  type EditModal = {
    id: string;
    url: string;
    date: string;
    comment: string;
    activityKeys: string[];
    categoryIds: string[];
    isFavorite: boolean;
  };
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [savingModal, setSavingModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/gallery");
    if (res.ok) setPhotos(await res.json());
  }

  async function loadCategories() {
    const res = await fetch("/api/admin/gallery-categories");
    if (res.ok) setAllCategories(await res.json());
  }

  useEffect(() => {
    load();
    loadCategories();
    fetch("/api/activities")
      .then((r) => r.json())
      .then((data: ActivityOption[]) =>
        setActivityOptions([...data, { key: "AUTRE", label: "Autre", emoji: "📌" }])
      );
  }, []);

  // Categories available for the selected activities (in form or edit mode)
  function categoriesForKeys(keys: string[]): GalleryCategory[] {
    return allCategories.filter((c) => keys.includes(c.activityKey));
  }

  function toggleFormActivity(key: string) {
    setForm((f) => {
      const newKeys = f.activityKeys.includes(key)
        ? f.activityKeys.filter((k) => k !== key)
        : [...f.activityKeys, key];
      // Remove category selections that no longer belong to a selected activity
      const validCatIds = allCategories
        .filter((c) => newKeys.includes(c.activityKey))
        .map((c) => c.id);
      return { ...f, activityKeys: newKeys, categoryIds: f.categoryIds.filter((id) => validCatIds.includes(id)) };
    });
  }

  function toggleFormCategory(id: string) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((x) => x !== id)
        : [...f.categoryIds, id],
    }));
  }

  function toggleEditActivity(key: string) {
    if (!editingActivity) return;
    const newKeys = editingActivity.keys.includes(key)
      ? editingActivity.keys.filter((k) => k !== key)
      : [...editingActivity.keys, key];
    const validCatIds = allCategories
      .filter((c) => newKeys.includes(c.activityKey))
      .map((c) => c.id);
    setEditingActivity({
      ...editingActivity,
      keys: newKeys,
      catIds: editingActivity.catIds.filter((id) => validCatIds.includes(id)),
    });
  }

  function toggleEditCategory(id: string) {
    if (!editingActivity) return;
    setEditingActivity({
      ...editingActivity,
      catIds: editingActivity.catIds.includes(id)
        ? editingActivity.catIds.filter((x) => x !== id)
        : [...editingActivity.catIds, id],
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/admin/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: form.url,
        date: form.date,
        comment: form.comment,
        activityKeys: form.activityKeys,
        categoryIds: form.categoryIds,
      }),
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

  async function saveActivities(id: string, keys: string[], catIds: string[]) {
    setSavingActivity(true);
    const res = await fetch(`/api/admin/gallery/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityKeys: keys, categoryIds: catIds }),
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

  function openEditModal(p: Photo) {
    setEditModal({
      id: p.id,
      url: p.url,
      date: p.date.slice(0, 10),
      comment: p.comment ?? "",
      activityKeys: p.activities.map((a) => a.activityKey),
      categoryIds: p.categories.map((c) => c.categoryId),
      isFavorite: p.isFavorite,
    });
    setModalError(null);
  }

  function toggleModalActivity(key: string) {
    if (!editModal) return;
    const newKeys = editModal.activityKeys.includes(key)
      ? editModal.activityKeys.filter((k) => k !== key)
      : [...editModal.activityKeys, key];
    const validCatIds = allCategories.filter((c) => newKeys.includes(c.activityKey)).map((c) => c.id);
    setEditModal({ ...editModal, activityKeys: newKeys, categoryIds: editModal.categoryIds.filter((id) => validCatIds.includes(id)) });
  }

  function toggleModalCategory(id: string) {
    if (!editModal) return;
    setEditModal({
      ...editModal,
      categoryIds: editModal.categoryIds.includes(id)
        ? editModal.categoryIds.filter((x) => x !== id)
        : [...editModal.categoryIds, id],
    });
  }

  async function saveModal(e: React.FormEvent) {
    e.preventDefault();
    if (!editModal) return;
    setSavingModal(true);
    setModalError(null);
    const res = await fetch(`/api/admin/gallery/${editModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: editModal.url,
        date: editModal.date,
        comment: editModal.comment.trim() || null,
        activityKeys: editModal.activityKeys,
        categoryIds: editModal.categoryIds,
        isFavorite: editModal.isFavorite,
      }),
    });
    setSavingModal(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setModalError(body.error ?? "Erreur lors de la sauvegarde.");
      return;
    }
    setEditModal(null);
    await load();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatError(null);
    setCatSaving(true);
    const res = await fetch("/api/admin/gallery-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityKey: catActivityKey, label: catLabel }),
    });
    setCatSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setCatError(body.error ?? "Erreur.");
    } else {
      setCatLabel("");
      await loadCategories();
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Supprimer cette catégorie ? Les photos associées perdront ce tag.")) return;
    const res = await fetch(`/api/admin/gallery-categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadCategories();
      await load();
    }
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

  // Categories for the add form (based on selected activities)
  const formCategories = categoriesForKeys(form.activityKeys);

  // Group categories by activity for the management panel
  const categoriesByActivity = visibleActivityOptions
    .filter((a) => a.key !== "AUTRE")
    .map((a) => ({
      activity: a,
      categories: allCategories.filter((c) => c.activityKey === a.key),
    }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Galerie photo</h1>
      <p className="mt-2 text-slate-400">Ajoutez des photos de l'association à la galerie publique.</p>

      {/* ── Category management ── */}
      {canWrite && (
        <div className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
          <h2 className="font-display text-lg text-silver-100">Gestion des catégories</h2>
          <p className="mt-1 text-sm text-slate-400">Créez des catégories par activité pour affiner le filtrage de la galerie.</p>

          <form onSubmit={addCategory} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400">Activité</label>
              <select
                value={catActivityKey}
                onChange={(e) => { setCatActivityKey(e.target.value); setCatError(null); }}
                required
                className="mt-1 rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100 focus:border-primary-400 focus:outline-none"
              >
                <option value="">— Choisir —</option>
                {visibleActivityOptions.filter((a) => a.key !== "AUTRE").map((a) => (
                  <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium text-slate-400">Nom de la catégorie</label>
              <input
                type="text"
                value={catLabel}
                onChange={(e) => setCatLabel(e.target.value)}
                required
                placeholder="Ex: Compétition, Soirée…"
                className="mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={catSaving}
              className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50"
            >
              {catSaving ? "…" : "+ Ajouter"}
            </button>
          </form>
          {catError && <p className="mt-2 text-sm text-red-400">{catError}</p>}

          {categoriesByActivity.some((g) => g.categories.length > 0) && (
            <div className="mt-4 space-y-3">
              {categoriesByActivity.filter((g) => g.categories.length > 0).map((g) => (
                <div key={g.activity.key}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {g.activity.emoji} {g.activity.label}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {g.categories.map((cat) => (
                      <span key={cat.id} className="flex items-center gap-1 rounded-full border border-primary-700 bg-primary-950 px-2.5 py-0.5 text-xs text-slate-300">
                        {cat.label}
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          className="ml-1 text-slate-500 hover:text-red-400"
                          title="Supprimer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add photo form ── */}
      {canWrite && (
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2">
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

          {formCategories.length > 0 && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-300">Catégories</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {formCategories.map((cat) => (
                  <label key={cat.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary-700 bg-primary-950/60 px-3 py-1.5 text-sm text-slate-200 hover:border-primary-500">
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(cat.id)}
                      onChange={() => toggleFormCategory(cat.id)}
                      className="h-3.5 w-3.5 rounded accent-primary-400"
                    />
                    {cat.label}
                    <span className="text-xs text-slate-500">
                      ({activityOptions.find((a) => a.key === cat.activityKey)?.emoji})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

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
        </form>
      )}

      {/* ── Photo grid ── */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {visiblePhotos.map((p) => {
          const photoCatIds = p.categories.map((c) => c.categoryId);
          const editCats = editingActivity?.id === p.id
            ? categoriesForKeys(editingActivity.keys)
            : [];

          return (
            <div key={p.id} className="overflow-hidden rounded-xl border border-primary-800 bg-primary-900/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.comment ?? ""} className="h-40 w-full object-cover" />
              <div className="p-3">

                {/* Activity + category badges / edit */}
                {canWrite && editingActivity?.id === p.id ? (
                  <div className="mb-2 space-y-2">
                    <div>
                      <p className="mb-1 text-xs text-slate-400">Activités :</p>
                      <div className="flex flex-wrap gap-1.5">
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
                    </div>
                    {editCats.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs text-slate-400">Catégories :</p>
                        <div className="flex flex-wrap gap-1.5">
                          {editCats.map((cat) => (
                            <label key={cat.id} className="flex cursor-pointer items-center gap-1.5 rounded border border-primary-700 bg-primary-950/60 px-2 py-1 text-xs text-slate-200 hover:border-primary-500">
                              <input
                                type="checkbox"
                                checked={editingActivity.catIds.includes(cat.id)}
                                onChange={() => toggleEditCategory(cat.id)}
                                className="h-3 w-3 rounded accent-primary-400"
                              />
                              {cat.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveActivities(p.id, editingActivity.keys, editingActivity.catIds)}
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
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400">
                        {resolveActivityLabels(p.activities.map((a) => a.activityKey))} · {new Date(p.date).toLocaleDateString("fr-FR")}
                      </p>
                      {p.categories.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.categories.map((c) => (
                            <span key={c.categoryId} className="rounded-full bg-primary-800 px-2 py-0.5 text-xs text-primary-200">
                              {c.category.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {canWrite && (
                      <button
                        onClick={() => setEditingActivity({ id: p.id, keys: p.activities.map((a) => a.activityKey), catIds: photoCatIds })}
                        className="shrink-0 text-xs text-slate-600 hover:text-slate-300"
                        title="Modifier les activités et catégories"
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
                    <button
                      onClick={() => openEditModal(p)}
                      className="text-sm text-primary-400 hover:underline"
                    >
                      Modifier
                    </button>
                    <button onClick={() => removePhoto(p.id)} className="text-sm text-red-400 hover:underline">
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {photos.length === 0 && <p className="text-sm text-slate-400">Aucune photo dans la galerie.</p>}
      </div>

      {/* ── Full edit modal ── */}
      {editModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditModal(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary-700 bg-primary-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-silver-100">Modifier la photo</h2>
            <form onSubmit={saveModal} className="mt-4 space-y-5">

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-slate-300">Image</label>
                <ImageUpload
                  label=""
                  value={editModal.url}
                  onChange={(url) => setEditModal({ ...editModal, url })}
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-300">Date</label>
                <DateInput
                  required
                  value={editModal.date}
                  onChange={(v) => setEditModal({ ...editModal, date: v })}
                  className={inputClass}
                />
              </div>

              {/* Activities */}
              <div>
                <label className="block text-sm font-medium text-slate-300">Activités associées</label>
                <p className="mt-1 text-xs text-slate-500">Sans activité cochée, la photo est visible par tous les adhérents.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {visibleActivityOptions.map((a) => (
                    <label key={a.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary-700 bg-primary-950/60 px-3 py-2 text-sm text-slate-200 hover:border-primary-500">
                      <input
                        type="checkbox"
                        checked={editModal.activityKeys.includes(a.key)}
                        onChange={() => toggleModalActivity(a.key)}
                        className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
                      />
                      {a.emoji} {a.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Categories (cascaded) */}
              {categoriesForKeys(editModal.activityKeys).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300">Catégories</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categoriesForKeys(editModal.activityKeys).map((cat) => (
                      <label key={cat.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary-700 bg-primary-950/60 px-3 py-1.5 text-sm text-slate-200 hover:border-primary-500">
                        <input
                          type="checkbox"
                          checked={editModal.categoryIds.includes(cat.id)}
                          onChange={() => toggleModalCategory(cat.id)}
                          className="h-3.5 w-3.5 rounded accent-primary-400"
                        />
                        {cat.label}
                        <span className="text-xs text-slate-500">({activityOptions.find((a) => a.key === cat.activityKey)?.emoji})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-slate-300">Description (optionnelle)</label>
                <textarea
                  value={editModal.comment}
                  onChange={(e) => setEditModal({ ...editModal, comment: e.target.value })}
                  rows={2}
                  placeholder="Description de la photo…"
                  className={inputClass}
                />
              </div>

              {/* Favorite */}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={editModal.isFavorite}
                  onChange={(e) => setEditModal({ ...editModal, isFavorite: e.target.checked })}
                  className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
                />
                ⭐ Afficher dans le carrousel d'accueil
              </label>

              {modalError && <p className="text-sm text-red-400">{modalError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="rounded-md px-4 py-2 text-sm text-slate-400 hover:bg-primary-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingModal || !editModal.url}
                  className="rounded-md bg-primary-500 px-5 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50"
                >
                  {savingModal ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

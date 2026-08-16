"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { sessionHasWriteAccess } from "@/lib/permissions";
import ImageUpload from "@/components/ImageUpload";

type Activity = {
  id: string;
  label: string;
  emoji: string;
};

type GameLocation = {
  id: string;
  title: string;
  description: string;
  activityId: string | null;
  photos: string;
  isPublic: boolean;
  isActive: boolean;
  showOnHome: boolean;
  createdAt: string;
  activity: { label: string; emoji: string } | null;
};

const EMPTY_FORM = {
  id: "",
  title: "",
  description: "",
  activityId: "",
  photos: [] as string[],
  isPublic: false,
  isActive: true,
  showOnHome: false,
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

export default function AdminLieuxPage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(sessionUser, "lieux");

  const [locations, setLocations] = useState<GameLocation[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function loadLocations() {
    const res = await fetch("/api/admin/game-locations");
    if (res.ok) setLocations(await res.json());
  }

  useEffect(() => {
    loadLocations();
    fetch("/api/activities").then((r) => r.ok ? r.json() : []).then((data) => setActivities(Array.isArray(data) ? data : []));
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setNewPhotoUrl("");
    setError(null);
  }

  function editLocation(loc: GameLocation) {
    setForm({
      id: loc.id,
      title: loc.title,
      description: loc.description,
      activityId: loc.activityId ?? "",
      photos: loc.photos ? loc.photos.split("\n").filter(Boolean) : [],
      isPublic: loc.isPublic,
      isActive: loc.isActive,
      showOnHome: loc.showOnHome,
    });
    setError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setError(null);

    if (!form.title.trim()) { setError("Le titre est requis."); return; }
    if (!form.description.trim()) { setError("La description est requise."); return; }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      activityId: form.activityId || null,
      photos: form.photos.join("\n"),
      isPublic: form.isPublic,
      isActive: form.isActive,
      showOnHome: form.showOnHome,
    };

    const res = form.id
      ? await fetch(`/api/admin/game-locations/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/game-locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Erreur."); return; }
    await loadLocations();
    resetForm();
  }

  async function handleDelete(id: string) {
    if (!canWrite || !confirm("Supprimer ce lieu de jeu ?")) return;
    await fetch(`/api/admin/game-locations/${id}`, { method: "DELETE" });
    await loadLocations();
    if (form.id === id) resetForm();
  }

  async function toggleField(loc: GameLocation, field: "isPublic" | "isActive" | "showOnHome") {
    if (!canWrite) return;
    await fetch(`/api/admin/game-locations/${loc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !loc[field] }),
    });
    await loadLocations();
  }

  function addPhoto(url: string) {
    if (url) setForm((f) => ({ ...f, photos: [...f.photos, url] }));
    setNewPhotoUrl("");
  }

  function removePhoto(idx: number) {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
  }

  function Toggle({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
    return (
      <label className="flex cursor-pointer items-center gap-3">
        <div
          onClick={onChange}
          className={`relative h-5 w-9 rounded-full transition ${value ? "bg-emerald-500" : "bg-primary-700"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? "left-4" : "left-0.5"}`} />
        </div>
        <span className="text-sm text-slate-300">{label}</span>
      </label>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl text-silver-100">📍 Lieux de jeu</h1>
      <p className="mt-1 text-slate-400">Gérez les lieux de jeu de l'association.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* List */}
        <div>
          <h2 className="font-display text-lg text-silver-100">Lieux ({locations.length})</h2>
          {locations.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Aucun lieu de jeu encore.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {locations.map((loc) => {
                const firstPhoto = loc.photos?.split("\n").find(Boolean);
                return (
                  <div
                    key={loc.id}
                    className="flex items-start gap-3 rounded-xl border border-primary-800 bg-primary-900/40 p-3"
                  >
                    {firstPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={firstPhoto} alt="" className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-primary-800 text-2xl">
                        📍
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm text-silver-100 line-clamp-1">{loc.title}</p>
                      {loc.activity && (
                        <p className="text-xs text-slate-400">
                          {loc.activity.emoji} {loc.activity.label}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${loc.isActive ? "bg-emerald-900/60 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                          {loc.isActive ? "Actif" : "Inactif"}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${loc.isPublic ? "bg-sky-900/60 text-sky-300" : "bg-primary-800/60 text-slate-400"}`}>
                          {loc.isPublic ? "Public" : "Membres"}
                        </span>
                        {loc.showOnHome && (
                          <span className="rounded bg-violet-900/60 px-1.5 py-0.5 text-xs text-violet-300">
                            Accueil
                          </span>
                        )}
                      </div>
                      {canWrite && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => editLocation(loc)}
                            className="rounded bg-primary-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-primary-700"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => toggleField(loc, "isActive")}
                            className="rounded bg-primary-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-primary-700"
                          >
                            {loc.isActive ? "Désactiver" : "Activer"}
                          </button>
                          <button
                            onClick={() => toggleField(loc, "isPublic")}
                            className="rounded bg-primary-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-primary-700"
                          >
                            {loc.isPublic ? "Rendre privé" : "Rendre public"}
                          </button>
                          <button
                            onClick={() => toggleField(loc, "showOnHome")}
                            className="rounded bg-primary-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-primary-700"
                          >
                            {loc.showOnHome ? "Retirer accueil" : "Afficher accueil"}
                          </button>
                          <button
                            onClick={() => handleDelete(loc.id)}
                            className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/70"
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Form */}
        {canWrite && (
          <div>
            <h2 className="font-display text-lg text-silver-100">
              {form.id ? "Modifier" : "Nouveau lieu de jeu"}
            </h2>
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-3 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Titre *</label>
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex : Salle polyvalente de Vieux-Boucau"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Description *</label>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Adresse, horaires, conditions d'accès…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Activité liée</label>
                <select
                  className={inputClass}
                  value={form.activityId}
                  onChange={(e) => setForm((f) => ({ ...f, activityId: e.target.value }))}
                >
                  <option value="">— Aucune activité —</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.emoji} {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Photos */}
              <div>
                <label className="block text-sm font-medium text-slate-300">Photos</label>
                {form.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.photos.map((url, idx) => (
                      <div key={idx} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-primary-700" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white hover:bg-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <ImageUpload
                    value={newPhotoUrl}
                    onChange={(url) => { if (url) addPhoto(url); else setNewPhotoUrl(""); }}
                    label=""
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3">
                <Toggle
                  value={form.isActive}
                  onChange={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  label="Lieu actif (visible sur le site)"
                />
                <Toggle
                  value={form.isPublic}
                  onChange={() => setForm((f) => ({ ...f, isPublic: !f.isPublic }))}
                  label="Visible par le public (non-membres)"
                />
                <Toggle
                  value={form.showOnHome}
                  onChange={() => setForm((f) => ({ ...f, showOnHome: !f.showOnHome }))}
                  label="Afficher sur la page d'accueil"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
                >
                  {saving ? "Enregistrement…" : form.id ? "Mettre à jour" : "Créer le lieu"}
                </button>
                {form.id && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md border border-primary-700 px-4 py-2 text-sm text-slate-300 hover:bg-primary-900"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { sessionHasWriteAccess } from "@/lib/permissions";

type EventTemplate = {
  id: string;
  title: string;
  description: string;
  activityKey: string | null;
  location: string | null;
  order: number;
};

const ACTIVITIES = [
  { key: "", label: "Toutes activités" },
  { key: "JEUX_DE_PLATEAU", label: "Jeux de plateau" },
  { key: "JEUX_DE_ROLE", label: "Jeux de rôle" },
  { key: "AIRSOFT", label: "Airsoft" },
  { key: "AUTRE", label: "Autre" },
];

const EMPTY_FORM = { id: "", title: "", description: "", activityKey: "", location: "" };

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

export default function AdminEventTemplatesPage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(sessionUser, "events");

  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function load() {
    const res = await fetch("/api/admin/event-templates");
    if (res.ok) setTemplates(await res.json());
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openEdit(t: EventTemplate) {
    setForm({ id: t.id, title: t.title, description: t.description, activityKey: t.activityKey ?? "", location: t.location ?? "" });
    setError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Le titre est requis."); return; }
    if (!form.description.trim()) { setError("La description est requise."); return; }
    setSaving(true);
    setError(null);
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      activityKey: form.activityKey || null,
      location: form.location.trim() || null,
    };
    const res = form.id
      ? await fetch(`/api/admin/event-templates/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/admin/event-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Erreur"); return; }
    await load();
    resetForm();
  }

  async function handleDelete(t: EventTemplate) {
    if (!confirm(`Supprimer le modèle "${t.title}" ?`)) return;
    await fetch(`/api/admin/event-templates/${t.id}`, { method: "DELETE" });
    await load();
    if (form.id === t.id) resetForm();
  }

  async function moveTemplate(t: EventTemplate, dir: -1 | 1) {
    const idx = templates.findIndex((x) => x.id === t.id);
    const swap = templates[idx + dir];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/admin/event-templates/${t.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: swap.order }) }),
      fetch(`/api/admin/event-templates/${swap.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: t.order }) }),
    ]);
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-2xl text-silver-100">Modèles d&apos;événements</h1>
      <p className="mt-1 text-sm text-slate-400">
        Gérez les titres, lieux et descriptions prédéfinis proposés lors de la création d&apos;un événement.
        Associez optionnellement un modèle à une activité pour le filtrer lors de la saisie.
      </p>

      {/* Liste */}
      <div className="mt-6 overflow-hidden rounded-xl border border-primary-800">
        {templates.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-400">Aucun modèle créé pour l&apos;instant.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary-800 bg-primary-900/60">
                <th className="px-4 py-2 text-left font-medium text-slate-300">Titre</th>
                <th className="hidden px-4 py-2 text-left font-medium text-slate-300 md:table-cell">Lieu</th>
                <th className="hidden px-4 py-2 text-left font-medium text-slate-300 sm:table-cell">Description</th>
                <th className="px-4 py-2 text-left font-medium text-slate-300">Activité</th>
                {canWrite && <th className="px-4 py-2 text-right font-medium text-slate-300">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {templates.map((t, idx) => {
                const activity = ACTIVITIES.find((a) => a.key === (t.activityKey ?? ""));
                return (
                  <tr key={t.id} className="border-b border-primary-800/50 last:border-0 hover:bg-primary-900/30">
                    <td className="px-4 py-3 font-medium text-slate-100">{t.title}</td>
                    <td className="hidden max-w-[160px] px-4 py-3 text-slate-400 md:table-cell">
                      {t.location ? (
                        <span className="line-clamp-1">📍 {t.location}</span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="hidden max-w-xs px-4 py-3 text-slate-400 sm:table-cell">
                      <span className="line-clamp-2">{t.description}</span>
                    </td>
                    <td className="px-4 py-3">
                      {t.activityKey ? (
                        <span className="rounded-md bg-primary-800/60 px-2 py-0.5 text-xs text-slate-300">
                          {activity?.label ?? t.activityKey}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Toutes</span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => moveTemplate(t, -1)}
                            disabled={idx === 0}
                            className="rounded px-1.5 py-1 text-slate-400 hover:bg-primary-800 disabled:opacity-30"
                            title="Monter"
                          >▲</button>
                          <button
                            onClick={() => moveTemplate(t, 1)}
                            disabled={idx === templates.length - 1}
                            className="rounded px-1.5 py-1 text-slate-400 hover:bg-primary-800 disabled:opacity-30"
                            title="Descendre"
                          >▼</button>
                          <button
                            onClick={() => openEdit(t)}
                            className="rounded px-2 py-1 text-sky-400 hover:bg-primary-800"
                          >Modifier</button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="rounded px-2 py-1 text-red-400 hover:bg-primary-800"
                          >Supprimer</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Formulaire */}
      {canWrite && (
        <form ref={formRef} onSubmit={handleSubmit} className="mt-6 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
          <h3 className="font-display text-base text-silver-100">
            {form.id ? "Modifier le modèle" : "Ajouter un modèle"}
          </h3>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">Titre *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Soirée jeux de plateau"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Activité <span className="text-slate-500">(optionnel)</span>
              </label>
              <select
                value={form.activityKey}
                onChange={(e) => setForm({ ...form, activityKey: e.target.value })}
                className={inputClass}
              >
                {ACTIVITIES.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-300">
              Lieu <span className="text-slate-500">(optionnel)</span>
            </label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ex: Salle des fêtes de Saint-Loup"
              className={inputClass}
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-300">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description par défaut de l'événement…"
              rows={4}
              className={inputClass}
              required
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : form.id ? "Mettre à jour" : "Ajouter"}
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
      )}
    </div>
  );
}

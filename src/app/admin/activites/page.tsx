"use client";

import { useEffect, useState } from "react";
import { COLOR_OPTIONS, type ColorKey } from "@/lib/activity-colors";

type Activity = {
  id: string;
  key: string;
  label: string;
  emoji: string;
  color: string;
  order: number;
  membershipRequired: boolean;
  isCore: boolean;
  isActive: boolean;
  price: number;
  content: string;
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

const EMPTY_FORM = { label: "", emoji: "🎯", color: "slate" as ColorKey, membershipRequired: false, price: 0 };

export default function AdminActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [metaDrafts, setMetaDrafts] = useState<Record<string, { label: string; emoji: string; color: ColorKey; membershipRequired: boolean; isActive: boolean; price: number }>>({});
  const [savingMeta, setSavingMeta] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/activities");
    if (res.ok) {
      const data: Activity[] = await res.json();
      setActivities(data);
      setDrafts(Object.fromEntries(data.map((a) => [a.key, a.content])));
      setMetaDrafts(Object.fromEntries(data.map((a) => [a.id, {
        label: a.label,
        emoji: a.emoji,
        color: a.color as ColorKey,
        membershipRequired: a.membershipRequired,
        isActive: a.isActive,
        price: a.price,
      }])));
    }
  }

  useEffect(() => { load(); }, []);

  async function saveContent(key: string) {
    setSaving(key);
    setSuccess(null);
    setContentError(null);

    const res = await fetch(`/api/admin/activities/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: drafts[key] }),
    });

    setSaving(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setContentError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    setActivities((prev) => prev.map((a) => a.key === key ? { ...a, content: drafts[key] } : a));
    setSuccess(key);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function addActivity(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAdding(true);

    const res = await fetch("/api/admin/activity-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setAdding(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setAddError(body.error ?? "Erreur lors de l'ajout.");
      return;
    }

    setForm(EMPTY_FORM);
    await load();
  }

  async function saveMeta(id: string) {
    setSavingMeta(id);
    const draft = metaDrafts[id];
    await fetch(`/api/admin/activity-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSavingMeta(null);
    await load();
  }

  async function moveActivity(id: string, direction: "up" | "down") {
    const sorted = [...activities].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((a) => a.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    await Promise.all([
      fetch(`/api/admin/activity-types/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: b.order }),
      }),
      fetch(`/api/admin/activity-types/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: a.order }),
      }),
    ]);
    await load();
  }

  async function deleteActivity(id: string, label: string) {
    if (!confirm(`Supprimer l'activité "${label}" ?`)) return;
    const res = await fetch(`/api/admin/activity-types/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Erreur lors de la suppression.");
      return;
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Activités</h1>
      <p className="mt-2 text-slate-400">
        Gérez les types d'activités de l'association et leur texte de présentation.
      </p>

      {/* ── Ajouter une activité ── */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-silver-100">Ajouter une activité</h2>
        <form
          onSubmit={addActivity}
          className="mt-4 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300">Nom de l'activité</label>
            <input
              required
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Ex: Escape Game"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Emoji</label>
            <input
              type="text"
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              className={inputClass}
              maxLength={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Couleur</label>
            <select
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value as ColorKey })}
              className={inputClass}
            >
              {(Object.entries(COLOR_OPTIONS) as [ColorKey, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Tarif adhésion (€)</label>
            <input
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
              className={inputClass}
              placeholder="0"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            <input
              id="membershipRequired"
              type="checkbox"
              checked={form.membershipRequired}
              onChange={(e) => setForm({ ...form, membershipRequired: e.target.checked })}
              className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
            />
            <label htmlFor="membershipRequired" className="text-sm text-slate-300">
              Cotisation requise pour s'inscrire aux événements de cette activité
            </label>
          </div>

          {addError && <p className="sm:col-span-2 text-sm text-red-400">{addError}</p>}

          <button
            type="submit"
            disabled={adding}
            className="sm:col-span-2 rounded-md bg-primary-400 px-5 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
          >
            {adding ? "Ajout..." : "Ajouter l'activité"}
          </button>
        </form>
      </section>

      {/* ── Liste des activités + contenus ── */}
      <section className="mt-10">
        <h2 className="font-display text-xl text-silver-100">Activités existantes</h2>
        <div className="mt-4 space-y-6">
          {[...activities].sort((a, b) => a.order - b.order).map((a, idx, sorted) => {
            const meta = metaDrafts[a.id];
            const colors = COLOR_OPTIONS[meta?.color ?? a.color as ColorKey] ?? COLOR_OPTIONS.slate;
            const metaChanged = meta && (
              meta.label !== a.label ||
              meta.emoji !== a.emoji ||
              meta.color !== a.color ||
              meta.membershipRequired !== a.membershipRequired ||
              meta.isActive !== a.isActive ||
              meta.price !== a.price
            );
            return (
              <div key={a.key} className={`rounded-xl border-2 bg-primary-900/40 p-6 ${colors.border}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{meta?.emoji ?? a.emoji}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        (meta?.isActive ?? a.isActive)
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {(meta?.isActive ?? a.isActive) ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h3 className={`mt-1 font-display text-lg ${(meta?.isActive ?? a.isActive) ? colors.text : "text-slate-500"}`}>
                      {meta?.label ?? a.label}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Clé : <code className="text-slate-400">{a.key}</code>
                      {a.isCore && " · Activité principale"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveActivity(a.id, "up")}
                        disabled={idx === 0}
                        className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-primary-800 hover:text-slate-100 disabled:opacity-20"
                        title="Monter"
                      >▲</button>
                      <button
                        onClick={() => moveActivity(a.id, "down")}
                        disabled={idx === sorted.length - 1}
                        className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-primary-800 hover:text-slate-100 disabled:opacity-20"
                        title="Descendre"
                      >▼</button>
                    </div>
                    {!a.isCore && (
                      <button onClick={() => deleteActivity(a.id, a.label)} className="text-sm text-red-400 hover:underline">
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>

                {/* Champs éditables — disponibles pour toutes les activités */}
                {meta && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Nom affiché</label>
                      <input
                        type="text"
                        value={meta.label}
                        onChange={(e) => setMetaDrafts((p) => ({ ...p, [a.id]: { ...p[a.id], label: e.target.value } }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Emoji</label>
                      <input
                        type="text"
                        value={meta.emoji}
                        maxLength={4}
                        onChange={(e) => setMetaDrafts((p) => ({ ...p, [a.id]: { ...p[a.id], emoji: e.target.value } }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Couleur</label>
                      <select
                        value={meta.color}
                        onChange={(e) => setMetaDrafts((p) => ({ ...p, [a.id]: { ...p[a.id], color: e.target.value as ColorKey } }))}
                        className={inputClass}
                      >
                        {(Object.entries(COLOR_OPTIONS) as [ColorKey, { label: string }][]).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Tarif adhésion (€)</label>
                      <input
                        type="number"
                        min="0"
                        value={meta.price}
                        onChange={(e) => setMetaDrafts((p) => ({ ...p, [a.id]: { ...p[a.id], price: parseInt(e.target.value) || 0 } }))}
                        className={inputClass}
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap gap-x-8 gap-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          id={`active-${a.id}`}
                          type="checkbox"
                          checked={meta.isActive}
                          onChange={(e) => setMetaDrafts((p) => ({ ...p, [a.id]: { ...p[a.id], isActive: e.target.checked } }))}
                          className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
                        />
                        <label htmlFor={`active-${a.id}`} className="text-sm text-slate-300">
                          Activité active (visible sur le site)
                        </label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          id={`mr-${a.id}`}
                          type="checkbox"
                          checked={meta.membershipRequired}
                          onChange={(e) => setMetaDrafts((p) => ({ ...p, [a.id]: { ...p[a.id], membershipRequired: e.target.checked } }))}
                          className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
                        />
                        <label htmlFor={`mr-${a.id}`} className="text-sm text-slate-300">
                          Cotisation requise pour s'inscrire aux événements
                        </label>
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => saveMeta(a.id)}
                        disabled={savingMeta === a.id || !metaChanged}
                        className="rounded-md bg-primary-400 px-4 py-1.5 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
                      >
                        {savingMeta === a.id ? "Enregistrement..." : "Enregistrer les paramètres"}
                      </button>
                      {metaChanged && savingMeta !== a.id && (
                        <button
                          type="button"
                          onClick={() => setMetaDrafts((p) => ({ ...p, [a.id]: { label: a.label, emoji: a.emoji, color: a.color as ColorKey, membershipRequired: a.membershipRequired, isActive: a.isActive, price: a.price } }))}
                          className="text-sm text-slate-500 hover:text-slate-300"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Texte de présentation */}
                <div className="mt-5 border-t border-primary-800 pt-5">
                  <label className="block text-sm font-medium text-slate-300">Texte de présentation</label>
                  <textarea
                    rows={5}
                    value={drafts[a.key] ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [a.key]: e.target.value }))}
                    className="mt-2 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                    placeholder="Décrivez cette activité..."
                  />
                  {contentError && saving === null && (
                    <p className="mt-1 text-sm text-red-400">{contentError}</p>
                  )}
                  <div className="mt-2 flex items-center gap-4">
                    <button
                      onClick={() => saveContent(a.key)}
                      disabled={saving === a.key || drafts[a.key] === a.content}
                      className="rounded-md bg-primary-400 px-4 py-1.5 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
                    >
                      {saving === a.key ? "Enregistrement..." : "Enregistrer le texte"}
                    </button>
                    {success === a.key && <span className="text-sm text-emerald-400">Enregistré ✓</span>}
                    {drafts[a.key] !== a.content && saving !== a.key && (
                      <button
                        onClick={() => setDrafts((prev) => ({ ...prev, [a.key]: a.content }))}
                        className="text-sm text-slate-500 hover:text-slate-300"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

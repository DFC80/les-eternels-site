"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { sessionHasWriteAccess } from "@/lib/permissions";

type CatalogItem = { id: string; label: string; stock: number | null; seasons: string | null; order: number };

type SeasonKey = "PRINTEMPS" | "ETE" | "AUTOMNE" | "HIVER";
const SEASONS: { key: SeasonKey; label: string; emoji: string }[] = [
  { key: "PRINTEMPS", label: "Printemps", emoji: "🌸" },
  { key: "ETE", label: "Été", emoji: "☀️" },
  { key: "AUTOMNE", label: "Automne", emoji: "🍂" },
  { key: "HIVER", label: "Hiver", emoji: "❄️" },
];

function parseSeasons(raw: string | null): SeasonKey[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as SeasonKey[]; } catch { return []; }
}

const EMPTY_FORM = { id: "", label: "", stock: "", seasons: [] as SeasonKey[] };

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

function CatalogSection({
  title,
  subtitle,
  apiBase,
  stockLabel,
  stockPlaceholder,
  addLabel,
  unitLabel,
  canWrite,
}: {
  title: string;
  subtitle: string;
  apiBase: string;
  stockLabel: string;
  stockPlaceholder: string;
  addLabel: string;
  unitLabel: string;
  canWrite: boolean;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState<{ id: string; label: string; stock: string; seasons: SeasonKey[] }>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function load() {
    const res = await fetch(apiBase);
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openEdit(item: CatalogItem) {
    setForm({ id: item.id, label: item.label, stock: item.stock != null ? String(item.stock) : "", seasons: parseSeasons(item.seasons) });
    setError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setError(null);
  }

  function toggleSeason(key: SeasonKey) {
    setForm((prev) => ({
      ...prev,
      seasons: prev.seasons.includes(key) ? prev.seasons.filter((s) => s !== key) : [...prev.seasons, key],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) { setError("Le libellé est requis."); return; }
    setSaving(true);
    setError(null);
    const body = {
      label: form.label.trim(),
      stock: form.stock !== "" ? Number(form.stock) : null,
      seasons: form.seasons.length > 0 ? form.seasons : null,
    };
    const res = form.id
      ? await fetch(`${apiBase}/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch(apiBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Erreur"); return; }
    await load();
    resetForm();
  }

  async function handleDelete(item: CatalogItem) {
    if (!confirm(`Supprimer "${item.label}" du catalogue ?`)) return;
    await fetch(`${apiBase}/${item.id}`, { method: "DELETE" });
    await load();
    if (form.id === item.id) resetForm();
  }

  async function moveItem(item: CatalogItem, dir: -1 | 1) {
    const idx = items.findIndex((i) => i.id === item.id);
    const swap = items[idx + dir];
    if (!swap) return;
    await Promise.all([
      fetch(`${apiBase}/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: swap.order }) }),
      fetch(`${apiBase}/${swap.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: item.order }) }),
    ]);
    await load();
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-silver-100">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>

      {/* Liste */}
      <div className="mt-4 overflow-hidden rounded-xl border border-primary-800">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">Aucun élément dans ce catalogue.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary-800 bg-primary-900/60">
                <th className="px-4 py-2 text-left font-medium text-slate-300">Libellé</th>
                <th className="px-4 py-2 text-center font-medium text-slate-300">Stock</th>
                <th className="px-4 py-2 text-center font-medium text-slate-300">Saisons</th>
                {canWrite && <th className="px-4 py-2 text-right font-medium text-slate-300">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-primary-800/50 last:border-0 hover:bg-primary-900/30">
                  <td className="px-4 py-3 text-slate-100">{item.label}</td>
                  <td className="px-4 py-3 text-center text-slate-300">
                    {item.stock == null ? (
                      <span className="text-xs text-slate-500">Illimité</span>
                    ) : item.stock === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-300">
                        Épuisé
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        {item.stock} {unitLabel}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {parseSeasons(item.seasons).length === 0 ? (
                      <span className="text-xs text-slate-500">Toutes</span>
                    ) : (
                      <span className="text-sm">
                        {parseSeasons(item.seasons).map((s) => SEASONS.find((x) => x.key === s)?.emoji).join(" ")}
                      </span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => moveItem(item, -1)}
                          disabled={idx === 0}
                          className="rounded px-1.5 py-1 text-slate-400 hover:bg-primary-800 disabled:opacity-30"
                          title="Monter"
                        >▲</button>
                        <button
                          onClick={() => moveItem(item, 1)}
                          disabled={idx === items.length - 1}
                          className="rounded px-1.5 py-1 text-slate-400 hover:bg-primary-800 disabled:opacity-30"
                          title="Descendre"
                        >▼</button>
                        <button
                          onClick={() => openEdit(item)}
                          className="rounded px-2 py-1 text-sky-400 hover:bg-primary-800"
                        >Modifier</button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="rounded px-2 py-1 text-red-400 hover:bg-primary-800"
                        >Supprimer</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Formulaire */}
      {canWrite && (
        <form ref={formRef} onSubmit={handleSubmit} className="mt-6 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
          <h3 className="font-display text-base text-silver-100">
            {form.id ? `Modifier` : addLabel}
          </h3>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">Libellé *</label>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder={stockPlaceholder}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                {stockLabel} <span className="text-slate-500">(laisser vide = illimité)</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                placeholder="Ex: 30"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-300">
              Saisons <span className="text-slate-500">(laisser vide = disponible toute l&apos;année)</span>
            </label>
            <div className="mt-2 flex flex-wrap gap-3">
              {SEASONS.map((s) => (
                <label key={s.key} className="flex cursor-pointer items-center gap-2 rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm hover:bg-primary-900">
                  <input
                    type="checkbox"
                    checked={form.seasons.includes(s.key)}
                    onChange={() => toggleSeason(s.key)}
                    className="accent-primary-400"
                  />
                  <span>{s.emoji} {s.label}</span>
                </label>
              ))}
            </div>
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
    </section>
  );
}

export default function AdminMenusPage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(sessionUser, "events");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-2xl text-silver-100">Catalogue menus &amp; boissons</h1>
      <p className="mt-1 text-sm text-slate-400">
        Gérez les libellés disponibles lors de la création d&apos;un événement avec repas.
        Le stock indique le nombre de portions/unités proposé par défaut.
      </p>

      <CatalogSection
        title="🍽️ Menus repas"
        subtitle="Plats proposés au choix lors des repas d'événements."
        apiBase="/api/admin/menu-catalog"
        stockLabel="Stock par défaut"
        stockPlaceholder="Ex: Merguez grillées"
        addLabel="Ajouter un menu"
        unitLabel="portions"
        canWrite={canWrite}
      />

      <CatalogSection
        title="🥤 Boissons"
        subtitle="Boissons proposées au choix lors des repas d'événements."
        apiBase="/api/admin/drink-catalog"
        stockLabel="Stock par défaut"
        stockPlaceholder="Ex: Coca-Cola"
        addLabel="Ajouter une boisson"
        unitLabel="unités"
        canWrite={canWrite}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { sessionHasWriteAccess } from "@/lib/permissions";

type CatalogItem = { id: string; label: string; stock: number | null; order: number };

const EMPTY_FORM = { id: "", label: "", stock: "" };

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

export default function AdminMenusPage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(sessionUser, "events");

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function load() {
    const res = await fetch("/api/admin/menu-catalog");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => { load(); }, []);

  function openEdit(item: CatalogItem) {
    setForm({ id: item.id, label: item.label, stock: item.stock != null ? String(item.stock) : "" });
    setError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) { setError("Le libellé est requis."); return; }
    setSaving(true);
    setError(null);
    const body = {
      label: form.label.trim(),
      stock: form.stock !== "" ? Number(form.stock) : null,
    };
    const res = form.id
      ? await fetch(`/api/admin/menu-catalog/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/admin/menu-catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Erreur"); return; }
    await load();
    resetForm();
  }

  async function handleDelete(item: CatalogItem) {
    if (!confirm(`Supprimer "${item.label}" du catalogue ?`)) return;
    await fetch(`/api/admin/menu-catalog/${item.id}`, { method: "DELETE" });
    await load();
    if (form.id === item.id) resetForm();
  }

  async function moveItem(item: CatalogItem, dir: -1 | 1) {
    const idx = items.findIndex((i) => i.id === item.id);
    const swap = items[idx + dir];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/admin/menu-catalog/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: swap.order }) }),
      fetch(`/api/admin/menu-catalog/${swap.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: item.order }) }),
    ]);
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-2xl text-silver-100">Catalogue des menus repas</h1>
      <p className="mt-1 text-sm text-slate-400">
        Gérez les libellés disponibles lors de la création d&apos;un événement avec repas.
        Le stock indique le nombre de portions proposé par défaut.
      </p>

      {/* Liste */}
      <div className="mt-6 overflow-hidden rounded-xl border border-primary-800">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">Aucun menu dans le catalogue.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary-800 bg-primary-900/60">
                <th className="px-4 py-2 text-left font-medium text-slate-300">Libellé</th>
                <th className="px-4 py-2 text-center font-medium text-slate-300">Stock</th>
                {canWrite && <th className="px-4 py-2 text-right font-medium text-slate-300">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-primary-800/50 last:border-0 hover:bg-primary-900/30">
                  <td className="px-4 py-3 text-slate-100">{item.label}</td>
                  <td className="px-4 py-3 text-center text-slate-300">
                    {item.stock != null ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        {item.stock} portions
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Illimité</span>
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
        <form ref={formRef} onSubmit={handleSubmit} className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
          <h2 className="font-display text-lg text-silver-100">
            {form.id ? "Modifier un menu" : "Ajouter un menu"}
          </h2>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">Libellé *</label>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Ex: Merguez grillées"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Stock par défaut <span className="text-slate-500">(laisser vide = illimité)</span>
              </label>
              <input
                type="number"
                min={1}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                placeholder="Ex: 30"
                className={inputClass}
              />
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
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { formatCentsToEuros } from "@/lib/money";

type Activity = { id: string; key: string; label: string; emoji: string };
type ProductActivity = { activityKey: string };

type Product = {
  id: string;
  category: "SNACK" | "DRINK";
  name: string;
  photoUrl: string | null;
  price: number;
  stock: number;
  activities: ProductActivity[];
};

const EMPTY_FORM = {
  id: "",
  category: "SNACK" as "SNACK" | "DRINK",
  name: "",
  photoUrl: "",
  price: "",
  stock: "",
  activityKeys: [] as string[],
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

export default function AdminProduitsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [prodRes, actRes] = await Promise.all([
      fetch("/api/admin/products"),
      fetch("/api/admin/activity-types"),
    ]);
    if (prodRes.ok) setItems(await prodRes.json());
    if (actRes.ok) {
      const acts: Activity[] = await actRes.json();
      setActivities(acts.filter((a) => a.key !== undefined));
    }
  }

  useEffect(() => { load(); }, []);

  function resetForm() { setForm(EMPTY_FORM); }

  function editItem(item: Product) {
    setForm({
      id: item.id,
      category: item.category,
      name: item.name,
      photoUrl: item.photoUrl ?? "",
      price: formatCentsToEuros(item.price).replace("€", "").trim(),
      stock: String(item.stock),
      activityKeys: item.activities.map((a) => a.activityKey),
    });
  }

  function toggleActivity(key: string) {
    setForm((f) => ({
      ...f,
      activityKeys: f.activityKeys.includes(key)
        ? f.activityKeys.filter((k) => k !== key)
        : [...f.activityKeys, key],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      category: form.category,
      name: form.name,
      photoUrl: form.photoUrl,
      price: form.price,
      stock: form.stock || "0",
      activityKeys: form.activityKeys,
    };

    const res = await fetch(form.id ? `/api/admin/products/${form.id}` : "/api/admin/products", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    resetForm();
    await load();
  }

  async function removeItem(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  function renderCard(item: Product) {
    const itemActivities = item.activities.map((pa) => {
      const act = activities.find((a) => a.key === pa.activityKey);
      return act ? `${act.emoji} ${act.label}` : pa.activityKey;
    });

    return (
      <div key={item.id} className="rounded-xl border border-primary-800 bg-primary-900/40 p-4">
        <div className="flex gap-4">
          {item.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt={item.name} className="h-20 w-20 rounded-lg object-cover" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-100">{item.name}</p>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  item.stock <= 0
                    ? "bg-red-950 text-red-300"
                    : item.stock <= 5
                      ? "bg-amber-950 text-amber-300"
                      : "bg-emerald-950 text-emerald-300"
                }`}
              >
                Stock : {item.stock}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{formatCentsToEuros(item.price)}</p>
            {itemActivities.length > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                Activités : {itemActivities.join(", ")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-600 italic">Visible par tous les adhérents</p>
            )}
            <div className="mt-2 flex gap-3 text-sm">
              <button onClick={() => editItem(item)} className="text-primary-300 hover:text-silver-200 hover:underline">
                Modifier
              </button>
              <button onClick={() => removeItem(item.id)} className="text-red-400 hover:underline">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const snacks = items.filter((i) => i.category === "SNACK");
  const drinks = items.filter((i) => i.category === "DRINK");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Friandises & boissons</h1>
      <p className="mt-2 text-slate-400">
        Gérez le stock et les prix des friandises et boissons proposées lors des soirées jeux.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2">
        <h2 className="col-span-full font-display text-lg text-silver-100">
          {form.id ? "Modifier le produit" : "Ajouter un produit"}
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-300">Catégorie</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as "SNACK" | "DRINK" })}
            className={inputClass}
          >
            <option value="SNACK">Friandise</option>
            <option value="DRINK">Boisson</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Nom</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Coca-Cola"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Prix (€)</label>
          <input
            type="text"
            inputMode="decimal"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="Ex: 0,50"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Stock disponible</label>
          <input
            type="number"
            min={0}
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300">Photo (URL, optionnel)</label>
          <input
            value={form.photoUrl}
            onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
            placeholder="https://exemple.com/photo.jpg"
            className={inputClass}
          />
        </div>

        {activities.length > 0 && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300">
              Activités associées
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              Si aucune activité n'est cochée, le produit est visible par tous les adhérents.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {activities.map((act) => (
                <label key={act.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary-700 bg-primary-950/60 px-3 py-2 text-sm text-slate-300 hover:border-primary-500">
                  <input
                    type="checkbox"
                    checked={form.activityKeys.includes(act.key)}
                    onChange={() => toggleActivity(act.key)}
                    className="accent-primary-400"
                  />
                  {act.emoji} {act.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="col-span-full text-sm text-red-400">{error}</p>}

        <div className="col-span-full flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-400 px-5 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : form.id ? "Mettre à jour" : "Ajouter"}
          </button>
          {form.id && (
            <button type="button" onClick={resetForm} className="rounded-md px-5 py-2 font-medium text-slate-300 hover:bg-primary-900">
              Annuler
            </button>
          )}
        </div>
      </form>

      <h2 className="mt-10 font-display text-xl text-silver-100">🍬 Friandises ({snacks.length})</h2>
      <div className="mt-4 space-y-3">
        {snacks.length === 0 && <p className="text-sm text-slate-400">Aucune friandise enregistrée.</p>}
        {snacks.map(renderCard)}
      </div>

      <h2 className="mt-10 font-display text-xl text-silver-100">🥤 Boissons ({drinks.length})</h2>
      <div className="mt-4 space-y-3">
        {drinks.length === 0 && <p className="text-sm text-slate-400">Aucune boisson enregistrée.</p>}
        {drinks.map(renderCard)}
      </div>
    </div>
  );
}

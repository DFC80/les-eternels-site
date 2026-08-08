"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { canAccessSection } from "@/lib/permissions";

type EquipmentCategory = { id: string; key: string; label: string; emoji: string; order: number };

type EquipmentItem = {
  id: string;
  category: string;
  name: string;
  photos: string | null;
  status: "DISPONIBLE" | "HORS_SERVICE" | "INDISPONIBLE";
  rentalCost: number;
  stock: number;
  fps: number | null;
  bbWeight: number | null;
  propulsion: string | null;
  info: string | null;
  associations: { itemId: string; quantity: number }[];
};

const EMPTY_FORM = {
  id: "",
  category: "",
  name: "",
  photos: "",
  status: "DISPONIBLE" as "DISPONIBLE" | "HORS_SERVICE" | "INDISPONIBLE",
  rentalCost: "",
  stock: "1",
  fps: "",
  bbWeight: "",
  propulsion: "",
  info: "",
};

const EMPTY_CAT_FORM = { id: "", label: "", emoji: "📦" };

const PROPULSION_OPTIONS: { value: string; label: string }[] = [
  { value: "AEG", label: "AEG" },
  { value: "AEP", label: "AEP" },
  { value: "GAZ", label: "GAZ" },
  { value: "CO2", label: "CO2" },
  { value: "HPA", label: "HPA" },
  { value: "ELECTRIQUE", label: "ELECTRIQUE" },
  { value: "VERROU", label: "Rechargement manuel (Verrou)" },
];

function togglePropulsion(current: string, value: string): string {
  const set = new Set(current.split(",").map((v) => v.trim()).filter(Boolean));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set).join(",");
}

const STATUS_LABELS: Record<string, string> = {
  DISPONIBLE: "Disponible",
  HORS_SERVICE: "Hors-service",
  INDISPONIBLE: "Indisponible",
};

const STATUS_COLORS: Record<string, string> = {
  DISPONIBLE: "bg-emerald-950 text-emerald-300",
  HORS_SERVICE: "bg-red-950 text-red-300",
  INDISPONIBLE: "bg-amber-950 text-amber-300",
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

function PhotosUploadField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const urls = value.split("\n").map((u) => u.trim()).filter(Boolean);

  async function handleFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) onChange([...urls, data.url].join("\n"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-1 space-y-2">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-20 w-20 rounded-lg border border-primary-700 object-cover" />
              <button type="button" onClick={() => onChange(urls.filter((u) => u !== url).join("\n"))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white hover:bg-red-500">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="flex items-center gap-2 rounded-md border border-dashed border-primary-600 px-4 py-2 text-sm text-slate-400 hover:border-primary-400 hover:text-slate-200 disabled:opacity-50">
        {uploading ? "Upload…" : "＋ Ajouter une photo"}
      </button>
    </div>
  );
}

export default function AdminEquipementsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";

  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Associations réplique → items
  const [expandedAssoc, setExpandedAssoc] = useState<string | null>(null);
  const [assocDraft, setAssocDraft] = useState<Record<string, { itemId: string; quantity: number }[]>>({});
  const [savingAssoc, setSavingAssoc] = useState<string | null>(null);

  // Category management
  const [catForm, setCatForm] = useState(EMPTY_CAT_FORM);
  const [catError, setCatError] = useState<string | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/equipment");
    if (res.ok) setItems(await res.json());
  }

  async function loadCategories() {
    const res = await fetch("/api/admin/equipment-categories");
    if (res.ok) {
      const cats: EquipmentCategory[] = await res.json();
      setCategories(cats);
      setForm((prev) => ({ ...prev, category: prev.category || cats[0]?.key || "" }));
    }
  }

  useEffect(() => {
    load();
    loadCategories();
  }, []);

  function resetForm() {
    setForm({ ...EMPTY_FORM, category: categories[0]?.key || "" });
  }

  function editItem(item: EquipmentItem) {
    setForm({
      id: item.id,
      category: item.category,
      name: item.name,
      photos: item.photos ?? "",
      status: item.status,
      rentalCost: String(item.rentalCost),
      stock: String(item.stock ?? 1),
      fps: item.fps ? String(item.fps) : "",
      bbWeight: item.bbWeight ? String(item.bbWeight) : "",
      propulsion: item.propulsion ?? "",
      info: item.info ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      category: form.category,
      name: form.name,
      photos: form.photos,
      status: form.status,
      rentalCost: form.rentalCost,
      stock: form.stock || "1",
      fps: form.fps || null,
      bbWeight: form.bbWeight || null,
      propulsion: form.propulsion || null,
      info: form.info,
    };

    const res = await fetch(form.id ? `/api/admin/equipment/${form.id}` : "/api/admin/equipment", {
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

  async function saveAssociations(replicaId: string) {
    setSavingAssoc(replicaId);
    await fetch(`/api/admin/equipment/${replicaId}/associations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: assocDraft[replicaId] ?? [] }),
    });
    setSavingAssoc(null);
    await load();
    setExpandedAssoc(null);
  }

  async function removeItem(id: string) {
    if (!confirm("Supprimer cet équipement ?")) return;
    const res = await fetch(`/api/admin/equipment/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  // --- Category handlers ---

  function editCategory(cat: EquipmentCategory) {
    setCatForm({ id: cat.id, label: cat.label, emoji: cat.emoji });
    setShowCatForm(true);
    setCatError(null);
  }

  function resetCatForm() {
    setCatForm(EMPTY_CAT_FORM);
    setShowCatForm(false);
    setCatError(null);
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatError(null);
    setCatSaving(true);

    const url = catForm.id ? `/api/admin/equipment-categories/${catForm.id}` : "/api/admin/equipment-categories";
    const res = await fetch(url, {
      method: catForm.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: catForm.label, emoji: catForm.emoji }),
    });

    setCatSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setCatError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    resetCatForm();
    await loadCategories();
  }

  async function handleDeleteCategory(cat: EquipmentCategory) {
    if (!confirm(`Supprimer la catégorie "${cat.label}" ?`)) return;
    const res = await fetch(`/api/admin/equipment-categories/${cat.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Impossible de supprimer cette catégorie.");
      return;
    }
    await loadCategories();
  }

  // --- Render ---

  function renderCard(item: EquipmentItem) {
    const photoUrls = item.photos?.split("\n").map((p) => p.trim()).filter(Boolean) ?? [];
    const isReplique = item.category === "REPLIQUE";
    const associableItems = items.filter(
      (i) => i.id !== item.id && i.category !== "REPLIQUE" && i.category !== "EQUIPEMENT"
    );
    const isExpanded = expandedAssoc === item.id;
    const draft: { itemId: string; quantity: number }[] = assocDraft[item.id] ?? item.associations;

    return (
      <div key={item.id} className="rounded-xl border border-primary-800 bg-primary-900/40 p-4">
        {photoUrls.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {photoUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt={item.name} className="h-28 w-28 shrink-0 rounded-lg object-cover" />
            ))}
          </div>
        )}
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="min-w-0 truncate font-medium text-slate-100">{item.name}</p>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Location : {item.rentalCost}€ · Stock : {item.stock ?? 1}
              {item.propulsion && ` · ${item.propulsion.split(",").map((v) => PROPULSION_OPTIONS.find((o) => o.value === v.trim())?.label ?? v.trim()).join(", ")}`}
              {item.fps != null && ` · ${item.fps} FPS`}
              {item.bbWeight != null && ` · ${item.bbWeight}g`}
            </p>
            {item.info && <p className="mt-1 text-sm text-slate-300">{item.info}</p>}
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <button onClick={() => editItem(item)} className="text-primary-300 hover:text-silver-200 hover:underline">
                Modifier
              </button>
              {isReplique && associableItems.length > 0 && (
                <button
                  onClick={() => {
                    if (isExpanded) { setExpandedAssoc(null); } else {
                      setAssocDraft((p) => ({ ...p, [item.id]: item.associations }));
                      setExpandedAssoc(item.id);
                    }
                  }}
                  className="text-amber-400 hover:underline"
                >
                  {isExpanded ? "Fermer" : `Éléments associés (${item.associations.length})`}
                </button>
              )}
              <button onClick={() => removeItem(item.id)} className="text-red-400 hover:underline">
                Supprimer
              </button>
            </div>
          </div>
        </div>

        {isReplique && isExpanded && (
          <div className="mt-3 border-t border-primary-700 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-400">
              Éléments associés à cette réplique (accessoires, batteries, chargeurs…)
            </p>
            <div className="space-y-1">
              {associableItems.map((i) => {
                const assocEntry = draft.find((a) => a.itemId === i.id);
                const checked = !!assocEntry;
                const qty = assocEntry?.quantity ?? 1;
                const cat = categories.find((c) => c.key === i.category);
                const maxQty = i.stock;
                return (
                  <div key={i.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary-800/40">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setAssocDraft((p) => {
                          const prev = p[item.id] ?? item.associations;
                          return {
                            ...p,
                            [item.id]: e.target.checked
                              ? [...prev, { itemId: i.id, quantity: Math.min(1, maxQty) }]
                              : prev.filter((a) => a.itemId !== i.id),
                          };
                        });
                      }}
                      className="h-3.5 w-3.5 shrink-0 rounded border-primary-600 bg-primary-950 accent-primary-400"
                    />
                    <span className="flex-1 text-slate-200">{i.name}</span>
                    {cat && <span className="text-xs text-slate-500">{cat.emoji} {cat.label}</span>}
                    {checked && (
                      <div className="flex items-center gap-1 ml-2">
                        <input
                          type="number"
                          min={1}
                          max={maxQty}
                          value={qty}
                          onChange={(e) => {
                            const val = Math.min(maxQty, Math.max(1, Number(e.target.value)));
                            setAssocDraft((p) => ({
                              ...p,
                              [item.id]: (p[item.id] ?? item.associations).map((a) =>
                                a.itemId === i.id ? { ...a, quantity: val } : a
                              ),
                            }));
                          }}
                          className="w-14 rounded border border-primary-700 bg-primary-950 px-2 py-0.5 text-center text-sm text-slate-100 focus:border-primary-400 focus:outline-none"
                        />
                        <span className="text-xs text-slate-500">/ {maxQty} dispo</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => saveAssociations(item.id)}
                disabled={savingAssoc === item.id}
                className="rounded-md bg-primary-400 px-4 py-1.5 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
              >
                {savingAssoc === item.id ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                onClick={() => setExpandedAssoc(null)}
                className="rounded-md border border-primary-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-primary-800/60"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (session && !canAccessSection(role, "equipements")) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-slate-400">Accès non autorisé.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Équipements Airsoft</h1>
      <p className="mt-2 text-slate-400">
        Gérez les catégories, répliques et équipements proposés à la location.
      </p>

      {/* Gestion des catégories */}
      <div className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-silver-100">Catégories</h2>
          {!showCatForm && (
            <button
              onClick={() => { setCatForm(EMPTY_CAT_FORM); setShowCatForm(true); setCatError(null); }}
              className="rounded-md border border-primary-700 px-3 py-1.5 text-sm text-primary-300 hover:bg-primary-800/60"
            >
              + Nouvelle catégorie
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-1 rounded-lg border border-primary-700 bg-primary-900/60 px-3 py-1.5">
              <span className="text-base">{cat.emoji}</span>
              <span className="text-sm text-slate-200">{cat.label}</span>
              <button
                onClick={() => editCategory(cat)}
                className="ml-1 text-xs text-primary-400 hover:text-primary-200"
                title="Modifier"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDeleteCategory(cat)}
                className="text-xs text-red-500 hover:text-red-300"
                title="Supprimer"
              >
                ✕
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-slate-500">Aucune catégorie. Ajoutez-en une ci-dessous.</p>
          )}
        </div>

        {showCatForm && (
          <form onSubmit={handleSaveCategory} className="mt-4 flex flex-wrap items-end gap-3 border-t border-primary-700 pt-4">
            <div>
              <label className="block text-xs font-medium text-slate-400">Emoji</label>
              <input
                value={catForm.emoji}
                onChange={(e) => setCatForm({ ...catForm, emoji: e.target.value })}
                placeholder="📦"
                className="mt-1 w-16 rounded-md border border-primary-700 bg-primary-950 px-2 py-1.5 text-center text-slate-100 focus:border-primary-400 focus:outline-none"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-slate-400">Nom de la catégorie</label>
              <input
                required
                value={catForm.label}
                onChange={(e) => setCatForm({ ...catForm, label: e.target.value })}
                placeholder="Ex: Protections"
                className="mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-1.5 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
              />
            </div>
            {catError && <p className="w-full text-sm text-red-400">{catError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={catSaving}
                className="rounded-md bg-primary-400 px-4 py-1.5 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
              >
                {catSaving ? "…" : catForm.id ? "Mettre à jour" : "Ajouter"}
              </button>
              <button
                type="button"
                onClick={resetCatForm}
                className="rounded-md border border-primary-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-primary-900"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Formulaire équipement */}
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2">
        <h2 className="col-span-full font-display text-lg text-silver-100">
          {form.id ? "Modifier l'équipement" : "Ajouter un équipement"}
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-300">Catégorie</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={inputClass}
            required
          >
            <option value="" disabled>— Choisir —</option>
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>{cat.emoji} {cat.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Nom</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: AEG M4 CQB"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Statut</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as "DISPONIBLE" | "HORS_SERVICE" | "INDISPONIBLE" })}
            className={inputClass}
          >
            <option value="DISPONIBLE">Disponible</option>
            <option value="HORS_SERVICE">Hors-service</option>
            <option value="INDISPONIBLE">Indisponible</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Coût de location (€)</label>
          <input
            type="number"
            min={0}
            required
            value={form.rentalCost}
            onChange={(e) => setForm({ ...form, rentalCost: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Quantité en stock</label>
          <input
            type="number"
            min={1}
            required
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Puissance (FPS, optionnel)</label>
          <input
            type="number"
            min={0}
            value={form.fps}
            onChange={(e) => setForm({ ...form, fps: e.target.value })}
            placeholder="Ex: 380"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Grammage des billes (g, optionnel)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.bbWeight}
            onChange={(e) => setForm({ ...form, bbWeight: e.target.value })}
            placeholder="Ex: 0.25"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Type de propulsion (optionnel)</label>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {PROPULSION_OPTIONS.map((opt) => {
              const checked = form.propulsion.split(",").map((v) => v.trim()).includes(opt.value);
              return (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setForm({ ...form, propulsion: togglePropulsion(form.propulsion, opt.value) })}
                    className="h-4 w-4 rounded border-primary-600 bg-primary-950 text-primary-400 focus:ring-primary-500"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300">Photos (optionnel)</label>
          <PhotosUploadField value={form.photos} onChange={(v) => setForm({ ...form, photos: v })} />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300">Informations supplémentaires</label>
          <textarea
            value={form.info}
            onChange={(e) => setForm({ ...form, info: e.target.value })}
            rows={2}
            placeholder="Ex: réglé à 1 joule, livré avec bi-pied"
            className={inputClass}
          />
        </div>

        {error && <p className="col-span-full text-sm text-red-400">{error}</p>}

        <div className="col-span-full flex gap-3">
          <button
            type="submit"
            disabled={saving || !form.category}
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

      {/* Sections par catégorie */}
      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat.key);
        return (
          <div key={cat.key}>
            <h2 className="mt-10 font-display text-xl text-silver-100">
              {cat.emoji} {cat.label} ({catItems.length})
            </h2>
            <div className="mt-4 space-y-3">
              {catItems.length === 0 && (
                <p className="text-sm text-slate-400">Aucun équipement dans cette catégorie.</p>
              )}
              {catItems.map(renderCard)}
            </div>
          </div>
        );
      })}

      {/* Équipements dont la catégorie a été supprimée */}
      {(() => {
        const knownKeys = new Set(categories.map((c) => c.key));
        const orphans = items.filter((i) => !knownKeys.has(i.category));
        if (orphans.length === 0) return null;
        return (
          <div>
            <h2 className="mt-10 font-display text-xl text-amber-400">⚠️ Catégorie inconnue ({orphans.length})</h2>
            <p className="mt-1 text-sm text-slate-500">Ces équipements appartiennent à une catégorie supprimée.</p>
            <div className="mt-4 space-y-3">{orphans.map(renderCard)}</div>
          </div>
        );
      })()}
    </div>
  );
}

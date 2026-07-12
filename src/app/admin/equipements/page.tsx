"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { canAccessSection } from "@/lib/permissions";

type EquipmentItem = {
  id: string;
  category: "REPLIQUE" | "EQUIPEMENT";
  name: string;
  photos: string | null;
  status: "DISPONIBLE" | "HORS_SERVICE" | "INDISPONIBLE";
  rentalCost: number;
  magazineCount: number | null;
  info: string | null;
};

const EMPTY_FORM = {
  id: "",
  category: "REPLIQUE" as "REPLIQUE" | "EQUIPEMENT",
  name: "",
  photos: "",
  status: "DISPONIBLE" as "DISPONIBLE" | "HORS_SERVICE" | "INDISPONIBLE",
  rentalCost: "",
  magazineCount: "",
  info: "",
};

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
      if (res.ok) {
        const next = [...urls, data.url].join("\n");
        onChange(next);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeUrl(url: string) {
    onChange(urls.filter((u) => u !== url).join("\n"));
  }

  const inputClass = "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

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
              <button type="button" onClick={() => removeUrl(url)}
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
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/equipment");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function editItem(item: EquipmentItem) {
    setForm({
      id: item.id,
      category: item.category,
      name: item.name,
      photos: item.photos ?? "",
      status: item.status,
      rentalCost: String(item.rentalCost),
      magazineCount: item.magazineCount ? String(item.magazineCount) : "",
      info: item.info ?? "",
    });
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
      magazineCount: form.category === "REPLIQUE" ? form.magazineCount || null : null,
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

  async function removeItem(id: string) {
    if (!confirm("Supprimer cet équipement ?")) return;
    const res = await fetch(`/api/admin/equipment/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  function renderCard(item: EquipmentItem) {
    const firstPhoto = item.photos?.split("\n").map((p) => p.trim()).filter(Boolean)[0];
    return (
      <div key={item.id} className="rounded-xl border border-primary-800 bg-primary-900/40 p-4">
        <div className="flex gap-4">
          {firstPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={firstPhoto} alt={item.name} className="h-20 w-20 rounded-lg object-cover" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-100">{item.name}</p>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Location : {item.rentalCost}€
              {item.magazineCount != null && ` · ${item.magazineCount} chargeur(s)`}
            </p>
            {item.info && <p className="mt-1 text-sm text-slate-300">{item.info}</p>}
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

  const repliques = items.filter((i) => i.category === "REPLIQUE");
  const equipements = items.filter((i) => i.category === "EQUIPEMENT");

  if (session && !canAccessSection(role, "equipements")) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-slate-400">Accès non autorisé.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Équipements Airsoft</h1>
      <p className="mt-2 text-slate-400">
        Gérez les répliques et équipements proposés à la location pour les sorties airsoft.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2">
        <h2 className="col-span-full font-display text-lg text-silver-100">
          {form.id ? "Modifier l'équipement" : "Ajouter un équipement"}
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-300">Catégorie</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as "REPLIQUE" | "EQUIPEMENT" })}
            className={inputClass}
          >
            <option value="REPLIQUE">Réplique</option>
            <option value="EQUIPEMENT">Équipement</option>
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
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as "DISPONIBLE" | "HORS_SERVICE" | "INDISPONIBLE" })
            }
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

        {form.category === "REPLIQUE" && (
          <div>
            <label className="block text-sm font-medium text-slate-300">Nombre de chargeurs disponibles</label>
            <input
              type="number"
              min={0}
              value={form.magazineCount}
              onChange={(e) => setForm({ ...form, magazineCount: e.target.value })}
              className={inputClass}
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300">
            Photos (optionnel)
          </label>
          <PhotosUploadField
            value={form.photos}
            onChange={(v) => setForm({ ...form, photos: v })}
          />
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

      <h2 className="mt-10 font-display text-xl text-silver-100">🔫 Répliques ({repliques.length})</h2>
      <div className="mt-4 space-y-3">
        {repliques.length === 0 && <p className="text-sm text-slate-400">Aucune réplique enregistrée.</p>}
        {repliques.map(renderCard)}
      </div>

      <h2 className="mt-10 font-display text-xl text-silver-100">🎒 Équipements ({equipements.length})</h2>
      <div className="mt-4 space-y-3">
        {equipements.length === 0 && <p className="text-sm text-slate-400">Aucun équipement enregistré.</p>}
        {equipements.map(renderCard)}
      </div>
    </div>
  );
}

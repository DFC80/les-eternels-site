"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

export default function ParametresPage() {
  const [nomAssociation, setNomAssociation] = useState("");
  const [anneeCopyright, setAnneeCopyright] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["especes"]);
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [activities, setActivities] = useState<{ label: string; isActive: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [logoVersion, setLogoVersion] = useState<string>(() => String(Date.now()));
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [settingsRes, actRes] = await Promise.all([
      fetch("/api/admin/settings"),
      fetch("/api/admin/activity-types"),
    ]);
    if (settingsRes.ok) {
      const data = await settingsRes.json();
      const currentYear = String(new Date().getFullYear());
      setNomAssociation(data.nomAssociation ?? "Les Éternels");
      setAnneeCopyright(data.anneeCopyright ?? currentYear);
      setDescription(data.description ?? "");
      try { setPaymentMethods(JSON.parse(data.paymentMethods ?? '["especes"]')); } catch { setPaymentMethods(["especes"]); }
      setOriginal({
        nomAssociation: data.nomAssociation ?? "Les Éternels",
        anneeCopyright: data.anneeCopyright ?? currentYear,
        description: data.description ?? "",
        paymentMethods: data.paymentMethods ?? '["especes"]',
      });
    }
    if (actRes.ok) {
      const acts = await actRes.json();
      setActivities(acts);
    }
  }

  useEffect(() => { load(); }, []);

  function generateFromActivities() {
    const labels = activities
      .filter((a) => a.isActive)
      .map((a) => a.label.toLowerCase());

    if (labels.length === 0) return;

    let list: string;
    if (labels.length === 1) {
      list = labels[0];
    } else {
      const allButLast = labels.slice(0, -1);
      const last = labels[labels.length - 1];
      list = `${allButLast.join(", ")} et ${last}`;
    }

    setDescription(
      `${nomAssociation} est une association à but non lucratif dédiée à la pratique du ${list}. ` +
      `Nous accueillons tous les passionnés, débutants ou confirmés, dans une ambiance conviviale et bienveillante.`
    );
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo() {
    if (!logoFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("logo", logoFile);
    const res = await fetch("/api/admin/upload-logo", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      const data = await res.json();
      setLogoVersion(data.version);
      setLogoFile(null);
      setLogoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadSuccess(true);
      router.refresh();
      setTimeout(() => setUploadSuccess(false), 3000);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomAssociation, anneeCopyright, description, paymentMethods: JSON.stringify(paymentMethods) }),
    });
    setSaving(false);
    setOriginal({ nomAssociation, anneeCopyright, description });
    setSuccess(true);
    router.refresh();
    setTimeout(() => setSuccess(false), 3000);
  }

  const changed = nomAssociation !== original.nomAssociation || anneeCopyright !== original.anneeCopyright || description !== original.description || JSON.stringify(paymentMethods) !== original.paymentMethods;

  const ALL_PAYMENT_METHODS = [
    { key: "especes", label: "Espèces" },
    { key: "cheque", label: "Chèque" },
    { key: "virement", label: "Virement bancaire" },
    { key: "carte", label: "Carte bancaire" },
  ];

  function togglePayment(key: string) {
    setPaymentMethods((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Paramètres de l'association</h1>
      <p className="mt-2 text-slate-400">
        Modifiez les informations générales affichées sur la page d'accueil.
      </p>

      {/* Logo — formulaire séparé (multipart) */}
      <div className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
        <p className="text-sm font-medium text-slate-300">Logo de l'association</p>
        <p className="mt-1 text-xs text-slate-500">Remplace le fichier logo.jpg. JPG, PNG ou WEBP.</p>
        <div className="mt-4 flex items-center gap-6">
          <Image
            src={logoPreview ?? `/logo.jpg?v=${logoVersion}`}
            alt="Logo actuel"
            width={80}
            height={52}
            className="rounded border border-primary-700 object-contain"
            unoptimized
          />
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onLogoChange}
              className="text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-primary-700 file:px-3 file:py-1 file:text-sm file:text-slate-200 hover:file:bg-primary-600"
            />
            {logoFile && (
              <button
                type="button"
                onClick={uploadLogo}
                disabled={uploading}
                className="rounded bg-primary-400 px-4 py-1.5 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
              >
                {uploading ? "Envoi en cours..." : "Enregistrer le logo"}
              </button>
            )}
            {uploadSuccess && <span className="text-sm text-emerald-400">Logo mis à jour ✓</span>}
          </div>
        </div>
      </div>

      <form onSubmit={save} className="mt-6 space-y-6">
        <div className="rounded-xl border border-primary-800 bg-primary-900/40 p-6">
          <label className="block text-sm font-medium text-slate-300">
            Nom de l'association
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Affiché dans le footer et sur la page d'accueil.
          </p>
          <input
            type="text"
            value={nomAssociation}
            onChange={(e) => setNomAssociation(e.target.value)}
            className={inputClass}
            placeholder="Les Éternels"
          />
        </div>

        <div className="rounded-xl border border-primary-800 bg-primary-900/40 p-6">
          <label className="block text-sm font-medium text-slate-300">
            Année du copyright
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Affiché dans le footer : © {anneeCopyright} {nomAssociation} — Association loi 1901.
          </p>
          <input
            type="text"
            value={anneeCopyright}
            onChange={(e) => setAnneeCopyright(e.target.value)}
            className={`${inputClass} max-w-[12rem]`}
            placeholder="2026"
          />
        </div>

        <div className="rounded-xl border border-primary-800 bg-primary-900/40 p-6">
          <label className="block text-sm font-medium text-slate-300">
            Descriptif de l'association
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Ce texte s'affiche sous le titre sur la page d'accueil.
          </p>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} mt-2`}
            placeholder="Une association à but non lucratif réunissant..."
          />
          <button
            type="button"
            onClick={generateFromActivities}
            className="mt-2 text-xs text-primary-300 hover:text-silver-200 hover:underline"
          >
            ↺ Générer depuis les activités actives
          </button>
        </div>

        <div className="rounded-xl border border-primary-800 bg-primary-900/40 p-6">
          <label className="block text-sm font-medium text-slate-300">Modes de paiement acceptés</label>
          <p className="mt-1 text-xs text-slate-500">
            Ces modes s'affichent sur la page de cotisation des membres.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {ALL_PAYMENT_METHODS.map((m) => (
              <label key={m.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary-700 bg-primary-950 px-4 py-2 text-sm text-slate-300 hover:border-primary-500">
                <input
                  type="checkbox"
                  checked={paymentMethods.includes(m.key)}
                  onChange={() => togglePayment(m.key)}
                  className="accent-primary-400"
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving || !changed}
            className="rounded-md bg-primary-400 px-5 py-2.5 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          {changed && !saving && (
            <button
              type="button"
              onClick={() => { setNomAssociation(original.nomAssociation ?? ""); setAnneeCopyright(original.anneeCopyright ?? ""); setDescription(original.description ?? ""); }}
              className="text-sm text-slate-500 hover:text-slate-300"
            >
              Annuler
            </button>
          )}
          {success && <span className="text-sm text-emerald-400">Enregistré ✓</span>}
        </div>
      </form>
    </div>
  );
}

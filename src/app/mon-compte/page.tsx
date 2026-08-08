"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getColors } from "@/lib/activity-colors";
import { BASE_MEMBERSHIP_FEE } from "@/lib/membership";

type ActivityDef = {
  key: string;
  label: string;
  emoji: string;
  color: string;
  price: number;
  isCore: boolean;
  isActive: boolean;
  membershipRequired: boolean;
};

type Membership = {
  wantsBoardGames: boolean;
  wantsRolePlay: boolean;
  wantsAirsoft: boolean;
  extraActivityKeys: string[];
  amount: number;
  isPaid: boolean;
  paidAmount: number;
  paidAt: string | null;
  year: number;
  expired: boolean;
} | null;

const CORE_KEY_MAP: Record<string, "wantsBoardGames" | "wantsRolePlay" | "wantsAirsoft"> = {
  JEUX_DE_PLATEAU: "wantsBoardGames",
  JEUX_DE_ROLE: "wantsRolePlay",
  AIRSOFT: "wantsAirsoft",
};

export default function MonComptePage() {
  const [membership, setMembership] = useState<Membership>(null);
  const [coreActivities, setCoreActivities] = useState<ActivityDef[]>([]);
  const [extraActivities, setExtraActivities] = useState<ActivityDef[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [originalKeys, setOriginalKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);

  async function payOnline() {
    setError(null);
    setPaying(true);
    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "MEMBERSHIP" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setError(data.error ?? "Impossible de démarrer le paiement en ligne.");
    setPaying(false);
  }

  async function load() {
    const [memberRes, actRes] = await Promise.all([
      fetch("/api/membership"),
      fetch("/api/activities"),
    ]);

    if (actRes.ok) {
      const acts: ActivityDef[] = await actRes.json();
      const active = acts.filter((a) => a.isActive);
      setCoreActivities(active.filter((a) => a.isCore));
      setExtraActivities(active.filter((a) => !a.isCore));
    }

    if (memberRes.ok) {
      const raw = await memberRes.json();
      // Sans adhésion, l'API renvoie { airsoftTrialDay } : ne le traite pas comme une adhésion
      const data: Membership = raw && "year" in raw ? raw : null;
      setMembership(data);
      if (data && !data.expired) {
        const keys = new Set<string>();
        if (data.wantsBoardGames) keys.add("JEUX_DE_PLATEAU");
        if (data.wantsRolePlay) keys.add("JEUX_DE_ROLE");
        if (data.wantsAirsoft) keys.add("AIRSOFT");
        for (const k of data.extraActivityKeys ?? []) keys.add(k);
        setSelectedKeys(keys);
        setOriginalKeys(new Set(keys));
      }
    }
  }

  useEffect(() => { load(); }, []);

  const allActivities = [...coreActivities, ...extraActivities];
  const selectedActivities = allActivities.filter((a) => selectedKeys.has(a.key));
  const activitiesAmount = selectedActivities.reduce((sum, a) => sum + a.price, 0);
  const amount = selectedActivities.length > 0 ? BASE_MEMBERSHIP_FEE + activitiesAmount : 0;

  function toggle(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    const extraKeys = [...selectedKeys].filter((k) => !CORE_KEY_MAP[k]);

    const res = await fetch("/api/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wantsBoardGames: selectedKeys.has("JEUX_DE_PLATEAU"),
        wantsRolePlay: selectedKeys.has("JEUX_DE_ROLE"),
        wantsAirsoft: selectedKeys.has("AIRSOFT"),
        extraActivityKeys: extraKeys,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      return;
    }

    setSuccess(true);
    await load();
  }

  const isPaidAndValid = !!(membership && !membership.expired && membership.isPaid);
  const isLocked = !!(membership && !membership.expired);
  const hasNewActivities = isPaidAndValid && [...selectedKeys].some((k) => !originalKeys.has(k));
  const newActivities = allActivities.filter((a) => selectedKeys.has(a.key) && !originalKeys.has(a.key));
  const supplement = newActivities.reduce((sum, a) => sum + a.price, 0);

  function canToggle(key: string) {
    if (isPaidAndValid) return !originalKeys.has(key); // activités déjà validées non décochables
    return !isLocked;
  }

  function renderActivityCard(a: ActivityDef) {
    const checked = selectedKeys.has(a.key);
    const isOriginal = originalKeys.has(a.key);
    const clickable = canToggle(a.key);
    const colors = getColors(a.color);
    return (
      <button
        key={a.key}
        type="button"
        onClick={() => clickable && toggle(a.key)}
        disabled={!clickable}
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center transition ${
          checked
            ? `${colors.border} bg-primary-800/60 shadow-lg shadow-primary-900/40`
            : "border-primary-800 bg-primary-900/40 hover:border-primary-600"
        } ${!clickable ? "cursor-not-allowed opacity-70" : ""}`}
      >
        <span className="text-4xl">{a.emoji}</span>
        <span className="font-display text-base text-silver-100">{a.label}</span>
        <span className={`text-sm font-semibold ${checked ? colors.text : "text-slate-400"}`}>
          {a.price > 0 ? `${a.price}€` : "Gratuit"}
        </span>
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
            checked
              ? isOriginal
                ? "bg-emerald-700 text-emerald-100"
                : "bg-primary-400 text-primary-950"
              : "bg-primary-950 text-slate-400"
          }`}
        >
          {checked ? (isOriginal ? "Déjà inclus ✓" : "Sélectionné") : "Sélectionner"}
        </span>
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Mon adhésion</h1>
      <p className="mt-2 text-slate-400">
        Choisissez les activités auxquelles vous souhaitez participer pour calculer le montant
        de votre cotisation annuelle ({new Date().getFullYear()}). Le règlement se fait sur place.
        La cotisation n'est valable que
        pour l'année en cours et doit être renouvelée chaque 1er janvier.
      </p>

      {membership && membership.expired && (
        <div className="mt-6 rounded-md border border-amber-700 bg-amber-950 px-4 py-3 text-sm text-amber-300">
          Votre cotisation {membership.year} est arrivée à expiration. Merci de renouveler votre
          choix d'activités pour {new Date().getFullYear()}.
        </div>
      )}

      {membership && !membership.expired && (() => {
        const dueOnline = membership.amount - (membership.isPaid ? membership.paidAmount : 0);
        return (
          <div className={`mt-6 rounded-md border px-4 py-3 text-sm ${
            membership.isPaid && dueOnline <= 0
              ? "border-emerald-700 bg-emerald-950 text-emerald-300"
              : "border-amber-700 bg-amber-950 text-amber-300"
          }`}>
            {membership.isPaid && dueOnline <= 0
              ? `Cotisation ${membership.year} de ${membership.amount}€ réglée${membership.paidAt ? ` le ${new Date(membership.paidAt).toLocaleDateString("fr-FR")}` : ""}.`
              : membership.isPaid
              ? `Supplément de ${dueOnline}€ à régler (nouvelles activités ajoutées).`
              : `Cotisation ${membership.year} de ${membership.amount}€ en attente de règlement.`}
            {dueOnline > 0 && (
              <>
                <button
                  type="button"
                  disabled
                  className="mt-3 block w-full rounded-md bg-primary-900 px-4 py-2.5 text-center font-semibold text-slate-500 border border-primary-700 cursor-not-allowed opacity-60 sm:w-auto sm:px-6"
                >
                  💳 Payer {dueOnline}€ en ligne (indisponible)
                </button>
                <p className="mt-2 text-xs opacity-80">
                  Le paiement s'effectue sur place à un administrateur.
                </p>
              </>
            )}
          </div>
        );
      })()}

      <form onSubmit={handleSubmit} className="mt-8">
        {coreActivities.length > 0 && (
          <div className={`grid gap-6 grid-cols-${Math.min(coreActivities.length, 3)} sm:grid-cols-${Math.min(coreActivities.length, 3)}`}
            style={{ gridTemplateColumns: `repeat(${Math.min(coreActivities.length, 3)}, minmax(0, 1fr))` }}>
            {coreActivities.map(renderActivityCard)}
          </div>
        )}

        {extraActivities.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-lg text-silver-100">Autres activités</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {extraActivities.map(renderActivityCard)}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border-2 border-primary-700 bg-primary-900/60 p-8 text-center">
          <span className="text-sm uppercase tracking-wide text-slate-400">
            Montant de la cotisation {new Date().getFullYear()}
          </span>
          <span className="font-display text-5xl text-silver-100">{amount}€</span>
          {selectedActivities.length > 0 && (
            <div className="text-xs text-slate-500 space-y-0.5">
              <p>Adhésion de base : {BASE_MEMBERSHIP_FEE}€</p>
              {selectedActivities.map((a) => (
                <p key={a.key}>{a.emoji} {a.label} : {a.price}€</p>
              ))}
            </div>
          )}

          {hasNewActivities && (
            <p className="text-sm text-amber-300">
              Supplément à régler sur place : <strong>+{supplement}€</strong>
            </p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">Votre choix d'activités a été enregistré.</p>}

          <button
            type="submit"
            disabled={saving || amount === 0 || (isLocked && !hasNewActivities)}
            className="w-full max-w-xs rounded-md bg-primary-400 px-4 py-3 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving
              ? "Enregistrement..."
              : hasNewActivities
              ? `Ajouter ces activités (+${supplement}€)`
              : isPaidAndValid
              ? "Cotisation réglée ✓"
              : isLocked
              ? "Choix enregistré"
              : "Valider mon choix"}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        <Link href="/profil" className="font-medium text-primary-300 hover:text-silver-200 hover:underline">
          Compléter mon profil (obligatoire pour adhérer)
        </Link>
      </p>
    </div>
  );
}

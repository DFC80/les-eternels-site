"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { canAccessSection, sessionHasWriteAccess } from "@/lib/permissions";
import DateInput from "@/components/DateInput";
import { formatCentsToEuros } from "@/lib/money";

type EventSummary = {
  eventId: string;
  title: string;
  startsAt: string;
  mealIncome: number;
  equipmentIncome: number;
  participationIncome: number;
  income: number;
  expensesTotal: number;
  profit: number;
  expenses: { id: string; label: string; amount: number }[];
};

type GeneralExpense = { id: string; label: string; amount: number; date: string };
type GeneralCredit = { id: string; label: string; amount: number; date: string };

type MembershipSummary = {
  membershipId: string;
  memberName: string;
  year: number;
  amount: number;
  paidAt: string | null;
};

type BalanceTopUp = {
  id: string;
  memberName: string;
  amount: number;
  createdAt: string;
};

type OnlinePayment = {
  id: string;
  memberName: string;
  type: "MEMBERSHIP" | "EVENT" | "BALANCE_TOPUP";
  label: string;
  amount: number;
  stripeFeesCents: number;
  paidAt: string | null;
};

type Accounting = {
  events: EventSummary[];
  generalExpenses: GeneralExpense[];
  generalCredits: GeneralCredit[];
  memberships: MembershipSummary[];
  balanceTopUps: BalanceTopUp[];
  onlinePayments: OnlinePayment[];
  totals: {
    totalMembershipIncome: number;
    totalEventIncome: number;
    totalEventExpenses: number;
    totalGeneralExpenses: number;
    totalGeneralCredits: number;
    totalBalanceTopUps: number;
    totalOnlinePaymentsCents: number;
    netResultCents: number;
  };
};

const PAYMENT_TYPE_LABELS: Record<OnlinePayment["type"], string> = {
  MEMBERSHIP: "Cotisation",
  EVENT: "Événement",
  BALANCE_TOPUP: "Recharge solde",
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

export default function ComptabilitePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(sessionUser, "comptabilite");
  const [data, setData] = useState<Accounting | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const [creditLabel, setCreditLabel] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDate, setCreditDate] = useState(new Date().toISOString().slice(0, 10));
  const [creditError, setCreditError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/accounting");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function addGeneralExpense(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label || !amount) return;

    const res = await fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, amount, date: date || undefined }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    setLabel("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    await load();
  }

  async function removeGeneralExpense(id: string) {
    const res = await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function addGeneralCredit(e: React.FormEvent) {
    e.preventDefault();
    setCreditError(null);
    if (!creditLabel || !creditAmount) return;

    const res = await fetch("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: creditLabel, amount: creditAmount, date: creditDate || undefined }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setCreditError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    setCreditLabel("");
    setCreditAmount("");
    setCreditDate(new Date().toISOString().slice(0, 10));
    await load();
  }

  async function removeGeneralCredit(id: string) {
    const res = await fetch(`/api/admin/credits/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-slate-400">Chargement...</p>
      </div>
    );
  }

  if (session && !canAccessSection(role, "comptabilite")) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-slate-400">Accès non autorisé.</div>;
  }

  const { totals } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Comptabilité</h1>
      <p className="mt-2 text-slate-400">
        Vue d'ensemble des gains et dépenses des événements, et des dépenses générales de
        l'association.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 sm:text-xs">Cotisations</p>
          <p className="mt-1 font-display text-2xl text-emerald-400">{totals.totalMembershipIncome}€</p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 sm:text-xs">Gains événements</p>
          <p className="mt-1 font-display text-2xl text-emerald-400">{totals.totalEventIncome}€</p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 sm:text-xs">Recharges solde</p>
          <p className="mt-1 font-display text-2xl text-emerald-400">
            {formatCentsToEuros(totals.totalBalanceTopUps)}
          </p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 sm:text-xs">Crédits divers</p>
          <p className="mt-1 font-display text-2xl text-emerald-400">{totals.totalGeneralCredits}€</p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 sm:text-xs">Dépenses événements</p>
          <p className="mt-1 font-display text-2xl text-red-400">{totals.totalEventExpenses}€</p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 sm:text-xs">Dépenses générales</p>
          <p className="mt-1 font-display text-2xl text-red-400">{totals.totalGeneralExpenses}€</p>
        </div>
        <div className="rounded-xl border-2 border-primary-400 bg-primary-800/50 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-slate-300 sm:text-xs">Résultat net</p>
          <p
            className={`mt-1 font-display text-2xl ${
              totals.netResultCents >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatCentsToEuros(totals.netResultCents)}
          </p>
        </div>
      </div>

      <h2 className="mt-10 font-display text-xl text-silver-100">Cotisations encaissées</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-primary-800 bg-primary-900/40">
        <table className="w-full text-sm">
          <thead className="bg-primary-950/60 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Membre</th>
              <th className="px-4 py-3">Année</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Date de paiement</th>
            </tr>
          </thead>
          <tbody>
            {data.memberships.map((m) => (
              <tr key={m.membershipId} className="border-t border-primary-800 text-slate-200">
                <td className="px-4 py-3 font-medium">{m.memberName}</td>
                <td className="px-4 py-3 text-slate-400">{m.year}</td>
                <td className="px-4 py-3">{m.amount}€</td>
                <td className="px-4 py-3 text-slate-400">
                  {m.paidAt ? new Date(m.paidAt).toLocaleDateString("fr-FR") : "—"}
                </td>
              </tr>
            ))}
            {data.memberships.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-slate-500">
                  Aucune cotisation encaissée pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-display text-xl text-silver-100">Recharges de solde adhérent</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-primary-800 bg-primary-900/40">
        <table className="w-full text-sm">
          <thead className="bg-primary-950/60 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Membre</th>
              <th className="px-4 py-3">Montant rechargé</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.balanceTopUps.map((t) => (
              <tr key={t.id} className="border-t border-primary-800 text-slate-200">
                <td className="px-4 py-3 font-medium">{t.memberName}</td>
                <td className="px-4 py-3 text-emerald-400">{formatCentsToEuros(t.amount)}</td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(t.createdAt).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))}
            {data.balanceTopUps.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-slate-500">
                  Aucune recharge de solde enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-display text-xl text-silver-100">
        💳 Paiements en ligne (Stripe) —{" "}
        <span className="text-emerald-400">{formatCentsToEuros(data.totals.totalOnlinePaymentsCents)}</span>
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Montants déjà comptés dans les catégories ci-dessus (cotisations, recharges, gains
        événements) — ce tableau détaille la part encaissée par carte bancaire.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-primary-800 bg-primary-900/40">
        <table className="w-full text-sm">
          <thead className="bg-primary-950/60 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Membre</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3 text-amber-400/80" title="Frais Stripe (non comptabilisés)">Frais</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.onlinePayments.map((p) => (
              <tr key={p.id} className="border-t border-primary-800 text-slate-200">
                <td className="px-4 py-3 font-medium">{p.memberName}</td>
                <td className="px-4 py-3 text-slate-400">{PAYMENT_TYPE_LABELS[p.type] ?? p.type}</td>
                <td className="px-4 py-3 text-slate-400">{p.label}</td>
                <td className="px-4 py-3 text-emerald-400">{formatCentsToEuros(p.amount)}</td>
                <td className="px-4 py-3 text-amber-400/80 text-xs">
                  {p.stripeFeesCents > 0 ? formatCentsToEuros(p.stripeFeesCents) : "—"}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {p.paidAt ? new Date(p.paidAt).toLocaleString("fr-FR") : "—"}
                </td>
              </tr>
            ))}
            {data.onlinePayments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-slate-500">
                  Aucun paiement en ligne pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-display text-xl text-silver-100">Détail par événement</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-primary-800 bg-primary-900/40">
        <table className="w-full text-sm">
          <thead className="bg-primary-950/60 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Événement</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Repas</th>
              <th className="px-4 py-3">Matériel</th>
              <th className="px-4 py-3">Participations</th>
              <th className="px-4 py-3">Total gains</th>
              <th className="px-4 py-3">Dépenses</th>
              <th className="px-4 py-3">Résultat</th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((ev) => (
              <tr key={ev.eventId} className="border-t border-primary-800 text-slate-200">
                <td className="px-4 py-3 font-medium">{ev.title}</td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(ev.startsAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-slate-400">{ev.mealIncome}€</td>
                <td className="px-4 py-3 text-slate-400">{ev.equipmentIncome}€</td>
                <td className="px-4 py-3 text-slate-400">
                  {ev.participationIncome > 0 ? `${ev.participationIncome}€` : "—"}
                </td>
                <td className="px-4 py-3">{ev.income}€</td>
                <td className="px-4 py-3">{ev.expensesTotal}€</td>
                <td
                  className={`px-4 py-3 font-semibold ${
                    ev.profit >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {ev.profit}€
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-display text-xl text-silver-100">Dépenses générales</h2>
      <p className="mt-1 text-sm text-slate-400">
        Frais non liés à un événement précis (location de terrain annuelle, assurance, matériel...).
      </p>

      {canWrite && <form
        onSubmit={addGeneralExpense}
        className="mt-4 grid gap-3 rounded-xl border border-primary-800 bg-primary-900/40 p-4 sm:grid-cols-4"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Assurance annuelle"
          className={`${inputClass} sm:col-span-2`}
        />
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Montant €"
          className={inputClass}
        />
        <DateInput value={date} onChange={setDate} className={inputClass} />
        <button
          type="submit"
          className="sm:col-span-4 rounded-md bg-primary-400 px-4 py-2 font-semibold text-primary-950 hover:bg-silver-300"
        >
          Ajouter la dépense
        </button>
        {error && <p className="sm:col-span-4 text-sm text-red-400">{error}</p>}
      </form>}

      <div className="mt-4 space-y-2">
        {data.generalExpenses.map((exp) => (
          <div
            key={exp.id}
            className="flex items-center justify-between rounded-lg border border-primary-800 bg-primary-900/40 p-3 text-sm text-slate-200"
          >
            <span>
              {exp.label} — {exp.amount}€ —{" "}
              <span className="text-slate-400">{new Date(exp.date).toLocaleDateString("fr-FR")}</span>
            </span>
            {canWrite && <button onClick={() => removeGeneralExpense(exp.id)} className="text-red-400 hover:underline">
              Supprimer
            </button>}
          </div>
        ))}
        {data.generalExpenses.length === 0 && (
          <p className="text-sm text-slate-500">Aucune dépense générale enregistrée.</p>
        )}
      </div>

      <h2 className="mt-10 font-display text-xl text-silver-100">Crédits divers</h2>
      <p className="mt-1 text-sm text-slate-400">
        Recettes ponctuelles non liées à un événement (subvention, don, remboursement...).
      </p>

      {canWrite && <form
        onSubmit={addGeneralCredit}
        className="mt-4 grid gap-3 rounded-xl border border-primary-800 bg-primary-900/40 p-4 sm:grid-cols-4"
      >
        <input
          value={creditLabel}
          onChange={(e) => setCreditLabel(e.target.value)}
          placeholder="Ex: Subvention mairie"
          className={`${inputClass} sm:col-span-2`}
        />
        <input
          type="number"
          min={0}
          value={creditAmount}
          onChange={(e) => setCreditAmount(e.target.value)}
          placeholder="Montant €"
          className={inputClass}
        />
        <DateInput value={creditDate} onChange={setCreditDate} className={inputClass} />
        <button
          type="submit"
          className="sm:col-span-4 rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500"
        >
          Ajouter le crédit
        </button>
        {creditError && <p className="sm:col-span-4 text-sm text-red-400">{creditError}</p>}
      </form>}

      <div className="mt-4 space-y-2">
        {data.generalCredits.map((cr) => (
          <div
            key={cr.id}
            className="flex items-center justify-between rounded-lg border border-emerald-800/40 bg-emerald-900/20 p-3 text-sm text-slate-200"
          >
            <span>
              {cr.label} —{" "}
              <span className="text-emerald-400 font-semibold">+{cr.amount}€</span> —{" "}
              <span className="text-slate-400">{new Date(cr.date).toLocaleDateString("fr-FR")}</span>
            </span>
            {canWrite && <button onClick={() => removeGeneralCredit(cr.id)} className="text-red-400 hover:underline">
              Supprimer
            </button>}
          </div>
        ))}
        {data.generalCredits.length === 0 && (
          <p className="text-sm text-slate-500">Aucun crédit divers enregistré.</p>
        )}
      </div>
    </div>
  );
}

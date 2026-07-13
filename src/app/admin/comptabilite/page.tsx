"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { canAccessSection } from "@/lib/permissions";
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

type MembershipSummary = {
  membershipId: string;
  memberName: string;
  year: number;
  amount: number;
  paidAt: string | null;
};

type SnackSale = {
  id: string;
  memberName: string;
  createdAt: string;
  totalAmount: number;
  items: { name: string; quantity: number; unitPrice: number }[];
};

type Accounting = {
  events: EventSummary[];
  generalExpenses: GeneralExpense[];
  memberships: MembershipSummary[];
  snackSales: SnackSale[];
  totals: {
    totalMembershipIncome: number;
    totalEventIncome: number;
    totalEventExpenses: number;
    totalGeneralExpenses: number;
    totalSnackIncome: number;
    netResultCents: number;
  };
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

export default function ComptabilitePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const [data, setData] = useState<Accounting | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    setDate("");
    await load();
  }

  async function removeGeneralExpense(id: string) {
    const res = await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
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

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-6">
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">Cotisations adhésions</p>
          <p className="mt-1 font-display text-2xl text-emerald-400">{totals.totalMembershipIncome}€</p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">Gains événements</p>
          <p className="mt-1 font-display text-2xl text-emerald-400">{totals.totalEventIncome}€</p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">Gains comptoir</p>
          <p className="mt-1 font-display text-2xl text-emerald-400">
            {formatCentsToEuros(totals.totalSnackIncome)}
          </p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">Dépenses événements</p>
          <p className="mt-1 font-display text-2xl text-red-400">{totals.totalEventExpenses}€</p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">Dépenses générales</p>
          <p className="mt-1 font-display text-2xl text-red-400">{totals.totalGeneralExpenses}€</p>
        </div>
        <div className="rounded-xl border-2 border-primary-400 bg-primary-800/50 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-300">Résultat net</p>
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

      <h2 className="mt-10 font-display text-xl text-silver-100">Ventes comptoir (friandises & boissons)</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-primary-800 bg-primary-900/40">
        <table className="w-full text-sm">
          <thead className="bg-primary-950/60 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Membre</th>
              <th className="px-4 py-3">Articles</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.snackSales.map((s) => (
              <tr key={s.id} className="border-t border-primary-800 text-slate-200">
                <td className="px-4 py-3 font-medium">{s.memberName}</td>
                <td className="px-4 py-3 text-slate-400">
                  {s.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                </td>
                <td className="px-4 py-3">{formatCentsToEuros(s.totalAmount)}</td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(s.createdAt).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))}
            {data.snackSales.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-slate-500">
                  Aucune vente comptoir enregistrée pour le moment.
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

      <form
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
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        <button
          type="submit"
          className="sm:col-span-4 rounded-md bg-primary-400 px-4 py-2 font-semibold text-primary-950 hover:bg-silver-300"
        >
          Ajouter la dépense
        </button>
        {error && <p className="sm:col-span-4 text-sm text-red-400">{error}</p>}
      </form>

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
            <button onClick={() => removeGeneralExpense(exp.id)} className="text-red-400 hover:underline">
              Supprimer
            </button>
          </div>
        ))}
        {data.generalExpenses.length === 0 && (
          <p className="text-sm text-slate-500">Aucune dépense générale enregistrée.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { formatCentsToEuros } from "@/lib/money";

const SUGGESTED_AMOUNTS = [5, 10, 20];

export default function BalanceTopUpCard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch("/api/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setBalance(d.balance); });
  }, []);

  async function payTopUp(euros: string) {
    setError(null);
    setPaying(true);
    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "BALANCE_TOPUP", amount: euros }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setError(data.error ?? "Impossible de démarrer le paiement en ligne.");
    setPaying(false);
  }

  return (
    <div className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
      <h2 className="font-display text-lg text-silver-100">💳 Mon solde comptoir</h2>
      <p className="mt-1 text-sm text-slate-400">
        Solde actuel :{" "}
        <span className={`font-semibold ${balance !== null && balance < 0 ? "text-red-400" : "text-emerald-400"}`}>
          {balance !== null ? formatCentsToEuros(balance) : "…"}
        </span>
      </p>
      <p className="mt-3 text-sm text-slate-300">
        Rechargez votre solde pour payer vos friandises et boissons au comptoir lors des événements.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 opacity-40 pointer-events-none select-none">
        {SUGGESTED_AMOUNTS.map((v) => (
          <button
            key={v}
            type="button"
            disabled
            className="rounded-md border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-300 cursor-not-allowed"
          >
            {v}€
          </button>
        ))}
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Autre montant"
          disabled
          className="w-32 rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 cursor-not-allowed"
        />
        <button
          type="button"
          disabled
          className="rounded-md bg-primary-800 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed"
        >
          Recharger
        </button>
      </div>

      <p className="mt-3 text-sm text-amber-400/80">
        💡 La recharge s'effectue sur place — remettez le montant à un administrateur au comptoir.
      </p>
    </div>
  );
}

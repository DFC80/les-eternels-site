"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCentsToEuros } from "@/lib/money";

type TxItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  customText?: string | null;
};

type Transaction = {
  id: string;
  type: "cotisation" | "recharge" | "comptoir" | "boutique";
  date: string;
  label: string;
  amountCents: number;
  status?: string;
  statusLabel?: string;
  items?: TxItem[];
};

const ALL_TYPES = ["cotisation", "recharge", "comptoir", "boutique"] as const;

const TYPE_META: Record<Transaction["type"], { icon: string; label: string; color: string; bg: string; activeBorder: string }> = {
  cotisation: { icon: "📋", label: "Cotisations",      color: "text-violet-300", bg: "bg-violet-900/30 border-violet-700/50",  activeBorder: "border-violet-500" },
  recharge:   { icon: "💳", label: "Recharges solde",  color: "text-emerald-300", bg: "bg-emerald-900/30 border-emerald-700/50", activeBorder: "border-emerald-500" },
  comptoir:   { icon: "🍬", label: "Achat comptoir",   color: "text-amber-300",   bg: "bg-amber-900/30 border-amber-700/50",    activeBorder: "border-amber-500" },
  boutique:   { icon: "🛍️", label: "Boutique",         color: "text-sky-300",     bg: "bg-sky-900/30 border-sky-700/50",        activeBorder: "border-sky-500" },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-amber-900/60 text-amber-300",
  CONFIRMED: "bg-emerald-900/60 text-emerald-300",
  DELIVERED: "bg-sky-900/60 text-sky-300",
  PAID:      "bg-violet-900/60 text-violet-300",
  CANCELLED: "bg-red-900/60 text-red-300",
};

export default function MesTransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeTypes, setActiveTypes] = useState<Set<Transaction["type"]>>(new Set(ALL_TYPES));

  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setTxns(data); setLoading(false); });
  }, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleType(t: Transaction["type"]) {
    setActiveTypes((prev) => {
      if (prev.size === ALL_TYPES.length) {
        // All shown → switch to only this type
        return new Set([t]);
      }
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size === 1) return new Set(ALL_TYPES); // last active → reset to all
        next.delete(t);
      } else {
        next.add(t);
      }
      return next;
    });
  }

  function resetFilter() {
    setActiveTypes(new Set(ALL_TYPES));
  }

  const isAll = activeTypes.size === ALL_TYPES.length;
  const filtered = txns.filter((tx) => activeTypes.has(tx.type));
  const filteredTotal = filtered
    .filter((tx) => tx.status !== "CANCELLED")
    .reduce((s, tx) => s + tx.amountCents, 0);

  // Count per type for badges
  const countByType = ALL_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = txns.filter((tx) => tx.type === t).length;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-2">
        <Link href="/profil" className="text-sm text-slate-400 hover:text-slate-200">
          ← Mon profil
        </Link>
      </div>
      <h1 className="font-display text-3xl text-silver-100">Mes transactions</h1>
      <p className="mt-1 text-slate-400">Historique de vos cotisations, recharges et achats.</p>

      {/* Filtres */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          {ALL_TYPES.map((t) => {
            const m = TYPE_META[t];
            const isActive = activeTypes.has(t);
            const count = countByType[t] ?? 0;
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                disabled={loading}
                className={[
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                  isActive
                    ? `${m.bg} ${m.color} ${m.activeBorder}`
                    : "border-primary-700 bg-primary-900/20 text-slate-500 hover:border-primary-600 hover:text-slate-400",
                ].join(" ")}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${isActive ? "bg-white/15" : "bg-primary-800 text-slate-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          {!isAll && (
            <button
              onClick={resetFilter}
              className="rounded-full border border-primary-700 px-3 py-1 text-xs text-slate-400 transition hover:border-primary-500 hover:text-slate-200"
            >
              Tout afficher
            </button>
          )}
        </div>
        {!loading && txns.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
            {!isAll ? " filtrée" + (filtered.length !== 1 ? "s" : "") : ""}
            {filtered.length > 0 && (
              <> · Total : <span className="font-medium text-slate-400">{formatCentsToEuros(filteredTotal)}</span></>
            )}
          </p>
        )}
      </div>

      {loading && (
        <p className="mt-8 text-slate-400">Chargement…</p>
      )}

      {!loading && txns.length === 0 && (
        <p className="mt-8 text-slate-400">Aucune transaction enregistrée.</p>
      )}

      {!loading && txns.length > 0 && filtered.length === 0 && (
        <p className="mt-8 text-slate-400">Aucune transaction dans cette catégorie.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="mt-6 space-y-3">
          {filtered.map((tx) => {
            const meta = TYPE_META[tx.type];
            const hasItems = (tx.items?.length ?? 0) > 0;
            const isOpen = expanded.has(tx.id);
            const isCancelled = tx.status === "CANCELLED";

            return (
              <div key={tx.id} className={`rounded-xl border p-4 ${meta.bg}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 text-xl flex-shrink-0">{meta.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${meta.color}`}>{tx.label}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {new Date(tx.date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      {tx.statusLabel && (
                        <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[tx.status ?? ""] ?? "bg-slate-800 text-slate-400"}`}>
                          {tx.statusLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-sm font-semibold ${isCancelled ? "text-slate-500 line-through" : "text-slate-100"}`}>
                      {tx.amountCents > 0 ? formatCentsToEuros(tx.amountCents) : "—"}
                    </span>
                    {hasItems && (
                      <button
                        onClick={() => toggleExpand(tx.id)}
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        {isOpen ? "Masquer ▲" : `Voir détail (${tx.items!.length}) ▼`}
                      </button>
                    )}
                  </div>
                </div>

                {hasItems && isOpen && (
                  <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                    {tx.items!.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs text-slate-200">
                            {item.name} × {item.quantity}
                          </span>
                          {item.customText && (
                            <p className="mt-0.5 text-xs text-slate-400 italic">✏️ {item.customText}</p>
                          )}
                        </div>
                        <span className="flex-shrink-0 text-xs text-slate-400">
                          {formatCentsToEuros(item.unitPrice * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

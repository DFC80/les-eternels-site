"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { formatCentsToEuros } from "@/lib/money";
import { isFullAdmin } from "@/lib/permissions";

type ProductActivity = { activityKey: string };

type OrderHistory = {
  id: string;
  memberName: string;
  createdAt: string;
  totalAmount: number;
  items: { name: string; quantity: number; unitPrice: number }[];
};

type Product = {
  id: string;
  category: "SNACK" | "DRINK";
  name: string;
  photoUrl: string | null;
  price: number;
  stock: number;
  activities: ProductActivity[];
};

type Member = {
  id: string;
  firstName: string;
  name: string;
  balance: number;
};

const CATEGORY_LABELS: Record<string, string> = { SNACK: "🍬 Friandises", DRINK: "🥤 Boissons" };

export default function KiosquePage() {
  const { data: session } = useSession();
  const canTopUp = isFullAdmin((session?.user as { role?: string } | undefined)?.role ?? "");
  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [topUpAmount, setTopUpAmount] = useState("");
  const [activityFilter, setActivityFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadProducts() {
    const res = await fetch("/api/admin/products");
    if (res.ok) setProducts(await res.json());
  }

  async function loadMembers() {
    const res = await fetch("/api/admin/kiosk/members");
    if (res.ok) setMembers(await res.json());
  }

  useEffect(() => {
    loadProducts();
    loadMembers();
  }, []);

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.firstName} ${m.name}`.toLowerCase().includes(q));
  }, [members, search]);

  function selectMember(id: string) {
    setSelectedMemberId(id);
    setCart({});
    setError(null);
    setMessage(null);
  }

  function addToCart(productId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta);
      const updated = { ...prev, [productId]: next };
      if (next === 0) delete updated[productId];
      return updated;
    });
  }

  // Clés d'activité uniques présentes dans les produits (pour les boutons de filtre)
  const activityKeys = useMemo(() => {
    const keys = new Set<string>();
    products.forEach((p) => p.activities.forEach((a) => keys.add(a.activityKey)));
    return Array.from(keys).sort();
  }, [products]);

  // Produits filtrés : stock disponible + activité sélectionnée
  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.stock <= 0) return false;
      if (!activityFilter) return true;
      return p.activities.length === 0 || p.activities.some((a) => a.activityKey === activityFilter);
    });
  }, [products, activityFilter]);

  const cartLines = Object.entries(cart)
    .map(([productId, quantity]) => ({ product: products.find((p) => p.id === productId), quantity }))
    .filter((l) => l.product) as { product: Product; quantity: number }[];

  const cartTotal = cartLines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  async function confirmOrder() {
    if (!selectedMemberId || cartLines.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/admin/kiosk/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedMemberId,
        items: cartLines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      }),
    });

    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de la commande.");
      return;
    }

    setCart({});
    setMessage("Commande confirmée !");
    await Promise.all([loadProducts(), loadMembers()]);
  }

  async function toggleHistory() {
    if (showHistory) { setShowHistory(false); return; }
    setShowHistory(true);
    if (history.length > 0) return;
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/kiosk/orders");
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistoryLoading(false);
    }
  }

  async function addBalance() {
    if (!selectedMemberId || !topUpAmount) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/admin/kiosk/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedMemberId, amount: topUpAmount }),
    });

    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de l'ajout du solde.");
      return;
    }

    setTopUpAmount("");
    setMessage("Solde mis à jour.");
    await loadMembers();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl text-silver-100">🛒 Comptoir friandises & boissons</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Sélection de la personne */}
        <div className="rounded-2xl border border-primary-800 bg-primary-900/40 p-4 lg:col-span-1">
          <h2 className="font-display text-lg text-silver-100">Qui es-tu ?</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un prénom..."
            className="mt-3 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
          />
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMember(m.id)}
                className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-3 text-left transition ${
                  selectedMemberId === m.id
                    ? "border-primary-400 bg-primary-800/50"
                    : "border-primary-800 bg-primary-950/60 hover:border-primary-600"
                }`}
              >
                <span className="font-medium text-silver-100">
                  {m.firstName} {m.name}
                </span>
                <span className={`text-sm font-semibold ${m.balance < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {formatCentsToEuros(m.balance)}
                </span>
              </button>
            ))}
            {filteredMembers.length === 0 && <p className="text-sm text-slate-500">Aucun membre trouvé.</p>}
          </div>

          {canTopUp && selectedMember && (
            <div className="mt-5 rounded-lg border border-primary-700 bg-primary-950/60 p-3">
              <p className="text-sm text-slate-300">
                Solde de <span className="font-semibold text-silver-100">{selectedMember.firstName}</span> :{" "}
                <span className={selectedMember.balance < 0 ? "text-red-400" : "text-emerald-400"}>
                  {formatCentsToEuros(selectedMember.balance)}
                </span>
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder="Ex: 5,50"
                  className="w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addBalance}
                  disabled={busy || !topUpAmount}
                  className="shrink-0 rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
                >
                  Ajouter
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Pour créditer le solde payé sur place par cette personne.</p>
            </div>
          )}
        </div>

        {/* Produits */}
        <div className="lg:col-span-2">
          {/* Filtre par activité */}
          {activityKeys.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActivityFilter(null)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  activityFilter === null
                    ? "bg-primary-400 text-primary-950"
                    : "border border-primary-700 text-slate-300 hover:border-primary-500"
                }`}
              >
                Toutes
              </button>
              {activityKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActivityFilter(activityFilter === key ? null : key)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                    activityFilter === key
                      ? "bg-primary-400 text-primary-950"
                      : "border border-primary-700 text-slate-300 hover:border-primary-500"
                  }`}
                >
                  {key.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          )}

          {["SNACK", "DRINK"].map((cat) => {
            const catProducts = visibleProducts.filter((p) => p.category === cat);
            if (catProducts.length === 0) return null;
            return (
              <div key={cat} className="mb-6">
                <h2 className="font-display text-lg text-silver-100">{CATEGORY_LABELS[cat]}</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {catProducts.map((p) => {
                    const qty = cart[p.id] ?? 0;
                    const disabled = !selectedMemberId;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-xl border-2 p-3 text-center transition ${
                          qty > 0 ? "border-primary-400 bg-primary-800/50" : "border-primary-800 bg-primary-900/40"
                        } ${disabled ? "opacity-50" : ""}`}
                      >
                        {p.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photoUrl} alt={p.name} className="mx-auto h-20 w-20 rounded-lg object-cover" />
                        )}
                        <p className="mt-2 font-medium text-silver-100">{p.name}</p>
                        <p className="text-sm text-slate-400">
                          {formatCentsToEuros(p.price)}
                          {p.stock <= 3 && (
                            <span className="ml-1 text-amber-400">· {p.stock} restant{p.stock > 1 ? "s" : ""}</span>
                          )}
                        </p>
                        <div className="mt-2 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => addToCart(p.id, -1)}
                            disabled={disabled || qty === 0}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-600 text-lg text-slate-200 hover:bg-primary-800 disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="w-6 font-display text-lg text-silver-100">{qty}</span>
                          <button
                            type="button"
                            onClick={() => addToCart(p.id, 1)}
                            disabled={disabled || qty >= p.stock}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-600 text-lg text-slate-200 hover:bg-primary-800 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!selectedMemberId && (
            <p className="text-sm text-amber-400">Sélectionnez une personne pour commencer une commande.</p>
          )}

          {cartLines.length > 0 && (
            <div className="rounded-2xl border-2 border-primary-400 bg-primary-800/40 p-4">
              <p className="font-display text-lg text-silver-100">Récapitulatif</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {cartLines.map((l) => (
                  <li key={l.product.id} className="flex justify-between">
                    <span>
                      {l.quantity}× {l.product.name}
                    </span>
                    <span>{formatCentsToEuros(l.product.price * l.quantity)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-display text-2xl text-silver-100">
                Total : {formatCentsToEuros(cartTotal)}
              </p>
              <button
                type="button"
                onClick={confirmOrder}
                disabled={busy}
                className="mt-4 w-full rounded-md bg-primary-400 px-5 py-3 text-base font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
              >
                {busy ? "Validation..." : "Confirmer"}
              </button>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          {message && <p className="mt-4 text-sm text-emerald-400">{message}</p>}
        </div>
      </div>
      <div className="mt-10 border-t border-primary-800 pt-6">
        <button
          type="button"
          onClick={toggleHistory}
          className="flex items-center gap-2 rounded-md border border-primary-700 px-4 py-2 text-sm text-slate-300 hover:bg-primary-800"
        >
          <span>{showHistory ? "▾" : "▸"}</span>
          Historique des ventes
        </button>

        {showHistory && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-primary-800 bg-primary-900/40">
            {historyLoading ? (
              <p className="px-4 py-4 text-sm text-slate-400">Chargement…</p>
            ) : (
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
                  {history.map((o) => (
                    <tr key={o.id} className="border-t border-primary-800 text-slate-200">
                      <td className="px-4 py-3 font-medium">{o.memberName}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                      </td>
                      <td className="px-4 py-3">{formatCentsToEuros(o.totalAmount)}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(o.createdAt).toLocaleString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-slate-500">
                        Aucune vente enregistrée.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

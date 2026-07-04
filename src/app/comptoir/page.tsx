"use client";

import { useEffect, useState } from "react";
import { formatCentsToEuros } from "@/lib/money";

type Product = {
  id: string;
  category: "SNACK" | "DRINK";
  name: string;
  photoUrl: string | null;
  price: number;
  stock: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  SNACK: "🍬 Friandises",
  DRINK: "🥤 Boissons",
};

export default function ComptoirPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [prodRes, profileRes] = await Promise.all([
      fetch("/api/kiosk/products"),
      fetch("/api/profile"),
    ]);
    if (prodRes.ok) setProducts(await prodRes.json());
    if (profileRes.ok) {
      const data = await profileRes.json();
      setBalance(data.balance ?? 0);
    }
  }

  useEffect(() => { load(); }, []);

  function addToCart(productId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta);
      const updated = { ...prev, [productId]: next };
      if (next === 0) delete updated[productId];
      return updated;
    });
  }

  const cartLines = Object.entries(cart)
    .map(([productId, quantity]) => ({ product: products.find((p) => p.id === productId), quantity }))
    .filter((l) => l.product) as { product: Product; quantity: number }[];

  const cartTotal = cartLines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const BALANCE_LIMIT = -2000; // -20€ en centimes
  const balanceAfter = (balance ?? 0) - cartTotal;
  const overLimit = balanceAfter < BALANCE_LIMIT;

  async function confirmOrder() {
    if (cartLines.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/kiosk/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cartLines.map((l) => ({ productId: l.product.id, quantity: l.quantity })) }),
    });

    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de la commande.");
      return;
    }

    const data = await res.json();
    setBalance(data.balance);
    setCart({});
    setMessage("Commande confirmée ! Ton solde a été mis à jour.");
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">🛒 Comptoir</h1>
      <p className="mt-2 text-slate-400">
        Sélectionne tes friandises et boissons. Le montant est débité de ton solde adhérent.
      </p>

      {/* Solde */}
      <div className={`mt-6 flex items-center justify-between rounded-xl border-2 px-6 py-4 ${
        (balance ?? 0) < 0 ? "border-red-700 bg-red-950/40" : "border-primary-700 bg-primary-900/40"
      }`}>
        <div>
          <p className="text-sm text-slate-400">Ton solde adhérent</p>
          <p className={`font-display text-3xl ${(balance ?? 0) < 0 ? "text-red-400" : "text-silver-100"}`}>
            {balance !== null ? formatCentsToEuros(balance) : "—"}
          </p>
        </div>
        {cartTotal > 0 && (
          <div className="text-right">
            <p className="text-sm text-slate-400">Après commande</p>
            <p className={`font-display text-2xl ${balanceAfter < 0 ? "text-red-400" : "text-emerald-300"}`}>
              {formatCentsToEuros(balanceAfter)}
            </p>
          </div>
        )}
      </div>

      {(balance ?? 0) < 0 && (
        <p className="mt-3 text-sm text-amber-400">
          Ton solde est négatif. Pense à le recharger auprès d'un administrateur (limite : −20€).
        </p>
      )}

      {/* Produits */}
      <div className="mt-8">
        {["SNACK", "DRINK"].map((cat) => {
          const catProducts = products.filter((p) => p.category === cat);
          if (catProducts.length === 0) return null;
          return (
            <div key={cat} className="mb-8">
              <h2 className="font-display text-xl text-silver-100">{CATEGORY_LABELS[cat]}</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {catProducts.map((p) => {
                  const qty = cart[p.id] ?? 0;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl border-2 p-4 text-center transition ${
                        qty > 0 ? "border-primary-400 bg-primary-800/50" : "border-primary-800 bg-primary-900/40"
                      }`}
                    >
                      {p.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photoUrl} alt={p.name} className="mx-auto h-20 w-20 rounded-lg object-cover" />
                      )}
                      <p className="mt-2 font-medium text-silver-100">{p.name}</p>
                      <p className="text-sm text-slate-400">{formatCentsToEuros(p.price)}</p>
                      <p className="text-xs text-slate-500">stock : {p.stock}</p>
                      <div className="mt-3 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => addToCart(p.id, -1)}
                          disabled={qty === 0}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-600 text-lg text-slate-200 hover:bg-primary-800 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 font-display text-lg text-silver-100">{qty}</span>
                        <button
                          type="button"
                          onClick={() => addToCart(p.id, 1)}
                          disabled={qty >= p.stock}
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

        {products.length === 0 && (
          <p className="text-sm text-slate-400">Aucun produit disponible pour le moment.</p>
        )}
      </div>

      {/* Récapitulatif */}
      {cartLines.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-primary-400 bg-primary-800/40 p-5">
          <p className="font-display text-lg text-silver-100">Récapitulatif</p>
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            {cartLines.map((l) => (
              <li key={l.product.id} className="flex justify-between">
                <span>{l.quantity}× {l.product.name}</span>
                <span>{formatCentsToEuros(l.product.price * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-display text-3xl text-silver-100">
            Total : {formatCentsToEuros(cartTotal)}
          </p>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button
            onClick={confirmOrder}
            disabled={busy || overLimit}
            className="mt-4 w-full rounded-md bg-primary-400 px-5 py-3 text-base font-semibold text-primary-950 hover:bg-silver-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Validation..." : overLimit ? "Limite de crédit atteinte (−20€)" : "Confirmer la commande"}
          </button>
        </div>
      )}

      {message && (
        <p className="mt-4 text-sm text-emerald-400">{message}</p>
      )}
    </div>
  );
}

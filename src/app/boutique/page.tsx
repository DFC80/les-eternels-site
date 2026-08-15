"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatCentsToEuros } from "@/lib/money";

type ShopItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  photos: string;
};

type CustomMode = "prenom" | "pseudo" | "libre" | null;

type CartItem = {
  shopItemId: string;
  title: string;
  price: number;
  quantity: number;
  customText: string;
  customMode: CustomMode;
};

type OrderItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  customText: string | null;
};

type Order = {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  items: OrderItem[];
};

type Profile = {
  firstName: string;
  airsoftPseudo: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée",
  DELIVERED: "Livrée",
  PAID: "Payée",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-900/60 text-amber-300",
  CONFIRMED: "bg-emerald-900/60 text-emerald-300",
  CANCELLED: "bg-red-900/60 text-red-300",
  DELIVERED: "bg-sky-900/60 text-sky-300",
  PAID: "bg-violet-900/60 text-violet-300",
};

export default function BoutiquePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [items, setItems] = useState<ShopItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"shop" | "orders">("shop");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/shop").then((r) => r.ok ? r.json() : []).then(setItems);
    fetch("/api/shop/orders").then((r) => r.ok ? r.json() : []).then(setOrders);
    fetch("/api/profile").then((r) => r.ok ? r.json() : null).then(setProfile);
  }, [status]);

  function openItem(item: ShopItem) {
    setSelectedItem(item);
    setPhotoIndex(0);
    if (!cart.find((c) => c.shopItemId === item.id)) {
      setCart((prev) => [
        ...prev,
        { shopItemId: item.id, title: item.title, price: item.price, quantity: 1, customText: "", customMode: null },
      ]);
    }
  }

  function closeItem() {
    setSelectedItem(null);
  }

  function getCartItem(id: string) {
    return cart.find((c) => c.shopItemId === id);
  }

  function updateCartItem(id: string, updates: Partial<CartItem>) {
    setCart((prev) => prev.map((c) => (c.shopItemId === id ? { ...c, ...updates } : c)));
  }

  function removeCartItem(id: string) {
    setCart((prev) => prev.filter((c) => c.shopItemId !== id));
  }

  function setCustomMode(id: string, mode: CustomMode) {
    setCart((prev) =>
      prev.map((c) => {
        if (c.shopItemId !== id) return c;
        let customText = c.customText;
        if (mode === "prenom") customText = profile?.firstName ?? "";
        else if (mode === "pseudo" && profile?.airsoftPseudo) customText = profile.airsoftPseudo;
        else if (mode === "pseudo" && !profile?.airsoftPseudo) customText = "";
        else if (mode === null) customText = "";
        return { ...c, customMode: mode, customText };
      })
    );
  }

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  async function placeOrder() {
    if (!cart.length) return;
    setOrdering(true);
    setOrderError(null);

    const res = await fetch("/api/shop/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((c) => ({
          shopItemId: c.shopItemId,
          quantity: c.quantity,
          customText: c.customText || undefined,
        })),
        notes: orderNotes,
      }),
    });

    setOrdering(false);
    if (!res.ok) {
      setOrderError((await res.json()).error ?? "Erreur lors de la commande.");
      return;
    }

    setOrderSuccess(true);
    setCart([]);
    setOrderNotes("");
    const [updatedOrders, updatedItems] = await Promise.all([
      fetch("/api/shop/orders").then((r) => r.ok ? r.json() : []),
      fetch("/api/shop").then((r) => r.ok ? r.json() : []),
    ]);
    setOrders(updatedOrders);
    setItems(updatedItems);
  }

  // Customization UI rendered inline for a given cart item
  function renderCustomizationUI(c: CartItem) {
    const hasPseudo = !!(profile?.airsoftPseudo);
    const radioBase = "h-3.5 w-3.5 accent-primary-400 cursor-pointer";

    return (
      <div className="mt-2.5 rounded-lg bg-primary-900/60 p-2.5 space-y-2">
        <p className="text-xs font-medium text-slate-300">Personnalisation :</p>
        <div className="space-y-1.5">
          {/* Prénom */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              className={radioBase}
              checked={c.customMode === "prenom"}
              onChange={() => setCustomMode(c.shopItemId, "prenom")}
            />
            <span className="text-xs text-slate-300">
              Prénom
              {c.customMode === "prenom" && (
                <span className="ml-1 text-primary-300">({profile?.firstName})</span>
              )}
            </span>
          </label>

          {/* Pseudo airsoft */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              className={radioBase}
              checked={c.customMode === "pseudo"}
              onChange={() => setCustomMode(c.shopItemId, "pseudo")}
            />
            <span className="text-xs text-slate-300">
              Pseudo airsoft
              {c.customMode === "pseudo" && hasPseudo && (
                <span className="ml-1 text-primary-300">({profile?.airsoftPseudo})</span>
              )}
            </span>
          </label>
          {c.customMode === "pseudo" && !hasPseudo && (
            <input
              type="text"
              value={c.customText}
              onChange={(e) => updateCartItem(c.shopItemId, { customText: e.target.value })}
              placeholder="Saisissez votre pseudo airsoft"
              className="ml-5 w-full rounded border border-primary-700 bg-primary-950 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:border-primary-400 focus:outline-none"
            />
          )}

          {/* Texte libre */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              className={radioBase}
              checked={c.customMode === "libre"}
              onChange={() => setCustomMode(c.shopItemId, "libre")}
            />
            <span className="text-xs text-slate-300">Texte libre</span>
          </label>
          {c.customMode === "libre" && (
            <input
              type="text"
              value={c.customText}
              onChange={(e) => updateCartItem(c.shopItemId, { customText: e.target.value })}
              placeholder="Ex : MonPseudo42"
              className="ml-5 w-full rounded border border-primary-700 bg-primary-950 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:border-primary-400 focus:outline-none"
            />
          )}
        </div>

        {c.customMode !== null && (
          <button
            type="button"
            onClick={() => setCustomMode(c.shopItemId, null)}
            className="mt-1 text-xs text-slate-500 hover:text-slate-300 hover:underline"
          >
            ✕ Annuler la personnalisation
          </button>
        )}
      </div>
    );
  }

  if (status === "loading") {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-400">Chargement…</div>;
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl text-silver-100">🛍️ Boutique</h1>
      <p className="mt-1 text-slate-400">Produits de l'association — réservé aux membres connectés.</p>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-primary-800">
        {(["shop", "orders"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition ${tab === t ? "border-b-2 border-primary-400 text-primary-300" : "text-slate-400 hover:text-slate-200"}`}
          >
            {t === "shop" ? "Produits" : `Mes commandes (${orders.length})`}
          </button>
        ))}
      </div>

      {/* Shop tab */}
      {tab === "shop" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Product grid */}
          <div className="lg:col-span-2">
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun produit disponible pour le moment.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((item) => {
                  const photos = item.photos ? item.photos.split("\n").filter(Boolean) : [];
                  const inCart = !!getCartItem(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => openItem(item)}
                      className="group rounded-xl border border-primary-800 bg-primary-900/40 p-4 text-left transition hover:border-primary-600 hover:bg-primary-800/60"
                    >
                      {photos[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photos[0]} alt={item.title} className="h-40 w-full rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-40 items-center justify-center rounded-lg bg-primary-800 text-4xl">
                          🛍️
                        </div>
                      )}
                      <h3 className="mt-3 font-display text-base text-silver-100 line-clamp-2">{item.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.description}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-lg font-bold text-primary-300">{formatCentsToEuros(item.price)}</p>
                        <div className="flex items-center gap-2">
                          {item.stock <= 0 && (
                            <span className="rounded bg-red-900/60 px-2 py-0.5 text-xs text-red-300">Épuisé</span>
                          )}
                          {inCart && item.stock > 0 && (
                            <span className="rounded bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300">Dans le panier</span>
                          )}
                          <span className="text-xs text-slate-500">Stock: {item.stock}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart */}
          <div>
            <div className="rounded-xl border border-primary-700 bg-primary-900/50 p-4">
              <h2 className="font-display text-base text-silver-100">🛒 Panier</h2>
              {cart.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">Votre panier est vide. Cliquez sur un produit pour l'ajouter.</p>
              ) : (
                <>
                  <div className="mt-3 space-y-3">
                    {cart.map((c) => {
                      const item = items.find((i) => i.id === c.shopItemId);
                      return (
                        <div key={c.shopItemId} className="rounded-lg bg-primary-950/50 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-slate-200 line-clamp-2">{c.title}</p>
                            <button
                              onClick={() => removeCartItem(c.shopItemId)}
                              className="shrink-0 text-xs text-red-400 hover:underline"
                            >
                              Retirer
                            </button>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-xs text-slate-400">Qté :</label>
                            <input
                              type="number"
                              min={1}
                              max={item?.stock ?? 99}
                              value={c.quantity}
                              onChange={(e) =>
                                updateCartItem(c.shopItemId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                              }
                              className="w-16 rounded border border-primary-700 bg-primary-950 px-2 py-0.5 text-sm text-slate-100 focus:border-primary-400 focus:outline-none"
                            />
                            <span className="ml-auto text-sm font-semibold text-primary-300">
                              {formatCentsToEuros(c.price * c.quantity)}
                            </span>
                          </div>
                          {renderCustomizationUI(c)}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs text-slate-400">Note pour la commande :</label>
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      rows={2}
                      placeholder="Remarques, précisions…"
                      className="mt-1 w-full rounded border border-primary-700 bg-primary-950 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-600 focus:border-primary-400 focus:outline-none"
                    />
                  </div>

                  <div className="mt-3 border-t border-primary-800 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Total</span>
                      <span className="text-lg font-bold text-primary-300">{formatCentsToEuros(cartTotal)}</span>
                    </div>
                    <button
                      onClick={placeOrder}
                      disabled={ordering}
                      className="mt-3 w-full rounded-md bg-primary-400 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
                    >
                      {ordering ? "Commande en cours…" : "Passer la commande"}
                    </button>
                    {orderError && <p className="mt-2 text-xs text-red-400">{orderError}</p>}
                    {orderSuccess && <p className="mt-2 text-xs text-emerald-400">✅ Commande passée avec succès !</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders tab */}
      {tab === "orders" && (
        <div className="mt-6">
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400">Vous n'avez pas encore passé de commande.</p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const isCancelled = order.status === "CANCELLED";
                const orderTotal = isCancelled ? 0 : order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                return (
                  <div key={order.id} className="rounded-xl border border-primary-800 bg-primary-900/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? "bg-slate-800 text-slate-400"}`}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>

                    <ul className="mt-3 space-y-1.5">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-2 rounded-lg bg-primary-950/50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm text-slate-200">
                              {item.name} × {item.quantity}
                            </p>
                            {item.customText && (
                              <p className="mt-0.5 text-xs text-primary-300">✏️ {item.customText}</p>
                            )}
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-silver-100">
                            {isCancelled ? "0,00 €" : formatCentsToEuros(item.unitPrice * item.quantity)}
                          </p>
                        </li>
                      ))}
                    </ul>

                    {order.notes && <p className="mt-2 text-xs text-slate-400 italic">📝 {order.notes}</p>}

                    <p className="mt-2 text-right text-sm font-semibold text-primary-300">
                      Total : {formatCentsToEuros(orderTotal)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Product detail modal */}
      {selectedItem &&
        (() => {
          const photos = selectedItem.photos ? selectedItem.photos.split("\n").filter(Boolean) : [];
          const cartItem = getCartItem(selectedItem.id);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closeItem}>
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-primary-700 bg-primary-950 p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl text-silver-100">{selectedItem.title}</h2>
                  <button onClick={closeItem} className="shrink-0 text-slate-400 hover:text-white">
                    ✕
                  </button>
                </div>

                {photos.length > 0 && (
                  <div className="mt-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photos[photoIndex]} alt={selectedItem.title} className="h-56 w-full rounded-xl object-cover" />
                    {photos.length > 1 && (
                      <div className="mt-2 flex gap-2 overflow-x-auto">
                        {photos.map((p, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={p}
                            alt=""
                            onClick={() => setPhotoIndex(i)}
                            className={`h-12 w-12 flex-shrink-0 cursor-pointer rounded-lg object-cover border-2 transition ${i === photoIndex ? "border-primary-400" : "border-transparent"}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-4 text-2xl font-bold text-primary-300">{formatCentsToEuros(selectedItem.price)}</p>
                <p className="mt-1 text-xs text-slate-500">Stock disponible : {selectedItem.stock}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 whitespace-pre-line">{selectedItem.description}</p>

                {selectedItem.stock <= 0 ? (
                  <p className="mt-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm font-medium text-red-400">
                    Ce produit est épuisé.
                  </p>
                ) : cartItem ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-slate-300">Quantité :</label>
                      <input
                        type="number"
                        min={1}
                        max={selectedItem.stock}
                        value={cartItem.quantity}
                        onChange={(e) =>
                          updateCartItem(selectedItem.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                        }
                        className="w-20 rounded border border-primary-700 bg-primary-950 px-2 py-1 text-sm text-slate-100 focus:border-primary-400 focus:outline-none"
                      />
                    </div>
                    {renderCustomizationUI(cartItem)}
                    <div className="flex gap-3">
                      <button
                        onClick={closeItem}
                        className="flex-1 rounded-md bg-primary-400 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300"
                      >
                        ✅ Dans le panier
                      </button>
                      <button
                        onClick={() => {
                          removeCartItem(selectedItem.id);
                          closeItem();
                        }}
                        className="rounded-md border border-primary-700 px-3 py-2 text-sm text-red-400 hover:bg-primary-900"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openItem(selectedItem)}
                    className="mt-4 w-full rounded-md bg-primary-400 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300"
                  >
                    Ajouter au panier
                  </button>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { formatCentsToEuros } from "@/lib/money";
import ImageUpload from "@/components/ImageUpload";

type ShopItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  isPublished: boolean;
  showOnHome: boolean;
  photos: string;
  _count: { orders: number };
};

type OrderItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  customText: string | null;
  shopItem: { id: string; title: string } | null;
};

type Order = {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  user: { id: string; firstName: string; name: string; email: string };
  items: OrderItem[];
};

const EMPTY_FORM = {
  id: "",
  title: "",
  description: "",
  price: "",
  stock: "",
  isPublished: false,
  showOnHome: false,
  photos: [] as string[],
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

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

export default function AdminBoutiquePage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(sessionUser, "boutique");

  const [tab, setTab] = useState<"products" | "orders">("products");
  const [items, setItems] = useState<ShopItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function loadItems() {
    const res = await fetch("/api/admin/shop");
    if (res.ok) setItems(await res.json());
  }

  async function loadOrders() {
    const res = await fetch("/api/admin/shop/orders");
    if (res.ok) setOrders(await res.json());
  }

  useEffect(() => {
    loadItems();
    loadOrders();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setNewPhotoUrl("");
    setError(null);
  }

  function editItem(item: ShopItem) {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description,
      price: (item.price / 100).toFixed(2),
      stock: String(item.stock),
      isPublished: item.isPublished,
      showOnHome: item.showOnHome,
      photos: item.photos ? item.photos.split("\n").filter(Boolean) : [],
    });
    setError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setError(null);

    const priceCents = Math.round(parseFloat(form.price) * 100);
    if (!form.title.trim()) { setError("Le titre est requis."); return; }
    if (!form.description.trim()) { setError("La description est requise."); return; }
    if (isNaN(priceCents) || priceCents < 0) { setError("Prix invalide."); return; }
    if (isNaN(parseInt(form.stock)) || parseInt(form.stock) < 0) { setError("Stock invalide."); return; }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      price: priceCents,
      stock: parseInt(form.stock),
      isPublished: form.isPublished,
      showOnHome: form.showOnHome,
      photos: form.photos.join("\n"),
    };

    const res = form.id
      ? await fetch(`/api/admin/shop/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/admin/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Erreur."); return; }
    await loadItems();
    resetForm();
  }

  async function handleDelete(id: string) {
    if (!canWrite || !confirm("Supprimer ce produit ?")) return;
    await fetch(`/api/admin/shop/${id}`, { method: "DELETE" });
    await loadItems();
    if (form.id === id) resetForm();
  }

  async function togglePublished(item: ShopItem) {
    if (!canWrite) return;
    await fetch(`/api/admin/shop/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !item.isPublished }),
    });
    await loadItems();
  }

  async function toggleShowOnHome(item: ShopItem) {
    if (!canWrite) return;
    await fetch(`/api/admin/shop/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showOnHome: !item.showOnHome }),
    });
    await loadItems();
  }

  async function updateOrderStatus(orderId: string, status: string) {
    if (!canWrite) return;
    await fetch("/api/admin/shop/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status }),
    });
    await loadOrders();
  }

  function addPhoto(url: string) {
    if (url) setForm((f) => ({ ...f, photos: [...f.photos, url] }));
    setNewPhotoUrl("");
  }

  function removePhoto(idx: number) {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl text-silver-100">🛍️ Boutique</h1>
      <p className="mt-1 text-slate-400">Gérez les produits de la boutique et les commandes des membres.</p>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-primary-800">
        {(["products", "orders"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition ${tab === t ? "border-b-2 border-primary-400 text-primary-300" : "text-slate-400 hover:text-slate-200"}`}
          >
            {t === "products" ? `Produits (${items.length})` : `Commandes (${orders.length})`}
          </button>
        ))}
      </div>

      {/* Products tab */}
      {tab === "products" && (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          {/* Product list */}
          <div>
            <h2 className="font-display text-lg text-silver-100">Produits</h2>
            {items.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">Aucun produit encore.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {items.map((item) => {
                  const firstPhoto = item.photos?.split("\n").find(Boolean);
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-xl border border-primary-800 bg-primary-900/40 p-3"
                    >
                      {firstPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={firstPhoto} alt="" className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-primary-800 text-2xl">
                          🛍️
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm text-silver-100 line-clamp-1">{item.title}</p>
                        <p className="text-sm font-semibold text-primary-300">{formatCentsToEuros(item.price)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${item.isPublished ? "bg-emerald-900/60 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                            {item.isPublished ? "Publié" : "Brouillon"}
                          </span>
                          {item.showOnHome && (
                            <span className="rounded bg-primary-800/60 px-1.5 py-0.5 text-xs text-primary-300">
                              Accueil
                            </span>
                          )}
                          <span className="text-xs text-slate-500">Stock: {item.stock}</span>
                          <span className="text-xs text-slate-500">{item._count.orders} cmd.</span>
                        </div>
                        {canWrite && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              onClick={() => editItem(item)}
                              className="rounded bg-primary-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-primary-700"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => togglePublished(item)}
                              className="rounded bg-primary-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-primary-700"
                            >
                              {item.isPublished ? "Dépublier" : "Publier"}
                            </button>
                            <button
                              onClick={() => toggleShowOnHome(item)}
                              className="rounded bg-primary-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-primary-700"
                            >
                              {item.showOnHome ? "Retirer accueil" : "Afficher accueil"}
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/70"
                            >
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form */}
          {canWrite && (
            <div>
              <h2 className="font-display text-lg text-silver-100">
                {form.id ? "Modifier le produit" : "Nouveau produit"}
              </h2>
              <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Titre *</label>
                  <input
                    className={inputClass}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Nom du produit"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">Description *</label>
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Description détaillée du produit…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Prix (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputClass}
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Stock *</label>
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={form.stock}
                      onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Photos */}
                <div>
                  <label className="block text-sm font-medium text-slate-300">Photos</label>
                  {form.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {form.photos.map((url, idx) => (
                        <div key={idx} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-primary-700" />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white hover:bg-red-500"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2">
                    <ImageUpload
                      value={newPhotoUrl}
                      onChange={(url) => { if (url) { addPhoto(url); } else { setNewPhotoUrl(""); } }}
                      label=""
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-col gap-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <div
                      onClick={() => setForm((f) => ({ ...f, isPublished: !f.isPublished }))}
                      className={`relative h-5 w-9 rounded-full transition ${form.isPublished ? "bg-emerald-500" : "bg-primary-700"}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${form.isPublished ? "left-4" : "left-0.5"}`} />
                    </div>
                    <span className="text-sm text-slate-300">Publier le produit (visible en boutique)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <div
                      onClick={() => setForm((f) => ({ ...f, showOnHome: !f.showOnHome }))}
                      className={`relative h-5 w-9 rounded-full transition ${form.showOnHome ? "bg-primary-400" : "bg-primary-700"}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${form.showOnHome ? "left-4" : "left-0.5"}`} />
                    </div>
                    <span className="text-sm text-slate-300">Afficher sur la page d'accueil</span>
                  </label>
                </div>

                {error && (
                  <p className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-400">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
                  >
                    {saving ? "Enregistrement…" : form.id ? "Mettre à jour" : "Créer le produit"}
                  </button>
                  {form.id && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-md border border-primary-700 px-4 py-2 text-sm text-slate-300 hover:bg-primary-900"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Orders tab */}
      {tab === "orders" && (
        <div className="mt-6">
          <h2 className="font-display text-lg text-silver-100">Commandes</h2>
          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Aucune commande encore.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {orders.map((order) => {
                const isCancelled = order.status === "CANCELLED";
                const orderTotal = isCancelled ? 0 : order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                return (
                <div key={order.id} className="rounded-xl border border-primary-800 bg-primary-900/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-silver-100">
                        {order.user.firstName} {order.user.name}
                      </p>
                      <p className="text-xs text-slate-400">{order.user.email}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? "bg-slate-800 text-slate-400"}`}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                      {canWrite && (
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          className="rounded border border-primary-700 bg-primary-950 px-2 py-0.5 text-xs text-slate-200"
                        >
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-2 rounded-lg bg-primary-950/50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200">
                            {item.name} × {item.quantity}
                          </p>
                          {item.customText && (
                            <p className="mt-0.5 text-xs text-primary-300">
                              ✏️ {item.customText}
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-silver-100">
                          {isCancelled ? "0,00 €" : formatCentsToEuros(item.unitPrice * item.quantity)}
                        </p>
                      </li>
                    ))}
                  </ul>

                  {order.notes && (
                    <p className="mt-2 text-xs text-slate-400 italic">📝 {order.notes}</p>
                  )}

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
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type MealMenu = { id: string; label: string; maxPerPerson: number | null };
type MealOrder = { id: string; menuId: string | null; quantity: number };

type Equipment = {
  id: string;
  category: "REPLIQUE" | "EQUIPEMENT";
  name: string;
  photos: string | null;
  status: "DISPONIBLE" | "HORS_SERVICE" | "INDISPONIBLE";
  rentalCost: number;
  magazineCount: number | null;
  info: string | null;
};

type EquipmentRental = {
  id: string;
  equipmentId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isFree: boolean;
  equipment: Equipment;
};

type EventRegistration = {
  id: string;
  userId: string;
  status: string;
  wantsMeal: boolean;
  mealNotes: string | null;
  mealOrders: MealOrder[];
  rentals: EquipmentRental[];
};

type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  activityType: string;
  location: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  hasMeal: boolean;
  mealInfo: string | null;
  mealPrice: number;
  registrationDeadline: string | null;
  menus: MealMenu[];
  boardGames: { id: string; name: string }[];
  registrations: EventRegistration[];
};

type Membership = {
  wantsBoardGames: boolean;
  wantsRolePlay: boolean;
  wantsAirsoft: boolean;
  extraActivityKeys: string[];
  year: number;
  expired: boolean;
} | null;

const GENERIC_MEAL_KEY = "__generic__";

type ActivityMeta = { key: string; label: string; emoji: string; color: string; membershipRequired: boolean };

const COLOR_BADGE: Record<string, string> = {
  emerald: "bg-emerald-950 text-emerald-300 border-emerald-700",
  violet:  "bg-violet-950 text-violet-300 border-violet-700",
  amber:   "bg-amber-950 text-amber-300 border-amber-700",
  blue:    "bg-blue-950 text-blue-300 border-blue-700",
  rose:    "bg-rose-950 text-rose-300 border-rose-700",
  cyan:    "bg-cyan-950 text-cyan-300 border-cyan-700",
  fuchsia: "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-700",
  slate:   "bg-slate-950 text-slate-300 border-slate-700",
};
const DEFAULT_BADGE = "bg-primary-900 text-silver-300 border-primary-700";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(month: Date) {
  const first = startOfMonth(month);
  const firstWeekday = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isEligibleByMembership(activityType: string, membership: Membership, activityMeta: ActivityMeta[]) {
  const act = activityMeta.find((a) => a.key === activityType);
  if (!act?.membershipRequired) return true;
  if (!membership || membership.expired) return false;
  if (activityType === "JEUX_DE_PLATEAU") return membership.wantsBoardGames;
  if (activityType === "JEUX_DE_ROLE") return membership.wantsRolePlay;
  if (activityType === "AIRSOFT") return membership.wantsAirsoft;
  return membership.extraActivityKeys.includes(activityType);
}

function getMembershipWarning(ev: CalendarEvent, membership: Membership, activityMeta: ActivityMeta[]) {
  const act = activityMeta.find((a) => a.key === ev.activityType);
  const label = act ? `${act.emoji} ${act.label}` : ev.activityType;

  if (!membership) {
    return (
      <p className="mt-4 text-sm text-amber-400">
        Vous n&apos;êtes pas encore adhérent. Adhérez à l&apos;activité{" "}
        <strong className="text-amber-300">{label}</strong> pour vous inscrire.{" "}
        <a href="/mon-compte" className="underline hover:text-amber-200">Gérer mon adhésion →</a>
      </p>
    );
  }

  if (membership.expired) {
    return (
      <p className="mt-4 text-sm text-amber-400">
        Votre cotisation {membership.year} est expirée. Renouvelez votre adhésion en incluant{" "}
        <strong className="text-amber-300">{label}</strong> pour vous inscrire.{" "}
        <a href="/mon-compte" className="underline hover:text-amber-200">Renouveler mon adhésion →</a>
      </p>
    );
  }

  return (
    <p className="mt-4 text-sm text-amber-400">
      Votre cotisation {membership.year} ne couvre pas l&apos;activité{" "}
      <strong className="text-amber-300">{label}</strong>. Mettez à jour votre adhésion pour accéder à cet événement.{" "}
      <a href="/mon-compte" className="underline hover:text-amber-200">Mettre à jour →</a>
    </p>
  );
}

export default function EventCalendar() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [membership, setMembership] = useState<Membership>(null);
  const [activityMeta, setActivityMeta] = useState<ActivityMeta[]>([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [wantsMeal, setWantsMeal] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [mealNotes, setMealNotes] = useState("");
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [wantsEquipment, setWantsEquipment] = useState(false);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  async function loadEvents(): Promise<CalendarEvent[]> {
    const res = await fetch("/api/events");
    if (!res.ok) return [];
    const data = await res.json();
    setEvents(data);
    return data;
  }

  async function loadMembership() {
    if (!session) return;
    const res = await fetch("/api/membership");
    if (res.ok) setMembership(await res.json());
  }

  async function loadEquipment() {
    if (!session) return;
    const res = await fetch("/api/equipment");
    if (res.ok) setEquipmentList(await res.json());
  }

  useEffect(() => {
    loadEvents();
    loadMembership();
    loadEquipment();
    fetch("/api/activities")
      .then((r) => r.json())
      .then((data: ActivityMeta[]) =>
        setActivityMeta([...data, { key: "AUTRE", label: "Autre", emoji: "📌", color: "slate", membershipRequired: false }])
      );
  }, [session]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = new Date(ev.startsAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), ev]);
    }
    return map;
  }, [events]);

  const isRegistered = (ev: CalendarEvent) =>
    !!session && ev.registrations.some((r) => r.userId === session.user.id);

  // Équipements déjà réservés (en attente ou validés) par un AUTRE membre pour cet événement.
  function takenEquipmentIds(ev: CalendarEvent): Set<string> {
    const taken = new Set<string>();
    for (const reg of ev.registrations) {
      if (session && reg.userId === session.user.id) continue;
      for (const rental of reg.rentals) {
        if (rental.status !== "REJECTED") taken.add(rental.equipmentId);
      }
    }
    return taken;
  }

  function isEligible(ev: CalendarEvent) {
    return isEligibleByMembership(ev.activityType, membership, activityMeta);
  }

  function isEventPast(ev: CalendarEvent) {
    return new Date(ev.startsAt) < new Date();
  }

  function isRegistrationClosed(ev: CalendarEvent) {
    if (isEventPast(ev)) return true;
    if (ev.registrationDeadline && new Date(ev.registrationDeadline) < new Date()) return true;
    return false;
  }

  function openEvent(ev: CalendarEvent) {
    setSelected(ev);
    setActionError(null);
    const myReg = session && ev.registrations.find((r) => r.userId === session.user.id);
    setWantsMeal(myReg?.wantsMeal ?? false);
    setMealNotes(myReg?.mealNotes ?? "");
    const initialQuantities: Record<string, number> = {};
    for (const order of myReg?.mealOrders ?? []) {
      initialQuantities[order.menuId ?? GENERIC_MEAL_KEY] = order.quantity;
    }
    setQuantities(initialQuantities);

    const rentedIds = myReg?.rentals.map((r) => r.equipmentId) ?? [];
    setSelectedEquipmentIds(rentedIds);
    setWantsEquipment(rentedIds.length > 0);
  }

  function setQuantity(key: string, value: number) {
    setQuantities((prev) => ({ ...prev, [key]: Math.max(0, value) }));
  }

  function toggleEquipment(id: string) {
    setSelectedEquipmentIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  const totalMealQuantity = Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0);

  const selectedEquipmentTotal = equipmentList
    .filter((eq) => selectedEquipmentIds.includes(eq.id))
    .reduce((sum, eq) => sum + eq.rentalCost, 0);

  async function handleRegister(ev: CalendarEvent) {
    if (!session) {
      window.location.href = "/login";
      return;
    }
    const registered = isRegistered(ev);

    if (!registered && ev.hasMeal && wantsMeal && totalMealQuantity <= 0) {
      setActionError("Veuillez indiquer au moins un repas (quantité supérieure à 0).");
      return;
    }

    const mealOrders = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([key, quantity]) => ({ menuId: key === GENERIC_MEAL_KEY ? null : key, quantity }));

    const equipmentIds = wantsEquipment ? selectedEquipmentIds : [];

    setLoadingAction(true);
    setActionError(null);
    const res = await fetch(`/api/events/${ev.id}/register`, {
      method: registered ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: registered ? undefined : JSON.stringify({ wantsMeal, mealOrders, mealNotes, equipmentIds }),
    });
    setLoadingAction(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? "Une erreur est survenue.");
      return;
    }
    const fresh = await loadEvents();
    setSelected((prev) => (prev ? fresh.find((e) => e.id === prev.id) ?? prev : prev));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="shrink-0 rounded-md border border-primary-700 px-2 py-1.5 text-sm text-slate-300 hover:bg-primary-900 sm:px-3"
        >
          <span className="sm:hidden">←</span>
          <span className="hidden sm:inline">← Précédent</span>
        </button>
        <h2 className="truncate font-display text-base capitalize text-silver-100 sm:text-lg">
          {month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
        </h2>
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="shrink-0 rounded-md border border-primary-700 px-2 py-1.5 text-sm text-slate-300 hover:bg-primary-900 sm:px-3"
        >
          <span className="sm:hidden">→</span>
          <span className="hidden sm:inline">Suivant →</span>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-slate-500 sm:gap-1 sm:text-xs">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="py-1 sm:py-2">
            <span className="sm:hidden">{d.slice(0, 1)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {cells.map((day, i) => {
          const dayEvents = day ? eventsByDay.get(day.toDateString()) ?? [] : [];
          return (
            <div
              key={i}
              className={`min-h-[56px] rounded-md border border-primary-800 p-0.5 text-[10px] sm:min-h-[90px] sm:p-1 sm:text-xs ${
                day ? "bg-primary-900/40" : "bg-transparent border-transparent"
              }`}
            >
              {day && <div className="mb-1 text-right text-slate-500">{day.getDate()}</div>}
              <div className="space-y-1">
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => openEvent(ev)}
                    className={`block w-full truncate rounded border px-1 py-0.5 text-left ${COLOR_BADGE[activityMeta.find((a) => a.key === ev.activityType)?.color ?? ""] ?? DEFAULT_BADGE}`}
                  >
                    {ev.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary-700 bg-primary-950 p-4 shadow-2xl shadow-black/60 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Card : informations événement */}
            <div className="rounded-xl border border-primary-800 bg-primary-900/50 p-5">
              {(() => {
                const act = activityMeta.find((a) => a.key === selected.activityType);
                return (
                  <span className={`inline-block rounded border px-2 py-0.5 text-xs ${COLOR_BADGE[act?.color ?? ""] ?? DEFAULT_BADGE}`}>
                    {act ? `${act.emoji} ${act.label}` : selected.activityType}
                  </span>
                );
              })()}
              <h3 className="mt-2 font-display text-xl text-silver-100">{selected.title}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {new Date(selected.startsAt).toLocaleString("fr-FR")} —{" "}
                {new Date(selected.endsAt).toLocaleString("fr-FR")}
              </p>
              <p className="mt-1 text-sm text-slate-400">📍 {selected.location}</p>
              {selected.location && (
                <div className="mt-3 overflow-hidden rounded-lg border border-primary-700">
                  <iframe
                    title="Carte du lieu"
                    width="100%"
                    height="220"
                    loading="lazy"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(selected.location)}&output=embed&hl=fr`}
                    className="block"
                  />
                </div>
              )}
              <p className="mt-4 text-sm text-slate-300">{selected.description}</p>
              <p className="mt-4 text-sm text-slate-400">
                {selected.registrations.length}
                {selected.capacity ? ` / ${selected.capacity}` : ""} inscrit(s)
              </p>
              {selected.boardGames.length > 0 && (
                <p className="mt-2 text-sm text-slate-300">
                  🎲 Jeux prévus : {selected.boardGames.map((g) => g.name).join(", ")}
                </p>
              )}
            </div>

            {isRegistered(selected) && (() => {
              const myReg = selected.registrations.find((r) => r.userId === session?.user.id);
              if (!myReg) return null;
              const statusConfig = {
                APPROVED: { label: "Inscription validée", color: "border-emerald-700 bg-emerald-950 text-emerald-300" },
                REJECTED: { label: "Inscription refusée", color: "border-red-700 bg-red-950 text-red-300" },
                PENDING:  { label: "Inscription en attente de validation", color: "border-amber-700 bg-amber-950 text-amber-300" },
              };
              const cfg = statusConfig[myReg.status as keyof typeof statusConfig] ?? statusConfig.PENDING;
              return (
                <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${cfg.color}`}>
                  {cfg.label}
                </div>
              );
            })()}

            {selected.hasMeal && !isRegistered(selected) && (
              <div className="mt-4 rounded-xl border border-primary-700 bg-primary-900/40 p-5">
                <p className="font-display text-lg text-silver-100">🍽️ Repas du jour</p>
                {selected.mealInfo && <p className="mt-1 text-sm text-slate-300">{selected.mealInfo}</p>}

                <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-200">
                  <input
                    type="checkbox"
                    checked={wantsMeal}
                    onChange={(e) => setWantsMeal(e.target.checked)}
                    className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
                  />
                  Je souhaite manger sur place ({selected.mealPrice}€ forfait repas, à régler sur
                  place)
                </label>

                {wantsMeal && (
                  <>
                    <p className="mt-3 text-xs text-slate-400">
                      Composez votre repas en choisissant une ou plusieurs portions ci-dessous — le
                      prix reste fixé à {selected.mealPrice}€, quel que soit le nombre de portions
                      choisies.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(selected.menus.length > 0
                        ? selected.menus.map((m) => ({ key: m.id, label: m.label, max: m.maxPerPerson }))
                        : [{ key: GENERIC_MEAL_KEY, label: "Repas", max: null as number | null }]
                      ).map((item) => {
                        const qty = quantities[item.key] ?? 0;
                        const atMax = item.max != null && qty >= item.max;
                        return (
                          <div
                            key={item.key}
                            className={`rounded-xl border-2 p-4 text-center transition ${
                              qty > 0
                                ? "border-primary-400 bg-primary-800/50"
                                : "border-primary-800 bg-primary-950/60"
                            }`}
                          >
                            <p className="font-medium text-silver-100">{item.label}</p>
                            {item.max != null && (
                              <p className="mt-0.5 text-xs text-slate-500">Max {item.max}/pers.</p>
                            )}
                            <div className="mt-3 flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => setQuantity(item.key, qty - 1)}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-primary-600 text-lg text-slate-200 hover:bg-primary-800"
                              >
                                −
                              </button>
                              <span className="w-8 font-display text-xl text-silver-100">{qty}</span>
                              <button
                                type="button"
                                onClick={() => !atMax && setQuantity(item.key, qty + 1)}
                                disabled={atMax}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-primary-600 text-lg text-slate-200 hover:bg-primary-800 disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-slate-300">
                        Intolérances ou allergies alimentaires (optionnel)
                      </label>
                      <textarea
                        value={mealNotes}
                        onChange={(e) => setMealNotes(e.target.value)}
                        rows={2}
                        placeholder="Ex: allergie aux arachides, sans gluten..."
                        className="mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                      />
                    </div>

                    {totalMealQuantity > 0 && (
                      <p className="mt-4 text-center text-sm text-slate-300">
                        Total à régler sur place pour le repas :{" "}
                        <span className="font-semibold text-silver-100">{selected.mealPrice}€</span>{" "}
                        (forfait, indépendant du nombre de portions)
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {selected.activityType === "AIRSOFT" && !isRegistered(selected) && (
              <div className="mt-4 rounded-xl border border-primary-700 bg-primary-900/40 p-5">
                <p className="font-display text-lg text-silver-100">🔫 Location de matériel</p>

                <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-200">
                  <input
                    type="checkbox"
                    checked={wantsEquipment}
                    onChange={(e) => {
                      setWantsEquipment(e.target.checked);
                      if (!e.target.checked) setSelectedEquipmentIds([]);
                    }}
                    className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
                  />
                  Je souhaite louer du matériel pour cette sortie
                </label>

                {wantsEquipment &&
                  (() => {
                    const taken = takenEquipmentIds(selected);
                    return ["REPLIQUE", "EQUIPEMENT"].map((cat) => {
                      const items = equipmentList.filter((eq) => eq.category === cat);
                      if (items.length === 0) return null;
                      return (
                        <div key={cat} className="mt-4">
                          <p className="text-sm font-medium text-slate-300">
                            {cat === "REPLIQUE" ? "Répliques" : "Équipements"}
                          </p>
                          <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            {items.map((eq) => {
                              const checked = selectedEquipmentIds.includes(eq.id);
                              const isTaken = taken.has(eq.id);
                              const disabled = eq.status !== "DISPONIBLE" || isTaken;
                              const firstPhoto = eq.photos
                                ?.split("\n")
                                .map((p) => p.trim())
                                .filter(Boolean)[0];
                              return (
                                <button
                                  type="button"
                                  key={eq.id}
                                  disabled={disabled}
                                  onClick={() => toggleEquipment(eq.id)}
                                  className={`flex gap-3 rounded-xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    checked
                                      ? "border-primary-400 bg-primary-800/50"
                                      : "border-primary-800 bg-primary-950/60"
                                  }`}
                                >
                                  {firstPhoto && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={firstPhoto}
                                      alt={eq.name}
                                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium text-silver-100">{eq.name}</p>
                                    <p className="text-xs text-slate-400">
                                      {eq.rentalCost}€
                                      {eq.magazineCount != null && ` · ${eq.magazineCount} chargeur(s)`}
                                    </p>
                                    {eq.info && <p className="mt-1 text-xs text-slate-400">{eq.info}</p>}
                                    {isTaken ? (
                                      <p className="mt-1 text-xs text-amber-400">
                                        Déjà réservé pour cet événement
                                      </p>
                                    ) : (
                                      eq.status !== "DISPONIBLE" && (
                                        <p className="mt-1 text-xs text-amber-400">
                                          {eq.status === "HORS_SERVICE" ? "Hors-service" : "Indisponible"}
                                        </p>
                                      )
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}

                    {selectedEquipmentTotal > 0 && (
                      <p className="mt-4 text-center text-sm text-slate-300">
                        Total location matériel :{" "}
                        <span className="font-semibold text-silver-100">{selectedEquipmentTotal}€</span> à
                        régler sur place
                      </p>
                    )}
              </div>
            )}

            {!isRegistered(selected) &&
              ((wantsMeal && totalMealQuantity > 0) || selectedEquipmentTotal > 0) && (
                <div className="mt-4 rounded-xl border-2 border-primary-400 bg-primary-800/40 p-4 text-center">
                  <p className="text-sm uppercase tracking-wide text-slate-300">Total à régler sur place</p>
                  <p className="mt-1 font-display text-2xl text-silver-100">
                    {(wantsMeal ? selected.mealPrice : 0) + selectedEquipmentTotal}€
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {wantsMeal && `${selected.mealPrice}€ repas`}
                    {wantsMeal && selectedEquipmentTotal > 0 && " + "}
                    {selectedEquipmentTotal > 0 && `${selectedEquipmentTotal}€ matériel`}
                  </p>
                </div>
              )}

            {selected.hasMeal && isRegistered(selected) && (
              <div className="mt-4 rounded-xl border border-primary-700 bg-primary-900/40 p-5 text-sm text-slate-300">
                {(() => {
                  const myReg = selected.registrations.find((r) => r.userId === session?.user.id);
                  if (!myReg?.wantsMeal || myReg.mealOrders.length === 0) {
                    return "Vous n'avez pas commandé de repas pour cet événement.";
                  }
                  return (
                    <>
                      <p className="font-medium text-silver-100">🍽️ Votre commande repas</p>
                      <ul className="mt-2 space-y-1">
                        {myReg.mealOrders.map((o) => {
                          const label = o.menuId
                            ? selected.menus.find((m) => m.id === o.menuId)?.label ?? "Menu"
                            : "Repas";
                          return (
                            <li key={o.id}>
                              {o.quantity}× {label}
                            </li>
                          );
                        })}
                      </ul>
                      {myReg.mealNotes && (
                        <p className="mt-2 text-amber-400">Intolérances signalées : {myReg.mealNotes}</p>
                      )}
                      <p className="mt-2 font-medium text-silver-100">
                        Total : {selected.mealPrice}€ (forfait) à régler sur place
                      </p>
                    </>
                  );
                })()}
              </div>
            )}

            {selected.activityType === "AIRSOFT" && isRegistered(selected) && (
              <div className="mt-4 rounded-xl border border-primary-700 bg-primary-900/40 p-5 text-sm text-slate-300">
                {(() => {
                  const myReg = selected.registrations.find((r) => r.userId === session?.user.id);
                  if (!myReg || myReg.rentals.length === 0) {
                    return "Vous n'avez pas loué de matériel pour cet événement.";
                  }
                  const total = myReg.rentals
                    .filter((r) => r.status !== "REJECTED")
                    .reduce((sum, r) => sum + (r.isFree ? 0 : r.equipment.rentalCost), 0);
                  const statusLabel = (s: string) =>
                    s === "APPROVED" ? "Validée" : s === "REJECTED" ? "Refusée" : "En attente de validation";
                  return (
                    <>
                      <p className="font-medium text-silver-100">🔫 Votre matériel loué</p>
                      <ul className="mt-2 space-y-1">
                        {myReg.rentals.map((r) => (
                          <li key={r.id}>
                            {r.equipment.name} — {r.isFree ? "Gratuit" : `${r.equipment.rentalCost}€`} —{" "}
                            <span
                              className={
                                r.status === "APPROVED"
                                  ? "text-emerald-400"
                                  : r.status === "REJECTED"
                                    ? "text-red-400"
                                    : "text-amber-400"
                              }
                            >
                              {statusLabel(r.status)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 font-medium text-silver-100">
                        Total matériel : {total}€ à régler sur place
                      </p>
                    </>
                  );
                })()}
              </div>
            )}

            {!isRegistered(selected) && isRegistrationClosed(selected) && (
              <p className="mt-4 text-sm text-amber-400">
                {isEventPast(selected)
                  ? "Cet événement est déjà passé, les inscriptions sont fermées."
                  : "La date limite d'inscription pour cet événement est dépassée."}
              </p>
            )}

            {!isRegistrationClosed(selected) && !isEligible(selected) && !isRegistered(selected) &&
              getMembershipWarning(selected, membership, activityMeta)
            }

            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setSelected(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-primary-900"
              >
                Fermer
              </button>
              <button
                onClick={() => handleRegister(selected)}
                disabled={
                  loadingAction ||
                  (!isRegistered(selected) && (!isEligible(selected) || isRegistrationClosed(selected)))
                }
                className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                  isRegistered(selected)
                    ? "bg-red-700 text-white hover:bg-red-600"
                    : "bg-primary-400 text-primary-950 hover:bg-silver-300"
                }`}
              >
                {isRegistered(selected) ? "Se désinscrire" : "S'inscrire"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

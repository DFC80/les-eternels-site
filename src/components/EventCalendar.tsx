"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type MealMenu = { id: string; label: string; maxPerPerson: number | null };
type MealOrder = { id: string; menuId: string | null; quantity: number };

type Equipment = {
  id: string;
  category: string;
  name: string;
  photos: string | null;
  status: "DISPONIBLE" | "HORS_SERVICE" | "INDISPONIBLE";
  rentalCost: number;
  stock: number;
  fps: number | null;
  bbWeight: number | null;
  magazineCapacity: number | null;
  propulsion: string | null;
  info: string | null;
  associations: { itemId: string; quantity: number }[];
};

type EquipmentRental = {
  id: string;
  equipmentId: string;
  quantity: number;
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
  participationFee: number;
  isTrialDay: boolean;
  isPaid: boolean;
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
  mealExtras: string;
  mealPrice: number;
  registrationDeadline: string | null;
  bureauOnly: boolean;
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
  isFuture?: boolean;
} | null;

type MembershipResponse = (Membership & { airsoftTrialDay?: boolean }) | { airsoftTrialDay?: boolean } | null;

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

function daysUntilNextSeason(membershipYear: number, eventStartsAt: string): number {
  const nextStart = new Date(membershipYear, 8, 1); // 1er septembre de l'année de début de saison
  return (nextStart.getTime() - new Date(eventStartsAt).getTime()) / 86400000;
}

function isEligibleByMembership(activityType: string, membership: Membership, activityMeta: ActivityMeta[], eventStartsAt?: string) {
  const act = activityMeta.find((a) => a.key === activityType);
  if (!act?.membershipRequired) return true;
  if (!membership || membership.expired) return false;
  if (membership.isFuture) {
    if (!eventStartsAt || daysUntilNextSeason(membership.year, eventStartsAt) > 70) return false;
  }
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
        Votre cotisation {membership.year}-{membership.year + 1} est expirée. Renouvelez votre adhésion en incluant{" "}
        <strong className="text-amber-300">{label}</strong> pour vous inscrire.{" "}
        <a href="/mon-compte" className="underline hover:text-amber-200">Renouveler mon adhésion →</a>
      </p>
    );
  }

  if (membership.isFuture && daysUntilNextSeason(membership.year, ev.startsAt) > 70) {
    const earliestDate = new Date(new Date(membership.year, 8, 1).getTime() - 70 * 86400000);
    const formatted = earliestDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    return (
      <p className="mt-4 text-sm text-amber-400">
        Votre adhésion {membership.year}-{membership.year + 1} vous permettra de vous inscrire à un évènement dont la date est à partir du{" "}
        <strong className="text-amber-300">{formatted}</strong> (70 jours avant le 1er septembre). Pour cet événement,{" "}
        <a href="/mon-compte" className="underline hover:text-amber-200">adhérez à la saison en cours →</a>
      </p>
    );
  }

  return (
    <p className="mt-4 text-sm text-amber-400">
      Votre cotisation {membership.year}-{membership.year + 1} ne couvre pas l&apos;activité{" "}
      <strong className="text-amber-300">{label}</strong>. Mettez à jour votre adhésion pour accéder à cet événement.{" "}
      <a href="/mon-compte" className="underline hover:text-amber-200">Mettre à jour →</a>
    </p>
  );
}

export default function EventCalendar() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [membership, setMembership] = useState<Membership>(null);
  const [airsoftTrialDay, setAirsoftTrialDay] = useState(false);
  const [activityMeta, setActivityMeta] = useState<ActivityMeta[]>([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [wantsMeal, setWantsMeal] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [mealNotes, setMealNotes] = useState("");
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentCategories, setEquipmentCategories] = useState<{ key: string; label: string; emoji: string }[]>([]);
  const [wantsEquipment, setWantsEquipment] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [participationAccepted, setParticipationAccepted] = useState<boolean | null>(null);
  const [editingMeal, setEditingMeal] = useState(false);
  const [eventDocs, setEventDocs] = useState<{ id: string; name: string }[]>([]);
  const [docMsg, setDocMsg] = useState<string | null>(null);
  const [docAcknowledged, setDocAcknowledged] = useState<Set<string>>(new Set());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [payingEvent, setPayingEvent] = useState(false);

  async function payEventOnline(registrationId: string) {
    setActionError(null);
    setPayingEvent(true);
    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "EVENT", registrationId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setActionError(data.error ?? "Impossible de démarrer le paiement en ligne.");
    setPayingEvent(false);
  }

  // Total dû en centimes pour une inscription (repas + participation + locations VALIDÉES payantes)
  function registrationDueCents(ev: CalendarEvent, reg: EventRegistration): number {
    const mealCents = ev.hasMeal && reg.wantsMeal ? ev.mealPrice * 100 : 0;
    const rentalsCents = reg.rentals
      .filter((r) => r.status === "APPROVED" && !r.isFree)
      .reduce((sum, r) => sum + r.equipment.rentalCost * (r.quantity ?? 1) * 100, 0);
    return mealCents + reg.participationFee + rentalsCents;
  }

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
    if (!res.ok) return;
    const data: MembershipResponse = await res.json();
    setAirsoftTrialDay((data as { airsoftTrialDay?: boolean } | null)?.airsoftTrialDay ?? false);
    // Only treat as a real membership if it has a year field
    if (data && "year" in data) setMembership(data as Membership);
    else setMembership(null);
  }

  async function loadEquipment() {
    if (!session) return;
    const [eqRes, catRes] = await Promise.all([
      fetch("/api/equipment"),
      fetch("/api/equipment-categories"),
    ]);
    if (eqRes.ok) setEquipmentList(await eqRes.json());
    if (catRes.ok) setEquipmentCategories(await catRes.json());
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

  // Somme des quantités déjà louées (en attente ou validées) par d'AUTRES membres pour cet événement.
  function takenEquipmentQuantities(ev: CalendarEvent): Map<string, number> {
    const taken = new Map<string, number>();
    for (const reg of ev.registrations) {
      if (session && reg.userId === session.user.id) continue;
      for (const rental of reg.rentals) {
        if (rental.status !== "REJECTED") {
          taken.set(rental.equipmentId, (taken.get(rental.equipmentId) ?? 0) + (rental.quantity ?? 1));
        }
      }
    }
    return taken;
  }

  function isEligible(ev: CalendarEvent) {
    if (ev.activityType === "AIRSOFT" && airsoftTrialDay) return true;
    return isEligibleByMembership(ev.activityType, membership, activityMeta, ev.startsAt);
  }

  function isEventPast(ev: CalendarEvent) {
    return new Date(ev.startsAt) < new Date();
  }

  function isRegistrationClosed(ev: CalendarEvent) {
    if (isEventPast(ev)) return true;
    if (ev.registrationDeadline && new Date(ev.registrationDeadline) < new Date()) return true;
    return false;
  }

  async function openDoc(id: string) {
    setDocMsg(null);
    const res = await fetch(`/api/docs/${id}`);
    if (res.status === 401) { setDocMsg("Connectez-vous pour accéder à ce document."); return; }
    if (res.status === 403) { setDocMsg("Votre cotisation ne couvre pas cette activité."); return; }
    if (!res.ok) { setDocMsg("Erreur lors de l'ouverture du document."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  function openEvent(ev: CalendarEvent) {
    setSelected(ev);
    setActionError(null);
    setParticipationAccepted(null);
    setEditingMeal(false);
    setEventDocs([]);
    setDocMsg(null);
    setDocAcknowledged(new Set());
    setShowConfirmation(false);
    fetch(`/api/activity-docs?activityKey=${ev.activityType}&showInEvents=true`)
      .then((r) => r.ok ? r.json() : [])
      .then(setEventDocs)
      .catch(() => {});
    const myReg = session && ev.registrations.find((r) => r.userId === session.user.id);
    setWantsMeal(myReg?.wantsMeal ?? false);
    setMealNotes(myReg?.mealNotes ?? "");
    const initialQuantities: Record<string, number> = {};
    for (const order of myReg?.mealOrders ?? []) {
      const key = order.menuId ?? GENERIC_MEAL_KEY;
      initialQuantities[key] = (initialQuantities[key] ?? 0) + order.quantity;
    }
    setQuantities(initialQuantities);

    const rentedEquipment: Record<string, number> = {};
    for (const r of myReg?.rentals ?? []) {
      rentedEquipment[r.equipmentId] = r.quantity ?? 1;
    }
    setSelectedEquipment(rentedEquipment);
    setWantsEquipment(Object.keys(rentedEquipment).length > 0);
  }

  function setQuantity(key: string, value: number) {
    setQuantities((prev) => ({ ...prev, [key]: Math.max(0, value) }));
  }

  const totalMealQuantity = Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0);

  const selectedEquipmentTotal = equipmentList
    .reduce((sum, eq) => sum + eq.rentalCost * (selectedEquipment[eq.id] ?? 0), 0);

  async function handleUpdateMeal(ev: CalendarEvent) {
    if (wantsMeal && totalMealQuantity <= 0) {
      setActionError("Veuillez indiquer au moins un repas (quantité supérieure à 0).");
      return;
    }
    const mealOrders = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([key, quantity]) => ({ menuId: key === GENERIC_MEAL_KEY ? null : key, quantity }));
    setLoadingAction(true);
    setActionError(null);
    const res = await fetch(`/api/events/${ev.id}/register/meal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wantsMeal, mealOrders, mealNotes }),
    });
    setLoadingAction(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? "Une erreur est survenue.");
      return;
    }
    setEditingMeal(false);
    const fresh = await loadEvents();
    setSelected((prev) => (prev ? fresh.find((e) => e.id === prev.id) ?? prev : prev));
  }

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

    const equipmentSelections = wantsEquipment
      ? Object.entries(selectedEquipment).filter(([, qty]) => qty > 0).map(([id, quantity]) => ({ id, quantity }))
      : [];
    const participationFee = participationAccepted === true ? 500 : 0;

    setLoadingAction(true);
    setActionError(null);
    const res = await fetch(`/api/events/${ev.id}/register`, {
      method: registered ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: registered ? undefined : JSON.stringify({ wantsMeal, mealOrders, mealNotes, equipmentSelections, participationFee }),
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
                    {ev.bureauOnly && <span className="mr-1 opacity-70">🔒</span>}{ev.title}
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
              <h3 className="mt-2 font-display text-xl text-silver-100">
                {selected.bureauOnly && (
                  <span className="mr-2 inline-block rounded border border-primary-700 bg-primary-950 px-2 py-0.5 text-xs font-medium text-primary-300 align-middle">🔒 Bureau</span>
                )}
                {selected.title}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {new Date(selected.startsAt).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                {" de "}
                {new Date(selected.startsAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                {" à "}
                {new Date(selected.endsAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
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

            {eventDocs.length > 0 && (
              <div className="mt-4 rounded-xl border border-primary-700 bg-primary-900/40 p-4">
                <p className="text-sm font-medium text-slate-300">📄 Documents</p>
                <ul className="mt-2 space-y-1">
                  {eventDocs.map((d) => (
                    <li key={d.id}>
                      <button
                        onClick={() => openDoc(d.id)}
                        className="text-sm text-primary-300 hover:underline"
                      >
                        {d.name}
                      </button>
                    </li>
                  ))}
                </ul>
                {docMsg && <p className="mt-2 text-xs text-amber-400">{docMsg}</p>}
              </div>
            )}

            {isRegistered(selected) && (() => {
              const myReg = selected.registrations.find((r) => r.userId === session?.user.id);
              if (!myReg) return null;
              const statusConfig = {
                APPROVED: { label: "Inscription validée", color: "border-emerald-700 bg-emerald-950 text-emerald-300" },
                REJECTED: { label: "Inscription refusée", color: "border-red-700 bg-red-950 text-red-300" },
                PENDING:  { label: "Inscription en attente de validation", color: "border-amber-700 bg-amber-950 text-amber-300" },
              };
              const cfg = statusConfig[myReg.status as keyof typeof statusConfig] ?? statusConfig.PENDING;
              const dueCents = registrationDueCents(selected, myReg);
              const hasPendingRentals = myReg.rentals.some((r) => r.status === "PENDING");
              return (
                <>
                  <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${cfg.color}`}>
                    {cfg.label}
                  </div>
                  {myReg.isPaid ? (
                    <div className="mt-3 rounded-lg border border-emerald-700 bg-emerald-950 px-4 py-3 text-sm text-emerald-300">
                      ✅ Frais de l&apos;événement réglés.
                    </div>
                  ) : hasPendingRentals ? (
                    <div className="mt-3 rounded-lg border border-amber-700 bg-amber-950 px-4 py-3 text-sm text-amber-300">
                      ⏳ Le paiement sera disponible une fois vos locations d&apos;équipement validées
                      par un administrateur. Vous recevrez le récapitulatif des frais par email.
                    </div>
                  ) : dueCents > 0 && myReg.status !== "REJECTED" ? (
                    <div className="mt-3 rounded-lg border border-primary-700 bg-primary-900/40 px-4 py-3">
                      <p className="text-sm text-slate-300">
                        Total à régler (repas, participation, locations) :{" "}
                        <strong className="text-silver-100">{(dueCents / 100).toLocaleString("fr-FR")}€</strong>
                      </p>
                      <button
                        type="button"
                        disabled
                        className="mt-2 rounded-md border border-primary-700 bg-primary-900 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed opacity-60"
                      >
                        💳 Payer en ligne (indisponible)
                      </button>
                      <p className="mt-1.5 text-sm text-amber-400/80">
                        💡 Le paiement s'effectue sur place le jour de l'événement.
                      </p>
                      {actionError && <p className="mt-2 text-xs text-red-400">{actionError}</p>}
                    </div>
                  ) : null}
                </>
              );
            })()}

            {selected.hasMeal && !isRegistered(selected) && (
              <div className="mt-4 rounded-xl border border-primary-700 bg-primary-900/40 p-5">
                <p className="font-display text-lg text-silver-100">🍽️ Repas du jour</p>
                {selected.mealInfo && <p className="mt-1 text-sm text-slate-300">{selected.mealInfo}</p>}
                {selected.mealExtras && (() => {
                  const EXTRAS_LABELS: Record<string, string> = {
                    softs: "🥤 Boissons softs",
                    beer: "🍺 Bières (1€ / verre ou canette)",
                    cheese: "🧀 Fromage",
                    dessert: "🍮 Dessert",
                  };
                  const extras = selected.mealExtras.split(",").filter(Boolean);
                  return extras.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {extras.map((key) => (
                        <span key={key} className="rounded-full border border-primary-700 bg-primary-900/60 px-2.5 py-0.5 text-xs text-slate-300">
                          {EXTRAS_LABELS[key] ?? key}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}

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
                      if (!e.target.checked) setSelectedEquipment({});
                    }}
                    className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
                  />
                  Je souhaite louer du matériel pour cette sortie
                </label>

                {wantsEquipment &&
                  (() => {
                    const taken = takenEquipmentQuantities(selected);
                    const cats = equipmentCategories.length > 0
                      ? equipmentCategories
                      : [...new Set(equipmentList.map(eq => eq.category))].map(k => ({ key: k, label: k, emoji: "📦" }));
                    return cats.map((cat) => {
                      const items = equipmentList.filter((eq) => eq.category === cat.key);
                      if (items.length === 0) return null;
                      return (
                        <div key={cat.key} className="mt-4">
                          <p className="text-sm font-medium text-slate-300">
                            {cat.emoji} {cat.label}
                          </p>
                          <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            {items.map((eq) => {
                              const qty = selectedEquipment[eq.id] ?? 0;
                              const takenQty = taken.get(eq.id) ?? 0;
                              const available = Math.max(0, (eq.stock ?? 1) - takenQty);
                              const isFull = available <= 0;
                              const disabled = eq.status !== "DISPONIBLE" || isFull;
                              const firstPhoto = eq.photos
                                ?.split("\n")
                                .map((p) => p.trim())
                                .filter(Boolean)[0];
                              return (
                                <div
                                  key={eq.id}
                                  className={`rounded-xl border-2 p-3 transition ${
                                    qty > 0 ? "border-primary-400 bg-primary-800/50" : "border-primary-800 bg-primary-950/60"
                                  } ${disabled && qty === 0 ? "opacity-50" : ""}`}
                                >
                                  <button
                                    type="button"
                                    disabled={disabled && qty === 0}
                                    onClick={() => {
                                      if (qty > 0) {
                                        setSelectedEquipment((prev) => { const n = { ...prev }; delete n[eq.id]; return n; });
                                      } else if (!disabled) {
                                        setSelectedEquipment((prev) => ({ ...prev, [eq.id]: 1 }));
                                      }
                                    }}
                                    className="flex w-full gap-3 text-left disabled:cursor-not-allowed"
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
                                        {eq.rentalCost}€ · {available}/{eq.stock ?? 1} dispo.
                                        {eq.propulsion && ` · ${eq.propulsion.split(",").map((v) => v.trim()).join(", ")}`}
                                        {eq.fps != null && ` · ${eq.fps} FPS`}
                                        {eq.bbWeight != null && ` · ${eq.bbWeight}g`}
                                        {eq.magazineCapacity != null && ` · ${eq.magazineCapacity} billes`}
                                      </p>
                                      {eq.info && <p className="mt-1 text-xs text-slate-400">{eq.info}</p>}
                                      {eq.associations.length > 0 && (
                                        <ul className="mt-1.5 space-y-0.5">
                                          {eq.associations.map((a) => {
                                            const item = equipmentList.find((e) => e.id === a.itemId);
                                            if (!item) return null;
                                            return (
                                              <li key={a.itemId} className="text-xs text-slate-500">
                                                + {a.quantity > 1 ? `${a.quantity}× ` : ""}{item.name}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                      {isFull ? (
                                        <p className="mt-1 text-xs text-amber-400">Plus disponible pour cet événement</p>
                                      ) : eq.status !== "DISPONIBLE" && (
                                        <p className="mt-1 text-xs text-amber-400">
                                          {eq.status === "HORS_SERVICE" ? "Hors-service" : "Indisponible"}
                                        </p>
                                      )}
                                    </div>
                                  </button>
                                  {qty > 0 && (
                                    <div className="mt-3 flex items-center gap-2 border-t border-primary-700 pt-3">
                                      <span className="text-xs text-slate-400">Quantité :</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (qty <= 1) {
                                            setSelectedEquipment((prev) => { const n = { ...prev }; delete n[eq.id]; return n; });
                                          } else {
                                            setSelectedEquipment((prev) => ({ ...prev, [eq.id]: qty - 1 }));
                                          }
                                        }}
                                        className="flex h-7 w-7 items-center justify-center rounded-full border border-primary-600 text-slate-200 hover:bg-primary-800"
                                      >−</button>
                                      <span className="w-6 text-center text-sm font-medium text-silver-100">{qty}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (qty < available) setSelectedEquipment((prev) => ({ ...prev, [eq.id]: qty + 1 }));
                                        }}
                                        disabled={qty >= available}
                                        className="flex h-7 w-7 items-center justify-center rounded-full border border-primary-600 text-slate-200 hover:bg-primary-800 disabled:opacity-40"
                                      >+</button>
                                    </div>
                                  )}
                                </div>
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
              ((wantsMeal && totalMealQuantity > 0) || selectedEquipmentTotal > 0 || participationAccepted === true) && (
                <div className="mt-4 rounded-xl border-2 border-primary-400 bg-primary-800/40 p-4 text-center">
                  <p className="text-sm uppercase tracking-wide text-slate-300">Total à régler sur place</p>
                  <p className="mt-1 font-display text-2xl text-silver-100">
                    {(wantsMeal ? selected.mealPrice : 0) + selectedEquipmentTotal + (participationAccepted === true ? 5 : 0)}€
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {participationAccepted === true && "5€ participation invité"}
                    {participationAccepted === true && (wantsMeal || selectedEquipmentTotal > 0) && " + "}
                    {wantsMeal && `${selected.mealPrice}€ repas`}
                    {wantsMeal && selectedEquipmentTotal > 0 && " + "}
                    {selectedEquipmentTotal > 0 && `${selectedEquipmentTotal}€ matériel`}
                  </p>
                </div>
              )}

            {selected.hasMeal && isRegistered(selected) && (
              <div className="mt-4 rounded-xl border border-primary-700 bg-primary-900/40 p-5 text-sm text-slate-300">
                {editingMeal ? (
                  <>
                    <p className="font-medium text-silver-100">🍽️ Modifier votre commande repas</p>
                    <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                      <input
                        type="checkbox"
                        checked={wantsMeal}
                        onChange={(e) => setWantsMeal(e.target.checked)}
                        className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
                      />
                      Je souhaite manger sur place ({selected.mealPrice}€ forfait, à régler sur place)
                    </label>
                    {wantsMeal && (
                      <>
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
                                  qty > 0 ? "border-primary-400 bg-primary-800/50" : "border-primary-800 bg-primary-950/60"
                                }`}
                              >
                                <p className="font-medium text-silver-100">{item.label}</p>
                                {item.max != null && (
                                  <p className="mt-0.5 text-xs text-slate-500">Max {item.max}/pers.</p>
                                )}
                                <div className="mt-3 flex items-center justify-center gap-3">
                                  <button type="button" onClick={() => setQuantity(item.key, qty - 1)}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-primary-600 text-lg text-slate-200 hover:bg-primary-800">−</button>
                                  <span className="w-8 font-display text-xl text-silver-100">{qty}</span>
                                  <button type="button" onClick={() => !atMax && setQuantity(item.key, qty + 1)} disabled={atMax}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-primary-600 text-lg text-slate-200 hover:bg-primary-800 disabled:opacity-40">+</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <textarea
                          value={mealNotes}
                          onChange={(e) => setMealNotes(e.target.value)}
                          placeholder="Intolérances ou allergies alimentaires (optionnel)"
                          rows={2}
                          className="mt-3 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                        />
                      </>
                    )}
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => handleUpdateMeal(selected)}
                        disabled={loadingAction}
                        className="rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-50"
                      >
                        {loadingAction ? "Enregistrement…" : "Enregistrer"}
                      </button>
                      <button
                        onClick={() => { setEditingMeal(false); openEvent(selected); }}
                        className="rounded-md border border-primary-700 px-4 py-2 text-sm text-slate-300 hover:bg-primary-800/60"
                      >
                        Annuler
                      </button>
                    </div>
                  </>
                ) : (
                  (() => {
                    const myReg = selected.registrations.find((r) => r.userId === session?.user.id);
                    return (
                      <>
                        {!myReg?.wantsMeal || myReg.mealOrders.length === 0 ? (
                          <p>Vous n'avez pas commandé de repas pour cet événement.</p>
                        ) : (
                          <>
                            <p className="font-medium text-silver-100">🍽️ Votre commande repas</p>
                            <ul className="mt-2 space-y-1">
                              {Object.entries(
                                myReg.mealOrders.reduce((acc, o) => {
                                  const key = o.menuId ?? "__null__";
                                  acc[key] = { menuId: o.menuId, quantity: (acc[key]?.quantity ?? 0) + o.quantity };
                                  return acc;
                                }, {} as Record<string, { menuId: string | null; quantity: number }>)
                              ).map(([key, { menuId, quantity }]) => {
                                const label = menuId
                                  ? selected.menus.find((m) => m.id === menuId)?.label ?? "Menu"
                                  : "Repas";
                                return <li key={key}>{quantity}× {label}</li>;
                              })}
                            </ul>
                            {myReg.mealNotes && (
                              <p className="mt-2 text-amber-400">Intolérances signalées : {myReg.mealNotes}</p>
                            )}
                            <p className="mt-2 font-medium text-silver-100">
                              Total : {selected.mealPrice}€ (forfait) à régler sur place
                            </p>
                          </>
                        )}
                        {!isRegistrationClosed(selected) && (
                          <button
                            onClick={() => setEditingMeal(true)}
                            className="mt-3 rounded-md border border-primary-600 px-3 py-1.5 text-xs text-primary-300 hover:bg-primary-800/60"
                          >
                            ✏️ Modifier mes choix repas
                          </button>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            )}

            {selected.activityType === "AIRSOFT" && isRegistered(selected) && (() => {
              const myReg = selected.registrations.find((r) => r.userId === session?.user.id);
              if (myReg?.isTrialDay) {
                return (
                  <div className="mt-4 rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4 text-sm text-emerald-300">
                    🎯 Vous participez en <strong>journée d'essai airsoft</strong> — aucun frais à régler.
                  </div>
                );
              }
              if (myReg?.participationFee && myReg.participationFee > 0) {
                return (
                  <div className="mt-4 rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-300">
                    💶 Participation invité : <strong>{myReg.participationFee / 100}€ à régler sur place</strong>
                  </div>
                );
              }
              return null;
            })()}

            {selected.activityType === "AIRSOFT" && isRegistered(selected) && (
              <div className="mt-4 rounded-xl border border-primary-700 bg-primary-900/40 p-5 text-sm text-slate-300">
                {(() => {
                  const myReg = selected.registrations.find((r) => r.userId === session?.user.id);
                  if (!myReg || myReg.rentals.length === 0) {
                    return "Vous n'avez pas loué de matériel pour cet événement.";
                  }
                  const total = myReg.rentals
                    .filter((r) => r.status !== "REJECTED")
                    .reduce((sum, r) => sum + (r.isFree ? 0 : r.equipment.rentalCost * (r.quantity ?? 1)), 0);
                  const statusLabel = (s: string) =>
                    s === "APPROVED" ? "Validée" : s === "REJECTED" ? "Refusée" : "En attente de validation";
                  return (
                    <>
                      <p className="font-medium text-silver-100">🔫 Votre matériel loué</p>
                      <ul className="mt-2 space-y-1">
                        {myReg.rentals.map((r) => (
                          <li key={r.id}>
                            {r.quantity > 1 ? `${r.quantity}× ` : ""}{r.equipment.name} — {r.isFree ? "Gratuit" : `${r.equipment.rentalCost * (r.quantity ?? 1)}€`} —{" "}
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

            {!isRegistrationClosed(selected) && !isEligible(selected) && !isRegistered(selected) && (
              <>
                {getMembershipWarning(selected, membership, activityMeta)}

                {selected.activityType === "AIRSOFT" && (
                  <div className="mt-4 rounded-xl border border-amber-800/60 bg-amber-950/30 p-5">
                    <p className="font-display text-base text-amber-200">💶 Participation invité — 5€</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Vous pouvez toutefois assister à cette sortie en réglant une participation de{" "}
                      <strong className="text-white">5€ sur place</strong>. Acceptez-vous cette condition ?
                    </p>
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setParticipationAccepted(true)}
                        className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                          participationAccepted === true
                            ? "bg-emerald-600 text-white"
                            : "border border-emerald-700 text-emerald-300 hover:bg-emerald-900/40"
                        }`}
                      >
                        ✓ Oui, je participe (5€)
                      </button>
                      <button
                        type="button"
                        onClick={() => setParticipationAccepted(false)}
                        className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                          participationAccepted === false
                            ? "bg-red-800 text-white"
                            : "border border-red-900 text-red-400 hover:bg-red-950/40"
                        }`}
                      >
                        ✗ Non, je refuse
                      </button>
                    </div>
                    {participationAccepted === true && (
                      <p className="mt-3 text-sm text-emerald-400">
                        5€ à régler sur place le jour de l&apos;événement.
                      </p>
                    )}
                    {participationAccepted === false && (
                      <p className="mt-3 text-sm text-amber-400">
                        Pour vous inscrire gratuitement, adhérez à l&apos;activité Airsoft.{" "}
                        <a href="/mon-compte" className="underline hover:text-amber-200">Gérer mon adhésion →</a>
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}

            {showConfirmation && !isRegistered(selected) && (
              <div className="mt-4 rounded-xl border-2 border-primary-500 bg-primary-900/60 p-5">
                <p className="font-display text-base text-silver-100">Récapitulatif de votre inscription</p>

                <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                  <li>📅 <strong className="text-silver-100">{selected.title}</strong></li>
                  <li>
                    {new Date(selected.startsAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    {" de "}
                    {new Date(selected.startsAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    {" à "}
                    {new Date(selected.endsAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </li>
                  {airsoftTrialDay && selected.activityType === "AIRSOFT" && (
                    <li>🎯 <span className="text-emerald-300">Journée d&apos;essai airsoft — participation gratuite</span></li>
                  )}
                  {participationAccepted === true && (
                    <li>💶 Participation invité : <strong className="text-white">5€ à régler sur place</strong></li>
                  )}
                  {wantsMeal && (
                    <li>🍽️ Repas : <strong className="text-white">{selected.mealPrice}€ forfait</strong> à régler sur place
                      {Object.entries(quantities).filter(([, q]) => q > 0).map(([key, qty]) => {
                        const label = key === GENERIC_MEAL_KEY ? "Repas" : selected.menus.find((m) => m.id === key)?.label ?? "Menu";
                        return <span key={key} className="ml-1 text-slate-400">({qty}× {label})</span>;
                      })}
                    </li>
                  )}
                  {selectedEquipmentTotal > 0 && (
                    <li>🔫 Matériel loué : <strong className="text-white">{selectedEquipmentTotal}€</strong> à régler sur place
                      <ul className="ml-4 mt-1 space-y-0.5 text-slate-400">
                        {Object.entries(selectedEquipment).filter(([, q]) => q > 0).map(([id, qty]) => {
                          const eq = equipmentList.find((e) => e.id === id);
                          return eq ? <li key={id}>{qty}× {eq.name}</li> : null;
                        })}
                      </ul>
                    </li>
                  )}
                  {(participationAccepted === true || wantsMeal || selectedEquipmentTotal > 0) && (
                    <li className="border-t border-primary-700 pt-2 font-medium text-silver-100">
                      Total à régler sur place :{" "}
                      {(participationAccepted === true ? 5 : 0) + (wantsMeal ? selected.mealPrice : 0) + selectedEquipmentTotal}€
                    </li>
                  )}
                </ul>

                {eventDocs.length > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-sm">
                    <p className="font-medium text-amber-300">📄 Documents à prendre en compte</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Lisez chaque document et cochez pour confirmer que vous en avez pris connaissance.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {eventDocs.map((d) => (
                        <li key={d.id} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            id={`doc-${d.id}`}
                            checked={docAcknowledged.has(d.id)}
                            onChange={() =>
                              setDocAcknowledged((prev) => {
                                const next = new Set(prev);
                                if (next.has(d.id)) next.delete(d.id);
                                else next.add(d.id);
                                return next;
                              })
                            }
                            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary-400"
                          />
                          <label htmlFor={`doc-${d.id}`} className="cursor-pointer">
                            <button
                              type="button"
                              onClick={() => openDoc(d.id)}
                              className="text-primary-300 hover:underline text-left"
                            >
                              📄 {d.name}
                            </button>
                            <span className="ml-1.5 text-xs text-slate-500">(cliquez pour lire)</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    {eventDocs.length > 0 && docAcknowledged.size < eventDocs.length && (
                      <p className="mt-2 text-xs text-amber-400">
                        Veuillez cocher tous les documents pour pouvoir vous inscrire.
                      </p>
                    )}
                    {docMsg && <p className="mt-2 text-xs text-amber-400">{docMsg}</p>}
                  </div>
                )}

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleRegister(selected)}
                    disabled={loadingAction || (eventDocs.length > 0 && docAcknowledged.size < eventDocs.length)}
                    className="rounded-md bg-primary-400 px-5 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
                  >
                    {loadingAction ? "Inscription…" : "Confirmer l'inscription"}
                  </button>
                  <button
                    onClick={() => setShowConfirmation(false)}
                    className="rounded-md border border-primary-700 px-4 py-2 text-sm text-slate-300 hover:bg-primary-800/60"
                  >
                    Retour
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setSelected(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-primary-900"
              >
                Fermer
              </button>
              {isRegistered(selected) ? (
                <button
                  onClick={() => handleRegister(selected)}
                  disabled={loadingAction}
                  className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                >
                  Se désinscrire
                </button>
              ) : !showConfirmation && (
                <button
                  onClick={() => setShowConfirmation(true)}
                  disabled={
                    loadingAction ||
                    isRegistrationClosed(selected) ||
                    (!isEligible(selected) && !(selected.activityType === "AIRSOFT" && participationAccepted === true))
                  }
                  className="rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
                >
                  S&apos;inscrire
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

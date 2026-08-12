"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAllowedActivityTypes, sessionHasWriteAccess } from "@/lib/permissions";
import DateInput from "@/components/DateInput";

type MenuItem = { id: string; label: string; maxPerPerson: number | null };

type EventItem = {
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
  showOnHome: boolean;
  menus: MenuItem[];
  boardGames: { id: string; name: string }[];
  registrations: {
    id: string;
    status: string;
    wantsMeal: boolean;
    participationFee: number;
    rentals: { status: string; isFree: boolean; quantity: number; equipment: { rentalCost: number } }[];
  }[];
};

type MealReport = {
  eventTitle: string;
  mealPrice: number;
  totalPeople: number;
  totalItems: number;
  totalAmount: number;
  byMenu: { menuId: string; label: string; count: number }[];
  withoutMenu: number;
  diners: { name: string; items: { label: string; quantity: number }[]; notes: string | null }[];
};

type MenuFormItem = { id?: string; label: string; maxPerPerson: string };

type Expense = { id: string; label: string; amount: number; createdAt: string };

type Rental = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isFree: boolean;
  quantity: number;
  memberName: string;
  equipment: { id: string; name: string; rentalCost: number; category: string };
};

type EquipmentCategory = { id: string; key: string; label: string; emoji: string; order: number };

type EventRegistrationAdmin = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  wantsMeal: boolean;
  isTrialDay: boolean;
  hasOwnEquipment: boolean;
  isPaid: boolean;
  memberName: string;
  memberEmail: string;
  createdAt: string;
  mealOrders: { menuLabel: string | null; quantity: number }[];
};

const EMPTY_FORM = {
  id: "",
  title: "",
  description: "",
  activityType: "JEUX_DE_PLATEAU",
  location: "",
  startsAt: "",
  endsAt: "",
  capacity: "",
  hasMeal: false,
  mealInfo: "",
  mealExtras: [] as string[],
  mealPrice: "10",
  registrationDeadline: "",
  menus: [] as MenuFormItem[],
  boardGameIds: [] as string[],
};

type AvailableGame = { id: string; name: string; minPlayers: number; maxPlayers: number; status: string; owner: { firstName: string; name: string } };

type KioskMember = { id: string; firstName: string; name: string; balance: number };
type KioskProduct = { id: string; category: string; name: string; price: number; stock: number };
type KioskData = { members: KioskMember[]; products: KioskProduct[] };

const MEAL_EXTRAS = [
  { key: "softs", label: "Boissons softs" },
  { key: "beer", label: "Bières (1€ / verre ou canette)" },
  { key: "cheese", label: "Fromage" },
  { key: "dessert", label: "Dessert" },
] as const;

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

const checkboxClass = "h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400";

type ActivityOption = { key: string; label: string; emoji: string; color: string; isActive: boolean };

const DEFAULT_BADGE = "bg-primary-900 text-silver-300 border-primary-700";
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

function toInputDateTime(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminEventsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(sessionUser, "events");
  const allowedTypes = getAllowedActivityTypes(role);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mealReportFor, setMealReportFor] = useState<string | null>(null);
  const [mealReport, setMealReport] = useState<MealReport | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [financeFor, setFinanceFor] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpenseLabel, setNewExpenseLabel] = useState("");
  const [newCustomExtra, setNewCustomExtra] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [rentalsFor, setRentalsFor] = useState<string | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [rentalsCategoryFilter, setRentalsCategoryFilter] = useState<string | null>(null);
  const [registrationsFor, setRegistrationsFor] = useState<string | null>(null);
  const [eventRegistrations, setEventRegistrations] = useState<EventRegistrationAdmin[]>([]);
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([]);
  const [kiosqueFor, setKiosqueFor] = useState<string | null>(null);
  const [kiosqueData, setKiosqueData] = useState<KioskData | null>(null);
  const [kiosqueMemberId, setKiosqueMemberId] = useState<string | null>(null);
  const [kiosqueCart, setKiosqueCart] = useState<Record<string, number>>({});
  const [kiosqueBusy, setKiosqueBusy] = useState(false);
  const [kiosqueError, setKiosqueError] = useState<string | null>(null);
  const [kiosqueMessage, setKiosqueMessage] = useState<string | null>(null);
  const [docsFor, setDocsFor] = useState<string | null>(null);
  const [eventDocuments, setEventDocuments] = useState<{ id: string; name: string; description: string | null; mime: string; size: number; visibility: string }[]>([]);
  const [availableDocs, setAvailableDocs] = useState<{ id: string; name: string; description: string | null; mime: string; size: number; visibility: string }[]>([]);
  const [docFilter, setDocFilter] = useState("");
  const [docLinking, setDocLinking] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [equipmentCategories, setEquipmentCategories] = useState<EquipmentCategory[]>([]);

  async function load() {
    const res = await fetch("/api/events");
    if (res.ok) setEvents(await res.json());
  }

  async function loadGames() {
    const res = await fetch("/api/admin/board-games");
    if (res.ok) setAvailableGames(await res.json());
  }

  useEffect(() => {
    load();
    loadGames();
    fetch("/api/activities")
      .then((r) => r.json())
      .then((data: ActivityOption[]) =>
        setActivityOptions([...data.filter((a) => a.isActive), { key: "AUTRE", label: "Autre", emoji: "📌", color: "slate", isActive: true }])
      );
    fetch("/api/equipment-categories")
      .then((r) => r.ok ? r.json() : [])
      .then((data: EquipmentCategory[]) => setEquipmentCategories(data))
      .catch(() => {});
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function editEvent(ev: EventItem) {
    setForm({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      activityType: ev.activityType,
      location: ev.location,
      startsAt: toInputDateTime(ev.startsAt),
      endsAt: toInputDateTime(ev.endsAt),
      capacity: ev.capacity ? String(ev.capacity) : "",
      hasMeal: ev.hasMeal,
      mealInfo: ev.mealInfo ?? "",
      mealExtras: ev.mealExtras ? ev.mealExtras.split(",").filter(Boolean) : [],
      mealPrice: String(ev.mealPrice ?? 10),
      registrationDeadline: ev.registrationDeadline ? toInputDateTime(ev.registrationDeadline) : "",
      menus: ev.menus.map((m) => ({ id: m.id, label: m.label, maxPerPerson: m.maxPerPerson ? String(m.maxPerPerson) : "" })),
      boardGameIds: ev.boardGames.map((g) => g.id),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleBoardGame(id: string) {
    setForm((prev) => ({
      ...prev,
      boardGameIds: prev.boardGameIds.includes(id)
        ? prev.boardGameIds.filter((g) => g !== id)
        : [...prev.boardGameIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      title: form.title,
      description: form.description,
      activityType: form.activityType,
      location: form.location,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      capacity: form.capacity || null,
      hasMeal: form.hasMeal,
      mealInfo: form.mealInfo,
      mealExtras: form.mealExtras,
      mealPrice: form.mealPrice || "10",
      registrationDeadline: form.registrationDeadline || null,
      menus: form.menus.map((m) => ({ label: m.label, maxPerPerson: m.maxPerPerson || null })),
      boardGameIds: form.activityType === "JEUX_DE_PLATEAU" ? form.boardGameIds : [],
    };

    const res = await fetch(form.id ? `/api/events/${form.id}` : "/api/events", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    resetForm();
    await load();
  }

  async function removeEvent(id: string) {
    if (!confirm("Supprimer cet événement ?")) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function toggleShowOnHome(id: string, value: boolean) {
    const res = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showOnHome: value }),
    });
    if (res.ok) await load();
  }

  function updateMenu(index: number, field: keyof MenuFormItem, value: string) {
    const menus = [...form.menus];
    menus[index] = { ...menus[index], [field]: value };
    setForm({ ...form, menus });
  }

  function removeMenu(index: number) {
    setForm({ ...form, menus: form.menus.filter((_, i) => i !== index) });
  }

  async function toggleMealReport(eventId: string) {
    if (mealReportFor === eventId) {
      setMealReportFor(null);
      setMealReport(null);
      return;
    }
    const res = await fetch(`/api/admin/events/${eventId}/meals`);
    if (res.ok) {
      setMealReport(await res.json());
      setMealReportFor(eventId);
    }
  }

  async function toggleFinance(eventId: string) {
    if (financeFor === eventId) {
      setFinanceFor(null);
      setExpenses([]);
      return;
    }
    const res = await fetch(`/api/admin/events/${eventId}/expenses`);
    if (res.ok) {
      setExpenses(await res.json());
      setFinanceFor(eventId);
      setNewExpenseLabel("");
      setNewExpenseAmount("");
    }
  }

  async function addExpense(eventId: string) {
    if (!newExpenseLabel || !newExpenseAmount) return;
    const res = await fetch(`/api/admin/events/${eventId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newExpenseLabel, amount: newExpenseAmount }),
    });
    if (res.ok) {
      setNewExpenseLabel("");
      setNewExpenseAmount("");
      const refreshed = await fetch(`/api/admin/events/${eventId}/expenses`);
      if (refreshed.ok) setExpenses(await refreshed.json());
    }
  }

  async function removeExpense(eventId: string, expenseId: string) {
    const res = await fetch(`/api/admin/events/${eventId}/expenses/${expenseId}`, { method: "DELETE" });
    if (res.ok) setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
  }

  async function loadRentals(eventId: string) {
    const res = await fetch(`/api/admin/events/${eventId}/rentals`);
    if (res.ok) setRentals(await res.json());
  }

  async function toggleRentals(eventId: string) {
    if (rentalsFor === eventId) {
      setRentalsFor(null);
      setRentals([]);
      setRentalsCategoryFilter(null);
      return;
    }
    setRentalsCategoryFilter(null);
    await loadRentals(eventId);
    setRentalsFor(eventId);
  }

  async function toggleKiosque(eventId: string) {
    if (kiosqueFor === eventId) {
      setKiosqueFor(null);
      setKiosqueData(null);
      setKiosqueMemberId(null);
      setKiosqueCart({});
      setKiosqueError(null);
      setKiosqueMessage(null);
      return;
    }
    const res = await fetch(`/api/admin/events/${eventId}/kiosk`);
    if (res.ok) {
      setKiosqueData(await res.json());
      setKiosqueMemberId(null);
      setKiosqueCart({});
      setKiosqueError(null);
      setKiosqueMessage(null);
      setKiosqueFor(eventId);
    }
  }

  async function reloadKiosque(eventId: string) {
    const res = await fetch(`/api/admin/events/${eventId}/kiosk`);
    if (res.ok) setKiosqueData(await res.json());
  }

  function kiosqueAddToCart(productId: string, delta: number) {
    setKiosqueCart((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta);
      const updated = { ...prev, [productId]: next };
      if (next === 0) delete updated[productId];
      return updated;
    });
  }

  async function kiosqueConfirmOrder(eventId: string) {
    if (!kiosqueMemberId || Object.keys(kiosqueCart).length === 0) return;
    setKiosqueBusy(true);
    setKiosqueError(null);
    setKiosqueMessage(null);
    const items = Object.entries(kiosqueCart).map(([productId, quantity]) => ({ productId, quantity }));
    const res = await fetch("/api/admin/kiosk/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: kiosqueMemberId, items }),
    });
    setKiosqueBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setKiosqueError(body.error ?? "Erreur lors de la commande.");
      return;
    }
    setKiosqueCart({});
    setKiosqueMessage("Commande enregistrée !");
    await reloadKiosque(eventId);
  }

  async function loadEventRegistrations(eventId: string) {
    const res = await fetch(`/api/admin/events/${eventId}/registrations`);
    if (res.ok) setEventRegistrations(await res.json());
  }

  async function toggleRegistrations(eventId: string) {
    if (registrationsFor === eventId) {
      setRegistrationsFor(null);
      setEventRegistrations([]);
      return;
    }
    await loadEventRegistrations(eventId);
    setRegistrationsFor(eventId);
  }

  async function updateRegistration(eventId: string, registrationId: string, status: "APPROVED" | "REJECTED") {
    const res = await fetch(`/api/admin/registrations/${registrationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await Promise.all([loadEventRegistrations(eventId), load()]);
    }
  }

  async function toggleRegistrationPaid(eventId: string, registrationId: string, isPaid: boolean) {
    const res = await fetch(`/api/admin/registrations/${registrationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid }),
    });
    if (res.ok) await loadEventRegistrations(eventId);
  }

  async function updateRental(eventId: string, rentalId: string, data: { status?: string; isFree?: boolean }) {
    const res = await fetch(`/api/admin/rentals/${rentalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) await loadRentals(eventId);
  }

  async function loadEventDocs(eventId: string) {
    const res = await fetch(`/api/admin/events/${eventId}/documents`);
    if (res.ok) setEventDocuments(await res.json());
  }

  async function toggleDocs(eventId: string) {
    if (docsFor === eventId) {
      setDocsFor(null);
      setEventDocuments([]);
      setAvailableDocs([]);
      setDocFilter("");
      setDocError(null);
      return;
    }
    const [linkedRes, allRes] = await Promise.all([
      fetch(`/api/admin/events/${eventId}/documents`),
      fetch("/api/admin/assoc-documents"),
    ]);
    if (linkedRes.ok) setEventDocuments(await linkedRes.json());
    if (allRes.ok) setAvailableDocs(await allRes.json());
    setDocsFor(eventId);
    setDocFilter("");
    setDocError(null);
  }

  async function linkDoc(eventId: string, documentId: string) {
    setDocLinking(true);
    setDocError(null);
    const res = await fetch(`/api/admin/events/${eventId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    setDocLinking(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDocError(body.error ?? "Erreur lors de l'association.");
      return;
    }
    await loadEventDocs(eventId);
  }

  async function unlinkDoc(eventId: string, docId: string) {
    const res = await fetch(`/api/admin/events/${eventId}/documents/${docId}`, { method: "DELETE" });
    if (res.ok) setEventDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  const now = new Date();
  const visibleEvents = allowedTypes
    ? events.filter((ev) => allowedTypes.includes(ev.activityType))
    : events;
  const upcomingEvents = visibleEvents.filter((ev) => new Date(ev.startsAt) >= now);
  const pastEvents = visibleEvents.filter((ev) => new Date(ev.startsAt) < now);
  const visibleActivityOptions = allowedTypes
    ? activityOptions.filter((a) => allowedTypes.includes(a.key))
    : activityOptions;

  function renderEventCard(ev: EventItem, isPast: boolean) {
    return (
      <div
        key={ev.id}
        className={`rounded-2xl border p-5 shadow-lg shadow-black/20 transition ${
          isPast ? "border-primary-800/60 bg-primary-900/20 opacity-80" : "border-primary-800 bg-primary-900/40"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {(() => {
            const act = activityOptions.find((a) => a.key === ev.activityType);
            const badge = act ? (COLOR_BADGE[act.color] ?? DEFAULT_BADGE) : DEFAULT_BADGE;
            return (
              <span className={`rounded border px-2 py-0.5 text-xs font-medium ${badge}`}>
                {act ? `${act.emoji} ${act.label}` : ev.activityType}
              </span>
            );
          })()}
          {ev.hasMeal && (
            <span className="rounded border border-primary-700 bg-primary-950 px-2 py-0.5 text-xs text-slate-300">
              🍽️ Repas
            </span>
          )}
          {isPast && (
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">Terminé</span>
          )}
        </div>

        <h3 className="mt-3 font-display text-lg text-silver-100">{ev.title}</h3>
        <p className="mt-1 text-sm text-slate-400">
          {new Date(ev.startsAt).toLocaleString("fr-FR")} · 📍 {ev.location}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {ev.registrations.filter((r) => r.status === "APPROVED").length}
          {ev.capacity ? ` / ${ev.capacity}` : ""} inscrit(s) validé(s)
        </p>
        {ev.registrationDeadline && (
          <p className="mt-1 text-xs text-slate-500">
            Inscriptions jusqu'au {new Date(ev.registrationDeadline).toLocaleString("fr-FR")}
          </p>
        )}
        {ev.boardGames.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            🎲 {ev.boardGames.map((g) => g.name).join(", ")}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-primary-800 pt-3 text-sm">
          <button
            onClick={() => toggleRegistrations(ev.id)}
            className="rounded-md border border-primary-700 px-3 py-1.5 text-primary-300 hover:bg-primary-800/60"
          >
            {registrationsFor === ev.id ? "Masquer inscriptions" : "Inscriptions"}
          </button>
          {ev.hasMeal && (
            <button
              onClick={() => toggleMealReport(ev.id)}
              className="rounded-md border border-primary-700 px-3 py-1.5 text-primary-300 hover:bg-primary-800/60"
            >
              {mealReportFor === ev.id ? "Masquer repas" : "Repas"}
            </button>
          )}
          <button
            onClick={() => toggleFinance(ev.id)}
            className="rounded-md border border-primary-700 px-3 py-1.5 text-primary-300 hover:bg-primary-800/60"
          >
            {financeFor === ev.id ? "Masquer finances" : "Finances"}
          </button>
          {ev.activityType === "AIRSOFT" && (
            <button
              onClick={() => toggleRentals(ev.id)}
              className="rounded-md border border-primary-700 px-3 py-1.5 text-primary-300 hover:bg-primary-800/60"
            >
              {rentalsFor === ev.id ? "Masquer locations" : "Locations"}
            </button>
          )}
          <button
            onClick={() => toggleKiosque(ev.id)}
            className="rounded-md border border-primary-700 px-3 py-1.5 text-primary-300 hover:bg-primary-800/60"
          >
            {kiosqueFor === ev.id ? "Masquer comptoir" : "🛒 Comptoir"}
          </button>
          <button
            onClick={() => toggleDocs(ev.id)}
            className="rounded-md border border-primary-700 px-3 py-1.5 text-primary-300 hover:bg-primary-800/60"
          >
            {docsFor === ev.id ? "Masquer documents" : "📄 Documents"}
          </button>
          {canWrite && !isPast && (
            <button
              onClick={() => editEvent(ev)}
              className="rounded-md border border-primary-700 px-3 py-1.5 text-primary-300 hover:bg-primary-800/60"
            >
              Modifier
            </button>
          )}
          <a
            href={`/admin/events/${ev.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-primary-700 px-3 py-1.5 text-primary-300 hover:bg-primary-800/60"
          >
            🖨️ Imprimer
          </a>
          {canWrite && (
            <button
              type="button"
              onClick={() => toggleShowOnHome(ev.id, !ev.showOnHome)}
              className={`rounded-md border px-3 py-1.5 transition ${
                ev.showOnHome
                  ? "border-primary-500 bg-primary-950/60 text-primary-300 hover:bg-primary-900"
                  : "border-primary-700 text-slate-500 hover:border-primary-500 hover:text-primary-300"
              }`}
            >
              {ev.showOnHome ? "🏠 Sur l'accueil" : "Publier accueil"}
            </button>
          )}
          {canWrite && (
            <button
              onClick={() => removeEvent(ev.id)}
              className="rounded-md border border-red-900 px-3 py-1.5 text-red-400 hover:bg-red-950/40"
            >
              Supprimer
            </button>
          )}
        </div>

        {registrationsFor === ev.id && (
          <div className="mt-4 rounded-lg border border-primary-700 bg-primary-950/60 p-4 text-sm">
            {eventRegistrations.length === 0 ? (
              <p className="text-slate-500">Aucune inscription pour cet événement.</p>
            ) : (
              <ul className="space-y-3">
                {eventRegistrations.map((r) => (
                  <li key={r.id} className="rounded-lg border border-primary-800 bg-primary-900/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-200">
                          {r.memberName}
                          {r.isTrialDay && (
                            <span className="ml-2 rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                              🎯 Essai
                            </span>
                          )}
                          {r.hasOwnEquipment && (
                            <span className="ml-2 rounded-full bg-blue-900/60 px-2 py-0.5 text-xs font-semibold text-blue-300">
                              🔫 Proprio
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {r.memberEmail}
                          {" · "}
                          <span
                            className={
                              r.status === "APPROVED"
                                ? "text-emerald-400"
                                : r.status === "REJECTED"
                                  ? "text-red-400"
                                  : "text-amber-400"
                            }
                          >
                            {r.status === "APPROVED"
                              ? "Validée"
                              : r.status === "REJECTED"
                                ? "Refusée"
                                : "En attente"}
                          </span>
                          {" · "}
                          <span className={r.isPaid ? "text-emerald-400" : "text-amber-400"}>
                            {r.isPaid ? "💶 Payé" : "💶 Non payé"}
                          </span>
                        </p>
                        {r.wantsMeal && (
                          <p className="mt-1 text-xs text-slate-400">
                            🍽️{" "}
                            {r.mealOrders.length > 0
                              ? r.mealOrders
                                  .map((o) => `${o.quantity}× ${o.menuLabel ?? "Repas"}`)
                                  .join(", ")
                              : "Repas (sans détail)"}
                          </p>
                        )}
                      </div>
                      {canWrite && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleRegistrationPaid(ev.id, r.id, !r.isPaid)}
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              r.isPaid
                                ? "bg-primary-900 text-slate-400 hover:bg-primary-800"
                                : "bg-emerald-950 text-emerald-300 hover:bg-emerald-900"
                            }`}
                            title={r.isPaid ? "Repasser en non payé" : "Règlement reçu sur place"}
                          >
                            {r.isPaid ? "Annuler paiement" : "Marquer payé"}
                          </button>
                          {r.status !== "APPROVED" && (
                            <button
                              onClick={() => updateRegistration(ev.id, r.id, "APPROVED")}
                              className="rounded bg-emerald-950 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-900"
                            >
                              Valider
                            </button>
                          )}
                          {r.status !== "REJECTED" && (
                            <button
                              onClick={() => updateRegistration(ev.id, r.id, "REJECTED")}
                              className="rounded bg-red-950 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-900"
                            >
                              Refuser
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mealReportFor === ev.id && mealReport && (
          <div className="mt-4 rounded-lg border border-primary-700 bg-primary-950/60 p-4 text-sm">
            <p className="font-semibold text-silver-100">
              {mealReport.totalPeople} repas (forfait) — {mealReport.totalAmount}€ à collecter (
              {mealReport.mealPrice}€/personne)
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {mealReport.totalItems} portion(s) au total à préparer, tous menus confondus.
            </p>
            {/* Répartition par menu — uniquement les menus avec au moins 1 portion */}
            {(() => {
              const nonZeroMenus = mealReport.byMenu.filter((m) => m.count > 0);
              const showWithout = mealReport.withoutMenu > 0;
              if (nonZeroMenus.length === 0 && !showWithout) return null;
              return (
                <ul className="mt-2 space-y-1 text-slate-300">
                  {nonZeroMenus.map((m) => (
                    <li key={m.menuId}>
                      {m.label} : <span className="font-semibold">{m.count}</span>
                    </li>
                  ))}
                  {showWithout && (
                    <li>Repas (inscription avant ajout des menus) : <span className="font-semibold">{mealReport.withoutMenu}</span></li>
                  )}
                </ul>
              );
            })()}
            {mealReport.diners.length > 0 && (
              <div className="mt-3 border-t border-primary-800 pt-3">
                <p className="font-medium text-slate-300">Participants au repas :</p>
                <ul className="mt-2 space-y-1 text-slate-300">
                  {mealReport.diners.map((d, i) => {
                    // Consolider les items de même label
                    const consolidated = Object.values(
                      d.items.reduce<Record<string, { label: string; quantity: number }>>((acc, it) => {
                        if (acc[it.label]) acc[it.label].quantity += it.quantity;
                        else acc[it.label] = { label: it.label, quantity: it.quantity };
                        return acc;
                      }, {})
                    );
                    return (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-silver-100">{d.name}</span>
                        <span className="text-slate-400">
                          {consolidated.map((it) => `${it.quantity}× ${it.label}`).join(", ")}
                        </span>
                        {d.notes && (
                          <span className="text-amber-400 text-xs">⚠ Intolérances : {d.notes}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {mealReport.totalPeople === 0 && (
              <p className="mt-2 text-slate-500">Aucune inscription repas pour le moment.</p>
            )}
          </div>
        )}

        {financeFor === ev.id && (
          <div className="mt-4 rounded-lg border border-primary-700 bg-primary-950/60 p-4 text-sm">
            {(() => {
              const mealIncome = ev.hasMeal
                ? ev.registrations.filter((r) => r.wantsMeal).length * ev.mealPrice
                : 0;
              const equipmentIncome = ev.registrations.reduce(
                (sum, r) =>
                  sum +
                  r.rentals
                    .filter((rt) => rt.status === "APPROVED")
                    .reduce((s, rt) => s + (rt.isFree ? 0 : rt.equipment.rentalCost * (rt.quantity ?? 1)), 0),
                0
              );
              const participationIncome = Math.round(
                ev.registrations.reduce((sum, r) => sum + (r.participationFee ?? 0), 0) / 100
              );
              const income = mealIncome + equipmentIncome + participationIncome;
              const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
              const profit = income - expensesTotal;
              return (
                <>
                  <p className="text-slate-300">
                    Gains repas : <span className="font-semibold text-silver-100">{mealIncome}€</span>
                  </p>
                  <p className="text-slate-300">
                    Gains location matériel :{" "}
                    <span className="font-semibold text-silver-100">{equipmentIncome}€</span>
                  </p>
                  {participationIncome > 0 && (
                    <p className="text-slate-300">
                      Participations invités :{" "}
                      <span className="font-semibold text-silver-100">{participationIncome}€</span>
                    </p>
                  )}
                  <p className="text-slate-300">
                    Dépenses : <span className="font-semibold text-silver-100">{expensesTotal}€</span>
                  </p>
                  <p
                    className={`mt-2 font-display text-lg ${
                      profit >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {profit >= 0 ? "Bénéfice" : "Perte"} : {profit}€
                  </p>
                </>
              );
            })()}

            <ul className="mt-3 space-y-1 text-slate-300">
              {expenses.map((exp) => (
                <li key={exp.id} className="flex items-center justify-between">
                  <span>
                    {exp.label} — {exp.amount}€
                  </span>
                  {canWrite && (
                    <button
                      onClick={() => removeExpense(ev.id, exp.id)}
                      className="text-red-400 hover:underline"
                    >
                      Supprimer
                    </button>
                  )}
                </li>
              ))}
              {expenses.length === 0 && <li className="text-slate-500">Aucune dépense enregistrée.</li>}
            </ul>

            {canWrite && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={newExpenseLabel}
                  onChange={(e) => setNewExpenseLabel(e.target.value)}
                  placeholder="Ex: Location terrain"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={0}
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  placeholder="Montant €"
                  className={`${inputClass} sm:w-32`}
                />
                <button
                  onClick={() => addExpense(ev.id)}
                  className="rounded-md bg-primary-400 px-3 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300"
                >
                  Ajouter
                </button>
              </div>
            )}
          </div>
        )}

        {rentalsFor === ev.id && (
          <div className="mt-4 rounded-lg border border-primary-700 bg-primary-950/60 p-4 text-sm">
            {rentals.length === 0 ? (
              <p className="text-slate-500">Aucune demande de location pour cet événement.</p>
            ) : (() => {
              const rentalCategories = [...new Set(rentals.map((r) => r.equipment.category).filter(Boolean))];
              const filtered = rentalsCategoryFilter
                ? rentals.filter((r) => r.equipment.category === rentalsCategoryFilter)
                : rentals;
              return (
                <>
                  {rentalCategories.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setRentalsCategoryFilter(null)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                          rentalsCategoryFilter === null
                            ? "border-primary-400 bg-primary-800 text-silver-100"
                            : "border-primary-700 text-slate-400 hover:border-primary-500 hover:text-slate-200"
                        }`}
                      >
                        Toutes
                      </button>
                      {rentalCategories.map((catKey) => {
                        const catMeta = equipmentCategories.find((c) => c.key === catKey);
                        return (
                          <button
                            key={catKey}
                            onClick={() => setRentalsCategoryFilter(catKey === rentalsCategoryFilter ? null : catKey)}
                            className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                              rentalsCategoryFilter === catKey
                                ? "border-primary-400 bg-primary-800 text-silver-100"
                                : "border-primary-700 text-slate-400 hover:border-primary-500 hover:text-slate-200"
                            }`}
                          >
                            {catMeta ? `${catMeta.emoji} ${catMeta.label}` : catKey}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <ul className="space-y-3">
                    {filtered.map((r) => (
                      <li key={r.id} className="rounded-lg border border-primary-800 bg-primary-900/40 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-slate-200">
                              {r.memberName} — <span className="font-medium">{r.quantity > 1 ? `${r.quantity}× ` : ""}{r.equipment.name}</span>
                            </p>
                            <p className="text-xs text-slate-400">
                              {r.isFree ? "Gratuit" : `${r.equipment.rentalCost * (r.quantity ?? 1)}€`} ·{" "}
                              <span
                                className={
                                  r.status === "APPROVED"
                                    ? "text-emerald-400"
                                    : r.status === "REJECTED"
                                      ? "text-red-400"
                                      : "text-amber-400"
                                }
                              >
                                {r.status === "APPROVED"
                                  ? "Validée"
                                  : r.status === "REJECTED"
                                    ? "Refusée"
                                    : "En attente"}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs text-slate-300">
                              <input
                                type="checkbox"
                                checked={r.isFree}
                                onChange={(e) => updateRental(ev.id, r.id, { isFree: e.target.checked })}
                                className="h-3.5 w-3.5 rounded border-primary-600 bg-primary-950 accent-primary-400"
                              />
                              Gratuit
                            </label>
                            {r.status !== "APPROVED" && (
                              <button
                                onClick={() => updateRental(ev.id, r.id, { status: "APPROVED" })}
                                className="rounded bg-emerald-950 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-900"
                              >
                                Valider
                              </button>
                            )}
                            {r.status !== "REJECTED" && (
                              <button
                                onClick={() => updateRental(ev.id, r.id, { status: "REJECTED" })}
                                className="rounded bg-red-950 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-900"
                              >
                                Refuser
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </div>
        )}

        {kiosqueFor === ev.id && kiosqueData && (() => {
          const member = kiosqueData.members.find((m) => m.id === kiosqueMemberId) ?? null;
          const cartLines = Object.entries(kiosqueCart)
            .map(([id, qty]) => ({ product: kiosqueData.products.find((p) => p.id === id), qty }))
            .filter((l) => l.product) as { product: KioskProduct; qty: number }[];
          const cartTotal = cartLines.reduce((s, l) => s + l.product.price * l.qty, 0);
          const byCategory: Record<string, KioskProduct[]> = {};
          for (const p of kiosqueData.products) {
            if (!byCategory[p.category]) byCategory[p.category] = [];
            byCategory[p.category].push(p);
          }
          const CATEGORY_LABELS: Record<string, string> = { DRINK: "🥤 Boissons", SNACK: "🍬 Friandises" };

          return (
            <div className="mt-4 rounded-lg border border-primary-700 bg-primary-950/60 p-4 text-sm">
              <p className="mb-3 font-semibold text-silver-100">🛒 Comptoir</p>

              {/* Membres inscrits */}
              <p className="mb-1 text-xs font-medium text-slate-400">Participant</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {kiosqueData.members.length === 0 && (
                  <span className="text-slate-500">Aucun inscrit.</span>
                )}
                {kiosqueData.members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setKiosqueMemberId(m.id); setKiosqueCart({}); setKiosqueError(null); setKiosqueMessage(null); }}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      kiosqueMemberId === m.id
                        ? "border-primary-400 bg-primary-800 text-silver-100"
                        : "border-primary-700 text-slate-300 hover:bg-primary-900"
                    }`}
                  >
                    {m.firstName} {m.name}
                    <span className="ml-1 text-slate-400">({(m.balance / 100).toFixed(2)}€)</span>
                  </button>
                ))}
              </div>

              {/* Produits */}
              {kiosqueData.products.length === 0 ? (
                <p className="text-slate-500">Aucun produit associé à cette activité.</p>
              ) : (
                Object.entries(byCategory).map(([cat, prods]) => (
                  <div key={cat} className="mb-3">
                    <p className="mb-1 text-xs font-medium text-slate-400">{CATEGORY_LABELS[cat] ?? cat}</p>
                    <div className="flex flex-wrap gap-2">
                      {prods.map((p) => {
                        const qty = kiosqueCart[p.id] ?? 0;
                        return (
                          <div key={p.id} className="flex items-center gap-1 rounded-md border border-primary-700 bg-primary-900/40 px-2 py-1">
                            <span className="text-slate-200">{p.name}</span>
                            <span className="text-xs text-slate-400 ml-1">{(p.price / 100).toFixed(2)}€</span>
                            {p.stock === 0 && <span className="text-xs text-red-400 ml-1">Épuisé</span>}
                            {canWrite && p.stock > 0 && kiosqueMemberId && (
                              <>
                                <button onClick={() => kiosqueAddToCart(p.id, -1)} className="ml-2 w-5 h-5 rounded bg-primary-800 text-slate-300 hover:bg-primary-700 text-center leading-5">−</button>
                                <span className="w-4 text-center text-slate-200">{qty}</span>
                                <button onClick={() => kiosqueAddToCart(p.id, 1)} className="w-5 h-5 rounded bg-primary-800 text-slate-300 hover:bg-primary-700 text-center leading-5">+</button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {/* Panier et validation */}
              {canWrite && cartLines.length > 0 && (
                <div className="mt-3 rounded-lg border border-primary-700 bg-primary-900/40 p-3">
                  <p className="text-xs font-medium text-slate-400 mb-1">Panier — {member?.firstName} {member?.name}</p>
                  <ul className="mb-2 space-y-0.5">
                    {cartLines.map((l) => (
                      <li key={l.product.id} className="text-xs text-slate-300">
                        {l.qty}× {l.product.name} — {((l.product.price * l.qty) / 100).toFixed(2)}€
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">Total : {(cartTotal / 100).toFixed(2)}€</span>
                    <button
                      onClick={() => kiosqueConfirmOrder(ev.id)}
                      disabled={kiosqueBusy}
                      className="rounded-md bg-primary-400 px-3 py-1.5 text-xs font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-50"
                    >
                      {kiosqueBusy ? "Enregistrement…" : "Valider"}
                    </button>
                  </div>
                </div>
              )}

              {kiosqueMessage && <p className="mt-2 text-xs text-emerald-400">{kiosqueMessage}</p>}
              {kiosqueError && <p className="mt-2 text-xs text-red-400">{kiosqueError}</p>}
            </div>
          );
        })()}

        {docsFor === ev.id && (
          <div className="mt-4 rounded-lg border border-primary-700 bg-primary-950/60 p-4 text-sm">
            <p className="mb-3 font-semibold text-silver-100">📄 Documents de l'événement</p>

            {/* Linked docs */}
            {eventDocuments.length === 0 ? (
              <p className="text-slate-500">Aucun document associé à cet événement.</p>
            ) : (
              <ul className="mb-3 space-y-1">
                {eventDocuments.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2">
                    <a
                      href={`/api/event-docs/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-300 hover:underline truncate"
                    >
                      {doc.name}
                    </a>
                    {canWrite && (
                      <button
                        onClick={() => unlinkDoc(ev.id, doc.id)}
                        className="flex-shrink-0 text-xs text-red-400 hover:underline"
                      >
                        Retirer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Picker: AssocDocuments not yet linked */}
            {(() => {
              const linkedIds = new Set(eventDocuments.map((d) => d.id));
              const unlinked = availableDocs.filter(
                (d) => !linkedIds.has(d.id) &&
                  (!docFilter || d.name.toLowerCase().includes(docFilter.toLowerCase()))
              );
              return (
                <div className="mt-3 border-t border-primary-700 pt-3">
                  <p className="mb-2 text-xs font-medium text-slate-400">Associer un document de la bibliothèque :</p>
                  {availableDocs.length === 0 ? (
                    <p className="text-xs text-slate-500">Aucun document disponible dans la bibliothèque. <a href="/admin/documents" className="text-primary-300 hover:underline">Ajouter des documents →</a></p>
                  ) : (
                    <>
                      <input
                        value={docFilter}
                        onChange={(e) => setDocFilter(e.target.value)}
                        placeholder="Rechercher un document…"
                        className="mb-2 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                      />
                      {unlinked.length === 0 ? (
                        <p className="text-xs text-slate-500">{docFilter ? "Aucun résultat." : "Tous les documents sont déjà associés."}</p>
                      ) : (
                        <ul className="max-h-40 space-y-1 overflow-y-auto">
                          {unlinked.map((doc) => (
                            <li key={doc.id} className="flex items-center justify-between gap-2">
                              <span className="truncate text-slate-200">{doc.name}
                                {doc.visibility === "PRIVATE" && <span className="ml-1 text-xs text-red-400">🔒</span>}
                              </span>
                              {canWrite && (
                                <button
                                  onClick={() => linkDoc(ev.id, doc.id)}
                                  disabled={docLinking}
                                  className="flex-shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-primary-800 text-primary-200 hover:bg-primary-700 disabled:opacity-50"
                                >
                                  + Associer
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {docError && <p className="mt-2 text-xs text-red-400">{docError}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Événements</h1>

      {canWrite && <form onSubmit={handleSubmit} className="mt-8 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2">
        <h2 className="col-span-full font-display text-lg text-silver-100">
          {form.id ? "Modifier l'événement" : "Créer un événement"}
        </h2>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300">Titre</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300">Description</label>
          <textarea
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Type d'activité</label>
          <select
            value={form.activityType}
            onChange={(e) => setForm({ ...form, activityType: e.target.value })}
            className={inputClass}
          >
            {visibleActivityOptions.map((a) => (
              <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Lieu</label>
          <input
            required
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Début</label>
          <DateInput
            type="datetime-local"
            required
            value={form.startsAt}
            onChange={(v) => setForm({ ...form, startsAt: v })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Fin</label>
          <DateInput
            type="datetime-local"
            required
            value={form.endsAt}
            onChange={(v) => setForm({ ...form, endsAt: v })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Capacité (optionnel)</label>
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Date limite d'inscription (optionnel)
          </label>
          <DateInput
            type="datetime-local"
            value={form.registrationDeadline}
            onChange={(v) => setForm({ ...form, registrationDeadline: v })}
            className={inputClass}
          />
        </div>

        {form.activityType === "JEUX_DE_PLATEAU" && (
          <div className="col-span-full rounded-lg border border-primary-700 bg-primary-950/60 p-4">
            <label className="block text-sm font-medium text-slate-200">
              🎲 Jeux de société prêtés par les membres (optionnel)
            </label>
            {availableGames.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Aucun jeu rendu visible par les membres pour le moment.</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {availableGames.map((game) => (
                  <label
                    key={game.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      game.status !== "DISPONIBLE"
                        ? "border-primary-900 text-slate-500 opacity-60"
                        : "border-primary-700 text-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={game.status !== "DISPONIBLE"}
                      checked={form.boardGameIds.includes(game.id)}
                      onChange={() => toggleBoardGame(game.id)}
                      className={checkboxClass}
                    />
                    <span>
                      <span className="font-medium">{game.name}</span>
                      <span className="ml-1 text-slate-400">
                        — {game.owner.firstName} {game.owner.name} · {game.minPlayers}–{game.maxPlayers} joueurs
                      </span>
                      {game.status !== "DISPONIBLE" && <span className="text-amber-400"> · indisponible</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="col-span-full rounded-lg border border-primary-700 bg-primary-950/60 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <input
              type="checkbox"
              checked={form.hasMeal}
              onChange={(e) => setForm({ ...form, hasMeal: e.target.checked, menus: e.target.checked ? form.menus : [] })}
              className={checkboxClass}
            />
            🍽️ Un repas est proposé pour cet événement (réglé sur place)
          </label>

          {form.hasMeal && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Repas du jour</label>
                <textarea
                  value={form.mealInfo}
                  onChange={(e) => setForm({ ...form, mealInfo: e.target.value })}
                  rows={2}
                  placeholder="Ex: Grillades et accompagnements préparés sur place."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Prix du repas (€/personne)</label>
                <input
                  type="number"
                  min={0}
                  value={form.mealPrice}
                  onChange={(e) => setForm({ ...form, mealPrice: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Le repas comprend également</label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {MEAL_EXTRAS.map((extra) => (
                    <label key={extra.key} className="flex items-center gap-2 rounded-md border border-primary-700 px-3 py-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={form.mealExtras.includes(extra.key)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            mealExtras: e.target.checked
                              ? [...form.mealExtras, extra.key]
                              : form.mealExtras.filter((k) => k !== extra.key),
                          })
                        }
                        className={checkboxClass}
                      />
                      {extra.label}
                    </label>
                  ))}
                </div>
                {(() => {
                  const predefinedKeys = MEAL_EXTRAS.map((e) => e.key as string);
                  const customExtras = form.mealExtras.filter((k) => !predefinedKeys.includes(k));
                  return (
                    <>
                      {customExtras.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {customExtras.map((label) => (
                            <span key={label} className="flex items-center gap-1 rounded-full border border-primary-600 bg-primary-900/60 px-3 py-1 text-xs text-slate-200">
                              {label}
                              <button
                                type="button"
                                onClick={() => setForm({ ...form, mealExtras: form.mealExtras.filter((k) => k !== label) })}
                                className="ml-1 text-slate-400 hover:text-red-400"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={newCustomExtra}
                          onChange={(e) => setNewCustomExtra(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const v = newCustomExtra.trim();
                              if (v && !form.mealExtras.includes(v)) {
                                setForm({ ...form, mealExtras: [...form.mealExtras, v] });
                              }
                              setNewCustomExtra("");
                            }
                          }}
                          placeholder="Ex: Pain, Salade…"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const v = newCustomExtra.trim();
                            if (v && !form.mealExtras.includes(v)) {
                              setForm({ ...form, mealExtras: [...form.mealExtras, v] });
                            }
                            setNewCustomExtra("");
                          }}
                          className="rounded-md border border-primary-700 px-3 py-2 text-sm text-slate-300 hover:bg-primary-900"
                        >
                          + Ajouter
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Menus au choix (optionnel) — avec quantité maximale par personne
                </label>
                <div className="mt-2 space-y-2">
                  {form.menus.map((menu, i) => (
                    <div key={i} className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={menu.label}
                        onChange={(e) => updateMenu(i, "label", e.target.value)}
                        placeholder="Ex: Merguez"
                        className={inputClass}
                      />
                      <input
                        type="number"
                        min={1}
                        value={menu.maxPerPerson}
                        onChange={(e) => updateMenu(i, "maxPerPerson", e.target.value)}
                        placeholder="Max/pers."
                        className={`${inputClass} sm:w-32`}
                      />
                      <button
                        type="button"
                        onClick={() => removeMenu(i)}
                        className="rounded-md border border-primary-700 px-3 py-2 text-red-400 hover:bg-primary-900 sm:border-0 sm:py-0"
                      >
                        ✕ Supprimer
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, menus: [...form.menus, { label: "", maxPerPerson: "" }] })}
                  className="mt-2 rounded-md border border-primary-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-primary-900"
                >
                  + Ajouter un menu
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="col-span-full text-sm text-red-400">{error}</p>}

        <div className="col-span-full flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-400 px-5 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : form.id ? "Mettre à jour" : "Créer l'événement"}
          </button>
          {form.id && (
            <button type="button" onClick={resetForm} className="rounded-md px-5 py-2 font-medium text-slate-300 hover:bg-primary-900">
              Annuler
            </button>
          )}
        </div>
      </form>}

      <h2 className="mt-10 font-display text-xl text-silver-100">À venir</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {upcomingEvents.length === 0 && <p className="text-sm text-slate-400">Aucun événement à venir.</p>}
        {upcomingEvents.map((ev) => renderEventCard(ev, false))}
      </div>

      <button
        onClick={() => setShowHistory((v) => !v)}
        className="mt-10 flex items-center gap-2 font-display text-xl text-silver-100 hover:text-primary-300"
      >
        Historique ({pastEvents.length}) {showHistory ? "▲" : "▼"}
      </button>
      {showHistory && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {pastEvents.length === 0 && <p className="text-sm text-slate-400">Aucun événement passé.</p>}
          {pastEvents.map((ev) => renderEventCard(ev, true))}
        </div>
      )}
    </div>
  );
}

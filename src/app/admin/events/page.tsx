"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAllowedActivityTypes } from "@/lib/permissions";

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
  mealPrice: number;
  registrationDeadline: string | null;
  menus: MenuItem[];
  boardGames: { id: string; name: string }[];
  registrations: {
    id: string;
    wantsMeal: boolean;
    participationFee: number;
    rentals: { status: string; isFree: boolean; equipment: { rentalCost: number } }[];
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

type MenuFormItem = { label: string; maxPerPerson: string };

type Expense = { id: string; label: string; amount: number; createdAt: string };

type Rental = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isFree: boolean;
  memberName: string;
  equipment: { id: string; name: string; rentalCost: number };
};

type EventRegistrationAdmin = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  wantsMeal: boolean;
  memberName: string;
  memberEmail: string;
  createdAt: string;
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
  mealPrice: "10",
  registrationDeadline: "",
  menus: [] as MenuFormItem[],
  boardGameIds: [] as string[],
};

type AvailableGame = { id: string; name: string; minPlayers: number; maxPlayers: number; status: string };

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
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [rentalsFor, setRentalsFor] = useState<string | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [registrationsFor, setRegistrationsFor] = useState<string | null>(null);
  const [eventRegistrations, setEventRegistrations] = useState<EventRegistrationAdmin[]>([]);
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([]);

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
      mealPrice: String(ev.mealPrice ?? 10),
      registrationDeadline: ev.registrationDeadline ? toInputDateTime(ev.registrationDeadline) : "",
      menus: ev.menus.map((m) => ({ label: m.label, maxPerPerson: m.maxPerPerson ? String(m.maxPerPerson) : "" })),
      boardGameIds: ev.boardGames.map((g) => g.id),
    });
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
      return;
    }
    await loadRentals(eventId);
    setRentalsFor(eventId);
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
          {ev.registrations.length}
          {ev.capacity ? ` / ${ev.capacity}` : ""} inscrit(s)
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
          {!isPast && (
            <button
              onClick={() => editEvent(ev)}
              className="rounded-md border border-primary-700 px-3 py-1.5 text-primary-300 hover:bg-primary-800/60"
            >
              Modifier
            </button>
          )}
          <button
            onClick={() => removeEvent(ev.id)}
            className="rounded-md border border-red-900 px-3 py-1.5 text-red-400 hover:bg-red-950/40"
          >
            Supprimer
          </button>
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
                        <p className="font-medium text-slate-200">{r.memberName}</p>
                        <p className="text-xs text-slate-400">
                          {r.memberEmail}
                          {r.wantsMeal && " · 🍽️ repas"}
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
                        </p>
                      </div>
                      <div className="flex gap-2">
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
                    .reduce((s, rt) => s + (rt.isFree ? 0 : rt.equipment.rentalCost), 0),
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
                  <button
                    onClick={() => removeExpense(ev.id, exp.id)}
                    className="text-red-400 hover:underline"
                  >
                    Supprimer
                  </button>
                </li>
              ))}
              {expenses.length === 0 && <li className="text-slate-500">Aucune dépense enregistrée.</li>}
            </ul>

            <div className="mt-3 flex gap-2">
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
                className={`${inputClass} w-32`}
              />
              <button
                onClick={() => addExpense(ev.id)}
                className="rounded-md bg-primary-400 px-3 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300"
              >
                Ajouter
              </button>
            </div>
          </div>
        )}

        {rentalsFor === ev.id && (
          <div className="mt-4 rounded-lg border border-primary-700 bg-primary-950/60 p-4 text-sm">
            {rentals.length === 0 ? (
              <p className="text-slate-500">Aucune demande de location pour cet événement.</p>
            ) : (
              <ul className="space-y-3">
                {rentals.map((r) => (
                  <li key={r.id} className="rounded-lg border border-primary-800 bg-primary-900/40 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-200">
                          {r.memberName} — <span className="font-medium">{r.equipment.name}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          {r.isFree ? "Gratuit" : `${r.equipment.rentalCost}€`} ·{" "}
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
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Événements</h1>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2">
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
          <input
            type="datetime-local"
            required
            value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Fin</label>
          <input
            type="datetime-local"
            required
            value={form.endsAt}
            onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
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
          <input
            type="datetime-local"
            value={form.registrationDeadline}
            onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
            className={inputClass}
          />
        </div>

        {form.activityType === "JEUX_DE_PLATEAU" && (
          <div className="col-span-full rounded-lg border border-primary-700 bg-primary-950/60 p-4">
            <label className="block text-sm font-medium text-slate-200">
              🎲 Jeux de société prêtés par les membres (optionnel)
            </label>
            {availableGames.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Aucun jeu enregistré dans le stock pour le moment.</p>
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
                    {game.name} ({game.minPlayers}-{game.maxPlayers} joueurs)
                    {game.status !== "DISPONIBLE" && " — indisponible"}
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
      </form>

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

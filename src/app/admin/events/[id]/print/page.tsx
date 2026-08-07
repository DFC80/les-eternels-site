export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import PrintTrigger from "./PrintTrigger";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: { title: true, startsAt: true },
  });
  if (!event) return { title: "Événement" };
  const date = event.startsAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return { title: `${event.title} ${date}` };
}

const ACTIVITY_LABELS: Record<string, string> = {
  JEUX_DE_PLATEAU: "Jeux de plateau",
  JDR: "Jeu de rôle",
  AIRSOFT: "Airsoft",
  AUTRE: "Autre",
};

function fmt(date: Date) {
  return date.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Validée",
  REJECTED: "Refusée",
};

const RENTAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvée",
  REJECTED: "Refusée",
};

export default async function PrintEventPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "events"))) {
    redirect("/login");
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      menus: true,
      boardGames: true,
      registrations: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { firstName: true, name: true, email: true } },
          mealOrders: { include: { menu: true } },
          rentals: {
            include: { equipment: { select: { name: true, rentalCost: true } } },
          },
        },
      },
      expenses: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!event) notFound();

  const approved = event.registrations.filter((r) => r.status === "APPROVED");
  const pending = event.registrations.filter((r) => r.status === "PENDING");
  const rejected = event.registrations.filter((r) => r.status === "REJECTED");

  const diners = event.registrations.filter((r) => r.wantsMeal);

  const byMenu = event.menus.map((menu) => ({
    label: menu.label,
    count: diners.reduce(
      (sum, r) => sum + r.mealOrders.filter((o) => o.menuId === menu.id).reduce((s, o) => s + o.quantity, 0),
      0
    ),
  }));
  const withoutMenuCount = diners.reduce(
    (sum, r) => sum + r.mealOrders.filter((o) => !o.menuId).reduce((s, o) => s + o.quantity, 0),
    0
  );

  const allRentals = event.registrations.flatMap((r) =>
    r.rentals.map((rental) => ({
      memberName: `${r.user.firstName} ${r.user.name}`,
      equipment: rental.equipment.name,
      rentalCost: rental.isFree ? 0 : rental.equipment.rentalCost,
      status: rental.status,
      isFree: rental.isFree,
    }))
  );

  const mealIncome = diners.length * event.mealPrice;
  const participationIncome = Math.round(
    event.registrations.reduce((sum, r) => sum + (r.participationFee ?? 0), 0) / 100
  );
  const rentalIncome = allRentals
    .filter((r) => r.status === "APPROVED")
    .reduce((sum, r) => sum + r.rentalCost, 0);
  const totalIncome = mealIncome + participationIncome + rentalIncome;
  const totalExpenses = event.expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpenses;

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; color: black; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          h2 { page-break-before: auto; }
          .section { page-break-inside: avoid; }
        }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: white; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        h2 { font-size: 14px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 4px; margin: 20px 0 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #eee; text-align: left; padding: 5px 8px; font-size: 12px; }
        td { padding: 4px 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
        .meta { color: #555; font-size: 12px; margin-bottom: 4px; }
        .badge-approved { color: #16a34a; font-weight: bold; }
        .badge-pending { color: #d97706; }
        .badge-rejected { color: #dc2626; }
        .tag { display: inline-block; background: #eee; border-radius: 4px; padding: 1px 6px; font-size: 11px; margin-right: 4px; }
        .total-row td { font-weight: bold; border-top: 2px solid #999; background: #f5f5f5; }
        .balance-positive { color: #16a34a; font-weight: bold; }
        .balance-negative { color: #dc2626; font-weight: bold; }
        .header-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #333; padding-bottom: 12px; margin-bottom: 4px; }
        .header-meta { text-align: right; font-size: 12px; color: #555; }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px" }}>
        {/* Header */}
        <div className="header-bar">
          <div>
            <div className="meta">Les Éternels — {ACTIVITY_LABELS[event.activityType] ?? event.activityType}</div>
            <h1>{event.title}</h1>
            <div className="meta">📅 {fmt(event.startsAt)} → {fmt(event.endsAt)}</div>
            <div className="meta">📍 {event.location}</div>
            {event.registrationDeadline && (
              <div className="meta">Date limite d&apos;inscription : {fmtDate(event.registrationDeadline)}</div>
            )}
          </div>
          <div className="header-meta">
            <div>Imprimé le {fmtDate(new Date())}</div>
            {event.capacity && <div>Capacité : {event.registrations.length} / {event.capacity}</div>}
          </div>
        </div>

        {event.description && (
          <p style={{ marginBottom: 12, fontSize: 12, color: "#444" }}>{event.description}</p>
        )}

        {/* Inscrits */}
        <h2>Inscrits ({event.registrations.length})</h2>
        {event.registrations.length === 0 ? (
          <p className="meta">Aucune inscription.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Statut</th>
                {event.hasMeal && <th>Repas</th>}
                <th>Date inscription</th>
              </tr>
            </thead>
            <tbody>
              {[...approved, ...pending, ...rejected].map((r) => (
                <tr key={r.id}>
                  <td>{r.user.firstName} {r.user.name}</td>
                  <td>{r.user.email}</td>
                  <td className={`badge-${r.status.toLowerCase()}`}>{STATUS_LABELS[r.status]}</td>
                  {event.hasMeal && <td>{r.wantsMeal ? "✓" : "—"}</td>}
                  <td>{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Repas */}
        {event.hasMeal && (() => {
          const EXTRAS_LABELS: Record<string, string> = {
            softs: "🥤 Boissons softs",
            beer: "🍺 Bières (1€ / verre ou canette)",
            cheese: "🧀 Fromage",
            dessert: "🍮 Dessert",
          };
          const extras = event.mealExtras ? event.mealExtras.split(",").filter(Boolean) : [];
          return extras.length > 0 ? (
            <p style={{ fontSize: 12, color: "#555", margin: "4px 0 0" }}>
              Comprend également : {extras.map((k) => EXTRAS_LABELS[k] ?? k).join(" · ")}
            </p>
          ) : null;
        })()}
        {event.hasMeal && (
          <>
            <h2>Repas — {diners.length} convive{diners.length > 1 ? "s" : ""} ({event.mealPrice}€/pers.)</h2>
            {diners.length === 0 ? (
              <p className="meta">Aucune commande repas.</p>
            ) : (
              <>
                <table style={{ marginBottom: 12 }}>
                  <thead>
                    <tr><th>Menu</th><th>Quantité</th></tr>
                  </thead>
                  <tbody>
                    {byMenu.filter((m) => m.count > 0).map((m) => (
                      <tr key={m.label}><td>{m.label}</td><td>{m.count}</td></tr>
                    ))}
                    {withoutMenuCount > 0 && (
                      <tr>
                        <td>Repas (inscription avant ajout des menus)</td>
                        <td>{withoutMenuCount}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <table>
                  <thead>
                    <tr><th>Convive</th><th>Commande</th><th>Intolérances</th></tr>
                  </thead>
                  <tbody>
                    {diners.map((r) => {
                      const consolidated = r.mealOrders.reduce((acc, o) => {
                        const key = o.menuId ?? "__null__";
                        acc[key] = { label: o.menu?.label ?? "Repas", qty: (acc[key]?.qty ?? 0) + o.quantity };
                        return acc;
                      }, {} as Record<string, { label: string; qty: number }>);
                      return (
                        <tr key={r.id}>
                          <td>{r.user.firstName} {r.user.name}</td>
                          <td>
                            {Object.values(consolidated).map(({ label, qty }) => (
                              <span key={label} className="tag">{qty}× {label}</span>
                            ))}
                          </td>
                          <td style={{ color: r.mealNotes ? "#b45309" : "#999" }}>
                            {r.mealNotes ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {/* Locations */}
        {allRentals.length > 0 && (
          <>
            <h2>Locations de matériel ({allRentals.length})</h2>
            <table>
              <thead>
                <tr><th>Membre</th><th>Matériel</th><th>Tarif</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {allRentals.map((r, i) => (
                  <tr key={i}>
                    <td>{r.memberName}</td>
                    <td>{r.equipment}</td>
                    <td>{r.isFree ? "Gratuit" : `${r.rentalCost}€`}</td>
                    <td className={`badge-${r.status.toLowerCase()}`}>{RENTAL_STATUS_LABELS[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Finances */}
        <h2>Finances</h2>
        <table>
          <thead>
            <tr><th>Poste</th><th style={{ textAlign: "right" }}>Montant</th></tr>
          </thead>
          <tbody>
            {mealIncome > 0 && (
              <tr><td>Repas ({diners.length} × {event.mealPrice}€)</td><td style={{ textAlign: "right" }}>{mealIncome}€</td></tr>
            )}
            {participationIncome > 0 && (
              <tr><td>Participations invités</td><td style={{ textAlign: "right" }}>{participationIncome}€</td></tr>
            )}
            {rentalIncome > 0 && (
              <tr><td>Locations approuvées</td><td style={{ textAlign: "right" }}>{rentalIncome}€</td></tr>
            )}
            <tr className="total-row">
              <td>Total revenus</td>
              <td style={{ textAlign: "right" }}>{totalIncome}€</td>
            </tr>
            {event.expenses.map((e) => (
              <tr key={e.id}>
                <td style={{ color: "#dc2626" }}>— {e.label}</td>
                <td style={{ textAlign: "right", color: "#dc2626" }}>−{e.amount}€</td>
              </tr>
            ))}
            {event.expenses.length > 0 && (
              <tr className="total-row">
                <td>Total dépenses</td>
                <td style={{ textAlign: "right" }}>−{totalExpenses}€</td>
              </tr>
            )}
            <tr className="total-row">
              <td>Bilan net</td>
              <td style={{ textAlign: "right" }} className={balance >= 0 ? "balance-positive" : "balance-negative"}>
                {balance >= 0 ? "+" : ""}{balance}€
              </td>
            </tr>
          </tbody>
        </table>

        {/* Jeux de plateau */}
        {event.boardGames.length > 0 && (
          <>
            <h2>Jeux de plateau ({event.boardGames.length})</h2>
            <p style={{ fontSize: 12 }}>{event.boardGames.map((g) => g.name).join(", ")}</p>
          </>
        )}
      </div>
    </>
  );
}

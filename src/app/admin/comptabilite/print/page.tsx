export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import PrintTrigger from "./PrintTrigger";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Comptabilité — Les Éternels" };

function fmtDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtEuros(amount: number): string {
  return (amount % 1 === 0 ? amount.toString() : amount.toFixed(2).replace(".", ",")) + "€";
}

function fmtCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + "€";
}

export default async function PrintComptabilitePage() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "comptabilite")) redirect("/login");

  const events = await prisma.event.findMany({
    orderBy: { startsAt: "desc" },
    include: {
      registrations: {
        include: { rentals: { where: { status: "APPROVED" }, include: { equipment: true } } },
      },
      expenses: { orderBy: { createdAt: "asc" } },
    },
  });

  const generalExpenses = await prisma.generalExpense.findMany({ orderBy: { date: "desc" } });
  const generalCredits = await prisma.generalCredit.findMany({ orderBy: { date: "desc" } });

  const paidMemberships = await prisma.membership.findMany({
    where: { isPaid: true },
    include: { user: { select: { firstName: true, name: true } } },
    orderBy: { paidAt: "desc" },
  });

  const balanceTopUps = await prisma.balanceTopUp.findMany({
    include: { user: { select: { firstName: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const eventSummaries = events.map((ev) => {
    const mealIncome = ev.hasMeal ? ev.registrations.filter((r) => r.wantsMeal).length * ev.mealPrice : 0;
    const equipmentIncome = ev.registrations.reduce(
      (sum, r) => sum + r.rentals.reduce((s, rental) => s + (rental.isFree ? 0 : rental.equipment.rentalCost * (rental.quantity ?? 1)), 0),
      0
    );
    const participationIncome = Math.round(
      ev.registrations.reduce((sum, r) => sum + (r.participationFee ?? 0), 0) / 100
    );
    const income = mealIncome + equipmentIncome + participationIncome;
    const expensesTotal = ev.expenses.reduce((sum, e) => sum + e.amount, 0);
    return {
      eventId: ev.id,
      title: ev.title,
      startsAt: ev.startsAt,
      mealIncome,
      equipmentIncome,
      participationIncome,
      income,
      expensesTotal,
      profit: income - expensesTotal,
      expenses: ev.expenses,
    };
  });

  const totalMembershipIncome = paidMemberships.reduce((sum, m) => sum + m.amount, 0);
  const totalEventIncome = eventSummaries.reduce((sum, e) => sum + e.income, 0);
  const totalEventExpenses = eventSummaries.reduce((sum, e) => sum + e.expensesTotal, 0);
  const totalGeneralExpenses = generalExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalGeneralCredits = generalCredits.reduce((sum, c) => sum + c.amount, 0);
  const totalBalanceTopUps = balanceTopUps.reduce((sum, t) => sum + t.amount, 0);
  const netResultCents =
    Math.round((totalMembershipIncome + totalEventIncome + totalGeneralCredits - totalEventExpenses - totalGeneralExpenses) * 100) +
    totalBalanceTopUps;

  const printDate = fmtDate(new Date());

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white !important; color: black !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          h2 { page-break-before: auto; }
          .section { page-break-inside: avoid; }
        }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a !important; background: white !important; color-scheme: light; }
        h1 { font-size: 22px; margin: 0 0 4px; color: #1a1a1a !important; }
        h2 { font-size: 14px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 4px; margin: 20px 0 10px; color: #1a1a1a !important; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #eee !important; color: #1a1a1a !important; text-align: left; padding: 5px 8px; font-size: 12px; }
        td { background: white !important; color: #1a1a1a !important; padding: 4px 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
        .meta { color: #555 !important; font-size: 12px; margin-bottom: 4px; }
        .total-row td { font-weight: bold; border-top: 2px solid #999; background: #f5f5f5 !important; color: #1a1a1a !important; }
        .positive { color: #16a34a !important; font-weight: bold; }
        .negative { color: #dc2626 !important; font-weight: bold; }
        .neutral { color: #555 !important; }
        .header-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #333; padding-bottom: 12px; margin-bottom: 4px; }
        .header-meta { text-align: right; font-size: 12px; color: #555 !important; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
        .summary-card { border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; text-align: center; background: #fafafa !important; }
        .summary-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #666 !important; }
        .summary-card .value { font-size: 18px; font-weight: bold; margin-top: 2px; }
        .summary-card.net { border: 2px solid #333; background: #f0f0f0 !important; }
        .result-box { border: 2px solid #333; border-radius: 6px; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; background: #f0f0f0 !important; margin-top: 20px; }
        .result-box .result-label { font-size: 14px; font-weight: bold; color: #1a1a1a !important; }
        .result-box .result-value { font-size: 24px; font-weight: bold; }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px" }}>

        <div className="header-bar">
          <div>
            <div className="meta">Les Éternels — Bilan comptable</div>
            <h1>Comptabilité complète</h1>
          </div>
          <div className="header-meta">
            <div>Imprimé le {printDate}</div>
          </div>
        </div>

        {/* Résumé des totaux */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="label">Cotisations</div>
            <div className="value positive">{fmtEuros(totalMembershipIncome)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Gains événements</div>
            <div className="value positive">{fmtEuros(totalEventIncome)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Recharges solde</div>
            <div className="value positive">{fmtCents(totalBalanceTopUps)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Crédits divers</div>
            <div className="value positive">{fmtEuros(totalGeneralCredits)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Dépenses événements</div>
            <div className="value negative">{fmtEuros(totalEventExpenses)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Dépenses générales</div>
            <div className="value negative">{fmtEuros(totalGeneralExpenses)}</div>
          </div>
          <div className="summary-card net" style={{ gridColumn: "span 2" }}>
            <div className="label">Résultat net</div>
            <div className={`value ${netResultCents >= 0 ? "positive" : "negative"}`}>
              {netResultCents >= 0 ? "+" : ""}{fmtCents(netResultCents)}
            </div>
          </div>
        </div>

        {/* Cotisations encaissées */}
        <h2>Cotisations encaissées ({paidMemberships.length})</h2>
        {paidMemberships.length === 0 ? (
          <p className="meta">Aucune cotisation encaissée.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Membre</th>
                <th style={{ width: 60 }}>Saison</th>
                <th style={{ width: 80, textAlign: "right" }}>Montant</th>
                <th style={{ width: 110 }}>Date de paiement</th>
              </tr>
            </thead>
            <tbody>
              {paidMemberships.map((m) => (
                <tr key={m.id}>
                  <td>{m.user.firstName} {m.user.name}</td>
                  <td style={{ color: "#666" }}>{m.year}</td>
                  <td style={{ textAlign: "right" }}>{m.amount}€</td>
                  <td style={{ color: "#666" }}>{m.paidAt ? fmtDate(m.paidAt) : "—"}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={2}>Total</td>
                <td style={{ textAlign: "right" }}>{fmtEuros(totalMembershipIncome)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}

        {/* Recharges de solde */}
        {balanceTopUps.length > 0 && (
          <>
            <h2>Recharges de solde adhérent ({balanceTopUps.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Membre</th>
                  <th style={{ width: 100, textAlign: "right" }}>Montant rechargé</th>
                  <th style={{ width: 130 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {balanceTopUps.map((t) => (
                  <tr key={t.id}>
                    <td>{t.user.firstName} {t.user.name}</td>
                    <td style={{ textAlign: "right" }}>{fmtCents(t.amount)}</td>
                    <td style={{ color: "#666" }}>{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Total</td>
                  <td style={{ textAlign: "right" }}>{fmtCents(totalBalanceTopUps)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* Détail par événement */}
        <h2>Détail par événement</h2>
        {eventSummaries.filter((e) => e.income > 0 || e.expensesTotal > 0).length === 0 ? (
          <p className="meta">Aucun événement avec données financières.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Événement</th>
                <th style={{ width: 80 }}>Date</th>
                <th style={{ width: 55, textAlign: "right" }}>Repas</th>
                <th style={{ width: 65, textAlign: "right" }}>Matériel</th>
                <th style={{ width: 80, textAlign: "right" }}>Participations</th>
                <th style={{ width: 70, textAlign: "right" }}>Gains</th>
                <th style={{ width: 70, textAlign: "right" }}>Dépenses</th>
                <th style={{ width: 70, textAlign: "right" }}>Résultat</th>
              </tr>
            </thead>
            <tbody>
              {eventSummaries
                .filter((e) => e.income > 0 || e.expensesTotal > 0)
                .map((ev) => (
                  <tr key={ev.eventId}>
                    <td>{ev.title}</td>
                    <td style={{ color: "#666", fontSize: 11 }}>{fmtDate(ev.startsAt)}</td>
                    <td style={{ textAlign: "right", color: "#666" }}>{ev.mealIncome > 0 ? `${ev.mealIncome}€` : "—"}</td>
                    <td style={{ textAlign: "right", color: "#666" }}>{ev.equipmentIncome > 0 ? `${ev.equipmentIncome}€` : "—"}</td>
                    <td style={{ textAlign: "right", color: "#666" }}>{ev.participationIncome > 0 ? `${ev.participationIncome}€` : "—"}</td>
                    <td style={{ textAlign: "right" }}>{ev.income}€</td>
                    <td style={{ textAlign: "right" }}>{ev.expensesTotal > 0 ? `${ev.expensesTotal}€` : "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: "bold" }}
                        className={ev.profit >= 0 ? "positive" : "negative"}>
                      {ev.profit >= 0 ? "+" : ""}{ev.profit}€
                    </td>
                  </tr>
                ))}
              <tr className="total-row">
                <td colSpan={5}>Total</td>
                <td style={{ textAlign: "right" }}>{fmtEuros(totalEventIncome)}</td>
                <td style={{ textAlign: "right" }}>{fmtEuros(totalEventExpenses)}</td>
                <td style={{ textAlign: "right" }}
                    className={(totalEventIncome - totalEventExpenses) >= 0 ? "positive" : "negative"}>
                  {(totalEventIncome - totalEventExpenses) >= 0 ? "+" : ""}
                  {fmtEuros(totalEventIncome - totalEventExpenses)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Dépenses générales */}
        <h2>Dépenses générales</h2>
        <p className="meta">Frais non liés à un événement (terrain, assurance, matériel...)</p>
        {generalExpenses.length === 0 ? (
          <p className="meta">Aucune dépense générale enregistrée.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Libellé</th>
                <th style={{ width: 100, textAlign: "right" }}>Montant</th>
                <th style={{ width: 110 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {generalExpenses.map((exp) => (
                <tr key={exp.id}>
                  <td>{exp.label}</td>
                  <td style={{ textAlign: "right", color: "#dc2626" }}>−{fmtEuros(exp.amount)}</td>
                  <td style={{ color: "#666" }}>{fmtDate(exp.date)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total</td>
                <td style={{ textAlign: "right", color: "#dc2626" }}>−{fmtEuros(totalGeneralExpenses)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}

        {/* Crédits divers */}
        {generalCredits.length > 0 && (
          <>
            <h2>Crédits divers</h2>
            <p className="meta">Recettes ponctuelles (subvention, don, remboursement...)</p>
            <table>
              <thead>
                <tr>
                  <th>Libellé</th>
                  <th style={{ width: 100, textAlign: "right" }}>Montant</th>
                  <th style={{ width: 110 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {generalCredits.map((cr) => (
                  <tr key={cr.id}>
                    <td>{cr.label}</td>
                    <td style={{ textAlign: "right" }} className="positive">+{fmtEuros(cr.amount)}</td>
                    <td style={{ color: "#666" }}>{fmtDate(cr.date)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Total</td>
                  <td style={{ textAlign: "right" }} className="positive">+{fmtEuros(totalGeneralCredits)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* Résultat net */}
        <div className="result-box">
          <div className="result-label">Résultat net global</div>
          <div className={`result-value ${netResultCents >= 0 ? "positive" : "negative"}`}>
            {netResultCents >= 0 ? "+" : ""}{fmtCents(netResultCents)}
          </div>
        </div>
      </div>
    </>
  );
}

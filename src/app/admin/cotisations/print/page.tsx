export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { seasonLabel } from "@/lib/membership";
import PrintTrigger from "./PrintTrigger";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cotisations — Les Éternels" };

function fmtDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function PrintCotisationsPage({ searchParams }: { searchParams: { saison?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "members")) {
    redirect("/login");
  }

  const allYears = await prisma.membership.findMany({
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });
  const years = allYears.map((r) => r.year);

  const selectedYear = searchParams.saison ? parseInt(searchParams.saison, 10) : (years[0] ?? null);

  const users = await prisma.user.findMany({
    where: { membership: { isNot: null, ...(selectedYear !== null ? { year: selectedYear } : {}) } },
    select: {
      firstName: true,
      name: true,
      email: true,
      membership: {
        include: { extraActivities: true },
      },
    },
    orderBy: [{ name: "asc" }, { firstName: "asc" }],
  });

  const activities = await prisma.activity.findMany({
    select: { key: true, label: true },
  });
  const activityMap = Object.fromEntries(activities.map((a) => [a.key, a]));

  function memberActivities(m: NonNullable<(typeof users)[0]["membership"]>): string[] {
    const labels: string[] = [];
    if (m.wantsBoardGames) labels.push("Jeux de plateau");
    if (m.wantsRolePlay) labels.push("Jeu de rôle");
    if (m.wantsAirsoft) labels.push("Airsoft");
    for (const ea of m.extraActivities) {
      const act = activityMap[ea.activityKey];
      if (act) labels.push(act.label);
    }
    return labels;
  }

  const paid = users.filter((u) => u.membership?.isPaid);
  const unpaid = users.filter((u) => !u.membership?.isPaid);
  const totalPaid = paid.reduce((s, u) => s + (u.membership?.amount ?? 0), 0);
  const totalUnpaid = unpaid.reduce((s, u) => s + (u.membership?.amount ?? 0), 0);

  const MemberTable = ({ list, showPaid }: { list: typeof users; showPaid: boolean }) => (
    <table>
      <thead>
        <tr>
          <th style={{ width: 28 }}>#</th>
          <th>Membre</th>
          <th style={{ width: 80 }}>Saison</th>
          <th>Type d&apos;adhésion</th>
          <th style={{ width: 80, textAlign: "right" }}>Montant</th>
          <th style={{ width: 90, textAlign: "center" }}>Statut</th>
        </tr>
      </thead>
      <tbody>
        {list.map((u, i) => {
          const ms = u.membership!;
          const acts = memberActivities(ms);
          return (
            <tr key={u.email}>
              <td style={{ color: "#aaa" }}>{i + 1}</td>
              <td>{u.firstName} {u.name}</td>
              <td style={{ fontSize: 11 }}>{seasonLabel(ms.year)}</td>
              <td style={{ fontSize: 11 }}>{acts.length > 0 ? acts.join(" · ") : "—"}</td>
              <td style={{ textAlign: "right" }}>{ms.amount}€</td>
              <td style={{ textAlign: "center" }} className={showPaid ? "badge-paid" : "badge-unpaid"}>
                {showPaid ? "Payée" : "En attente"}
              </td>
            </tr>
          );
        })}
        <tr className="total-row">
          <td colSpan={4}>{showPaid ? "Total encaissé" : "Total attendu"}</td>
          <td style={{ textAlign: "right" }}>{showPaid ? totalPaid : totalUnpaid}€</td>
          <td />
        </tr>
      </tbody>
    </table>
  );

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
        }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: white; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        h2 { font-size: 14px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 4px; margin: 20px 0 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #eee; text-align: left; padding: 5px 8px; font-size: 12px; }
        td { padding: 4px 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
        .meta { color: #555; font-size: 12px; margin-bottom: 4px; }
        .badge-paid { color: #16a34a; font-weight: bold; }
        .badge-unpaid { color: #d97706; }
        .total-row td { font-weight: bold; border-top: 2px solid #999; background: #f5f5f5; }
        .header-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #333; padding-bottom: 12px; margin-bottom: 4px; }
        .header-meta { text-align: right; font-size: 12px; color: #555; }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px" }}>
        <form method="get" className="no-print" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <label htmlFor="saison" style={{ fontSize: 13, fontWeight: "bold" }}>Saison :</label>
          <select
            id="saison"
            name="saison"
            defaultValue={selectedYear ?? ""}
            style={{ fontSize: 13, padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4 }}
          >
            {years.map((y) => (
              <option key={y} value={y}>{seasonLabel(y)}</option>
            ))}
          </select>
          <button type="submit" style={{ fontSize: 13, padding: "4px 12px", background: "#6366f1", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Filtrer
          </button>
        </form>

        <div className="header-bar">
          <div>
            <div className="meta">Les Éternels — Cotisations {selectedYear ? seasonLabel(selectedYear) : ""}</div>
            <h1>Liste des adhérents</h1>
          </div>
          <div className="header-meta">
            <div>Imprimé le {fmtDate(new Date())}</div>
            <div>{users.length} adhérent{users.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        <h2>Cotisations payées ({paid.length})</h2>
        {paid.length === 0
          ? <p className="meta">Aucune cotisation payée.</p>
          : <MemberTable list={paid} showPaid={true} />
        }

        <h2>Cotisations en attente de paiement ({unpaid.length})</h2>
        {unpaid.length === 0
          ? <p className="meta">Aucune cotisation en attente.</p>
          : <MemberTable list={unpaid} showPaid={false} />
        }

        <h2>Récapitulatif</h2>
        <table>
          <thead>
            <tr>
              <th>Poste</th>
              <th style={{ textAlign: "right" }}>Montant</th>
              <th style={{ textAlign: "right", width: 100 }}>Adhérents</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cotisations payées</td>
              <td style={{ textAlign: "right" }}>{totalPaid}€</td>
              <td style={{ textAlign: "right" }}>{paid.length}</td>
            </tr>
            <tr>
              <td>Cotisations en attente</td>
              <td style={{ textAlign: "right" }}>{totalUnpaid}€</td>
              <td style={{ textAlign: "right" }}>{unpaid.length}</td>
            </tr>
            <tr className="total-row">
              <td>Total</td>
              <td style={{ textAlign: "right" }}>{totalPaid + totalUnpaid}€</td>
              <td style={{ textAlign: "right" }}>{users.length}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

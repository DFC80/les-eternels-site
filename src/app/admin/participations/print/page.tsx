export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import PrintTrigger from "./PrintTrigger";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Participations — Les Éternels" };

const ACTIVITY_LABELS: Record<string, string> = {
  AIRSOFT: "Airsoft",
  JEUX_DE_PLATEAU: "Jeux de plateau",
  JEUX_DE_ROLE: "Jeux de rôle",
  AUTRE: "Autre",
};

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Approuvé",
  PENDING: "En attente",
  REJECTED: "Refusé",
};

function fmtDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function PrintParticipationsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "events")) {
    redirect("/login");
  }

  const statusFilter = searchParams.status && searchParams.status !== "ALL"
    ? searchParams.status
    : undefined;

  const registrations = await prisma.eventRegistration.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: {
      user: { select: { id: true, firstName: true, name: true, email: true } },
      event: { select: { id: true, title: true, startsAt: true, activityType: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { user: { firstName: "asc" } }, { event: { startsAt: "desc" } }],
  });

  // Group by user
  type Reg = typeof registrations[0];
  const byUser = new Map<string, { user: Reg["user"]; regs: Reg[] }>();
  for (const r of registrations) {
    const uid = r.user.id;
    if (!byUser.has(uid)) byUser.set(uid, { user: r.user, regs: [] });
    byUser.get(uid)!.regs.push(r);
  }
  const grouped = [...byUser.values()];

  const totalRegs = registrations.length;
  const statuses = ["ALL", "APPROVED", "PENDING", "REJECTED"];

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white !important; color: black !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          .member-section { page-break-inside: avoid; }
          h2 { page-break-before: auto; }
        }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a !important; background: white !important; color-scheme: light; }
        h1 { font-size: 20px; margin: 0 0 4px; color: #1a1a1a !important; }
        h2 { font-size: 13px; font-weight: bold; margin: 18px 0 6px; color: #1a1a1a !important; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        th { background: #eee !important; color: #1a1a1a !important; text-align: left; padding: 4px 8px; font-size: 11px; }
        td { background: white !important; color: #1a1a1a !important; padding: 3px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
        .meta { color: #555; font-size: 12px; margin-bottom: 4px; }
        .badge-approved { color: #16a34a !important; font-weight: bold; }
        .badge-pending { color: #d97706 !important; }
        .badge-rejected { color: #dc2626 !important; }
        .header-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
        .header-meta { text-align: right; font-size: 12px; color: #555; }
        .member-count { font-size: 11px; color: #666; margin-left: 6px; }
        .filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px" }}>
        {/* Filter bar (no-print) */}
        <form method="get" className="no-print filter-bar">
          <label htmlFor="status" style={{ fontSize: 13, fontWeight: "bold" }}>Statut :</label>
          <select
            id="status"
            name="status"
            defaultValue={searchParams.status ?? "ALL"}
            style={{ fontSize: 13, padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4 }}
          >
            <option value="ALL">Tous</option>
            <option value="APPROVED">Approuvé</option>
            <option value="PENDING">En attente</option>
            <option value="REJECTED">Refusé</option>
          </select>
          <button
            type="submit"
            style={{ fontSize: 13, padding: "4px 12px", background: "#6366f1", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            Filtrer
          </button>
        </form>

        {/* Header */}
        <div className="header-bar">
          <div>
            <p className="meta">Les Éternels — Participations aux événements</p>
            <h1>Liste des participations</h1>
            {statusFilter && (
              <p className="meta">Filtre : {STATUS_LABELS[statusFilter] ?? statusFilter}</p>
            )}
          </div>
          <div className="header-meta">
            <div>Imprimé le {fmtDate(new Date())}</div>
            <div>{grouped.length} membre{grouped.length !== 1 ? "s" : ""} · {totalRegs} inscription{totalRegs !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {grouped.length === 0 ? (
          <p className="meta">Aucune participation trouvée.</p>
        ) : (
          grouped.map(({ user, regs }) => (
            <div key={user.id} className="member-section">
              <h2>
                {user.firstName} {user.name}
                <span className="member-count">— {user.email} — {regs.length} inscription{regs.length !== 1 ? "s" : ""}</span>
              </h2>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>#</th>
                    <th>Événement</th>
                    <th style={{ width: 90 }}>Date</th>
                    <th style={{ width: 120 }}>Activité</th>
                    <th style={{ width: 90 }}>Statut</th>
                    <th style={{ width: 50, textAlign: "center" }}>Repas</th>
                    <th style={{ width: 50, textAlign: "center" }}>Essai</th>
                    <th style={{ width: 50, textAlign: "center" }}>Payé</th>
                  </tr>
                </thead>
                <tbody>
                  {regs.map((r, i) => (
                    <tr key={r.id}>
                      <td style={{ color: "#aaa" }}>{i + 1}</td>
                      <td>{r.event.title}</td>
                      <td>{fmtDate(r.event.startsAt)}</td>
                      <td>{ACTIVITY_LABELS[r.event.activityType] ?? r.event.activityType}</td>
                      <td className={`badge-${r.status.toLowerCase()}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </td>
                      <td style={{ textAlign: "center" }}>{r.wantsMeal ? "✓" : "—"}</td>
                      <td style={{ textAlign: "center" }}>{r.isTrialDay ? "✓" : "—"}</td>
                      <td style={{ textAlign: "center" }}>{r.isPaid ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </>
  );
}

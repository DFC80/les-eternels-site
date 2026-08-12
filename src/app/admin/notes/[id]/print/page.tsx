export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import PrintTrigger from "./PrintTrigger";

export default async function PrintNotePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) redirect("/login");

  const note = await prisma.adminNote.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { position: "asc" } } },
  });

  if (!note) notFound();

  const printDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; color: black; }
        }
        body { font-family: Georgia, serif; margin: 0; padding: 0; background: white; color: #111; }
        .container { max-width: 680px; margin: 40px auto; padding: 0 24px; }
        h1 { font-size: 24px; margin: 0 0 6px; }
        .meta { font-size: 12px; color: #666; margin-bottom: 24px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px;
                 background: #e5e7eb; color: #374151; margin-right: 8px; }
        .description { font-size: 14px; line-height: 1.7; white-space: pre-wrap; margin-top: 16px; }
        .items { margin-top: 16px; list-style: none; padding: 0; }
        .items li { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0;
                    border-bottom: 1px solid #e5e7eb; font-size: 14px; }
        .items li:last-child { border-bottom: none; }
        .checkbox { width: 16px; height: 16px; border: 2px solid #6b7280; border-radius: 3px;
                    flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; }
        .checkbox.checked { background: #10b981; border-color: #10b981; }
        .checkmark { color: white; font-size: 11px; line-height: 1; }
        .item-label { flex: 1; }
        .item-label.checked { text-decoration: line-through; color: #9ca3af; }
        .progress { margin-top: 8px; font-size: 12px; color: #6b7280; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
      `}</style>

      <div className="container">
        <PrintTrigger />
        <hr />

        <h1>{note.title}</h1>
        <p className="meta">
          <span className="badge">{note.type === "LIST" ? "🛒 Liste de courses" : "📝 Note classique"}</span>
          <span className="badge">{note.isActive ? "Actif" : "Inactif"}</span>
          Imprimé le {printDate}
        </p>

        <hr />

        {note.type === "NOTE" && note.description && (
          <p className="description">{note.description}</p>
        )}

        {note.type === "LIST" && (
          <>
            {note.items.length > 0 && (
              <p className="progress">
                {note.items.filter((i) => i.isChecked).length}/{note.items.length} éléments cochés
              </p>
            )}
            <ul className="items">
              {note.items.map((item) => (
                <li key={item.id}>
                  <div className={`checkbox ${item.isChecked ? "checked" : ""}`}>
                    {item.isChecked && <span className="checkmark">✓</span>}
                  </div>
                  <span className={`item-label ${item.isChecked ? "checked" : ""}`}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

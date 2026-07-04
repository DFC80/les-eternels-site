import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CORE_ACTIVITIES } from "@/lib/activity-colors";

const DEFAULT_CONTENTS: Record<string, string> = {
  JEUX_DE_PLATEAU:
    "Chaque semaine, nos membres se retrouvent autour de jeux de société variés : jeux de stratégie, jeux coopératifs, jeux d'ambiance et grands classiques. Notre ludothèque compte plus de 150 jeux, accessibles à tous les membres lors des soirées organisées au local de l'association. Les débutants sont toujours les bienvenus : des membres expérimentés sont présents pour expliquer les règles.",
  JEUX_DE_ROLE:
    "Nos maîtres de jeu animent des campagnes au long cours et des one-shots dans des univers variés : héroic-fantasy, horreur, science-fiction, post-apocalyptique... Que vous soyez joueur expérimenté ou que vous découvriez le jeu de rôle, des tables sont ouvertes pour tous les niveaux, sur réservation via le calendrier des événements.",
  AIRSOFT:
    "Des sorties terrain sont organisées régulièrement, en forêt ou sur des terrains CQB partenaires. La sécurité est notre priorité : port d'une protection oculaire obligatoire, respect strict des limites de puissance et du fair-play. Le matériel peut être prêté aux nouveaux membres pour leurs premières sorties.",
};

async function ensureCoreActivities() {
  for (const a of CORE_ACTIVITIES) {
    await prisma.activity.upsert({ where: { key: a.key }, update: {}, create: a });
    await prisma.activity.updateMany({ where: { key: a.key, price: 0 }, data: { price: a.price } });
  }
}

export async function GET() {
  await ensureCoreActivities();

  const [activities, contentRows] = await Promise.all([
    prisma.activity.findMany({ orderBy: { order: "asc" } }),
    prisma.activityContent.findMany(),
  ]);

  const contentMap = Object.fromEntries(contentRows.map((r) => [r.key, r.content]));

  const result = activities.map((a) => ({
    id: a.id,
    key: a.key,
    label: a.label,
    emoji: a.emoji,
    color: a.color,
    order: a.order,
    membershipRequired: a.membershipRequired,
    isCore: a.isCore,
    isActive: a.isActive,
    price: a.price,
    content: contentMap[a.key] ?? DEFAULT_CONTENTS[a.key] ?? "",
  }));

  return NextResponse.json(result);
}

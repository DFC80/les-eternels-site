import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@les-eternels.fr";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    const passwordHash = await bcrypt.hash("Admin1234!", 10);
    await prisma.user.create({
      data: {
        firstName: "Compte",
        name: "Administrateur",
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(`Compte admin créé : ${adminEmail} / Admin1234!`);
  } else {
    console.log("Le compte admin existe déjà.");
  }

  const eventCount = await prisma.event.count();
  if (eventCount === 0) {
    const now = new Date();
    await prisma.event.createMany({
      data: [
        {
          title: "Soirée jeux de plateau",
          description: "Venez découvrir nos nouveautés ludiques au local de l'association.",
          activityType: "JEUX_DE_PLATEAU",
          location: "Local associatif, 12 rue des Éternels",
          startsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 19, 0),
          endsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 23, 0),
          capacity: 20,
        },
        {
          title: "Campagne JdR : Les Terres Oubliées",
          description: "Séance 4 de notre campagne héroic-fantasy. Personnages niveau 5.",
          activityType: "JEUX_DE_ROLE",
          location: "Salle B, local associatif",
          startsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 18, 30),
          endsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 22, 30),
          capacity: 6,
        },
      ],
    });

    const now2 = new Date();
    await prisma.event.create({
      data: {
        title: "Sortie Airsoft - Forêt de Brocéliande",
        description: "Partie en forêt, scénario capture de drapeau. Protection oculaire obligatoire.",
        activityType: "AIRSOFT",
        location: "Terrain partenaire, Forêt de Brocéliande",
        startsAt: new Date(now2.getFullYear(), now2.getMonth(), now2.getDate() + 10, 9, 0),
        endsAt: new Date(now2.getFullYear(), now2.getMonth(), now2.getDate() + 10, 17, 0),
        capacity: 30,
        hasMeal: true,
        mealInfo: "Grillades et accompagnements préparés sur place par l'équipe logistique.",
        menus: {
          create: [{ label: "Menu classique" }, { label: "Menu végétarien" }, { label: "Menu sans porc" }],
        },
      },
    });
    console.log("Événements de démonstration créés.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

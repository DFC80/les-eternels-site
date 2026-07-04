# Les Éternels — Site de l'association

Site web pour une association loi 1901 dédiée aux jeux de plateau, jeux de rôle et airsoft.

## Fonctionnalités

- Vitrine présentant l'association et ses 3 activités
- Inscription / connexion des membres (NextAuth, mots de passe hashés avec bcrypt)
- Calendrier des événements, inscription en un clic pour les membres connectés
- Panel d'administration : gestion des membres (rôle, activation, suppression) et des événements (création, édition, suppression)

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma · SQLite · NextAuth

## Installation

Node.js (version 18 ou supérieure) doit être installé : https://nodejs.org/

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Modifier NEXTAUTH_SECRET avec une chaîne aléatoire (ex: openssl rand -base64 32)

# 3. Créer la base de données et appliquer le schéma
npx prisma migrate dev --name init

# 4. Créer le compte admin et des événements de démonstration
npm run seed

# 5. Lancer le serveur de développement
npm run dev
```

Le site est ensuite accessible sur http://localhost:3000

## Compte administrateur par défaut

- Email : `admin@les-eternels.fr`
- Mot de passe : `Admin1234!`

⚠️ Pensez à changer ce mot de passe après la première connexion (via la base de données ou en ajoutant une page de modification de profil).

## Structure du projet

```
src/
  app/
    page.tsx              # Accueil
    activites/             # Page de présentation des activités
    login/, register/      # Authentification
    calendar/               # Calendrier des événements
    admin/                  # Panel administrateur (membres, événements)
    api/                    # Routes API (auth, events, register, admin)
  components/               # Navbar, Footer, EventCalendar, Providers
  lib/                      # Configuration Prisma et NextAuth
prisma/
  schema.prisma             # Modèle de données (User, Event, EventRegistration)
  seed.ts                   # Script de données initiales
```

## Déploiement

Pour la production, remplacez SQLite par PostgreSQL ou MySQL en changeant le `provider` dans `prisma/schema.prisma` et la variable `DATABASE_URL`.

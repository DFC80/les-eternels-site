-- CreateTable
CREATE TABLE "MenuCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "stock" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MealMenu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxPerPerson" INTEGER,
    "extraPrice" INTEGER,
    "stock" INTEGER,
    "catalogId" TEXT,
    CONSTRAINT "MealMenu_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealMenu_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "MenuCatalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MealMenu" ("eventId", "extraPrice", "id", "label", "maxPerPerson") SELECT "eventId", "extraPrice", "id", "label", "maxPerPerson" FROM "MealMenu";
DROP TABLE "MealMenu";
ALTER TABLE "new_MealMenu" RENAME TO "MealMenu";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

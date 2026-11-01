-- CreateTable
CREATE TABLE "DrinkCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "stock" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EventDrink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxPerPerson" INTEGER,
    "stock" INTEGER,
    "catalogId" TEXT,
    CONSTRAINT "EventDrink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventDrink_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "DrinkCatalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "hasDrinks" BOOLEAN NOT NULL DEFAULT false;

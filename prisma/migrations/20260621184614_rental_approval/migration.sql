-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EquipmentRental" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrationId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentRental_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentRental_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EquipmentRental" ("createdAt", "equipmentId", "id", "registrationId") SELECT "createdAt", "equipmentId", "id", "registrationId" FROM "EquipmentRental";
DROP TABLE "EquipmentRental";
ALTER TABLE "new_EquipmentRental" RENAME TO "EquipmentRental";
CREATE UNIQUE INDEX "EquipmentRental_registrationId_equipmentId_key" ON "EquipmentRental"("registrationId", "equipmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

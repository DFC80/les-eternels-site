-- CreateTable
CREATE TABLE "BoardGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "minPlayers" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardGame_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_BoardGameToEvent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BoardGameToEvent_A_fkey" FOREIGN KEY ("A") REFERENCES "BoardGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BoardGameToEvent_B_fkey" FOREIGN KEY ("B") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_BoardGameToEvent_AB_unique" ON "_BoardGameToEvent"("A", "B");

-- CreateIndex
CREATE INDEX "_BoardGameToEvent_B_index" ON "_BoardGameToEvent"("B");

-- CreateTable
CREATE TABLE "GalleryPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "comment" TEXT,
    "activityType" TEXT NOT NULL DEFAULT 'AUTRE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

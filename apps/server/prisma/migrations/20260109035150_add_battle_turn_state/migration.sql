-- AlterTable
ALTER TABLE "Battle" ADD COLUMN     "activeUnitId" TEXT,
ADD COLUMN     "currentPlayerId" TEXT,
ADD COLUMN     "turnTimer" INTEGER NOT NULL DEFAULT 60;

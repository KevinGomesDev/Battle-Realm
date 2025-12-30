-- AlterTable
ALTER TABLE "BattleUnit" ADD COLUMN     "classFeatures" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "classId" TEXT,
ADD COLUMN     "equipment" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "troopSlot" INTEGER;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "isAlive" BOOLEAN NOT NULL DEFAULT true;

/*
  Warnings:

  - You are about to drop the column `inventory` on the `Kingdom` table. All the data in the column will be lost.
  - You are about to drop the column `locationIndex` on the `Kingdom` table. All the data in the column will be lost.
  - You are about to drop the column `raceMetadata` on the `Kingdom` table. All the data in the column will be lost.
  - You are about to drop the column `kingdomId` on the `Structure` table. All the data in the column will be lost.
  - You are about to drop the column `kingdomId` on the `Unit` table. All the data in the column will be lost.
  - You are about to drop the `MatchPlayer` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[regentId]` on the table `Kingdom` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "BattleUnit" DROP CONSTRAINT "BattleUnit_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "MatchPlayer" DROP CONSTRAINT "MatchPlayer_kingdomId_fkey";

-- DropForeignKey
ALTER TABLE "MatchPlayer" DROP CONSTRAINT "MatchPlayer_matchId_fkey";

-- DropForeignKey
ALTER TABLE "MatchPlayer" DROP CONSTRAINT "MatchPlayer_userId_fkey";

-- DropForeignKey
ALTER TABLE "Structure" DROP CONSTRAINT "Structure_kingdomId_fkey";

-- DropForeignKey
ALTER TABLE "Structure" DROP CONSTRAINT "Structure_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_kingdomId_fkey";

-- DropForeignKey
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_ownerId_fkey";

-- AlterTable
ALTER TABLE "Kingdom" DROP COLUMN "inventory",
DROP COLUMN "locationIndex",
DROP COLUMN "raceMetadata",
ADD COLUMN     "regentId" TEXT;

-- AlterTable
ALTER TABLE "Structure" DROP COLUMN "kingdomId";

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "kingdomId";

-- DropTable
DROP TABLE "MatchPlayer";

-- CreateTable
CREATE TABLE "MatchHistory" (
    "id" TEXT NOT NULL,
    "kingdomId" TEXT NOT NULL,
    "matchDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL,
    "opponentName" TEXT NOT NULL,
    "opponentRace" TEXT NOT NULL,
    "finalRound" INTEGER NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "MatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchKingdom" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kingdomId" TEXT NOT NULL,
    "playerIndex" INTEGER NOT NULL DEFAULT 0,
    "playerColor" TEXT NOT NULL DEFAULT '#ff0000',
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "freeBuildingsUsed" INTEGER NOT NULL DEFAULT 0,
    "capitalTerritoryId" TEXT,
    "locationIndex" INTEGER,
    "troopLevels" TEXT NOT NULL DEFAULT '{}',
    "troopTemplates" TEXT NOT NULL DEFAULT '{}',
    "customChoices" TEXT NOT NULL DEFAULT '{}',
    "raceMetadata" TEXT,
    "inventory" TEXT NOT NULL DEFAULT '[]',
    "resources" TEXT NOT NULL DEFAULT '{"ore":0,"supplies":0,"arcane":0,"experience":0,"devotion":0}',
    "hasPlayedTurn" BOOLEAN NOT NULL DEFAULT false,
    "hasFinishedAdminTurn" BOOLEAN NOT NULL DEFAULT false,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "buildingCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatchKingdom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kingdom_regentId_key" ON "Kingdom"("regentId");

-- AddForeignKey
ALTER TABLE "Kingdom" ADD CONSTRAINT "Kingdom_regentId_fkey" FOREIGN KEY ("regentId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchHistory" ADD CONSTRAINT "MatchHistory_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchKingdom" ADD CONSTRAINT "MatchKingdom_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchKingdom" ADD CONSTRAINT "MatchKingdom_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchKingdom" ADD CONSTRAINT "MatchKingdom_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MatchKingdom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Structure" ADD CONSTRAINT "Structure_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MatchKingdom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleUnit" ADD CONSTRAINT "BattleUnit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MatchKingdom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

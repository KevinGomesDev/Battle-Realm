/*
  Warnings:

  - You are about to drop the column `actions` on the `Unit` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "GameEvent_arenaLobbyId_idx";

-- DropIndex
DROP INDEX "GameEvent_battleId_idx";

-- DropIndex
DROP INDEX "GameEvent_context_idx";

-- DropIndex
DROP INDEX "GameEvent_matchId_idx";

-- DropIndex
DROP INDEX "GameEvent_timestamp_idx";

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "actions",
ADD COLUMN     "conditions" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "skillCooldowns" TEXT NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "GameEvent_matchId_timestamp_idx" ON "GameEvent"("matchId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "GameEvent_battleId_timestamp_idx" ON "GameEvent"("battleId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "GameEvent_arenaLobbyId_timestamp_idx" ON "GameEvent"("arenaLobbyId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "GameEvent_context_timestamp_idx" ON "GameEvent"("context", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "GameEvent_timestamp_idx" ON "GameEvent"("timestamp" DESC);

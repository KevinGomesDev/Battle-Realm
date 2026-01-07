/*
  Warnings:

  - You are about to drop the `BattleLog` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `hostKingdomId` to the `ArenaLobby` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BattleLog" DROP CONSTRAINT "BattleLog_battleId_fkey";

-- AlterTable
ALTER TABLE "ArenaLobby" ADD COLUMN     "hostKingdomId" TEXT NOT NULL,
ADD COLUMN     "hostKingdomName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "hostSocketId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "hostUsername" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Battle" ADD COLUMN     "guestKingdomId" TEXT,
ADD COLUMN     "guestUserId" TEXT,
ADD COLUMN     "hostKingdomId" TEXT,
ADD COLUMN     "hostUserId" TEXT;

-- AlterTable
ALTER TABLE "BattleUnit" ADD COLUMN     "actions" TEXT NOT NULL DEFAULT '["attack","move","dash","dodge"]',
ALTER COLUMN "features" SET DEFAULT '[]';

-- DropTable
DROP TABLE "BattleLog";

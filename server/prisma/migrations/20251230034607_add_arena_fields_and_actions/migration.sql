/*
  Warnings:

  - The values [TROPA,HEROI,REGENTE,PRISIONEIRO,INVOCACAO,MONSTRO] on the enum `UnitCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `supplyBids` on the `Battle` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UnitCategory_new" AS ENUM ('TROOP', 'HERO', 'REGENT', 'PRISONER', 'SUMMON', 'MONSTER');
ALTER TABLE "Unit" ALTER COLUMN "category" TYPE "UnitCategory_new" USING ("category"::text::"UnitCategory_new");
ALTER TYPE "UnitCategory" RENAME TO "UnitCategory_old";
ALTER TYPE "UnitCategory_new" RENAME TO "UnitCategory";
DROP TYPE "UnitCategory_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Battle" DROP CONSTRAINT "Battle_matchId_fkey";

-- DropForeignKey
ALTER TABLE "BattleUnit" DROP CONSTRAINT "BattleUnit_battleId_fkey";

-- DropForeignKey
ALTER TABLE "BattleUnit" DROP CONSTRAINT "BattleUnit_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "BattleUnit" DROP CONSTRAINT "BattleUnit_unitId_fkey";

-- AlterTable
ALTER TABLE "Battle" DROP COLUMN "supplyBids",
ADD COLUMN     "guestKingdomId" TEXT,
ADD COLUMN     "guestUserId" TEXT,
ADD COLUMN     "hostKingdomId" TEXT,
ADD COLUMN     "hostUserId" TEXT,
ADD COLUMN     "isArena" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lobbyId" TEXT,
ADD COLUMN     "winReason" TEXT,
ADD COLUMN     "winnerId" TEXT,
ALTER COLUMN "matchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BattleUnit" ADD COLUMN     "actions" TEXT NOT NULL DEFAULT '["attack","move"]',
ADD COLUMN     "acuity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "armor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'TROOP',
ADD COLUMN     "combat" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "currentHp" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "focus" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "hasStartedAction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kingdomId" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Unidade',
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "vitality" INTEGER NOT NULL DEFAULT 5,
ALTER COLUMN "unitId" DROP NOT NULL,
ALTER COLUMN "ownerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "actions" TEXT NOT NULL DEFAULT '["attack","move"]';

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleUnit" ADD CONSTRAINT "BattleUnit_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleUnit" ADD CONSTRAINT "BattleUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleUnit" ADD CONSTRAINT "BattleUnit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MatchPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

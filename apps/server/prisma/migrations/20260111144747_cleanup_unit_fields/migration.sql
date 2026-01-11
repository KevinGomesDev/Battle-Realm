/*
  Warnings:

  - You are about to drop the column `actions` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `corpseRemoved` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `initiative` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `learnedSkills` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `oderId` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `actionsLeft` on the `Unit` table. All the data in the column will be lost.
  - You are about to drop the column `movesLeft` on the `Unit` table. All the data in the column will be lost.
  - You are about to drop the column `unitCooldowns` on the `Unit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BattleUnit" DROP COLUMN "actions",
DROP COLUMN "corpseRemoved",
DROP COLUMN "initiative",
DROP COLUMN "learnedSkills",
DROP COLUMN "oderId",
ADD COLUMN     "hotbar" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "isNemesis" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nemesisFears" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "nemesisId" TEXT,
ADD COLUMN     "nemesisKillCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nemesisPowerLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nemesisRank" TEXT,
ADD COLUMN     "nemesisScars" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "nemesisStrengths" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "nemesisTargetPlayer" TEXT,
ADD COLUMN     "nemesisTitle" TEXT,
ADD COLUMN     "nemesisTraits" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "unitBattleId" TEXT;

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "actionsLeft",
DROP COLUMN "movesLeft",
DROP COLUMN "unitCooldowns",
ADD COLUMN     "hotbar" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "nemesisId" TEXT;

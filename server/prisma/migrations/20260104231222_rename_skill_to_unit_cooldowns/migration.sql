/*
  Warnings:

  - You are about to drop the column `skillCooldowns` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `skillCooldowns` on the `Unit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BattleUnit" DROP COLUMN "skillCooldowns",
ADD COLUMN     "unitCooldowns" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "skillCooldowns",
ADD COLUMN     "unitCooldowns" TEXT NOT NULL DEFAULT '{}';

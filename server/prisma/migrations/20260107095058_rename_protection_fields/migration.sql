/*
  Warnings:

  - You are about to drop the column `armor` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `protection` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `protectionBroken` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `armor` on the `TroopTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `armor` on the `Unit` table. All the data in the column will be lost.
  - Added the required column `maxHp` to the `Unit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resistance` to the `Unit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `will` to the `Unit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BattleUnit" DROP COLUMN "armor",
DROP COLUMN "protection",
DROP COLUMN "protectionBroken",
ADD COLUMN     "currentMana" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "magicalProtection" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxHp" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "maxMana" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "physicalProtection" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resistance" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "will" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TroopTemplate" DROP COLUMN "armor",
ADD COLUMN     "resistance" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "will" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "armor",
ADD COLUMN     "currentMana" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxHp" INTEGER NOT NULL,
ADD COLUMN     "maxMana" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resistance" INTEGER NOT NULL,
ADD COLUMN     "will" INTEGER NOT NULL;

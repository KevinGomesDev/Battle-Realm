/*
  Warnings:

  - You are about to drop the column `initiativeOrder` on the `Battle` table. All the data in the column will be lost.
  - The `territorySize` column on the `Battle` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `capitalName` on the `Kingdom` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Battle" DROP COLUMN "initiativeOrder",
DROP COLUMN "territorySize",
ADD COLUMN     "territorySize" "TerritorySize" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "BattleUnit" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "size" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "visionRange" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Kingdom" DROP COLUMN "capitalName";

-- AlterTable
ALTER TABLE "TroopTemplate" ADD COLUMN     "avatar" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "avatar" TEXT;

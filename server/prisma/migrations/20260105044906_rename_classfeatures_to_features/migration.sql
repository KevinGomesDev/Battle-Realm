/*
  Warnings:

  - You are about to drop the column `classFeatures` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `classFeatures` on the `Unit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BattleUnit" DROP COLUMN "classFeatures",
ADD COLUMN     "learnedSkills" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "classFeatures",
ADD COLUMN     "features" TEXT NOT NULL DEFAULT '[]';

/*
  Warnings:

  - You are about to drop the column `classId` on the `BattleUnit` table. All the data in the column will be lost.
  - You are about to drop the column `classId` on the `Unit` table. All the data in the column will be lost.
  - You are about to drop the `HeroClass` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Skill` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_classId_fkey";

-- DropForeignKey
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_classId_fkey";

-- AlterTable
ALTER TABLE "BattleUnit" DROP COLUMN "classId",
ADD COLUMN     "classCode" TEXT;

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "classId",
ADD COLUMN     "classCode" TEXT;

-- DropTable
DROP TABLE "HeroClass";

-- DropTable
DROP TABLE "Skill";

-- DropEnum
DROP TYPE "Archetype";

-- DropEnum
DROP TYPE "CostTier";

-- DropEnum
DROP TYPE "SkillCategory";

-- DropEnum
DROP TYPE "SkillRange";

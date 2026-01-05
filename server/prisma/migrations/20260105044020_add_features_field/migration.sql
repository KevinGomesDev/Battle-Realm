/*
  Warnings:

  - You are about to drop the column `actions` on the `BattleUnit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BattleUnit" DROP COLUMN "actions",
ADD COLUMN     "features" TEXT NOT NULL DEFAULT '["ATTACK","DASH","DODGE"]';

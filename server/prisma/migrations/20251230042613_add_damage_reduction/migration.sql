-- AlterTable
ALTER TABLE "BattleUnit" ADD COLUMN     "damageReduction" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "actions" SET DEFAULT '["attack","move","dash","dodge"]',
ALTER COLUMN "name" SET DEFAULT 'Unit';

-- AlterTable
ALTER TABLE "Unit" ALTER COLUMN "actions" SET DEFAULT '["attack","move","dash","dodge"]';

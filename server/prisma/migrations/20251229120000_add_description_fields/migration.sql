-- AlterTable: Add description fields
ALTER TABLE "Kingdom" ADD COLUMN "description" TEXT;

ALTER TABLE "TroopTemplate" ADD COLUMN "description" TEXT;

ALTER TABLE "Unit" ADD COLUMN "description" TEXT;

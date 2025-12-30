/*
  Warnings:

  - You are about to drop the column `capitalImageUrl` on the `Kingdom` table. All the data in the column will be lost.
  - You are about to drop the column `crestUrl` on the `Kingdom` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Kingdom" DROP COLUMN "capitalImageUrl",
DROP COLUMN "crestUrl";

/*
  Warnings:

  - You are about to drop the column `guestKingdomId` on the `ArenaLobby` table. All the data in the column will be lost.
  - You are about to drop the column `guestKingdomName` on the `ArenaLobby` table. All the data in the column will be lost.
  - You are about to drop the column `guestSocketId` on the `ArenaLobby` table. All the data in the column will be lost.
  - You are about to drop the column `guestUserId` on the `ArenaLobby` table. All the data in the column will be lost.
  - You are about to drop the column `guestUsername` on the `ArenaLobby` table. All the data in the column will be lost.
  - You are about to drop the column `hostKingdomId` on the `ArenaLobby` table. All the data in the column will be lost.
  - You are about to drop the column `hostKingdomName` on the `ArenaLobby` table. All the data in the column will be lost.
  - You are about to drop the column `hostSocketId` on the `ArenaLobby` table. All the data in the column will be lost.
  - You are about to drop the column `hostUsername` on the `ArenaLobby` table. All the data in the column will be lost.
  - You are about to drop the column `guestKingdomId` on the `Battle` table. All the data in the column will be lost.
  - You are about to drop the column `guestUserId` on the `Battle` table. All the data in the column will be lost.
  - You are about to drop the column `hostKingdomId` on the `Battle` table. All the data in the column will be lost.
  - You are about to drop the column `hostUserId` on the `Battle` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ArenaLobby" DROP COLUMN "guestKingdomId",
DROP COLUMN "guestKingdomName",
DROP COLUMN "guestSocketId",
DROP COLUMN "guestUserId",
DROP COLUMN "guestUsername",
DROP COLUMN "hostKingdomId",
DROP COLUMN "hostKingdomName",
DROP COLUMN "hostSocketId",
DROP COLUMN "hostUsername",
ADD COLUMN     "maxPlayers" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "players" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "vsBot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Battle" DROP COLUMN "guestKingdomId",
DROP COLUMN "guestUserId",
DROP COLUMN "hostKingdomId",
DROP COLUMN "hostUserId",
ADD COLUMN     "kingdomIds" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "maxPlayers" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "playerColors" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "playerIds" TEXT NOT NULL DEFAULT '[]';

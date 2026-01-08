-- CreateEnum
CREATE TYPE "Alignment" AS ENUM ('BOM', 'MAL', 'NEUTRO');

-- CreateEnum
CREATE TYPE "Race" AS ENUM ('ABERRACAO', 'BESTA', 'CELESTIAL', 'CONSTRUTO', 'DRAGAO', 'ELEMENTAL', 'FADA', 'DIABO', 'GIGANTE', 'HUMANOIDE', 'MONSTRUOSIDADE', 'GOSMA', 'PLANTA', 'MORTO_VIVO', 'INSETO');

-- CreateEnum
CREATE TYPE "UnitCategory" AS ENUM ('TROOP', 'HERO', 'REGENT', 'SUMMON', 'MONSTER');

-- CreateEnum
CREATE TYPE "TerritorySize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "TurnType" AS ENUM ('ADMINISTRACAO', 'EXERCITOS', 'MOVIMENTACAO', 'CRISE', 'ACAO', 'BATALHA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "battleWins" INTEGER NOT NULL DEFAULT 0,
    "battleLosses" INTEGER NOT NULL DEFAULT 0,
    "matchWins" INTEGER NOT NULL DEFAULT 0,
    "matchLosses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kingdom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "alignment" "Alignment" NOT NULL,
    "race" "Race" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "regentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Kingdom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TroopTemplate" (
    "id" TEXT NOT NULL,
    "kingdomId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "passiveId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "combat" INTEGER NOT NULL DEFAULT 2,
    "speed" INTEGER NOT NULL DEFAULT 2,
    "focus" INTEGER NOT NULL DEFAULT 2,
    "resistance" INTEGER NOT NULL DEFAULT 2,
    "will" INTEGER NOT NULL DEFAULT 0,
    "vitality" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "TroopTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "maxPlayers" INTEGER NOT NULL DEFAULT 2,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "currentTurn" "TurnType" NOT NULL DEFAULT 'ADMINISTRACAO',
    "crisisMeter" INTEGER NOT NULL DEFAULT 0,
    "crisisState" TEXT,
    "recruitedHeroes" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchHistory" (
    "id" TEXT NOT NULL,
    "kingdomId" TEXT NOT NULL,
    "matchDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL,
    "opponentName" TEXT NOT NULL,
    "opponentRace" TEXT NOT NULL,
    "finalRound" INTEGER NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "MatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchKingdom" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kingdomId" TEXT NOT NULL,
    "playerIndex" INTEGER NOT NULL DEFAULT 0,
    "playerColor" TEXT NOT NULL DEFAULT '#ff0000',
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "freeBuildingsUsed" INTEGER NOT NULL DEFAULT 0,
    "capitalTerritoryId" TEXT,
    "locationIndex" INTEGER,
    "troopLevels" TEXT NOT NULL DEFAULT '{}',
    "troopTemplates" TEXT NOT NULL DEFAULT '{}',
    "customChoices" TEXT NOT NULL DEFAULT '{}',
    "raceMetadata" TEXT,
    "inventory" TEXT NOT NULL DEFAULT '[]',
    "resources" TEXT NOT NULL DEFAULT '{"ore":0,"supplies":0,"arcane":0,"experience":0,"devotion":0}',
    "hasPlayedTurn" BOOLEAN NOT NULL DEFAULT false,
    "hasFinishedAdminTurn" BOOLEAN NOT NULL DEFAULT false,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "buildingCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatchKingdom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "mapIndex" INTEGER NOT NULL,
    "centerX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "centerY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "terrainType" TEXT NOT NULL,
    "polygonData" TEXT NOT NULL,
    "size" "TerritorySize" NOT NULL DEFAULT 'MEDIUM',
    "areaSlots" INTEGER NOT NULL DEFAULT 10,
    "usedSlots" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "isCapital" BOOLEAN NOT NULL DEFAULT false,
    "hasCrisisIntel" BOOLEAN NOT NULL DEFAULT false,
    "constructionCount" INTEGER NOT NULL DEFAULT 0,
    "fortressCount" INTEGER NOT NULL DEFAULT 0,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "matchId" TEXT,
    "ownerId" TEXT,
    "name" TEXT,
    "description" TEXT,
    "equipment" TEXT NOT NULL DEFAULT '[]',
    "summonerId" TEXT,
    "category" "UnitCategory" NOT NULL,
    "troopSlot" INTEGER,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "avatar" TEXT,
    "classCode" TEXT,
    "features" TEXT NOT NULL DEFAULT '[]',
    "spells" TEXT NOT NULL DEFAULT '[]',
    "conditions" TEXT NOT NULL DEFAULT '[]',
    "unitCooldowns" TEXT NOT NULL DEFAULT '{}',
    "combat" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "focus" INTEGER NOT NULL,
    "resistance" INTEGER NOT NULL,
    "will" INTEGER NOT NULL,
    "vitality" INTEGER NOT NULL,
    "damageReduction" INTEGER NOT NULL DEFAULT 0,
    "maxHp" INTEGER NOT NULL,
    "currentHp" INTEGER NOT NULL,
    "maxMana" INTEGER NOT NULL DEFAULT 0,
    "currentMana" INTEGER NOT NULL DEFAULT 0,
    "movesLeft" INTEGER NOT NULL,
    "actionsLeft" INTEGER NOT NULL,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "locationIndex" INTEGER,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Structure" (
    "id" TEXT NOT NULL,
    "matchId" TEXT,
    "ownerId" TEXT,
    "type" TEXT NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "currentHp" INTEGER NOT NULL,
    "resourceType" TEXT,
    "productionRate" INTEGER NOT NULL,
    "locationIndex" INTEGER,

    CONSTRAINT "Structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleLobby" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "hostSocketId" TEXT NOT NULL DEFAULT '',
    "hostKingdomId" TEXT NOT NULL,
    "hostUsername" TEXT NOT NULL DEFAULT '',
    "hostKingdomName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "battleId" TEXT,
    "maxPlayers" INTEGER NOT NULL DEFAULT 2,
    "players" TEXT NOT NULL DEFAULT '[]',
    "vsBot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleLobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "matchId" TEXT,
    "isPvP" BOOLEAN NOT NULL DEFAULT false,
    "lobbyId" TEXT,
    "hostUserId" TEXT,
    "guestUserId" TEXT,
    "hostKingdomId" TEXT,
    "guestKingdomId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "gridWidth" INTEGER NOT NULL DEFAULT 20,
    "gridHeight" INTEGER NOT NULL DEFAULT 20,
    "round" INTEGER NOT NULL DEFAULT 1,
    "currentTurnIndex" INTEGER NOT NULL DEFAULT 0,
    "actionOrder" TEXT NOT NULL DEFAULT '[]',
    "winnerId" TEXT,
    "winReason" TEXT,
    "ransomPrice" INTEGER,
    "ransomResource" TEXT,
    "terrainType" TEXT NOT NULL DEFAULT 'PLAINS',
    "territorySize" "TerritorySize" NOT NULL DEFAULT 'MEDIUM',
    "obstacles" TEXT NOT NULL DEFAULT '[]',
    "maxPlayers" INTEGER NOT NULL DEFAULT 2,
    "playerIds" TEXT NOT NULL DEFAULT '[]',
    "kingdomIds" TEXT NOT NULL DEFAULT '[]',
    "playerColors" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleUnit" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "unitId" TEXT,
    "ownerId" TEXT,
    "userId" TEXT,
    "kingdomId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Unit',
    "avatar" TEXT,
    "category" TEXT NOT NULL DEFAULT 'TROOP',
    "troopSlot" INTEGER,
    "level" INTEGER NOT NULL DEFAULT 1,
    "classCode" TEXT,
    "features" TEXT NOT NULL DEFAULT '[]',
    "learnedSkills" TEXT NOT NULL DEFAULT '[]',
    "equipment" TEXT NOT NULL DEFAULT '[]',
    "spells" TEXT NOT NULL DEFAULT '[]',
    "combat" INTEGER NOT NULL DEFAULT 1,
    "speed" INTEGER NOT NULL DEFAULT 1,
    "focus" INTEGER NOT NULL DEFAULT 1,
    "resistance" INTEGER NOT NULL DEFAULT 1,
    "will" INTEGER NOT NULL DEFAULT 0,
    "vitality" INTEGER NOT NULL DEFAULT 5,
    "damageReduction" INTEGER NOT NULL DEFAULT 0,
    "maxHp" INTEGER NOT NULL DEFAULT 10,
    "currentHp" INTEGER NOT NULL DEFAULT 10,
    "maxMana" INTEGER NOT NULL DEFAULT 0,
    "currentMana" INTEGER NOT NULL DEFAULT 0,
    "posX" INTEGER NOT NULL DEFAULT 0,
    "posY" INTEGER NOT NULL DEFAULT 0,
    "initiative" INTEGER NOT NULL DEFAULT 0,
    "movesLeft" INTEGER NOT NULL DEFAULT 3,
    "actionsLeft" INTEGER NOT NULL DEFAULT 1,
    "attacksLeftThisTurn" INTEGER NOT NULL DEFAULT 0,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "actionMarks" INTEGER NOT NULL DEFAULT 0,
    "physicalProtection" INTEGER NOT NULL DEFAULT 0,
    "magicalProtection" INTEGER NOT NULL DEFAULT 0,
    "conditions" TEXT NOT NULL DEFAULT '[]',
    "grabbedByBattleUnitId" TEXT,
    "corpseRemoved" BOOLEAN NOT NULL DEFAULT false,
    "hasStartedAction" BOOLEAN NOT NULL DEFAULT false,
    "actions" TEXT NOT NULL DEFAULT '["attack","move","dash","dodge"]',
    "isAIControlled" BOOLEAN NOT NULL DEFAULT false,
    "size" TEXT NOT NULL DEFAULT 'NORMAL',
    "visionRange" INTEGER NOT NULL DEFAULT 10,
    "unitCooldowns" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "BattleUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "matchId" TEXT,
    "battleId" TEXT,
    "battleLobbyId" TEXT,
    "targetUserIds" TEXT NOT NULL DEFAULT '[]',
    "sourceUserId" TEXT,
    "message" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "actorId" TEXT,
    "actorName" TEXT,
    "targetId" TEXT,
    "targetName" TEXT,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Kingdom_regentId_key" ON "Kingdom"("regentId");

-- CreateIndex
CREATE UNIQUE INDEX "TroopTemplate_kingdomId_slotIndex_key" ON "TroopTemplate"("kingdomId", "slotIndex");

-- CreateIndex
CREATE INDEX "GameEvent_matchId_timestamp_idx" ON "GameEvent"("matchId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "GameEvent_battleId_timestamp_idx" ON "GameEvent"("battleId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "GameEvent_battleLobbyId_timestamp_idx" ON "GameEvent"("battleLobbyId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "GameEvent_context_timestamp_idx" ON "GameEvent"("context", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "GameEvent_timestamp_idx" ON "GameEvent"("timestamp" DESC);

-- AddForeignKey
ALTER TABLE "Kingdom" ADD CONSTRAINT "Kingdom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kingdom" ADD CONSTRAINT "Kingdom_regentId_fkey" FOREIGN KEY ("regentId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TroopTemplate" ADD CONSTRAINT "TroopTemplate_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchHistory" ADD CONSTRAINT "MatchHistory_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchKingdom" ADD CONSTRAINT "MatchKingdom_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchKingdom" ADD CONSTRAINT "MatchKingdom_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchKingdom" ADD CONSTRAINT "MatchKingdom_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MatchKingdom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_summonerId_fkey" FOREIGN KEY ("summonerId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Structure" ADD CONSTRAINT "Structure_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Structure" ADD CONSTRAINT "Structure_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MatchKingdom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleUnit" ADD CONSTRAINT "BattleUnit_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleUnit" ADD CONSTRAINT "BattleUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleUnit" ADD CONSTRAINT "BattleUnit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MatchKingdom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_battleLobbyId_fkey" FOREIGN KEY ("battleLobbyId") REFERENCES "BattleLobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

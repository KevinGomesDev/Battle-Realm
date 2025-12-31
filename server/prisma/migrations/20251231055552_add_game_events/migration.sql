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
    "arenaLobbyId" TEXT,
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
CREATE INDEX "GameEvent_matchId_idx" ON "GameEvent"("matchId");

-- CreateIndex
CREATE INDEX "GameEvent_battleId_idx" ON "GameEvent"("battleId");

-- CreateIndex
CREATE INDEX "GameEvent_arenaLobbyId_idx" ON "GameEvent"("arenaLobbyId");

-- CreateIndex
CREATE INDEX "GameEvent_context_idx" ON "GameEvent"("context");

-- CreateIndex
CREATE INDEX "GameEvent_timestamp_idx" ON "GameEvent"("timestamp");

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_arenaLobbyId_fkey" FOREIGN KEY ("arenaLobbyId") REFERENCES "ArenaLobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

// server/src/colyseus/rooms/global/session.handler.ts
// Handler de Session: verificação de sessão ativa (battle, match, lobby)

import { Client, matchMaker } from "@colyseus/core";
import { prisma } from "../../../lib/prisma";
import {
  findActiveBattleForUser,
  findActiveMatchForUser,
} from "../../../modules/match/services/battle-persistence.service";
import { getUserData, isAuthenticated } from "./types";

/**
 * Verifica se o usuário tem sessão ativa (battle, match ou lobby)
 */
export async function handleCheckSession(client: Client): Promise<void> {
  if (!isAuthenticated(client)) {
    client.send("session:none", {});
    return;
  }

  const userData = getUserData(client)!;

  try {
    // 1. Verificar rooms de battle ativas (memória)
    const battleRooms = await matchMaker.query({ name: "battle" });

    for (const room of battleRooms) {

      if (room.metadata?.players?.includes(userData.userId)) {
        const isInBattle =
          room.metadata?.status === "BATTLING" ||
          room.metadata?.status === "BATTLE_ENDED";

        const kingdomId =
          room.metadata?.playerKingdoms?.[userData.userId] || null;

        client.send("session:active", {
          type: isInBattle ? "BATTLE_SESSION" : "BATTLE_LOBBY",
          roomId: room.roomId,
          battleId: room.roomId,
          lobbyId: room.roomId,
          kingdomId,
          status: room.metadata?.status,
          source: "memory",
        });
        return;
      }
    }

    // 2. Verificar rooms de match ativas (memória)
    const matchRooms = await matchMaker.query({ name: "match" });

    for (const room of matchRooms) {
      if (room.metadata?.players?.includes(userData.userId)) {
        const kingdomId =
          room.metadata?.playerKingdoms?.[userData.userId] || null;

        client.send("session:active", {
          type: "MATCH",
          roomId: room.roomId,
          matchId: room.roomId,
          kingdomId,
          status: room.metadata?.status,
          source: "memory",
        });
        return;
      }
    }

    // 3. Verificar batalha pausada no banco
    const pausedBattle = await findActiveBattleForUser(userData.userId);
    if (pausedBattle) {
      const playerIndex = pausedBattle.playerIds.indexOf(userData.userId);
      const kingdomId =
        playerIndex >= 0 ? pausedBattle.kingdomIds[playerIndex] : null;

      client.send("session:active", {
        type: "BATTLE_SESSION",
        roomId: pausedBattle.id,
        battleId: pausedBattle.id,
        lobbyId: pausedBattle.lobbyId,
        kingdomId,
        status: pausedBattle.status,
        source: "database",
        needsRestore: true,
      });
      return;
    }

    // 4. Verificar match pausado no banco
    const pausedMatchId = await findActiveMatchForUser(userData.userId);
    if (pausedMatchId) {
      const match = await prisma.match.findUnique({
        where: { id: pausedMatchId },
      });
      if (match && match.status !== "ENDED") {
        client.send("session:active", {
          type: "MATCH",
          roomId: pausedMatchId,
          matchId: pausedMatchId,
          status: match.status,
          source: "database",
          needsRestore: true,
        });
        return;
      }
    }

    client.send("session:none", {});
  } catch (error) {
    console.error("[Session] Erro ao verificar sessão:", error);
    client.send("session:none", {});
  }
}

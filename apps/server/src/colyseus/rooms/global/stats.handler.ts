// server/src/colyseus/rooms/global/stats.handler.ts
// Handler de Stats: atualização de estatísticas do servidor

import { matchMaker } from "@colyseus/core";
import { GlobalRoomState, BattleLobbyState } from "../../schemas";

/**
 * Atualiza estatísticas do servidor (lobbies, batalhas, etc)
 */
export async function updateStats(state: GlobalRoomState): Promise<void> {
  try {
    const battleRooms = await matchMaker.query({ name: "battle" });
    const matchRooms = await matchMaker.query({ name: "match" });

    state.activeLobbies = battleRooms.filter(
      (r) => r.metadata?.status === "WAITING"
    ).length;

    state.activeBattles =
      battleRooms.filter((r) => r.metadata?.status === "BATTLING").length +
      matchRooms.length;

    // Atualizar lista de lobbies disponíveis
    state.availableLobbies.clear();

    for (const room of battleRooms) {
      if (room.metadata?.status === "WAITING") {
        const lobby = new BattleLobbyState();
        lobby.lobbyId = room.roomId;
        lobby.hostUserId = room.metadata?.hostUserId || "";
        lobby.maxPlayers = room.metadata?.maxPlayers || 2;
        lobby.status = "WAITING";

        state.availableLobbies.push(lobby);
      }
    }
  } catch (error) {
    console.error("[Stats] Erro ao atualizar stats:", error);
  }
}

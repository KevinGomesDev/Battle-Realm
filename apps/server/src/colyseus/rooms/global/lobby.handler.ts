// server/src/colyseus/rooms/global/lobby.handler.ts
// Handlers de Lobby: listagem e criação de lobbies de batalha e partidas

import { Client, matchMaker } from "@colyseus/core";
import { getUserData, isAuthenticated, sendAuthError } from "./types";

/**
 * Lista lobbies de batalha disponíveis
 */
export async function handleListLobbies(client: Client): Promise<void> {
  try {
    const rooms = await matchMaker.query({ name: "battle" });

    const lobbies = rooms
      .filter((room) => room.metadata?.status === "WAITING")
      .map((room) => ({
        lobbyId: room.roomId,
        hostUserId: room.metadata?.hostUserId,
        hostUsername: room.metadata?.hostUsername || "Unknown",
        hostKingdomName: room.metadata?.hostKingdomName || "Unknown",
        maxPlayers: room.metadata?.maxPlayers || 2,
        playerCount: room.clients || 0,
        players: [],
        status: room.metadata?.status || "WAITING",
        createdAt: new Date(),
      }));

    client.send("lobby:list", { lobbies });
  } catch (error) {
    client.send("error", { message: "Erro ao listar lobbies" });
  }
}

/**
 * Lista partidas estratégicas disponíveis
 */
export async function handleListMatches(client: Client): Promise<void> {
  try {
    const rooms = await matchMaker.query({ name: "match" });

    const matches = rooms
      .filter(
        (room) =>
          room.metadata?.status === "WAITING" ||
          room.metadata?.status === "OPEN"
      )
      .map((room) => ({
        matchId: room.roomId,
        hostId: room.metadata?.hostUserId || room.metadata?.hostId,
        hostName: room.metadata?.hostName || "Host",
        mapId: room.metadata?.mapId || "",
        playerCount: room.clients || 0,
        maxPlayers: room.metadata?.maxPlayers || 2,
        status: room.metadata?.status || "WAITING",
      }));

    client.send("match:list_result", matches);
  } catch (error) {
    client.send("match:error", { message: "Erro ao listar partidas" });
  }
}

/**
 * Lista lobbies de batalha (formato alternativo)
 */
export async function handleListBattleLobbies(client: Client): Promise<void> {
  try {
    const rooms = await matchMaker.query({ name: "battle" });

    const lobbies = rooms
      .filter((room) => room.metadata?.status === "WAITING")
      .map((room) => ({
        lobbyId: room.roomId,
        hostUserId: room.metadata?.hostUserId,
        hostName: room.metadata?.hostName || "Host",
        maxPlayers: room.metadata?.maxPlayers || 2,
        playerCount: room.clients || 0,
        status: room.metadata?.status || "WAITING",
      }));

    client.send("battle:lobbies_list", lobbies);
  } catch (error) {
    client.send("battle:error", {
      message: "Erro ao listar lobbies de batalha",
    });
  }
}

/**
 * Cria um novo lobby de batalha
 */
export async function handleCreateLobby(
  client: Client,
  options: { kingdomId: string; maxPlayers?: number }
): Promise<void> {
  if (!isAuthenticated(client)) {
    sendAuthError(client);
    return;
  }

  const userData = getUserData(client)!;

  try {
    const room = await matchMaker.createRoom("battle", {
      userId: userData.userId,
      kingdomId: options.kingdomId,
      maxPlayers: options.maxPlayers || 2,
    });

    client.send("lobby:created", {
      roomId: room.roomId,
      ...options,
    });
  } catch (error: any) {
    client.send("error", { message: error.message || "Erro ao criar lobby" });
  }
}

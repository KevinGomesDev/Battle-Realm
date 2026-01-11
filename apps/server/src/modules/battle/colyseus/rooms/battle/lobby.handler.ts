// lobby.handler.ts - Handlers de lobby
import type { Client, Room } from "@colyseus/core";
import type { BattleSessionState, BattlePlayerSchema } from "../../schemas";
import { BattlePlayerSchema as PlayerSchema } from "../../schemas";
import { prisma } from "../../../../../lib/prisma";
import {
  getUserData,
  sendError,
  PLAYER_COLORS,
  type JoinOptions,
} from "./types";
import { getPlayersInfo, serializeFullState } from "./utils";

/**
 * Handler quando jogador marca como pronto
 */
export function handleLobbyReady(
  client: Client,
  state: BattleSessionState,
  readyPlayers: Set<string>,
  broadcast: Room<BattleSessionState>["broadcast"],
  startBattle: () => Promise<void>
): void {
  const userData = getUserData(client);
  if (!userData) return;

  readyPlayers.add(userData.userId);
  broadcast("lobby:player_ready", { userId: userData.userId });

  if (readyPlayers.size >= state.players.length) {
    startBattle();
  }
}

/**
 * Handler para iniciar a batalha (apenas host)
 */
export async function handleLobbyStart(
  client: Client,
  state: BattleSessionState,
  startBattle: () => Promise<void>
): Promise<void> {
  const userData = getUserData(client);
  if (!userData) return;

  if (state.players[0]?.oderId !== userData.userId) {
    sendError(client, "Apenas o host pode iniciar");
    return;
  }

  if (state.players.length < 2) {
    sendError(client, "Mínimo de 2 jogadores");
    return;
  }

  await startBattle();
}

/**
 * Handler para quando um jogador entra no lobby/batalha
 */
export async function handleJoin(
  client: Client,
  options: JoinOptions,
  state: BattleSessionState,
  roomId: string,
  metadata: Record<string, any>,
  getLobbyPhase: () => boolean,
  disconnectedPlayers: Map<string, any>,
  broadcast: Room<BattleSessionState>["broadcast"],
  setMetadata: Room<BattleSessionState>["setMetadata"],
  cancelPersistence: () => void,
  startBattle: () => Promise<void>,
  fromArena: boolean = false
): Promise<void> {
  const lobbyPhase = getLobbyPhase();

  const { userId, kingdomId } = options;

  // Se a batalha já está ativa (não mais em lobby), tratar reconexão
  if (state.status === "ACTIVE") {
    // Primeiro tenta reconexão via map de desconectados
    const reconnected = await handleReconnection(
      client,
      userId,
      kingdomId,
      state,
      disconnectedPlayers,
      cancelPersistence
    );
    if (reconnected) {
      return;
    }

    // Se não reconectou mas o jogador já existe na partida, apenas reconectar
    const existingPlayer = state.getPlayer(userId);
    if (existingPlayer) {
      existingPlayer.isConnected = true;
      client.userData = { userId, kingdomId };

      // Enviar estado completo serializado para garantir sincronização
      const fullState = serializeFullState(state);
      client.send("battle:reconnected", {
        success: true,
        ...fullState,
      });
      return;
    }

    // Se a batalha já começou e o jogador não está nela, erro
    throw new Error("Batalha já iniciada");
  }

  // Reconexão no lobby
  const existingPlayer = state.getPlayer(userId);
  if (existingPlayer) {
    existingPlayer.isConnected = true;
    client.userData = { userId, kingdomId };
    client.send("lobby:reconnected", {
      lobbyId: roomId,
      playerIndex: existingPlayer.playerIndex,
      players: getPlayersInfo(state),
    });
    return;
  }

  // Verificar limite
  if (state.players.length >= state.maxPlayers) {
    throw new Error("Lobby cheio");
  }

  // Validar kingdom
  const kingdom = await prisma.kingdom.findUnique({
    where: { id: kingdomId },
    include: { regent: true, owner: true },
  });

  if (!kingdom) throw new Error("Reino não encontrado");
  if (kingdom.ownerId !== userId)
    throw new Error("Este reino não pertence a você");
  if (!kingdom.regent) throw new Error("Reino sem Regente definido");

  // Criar jogador
  const playerIndex = state.players.length;
  const player = new PlayerSchema();
  player.oderId = userId;
  player.kingdomId = kingdomId;
  player.kingdomName = kingdom.name;
  player.username = kingdom.owner?.username || "Unknown";
  player.playerIndex = playerIndex;
  player.playerColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
  player.isConnected = true;

  state.players.push(player);

  // Atualizar metadata
  const playerKingdoms: Record<string, string> = {};
  state.players.forEach((p: BattlePlayerSchema) => {
    playerKingdoms[p.oderId] = p.kingdomId;
  });

  setMetadata({
    ...metadata,
    playerCount: state.players.length,
    players: state.players.map((p: BattlePlayerSchema) => p.oderId),
    playerKingdoms,
    status: state.players.length >= state.maxPlayers ? "READY" : "WAITING",
    // Guardar info do host quando é o primeiro jogador
    ...(playerIndex === 0 && {
      hostUsername: player.username,
      hostKingdomName: player.kingdomName,
    }),
  });

  client.userData = { userId, kingdomId };

  client.send("lobby:joined", {
    lobbyId: roomId,
    playerIndex,
    players: getPlayersInfo(state),
  });

  broadcast(
    "lobby:player_joined",
    {
      player: {
        oderId: userId,
        username: player.username,
        kingdomName: player.kingdomName,
        playerIndex,
      },
      totalPlayers: state.players.length,
      maxPlayers: state.maxPlayers,
    },
    { except: client }
  );

  // Lobby cheio
  if (state.players.length >= state.maxPlayers && state.status === "WAITING") {
    state.status = "READY";

    // Se veio da Arena, iniciar batalha automaticamente
    if (fromArena) {
      await startBattle();

      // Log do estado após batalha iniciar
    }
  }
}

async function handleReconnection(
  client: Client,
  userId: string,
  kingdomId: string,
  state: BattleSessionState,
  disconnectedPlayers: Map<string, any>,
  cancelPersistence: () => void
): Promise<boolean> {
  // Via disconnectedPlayers map
  const disconnected = disconnectedPlayers.get(userId);
  if (disconnected) {
    disconnected.timeout.clear();
    disconnectedPlayers.delete(userId);

    const player = state.getPlayer(userId);
    if (player) {
      player.isConnected = true;
      client.userData = { userId, kingdomId };
    }

    cancelPersistence();
    // Enviar estado completo serializado para garantir sincronização
    const fullState = serializeFullState(state);
    client.send("battle:reconnected", {
      success: true,
      ...fullState,
    });
    return true;
  }

  // Via state
  const existingPlayer = state.getPlayer(userId);
  if (existingPlayer) {
    existingPlayer.isConnected = true;
    client.userData = { userId, kingdomId };

    cancelPersistence();
    // Enviar estado completo serializado para garantir sincronização
    const fullStateFromState = serializeFullState(state);
    client.send("battle:reconnected", {
      success: true,
      ...fullStateFromState,
    });
    return true;
  }

  return false;
}

/**
 * Handler quando jogador sai do lobby
 */
export function handleLobbyLeave(
  userId: string,
  state: BattleSessionState,
  metadata: Record<string, any>,
  broadcast: Room<BattleSessionState>["broadcast"],
  setMetadata: Room<BattleSessionState>["setMetadata"]
): void {
  const playerIndex = state.players.findIndex(
    (p: BattlePlayerSchema) => p.oderId === userId
  );
  if (playerIndex !== -1) {
    state.players.splice(playerIndex, 1);

    state.players.forEach((p: BattlePlayerSchema, idx: number) => {
      p.playerIndex = idx;
      p.playerColor = PLAYER_COLORS[idx % PLAYER_COLORS.length];
    });

    setMetadata({
      ...metadata,
      playerCount: state.players.length,
      players: state.players.map((p: BattlePlayerSchema) => p.oderId),
      status: "WAITING",
    });

    broadcast("lobby:player_left", { userId });
  }
}

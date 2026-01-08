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
import { getPlayersInfo } from "./utils";

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
  lobbyPhase: boolean,
  disconnectedPlayers: Map<string, any>,
  broadcast: Room<BattleSessionState>["broadcast"],
  setMetadata: Room<BattleSessionState>["setMetadata"],
  cancelPersistence: () => void,
  addBotPlayer: () => void,
  startBattle: () => Promise<void>,
  vsBot: boolean
): Promise<void> {
  console.log(`[BattleRoom] ${client.sessionId} entrou na sala ${roomId}`);

  const { userId, kingdomId } = options;

  // Reconexão durante batalha
  if (!lobbyPhase && state.status !== "WAITING") {
    const reconnected = await handleReconnection(
      client,
      userId,
      kingdomId,
      state,
      disconnectedPlayers,
      cancelPersistence
    );
    if (reconnected) return;

    throw new Error("Batalha já iniciada");
  }

  // Reconexão no lobby
  const existingPlayer = state.getPlayer(userId);
  if (existingPlayer) {
    existingPlayer.isConnected = true;
    client.userData = { userId, kingdomId };

    console.log(`[BattleRoom] Jogador ${userId} reconectado ao lobby`);
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
  player.isBot = false;

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

  // vsBot flow
  if (vsBot && state.players.length === 1) {
    console.log(`[BattleRoom] Iniciando fluxo vsBot...`);
    addBotPlayer();
    console.log(
      `[BattleRoom] Bot adicionado, players agora: ${state.players.length}`
    );
    await startBattle();
    console.log(
      `[BattleRoom] startBattle() concluído, status: ${state.status}`
    );
    return;
  }

  // Lobby cheio
  if (state.players.length >= state.maxPlayers && state.status === "WAITING") {
    state.status = "READY";
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

    console.log(
      `[BattleRoom] Jogador ${userId} reconectado via disconnectedPlayers`
    );
    client.send("battle:reconnected", { success: true });
    return true;
  }

  // Via state
  const existingPlayer = state.getPlayer(userId);
  if (existingPlayer) {
    existingPlayer.isConnected = true;
    client.userData = { userId, kingdomId };

    cancelPersistence();

    console.log(
      `[BattleRoom] Jogador ${userId} reconectado (já existe no state)`
    );
    client.send("battle:reconnected", { success: true });
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

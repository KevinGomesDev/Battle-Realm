// src/handlers/session.handler.ts
// Handler para gerenciamento de sessão do usuário (retomar partida/arena)

import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import {
  getUserActiveSession,
  canJoinNewSession,
  setArenaRefs,
} from "../utils/session.utils";
import { resumeBattleTimer } from "./battle.handler";
import type {
  ArenaLobbyData,
  ArenaBattleData,
} from "../../../shared/types/session.types";

// ============================================
// Types para os Maps em memória
// ============================================

type ArenaLobbiesMap = Map<string, ArenaLobbyData>;
type ArenaBattlesMap = Map<string, ArenaBattleData>;
type UserToLobbyMap = Map<string, string>;
type DisconnectedPlayersMap = Map<string, string>;
type SocketToUserMap = Map<string, string>;

// Referências dos mapas de arena serão injetadas pelo arena.handler
let arenaLobbiesRef: ArenaLobbiesMap | null = null;
let arenaBattlesRef: ArenaBattlesMap | null = null;
let userToLobbyRef: UserToLobbyMap | null = null;
let disconnectedPlayersRef: DisconnectedPlayersMap | null = null;
let socketToUserRef: SocketToUserMap | null = null;

/**
 * Injeta as referências dos mapas de arena no session handler
 * Chamado pelo server.ts ao inicializar
 */
export function injectArenaRefs(
  lobbies: ArenaLobbiesMap,
  battles: ArenaBattlesMap,
  userToLobby: UserToLobbyMap,
  disconnectedPlayers?: DisconnectedPlayersMap,
  socketToUser?: SocketToUserMap
): void {
  arenaLobbiesRef = lobbies;
  arenaBattlesRef = battles;
  userToLobbyRef = userToLobby;
  disconnectedPlayersRef = disconnectedPlayers || null;
  socketToUserRef = socketToUser || null;
  // Também injeta no session.utils
  setArenaRefs(lobbies, battles, userToLobby);
}

export const registerSessionHandlers = (io: Server, socket: Socket): void => {
  /**
   * Verifica se o usuário tem uma sessão ativa e retorna os dados para retomar
   * Deve ser chamado pelo frontend logo após autenticação
   *
   * Emite:
   * - session:active { type, sessionId, ... } se há sessão ativa
   * - session:none {} se não há sessão
   */
  socket.on("session:check", async ({ userId }) => {
    try {
      if (!userId) {
        return socket.emit("error", { message: "userId é obrigatório" });
      }

      const session = await getUserActiveSession(userId);

      if (!session.type) {
        return socket.emit("session:none", {
          message: "Nenhuma sessão ativa encontrada",
        });
      }

      // Verificar se o jogador estava marcado como desconectado e limpar
      let wasDisconnected = false;
      if (disconnectedPlayersRef?.has(userId)) {
        disconnectedPlayersRef.delete(userId);
        wasDisconnected = true;
        console.log(
          `[SESSION] ✅ Usuário ${userId} reconectou! Removido da lista de desconectados.`
        );
      }

      // Atualizar mapeamento socketToUser com o novo socket
      if (
        socketToUserRef &&
        (session.type === "ARENA_BATTLE" || session.type === "ARENA_LOBBY")
      ) {
        socketToUserRef.set(socket.id, userId);
        console.log(
          `[SESSION] Mapeamento socketToUser atualizado: ${socket.id} -> ${userId}`
        );
      }

      // Reentrar na sala do socket
      if (session.matchId) {
        socket.join(session.matchId);
      }
      if (session.lobbyId) {
        socket.join(session.lobbyId);

        // Notificar o outro jogador que o usuário reconectou
        if (wasDisconnected) {
          io.to(session.lobbyId).emit("battle:player_reconnected", {
            lobbyId: session.lobbyId,
            userId,
          });
        }
      }
      if (session.battleId) {
        socket.join(session.battleId);
      }

      // Buscar dados completos baseado no tipo de sessão
      if (session.type === "MATCH") {
        const match = await prisma.match.findUnique({
          where: { id: session.matchId },
          include: {
            players: { include: { user: true, kingdom: true } },
            territories: true,
          },
        });

        if (!match) {
          return socket.emit("session:none", {
            message: "Partida não encontrada",
          });
        }

        const player = match.players.find((p) => p.userId === userId);

        socket.emit("session:active", {
          type: "MATCH",
          matchId: session.matchId,
          matchStatus: match.status,
          currentRound: match.currentRound,
          currentTurn: match.currentTurn,
          playerId: player?.id,
          playerIndex: player?.playerIndex,
          players: match.players.map((p) => ({
            id: p.id,
            username: p.user?.username,
            kingdomName: p.kingdom?.name,
            playerIndex: p.playerIndex,
            playerColor: p.playerColor,
          })),
        });

        console.log(
          `[SESSION] Usuário ${userId} retomou partida ${session.matchId}`
        );
      } else if (session.type === "ARENA_LOBBY") {
        const lobby = arenaLobbiesRef?.get(session.lobbyId!);

        if (!lobby) {
          // Limpar referência órfã
          userToLobbyRef?.delete(userId);
          return socket.emit("session:none", {
            message: "Lobby não encontrado",
          });
        }

        // Atualizar socketId do usuário reconectado
        if (lobby.hostUserId === userId) {
          lobby.hostSocketId = socket.id;
        } else if (lobby.guestUserId === userId) {
          lobby.guestSocketId = socket.id;
        }

        // Buscar dados completos para restauração
        const hostKingdom = await prisma.kingdom.findUnique({
          where: { id: lobby.hostKingdomId },
        });
        const hostUser = await prisma.user.findUnique({
          where: { id: lobby.hostUserId },
        });
        let guestKingdom = null;
        let guestUser = null;
        if (lobby.guestUserId && lobby.guestKingdomId) {
          guestKingdom = await prisma.kingdom.findUnique({
            where: { id: lobby.guestKingdomId },
          });
          guestUser = await prisma.user.findUnique({
            where: { id: lobby.guestUserId },
          });
        }

        const isHost = lobby.hostUserId === userId;

        // Emitir evento específico para restauração de arena
        socket.emit("battle:session_restored", {
          lobbyId: session.lobbyId,
          hostUserId: lobby.hostUserId,
          hostUsername: hostUser?.username || "Unknown",
          hostKingdomName: hostKingdom?.name || "Unknown",
          guestUserId: lobby.guestUserId,
          guestUsername: guestUser?.username,
          guestKingdomName: guestKingdom?.name,
          status: lobby.status,
          isHost,
          createdAt: lobby.createdAt,
        });

        socket.emit("session:active", {
          type: "ARENA_LOBBY",
          lobbyId: session.lobbyId,
          lobbyStatus: lobby.status,
          isHost,
          hostUserId: lobby.hostUserId,
          guestUserId: lobby.guestUserId,
        });

        console.log(
          `[SESSION] Usuário ${userId} retomou lobby de Arena ${session.lobbyId} (isHost: ${isHost})`
        );
      } else if (session.type === "ARENA_BATTLE") {
        const battle = arenaBattlesRef?.get(session.battleId!);
        const lobby = session.lobbyId
          ? arenaLobbiesRef?.get(session.lobbyId)
          : null;

        if (!battle) {
          console.error(
            `[SESSION] ❌ Batalha ${session.battleId} não encontrada no mapa de batalhas!`
          );
          return socket.emit("session:none", {
            message: "Batalha não encontrada",
          });
        }

        // Entrar na sala da batalha e do lobby (timer emite para lobbyId)
        socket.join(session.battleId!);
        if (session.lobbyId) {
          socket.join(session.lobbyId);
        }

        // Atualizar socketId se reconectando durante batalha
        if (lobby) {
          if (lobby.hostUserId === userId) {
            lobby.hostSocketId = socket.id;
          } else if (lobby.guestUserId === userId) {
            lobby.guestSocketId = socket.id;
          }
        }

        // Buscar dados dos reinos para a batalha
        const hostKingdom = lobby?.hostKingdomId
          ? await prisma.kingdom.findUnique({
              where: { id: lobby.hostKingdomId },
            })
          : null;
        const guestKingdom = lobby?.guestKingdomId
          ? await prisma.kingdom.findUnique({
              where: { id: lobby.guestKingdomId },
            })
          : null;

        // Emitir evento específico para restauração de batalha
        socket.emit("battle:battle_restored", {
          battleId: session.battleId,
          lobbyId: session.lobbyId,
          config: battle.config, // Configuração dinâmica da batalha (com mapa, clima, obstáculos)
          round: battle.round,
          status: battle.status,
          currentTurnIndex: battle.currentTurnIndex,
          currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
          turnTimer: battle.turnTimer, // Timer atual da batalha
          units: battle.units,
          actionOrder: battle.actionOrder,
          hostKingdom: hostKingdom
            ? {
                id: hostKingdom.id,
                name: hostKingdom.name,
                ownerId: lobby?.hostUserId,
              }
            : null,
          guestKingdom: guestKingdom
            ? {
                id: guestKingdom.id,
                name: guestKingdom.name,
                ownerId: lobby?.guestUserId,
              }
            : null,
        });

        socket.emit("session:active", {
          type: "ARENA_BATTLE",
          battleId: session.battleId,
          lobbyId: session.lobbyId,
          battleStatus: battle.status,
          round: battle.round,
          currentTurnIndex: battle.currentTurnIndex,
          units: battle.units,
          actionOrder: battle.actionOrder,
          gridWidth: battle.gridWidth,
          gridHeight: battle.gridHeight,
        });

        // Sempre tentar retomar timer da batalha (caso esteja pausado ou não iniciado)
        // resumeBattleTimer já verifica se há timer ativo antes de criar novo
        resumeBattleTimer(session.battleId!);

        console.log(
          `[SESSION] Usuário ${userId} retomou batalha de Arena ${
            session.battleId
          }${wasDisconnected ? " (estava desconectado)" : ""}`
        );
      }
    } catch (error) {
      console.error("[SESSION] Erro ao verificar sessão:", error);
      socket.emit("error", { message: "Erro ao verificar sessão ativa" });
    }
  });

  /**
   * Verifica se o usuário pode entrar em uma nova sessão
   * Útil para o frontend verificar antes de mostrar opções
   */
  socket.on("session:can_join", async ({ userId }) => {
    try {
      if (!userId) {
        return socket.emit("error", { message: "userId é obrigatório" });
      }

      const blockReason = await canJoinNewSession(userId);

      socket.emit("session:can_join_result", {
        canJoin: !blockReason,
        reason: blockReason,
      });
    } catch (error) {
      console.error("[SESSION] Erro ao verificar permissão:", error);
      socket.emit("error", { message: "Erro ao verificar permissão" });
    }
  });
};

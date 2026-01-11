// src/utils/session.utils.ts
// Funções utilitárias para verificar sessão ativa do usuário (Partida ou Batalha)

import { prisma } from "../lib/prisma";
import type {
  SessionType,
  ActiveSession,
  BattleLobbyData,
  BattleSessionData,
} from "@boundless/shared/types/session.types";

// ============================================
// Types para os Maps em memória
// ============================================

type battleLobbiesMap = Map<string, BattleLobbyData>;
type BattleSessionsMap = Map<string, BattleSessionData>;
type UserToLobbyMap = Map<string, string>;

// Referência aos mapas de batalha em memória (importados do handler)
// Será injetado pelo handler para evitar dependência circular
let battleLobbiesRef: battleLobbiesMap | null = null;
let BattleSessionsRef: BattleSessionsMap | null = null;
let userToLobbyRef: UserToLobbyMap | null = null;

/**
 * Injeta referências dos mapas de batalha para uso nas funções de sessão
 */
export function setBattleRefs(
  lobbies: battleLobbiesMap,
  battles: BattleSessionsMap,
  userToLobby: UserToLobbyMap
): void {
  battleLobbiesRef = lobbies;
  BattleSessionsRef = battles;
  userToLobbyRef = userToLobby;
}

// Re-export types para compatibilidade
export type { SessionType, ActiveSession };

/**
 * Verifica se o usuário está em uma sessão ativa (Partida ou Batalha)
 */
export async function getUserActiveSession(
  userId: string
): Promise<ActiveSession> {
  // 1. Verificar se está em uma partida ativa (WAITING, PREPARATION, ACTIVE)
  const matchKingdom = await prisma.matchKingdom.findFirst({
    where: {
      userId,
      match: {
        status: { in: ["WAITING", "PREPARATION", "ACTIVE"] },
      },
    },
    include: {
      match: true,
    },
  });

  if (matchKingdom && matchKingdom.match) {
    return {
      type: "MATCH",
      sessionId: matchKingdom.match.id,
      matchId: matchKingdom.match.id,
      matchStatus: matchKingdom.match.status,
      playerId: matchKingdom.id,
    };
  }

  // 2. Verificar se está em um lobby de Batalha
  if (userToLobbyRef && userToLobbyRef.has(userId)) {
    const lobbyId = userToLobbyRef.get(userId)!;
    const lobby = battleLobbiesRef?.get(lobbyId);

    if (lobby) {

      // Se o lobby está encerrado, não é uma sessão ativa
      if (lobby.status === "ENDED") {
        userToLobbyRef.delete(userId);
        // Continuar para retornar sessão vazia (não fazer return aqui)
      } else if (lobby.status === "BATTLING") {
        // Encontrar a batalha associada
        const battlesCount = BattleSessionsRef?.size ?? 0;

        for (const [battleId, battle] of BattleSessionsRef?.entries() ?? []) {
          if (battle.lobbyId === lobbyId && battle.status === "ACTIVE") {
            return {
              type: "BATTLE_SESSION",
              sessionId: battleId,
              lobbyId,
              battleId,
              battleStatus: "BATTLING",
            };
          }
        }

        // Se o lobby está em BATTLING mas não encontrou batalha, limpar estado órfão
        console.warn(
          `[SESSION] ⚠️ Lobby ${lobbyId} está BATTLING mas nenhuma batalha ativa foi encontrada!`
        );

        // Limpar referências de usuários para este lobby
        for (const player of lobby.players) {
          userToLobbyRef.delete(player.userId);
        }

        // Deletar o lobby órfão
        battleLobbiesRef?.delete(lobbyId);

        // Retornar sessão vazia - usuário está livre
        return {
          type: null,
          sessionId: null,
        };
      } else {
        // Lobby está em WAITING ou READY - retornar como sessão ativa
        return {
          type: "BATTLE_LOBBY",
          sessionId: lobbyId,
          lobbyId,
          battleStatus: lobby.status,
        };
      }
    }
  }

  // 3. Não está em nenhuma sessão
  return {
    type: null,
    sessionId: null,
  };
}

/**
 * Verifica se o usuário pode entrar em uma nova sessão
 * Retorna null se pode, ou uma mensagem de erro se não pode
 */
export async function canJoinNewSession(
  userId: string
): Promise<string | null> {
  const session = await getUserActiveSession(userId);

  if (session.type === "MATCH") {
    return `Você já está em uma partida (${session.matchStatus}). Saia da partida atual antes de entrar em outra.`;
  }

  if (session.type === "BATTLE_LOBBY") {
    return "Você já está em um lobby de Batalha. Saia do lobby antes de entrar em outra sessão.";
  }

  if (session.type === "BATTLE_SESSION") {
    return "Você está em uma sess�o de batalha em andamento. Conclua ou abandone a batalha antes de entrar em outra sessão.";
  }

  return null; // Pode entrar
}

/**
 * Remove usuário de uma batalha (lobby ou sessão) - usado internamente
 */
export function removeUserFromBattle(userId: string): boolean {
  if (!userToLobbyRef) return false;

  const lobbyId = userToLobbyRef.get(userId);
  if (!lobbyId) return false;

  const lobby = battleLobbiesRef?.get(lobbyId);
  if (!lobby) {
    userToLobbyRef.delete(userId);
    return true;
  }

  // Se é o host e está esperando, deleta o lobby
  if (lobby.hostUserId === userId && lobby.status === "WAITING") {
    // Limpar referências de todos os jogadores
    for (const player of lobby.players) {
      userToLobbyRef.delete(player.userId);
    }
    battleLobbiesRef?.delete(lobbyId);
    return true;
  }

  // Se não é o host, remove do lobby
  const playerIndex = lobby.players.findIndex((p) => p.userId === userId);
  if (playerIndex > 0) {
    // Não é o host (índice 0)
    lobby.players.splice(playerIndex, 1);
    // Reindexar jogadores restantes
    lobby.players.forEach((p, idx) => {
      p.playerIndex = idx;
    });
    lobby.status = "WAITING";
    userToLobbyRef.delete(userId);
    return true;
  }

  // Se é o host mas tem outros jogadores, não pode sair (precisa fechar o lobby)
  if (lobby.hostUserId === userId && lobby.players.length > 1) {
    return false;
  }

  userToLobbyRef.delete(userId);
  return true;
}

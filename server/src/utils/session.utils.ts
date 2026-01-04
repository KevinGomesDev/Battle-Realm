// src/utils/session.utils.ts
// Funções utilitárias para verificar sessão ativa do usuário (Partida ou Arena)

import { prisma } from "../lib/prisma";
import type {
  SessionType,
  ActiveSession,
  ArenaLobbyData,
  ArenaBattleData,
} from "../../../shared/types/session.types";

// ============================================
// Types para os Maps em memória
// ============================================

type ArenaLobbiesMap = Map<string, ArenaLobbyData>;
type ArenaBattlesMap = Map<string, ArenaBattleData>;
type UserToLobbyMap = Map<string, string>;

// Referência aos mapas de arena em memória (importados do handler)
// Será injetado pelo handler para evitar dependência circular
let arenaLobbiesRef: ArenaLobbiesMap | null = null;
let arenaBattlesRef: ArenaBattlesMap | null = null;
let userToLobbyRef: UserToLobbyMap | null = null;

/**
 * Injeta referências dos mapas de arena para uso nas funções de sessão
 */
export function setArenaRefs(
  lobbies: ArenaLobbiesMap,
  battles: ArenaBattlesMap,
  userToLobby: UserToLobbyMap
): void {
  arenaLobbiesRef = lobbies;
  arenaBattlesRef = battles;
  userToLobbyRef = userToLobby;
}

// Re-export types para compatibilidade
export type { SessionType, ActiveSession };

/**
 * Verifica se o usuário está em uma sessão ativa (Partida ou Arena)
 */
export async function getUserActiveSession(
  userId: string
): Promise<ActiveSession> {
  // 1. Verificar se está em uma partida ativa (WAITING, PREPARATION, ACTIVE)
  const matchPlayer = await prisma.matchPlayer.findFirst({
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

  if (matchPlayer && matchPlayer.match) {
    return {
      type: "MATCH",
      sessionId: matchPlayer.match.id,
      matchId: matchPlayer.match.id,
      matchStatus: matchPlayer.match.status,
      playerId: matchPlayer.id,
    };
  }

  // 2. Verificar se está em um lobby de Arena
  if (userToLobbyRef && userToLobbyRef.has(userId)) {
    const lobbyId = userToLobbyRef.get(userId)!;
    const lobby = arenaLobbiesRef?.get(lobbyId);

    if (lobby) {
      console.log(
        `[SESSION] Usuário ${userId} encontrado no lobby ${lobbyId}, status: ${lobby.status}`
      );

      // Se o lobby está encerrado, não é uma sessão ativa
      if (lobby.status === "ENDED") {
        console.log(
          `[SESSION] Lobby ${lobbyId} está ENDED, limpando referência do usuário`
        );
        userToLobbyRef.delete(userId);
        // Continuar para retornar sessão vazia (não fazer return aqui)
      } else if (lobby.status === "BATTLING") {
        // Encontrar a batalha associada
        const battlesCount = arenaBattlesRef?.size ?? 0;
        console.log(
          `[SESSION] Procurando batalha para lobby ${lobbyId} entre ${battlesCount} batalhas`
        );

        for (const [battleId, battle] of arenaBattlesRef?.entries() ?? []) {
          console.log(
            `[SESSION] Verificando batalha ${battleId}: lobbyId=${battle.lobbyId}, status=${battle.status}`
          );
          if (battle.lobbyId === lobbyId && battle.status === "ACTIVE") {
            console.log(`[SESSION] ✅ Batalha encontrada: ${battleId}`);
            return {
              type: "ARENA_BATTLE",
              sessionId: battleId,
              lobbyId,
              battleId,
              arenaStatus: "BATTLING",
            };
          }
        }

        // Se o lobby está em BATTLING mas não encontrou batalha, limpar estado órfão
        console.warn(
          `[SESSION] ⚠️ Lobby ${lobbyId} está BATTLING mas nenhuma batalha ativa foi encontrada!`
        );
        console.log(
          `[SESSION] 🧹 Limpando lobby órfão ${lobbyId} e referências de usuários...`
        );

        // Limpar referências de usuários para este lobby
        if (lobby.hostUserId) {
          userToLobbyRef.delete(lobby.hostUserId);
        }
        if (lobby.guestUserId) {
          userToLobbyRef.delete(lobby.guestUserId);
        }

        // Deletar o lobby órfão
        arenaLobbiesRef?.delete(lobbyId);

        console.log(
          `[SESSION] ✅ Lobby órfão ${lobbyId} foi limpo com sucesso`
        );

        // Retornar sessão vazia - usuário está livre
        return {
          type: null,
          sessionId: null,
        };
      } else {
        // Lobby está em WAITING ou READY - retornar como sessão ativa
        return {
          type: "ARENA_LOBBY",
          sessionId: lobbyId,
          lobbyId,
          arenaStatus: lobby.status,
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

  if (session.type === "ARENA_LOBBY") {
    return "Você já está em um lobby de Arena. Saia do lobby antes de entrar em outra sessão.";
  }

  if (session.type === "ARENA_BATTLE") {
    return "Você está em uma batalha de Arena em andamento. Conclua ou abandone a batalha antes de entrar em outra sessão.";
  }

  return null; // Pode entrar
}

/**
 * Remove usuário de uma arena (lobby ou batalha) - usado internamente
 */
export function removeUserFromArena(userId: string): boolean {
  if (!userToLobbyRef) return false;

  const lobbyId = userToLobbyRef.get(userId);
  if (!lobbyId) return false;

  const lobby = arenaLobbiesRef?.get(lobbyId);
  if (!lobby) {
    userToLobbyRef.delete(userId);
    return true;
  }

  // Se é o host e está esperando, deleta o lobby
  if (lobby.hostUserId === userId && lobby.status === "WAITING") {
    arenaLobbiesRef?.delete(lobbyId);
    userToLobbyRef.delete(userId);
    return true;
  }

  // Se é o guest, remove do lobby
  if (lobby.guestUserId === userId) {
    lobby.guestUserId = undefined;
    lobby.guestSocketId = undefined;
    lobby.guestKingdomId = undefined;
    lobby.status = "WAITING";
    userToLobbyRef.delete(userId);
    return true;
  }

  // Se é o host mas tem guest, não pode sair (precisa cancelar a batalha)
  if (lobby.hostUserId === userId && lobby.guestUserId) {
    return false;
  }

  userToLobbyRef.delete(userId);
  return true;
}

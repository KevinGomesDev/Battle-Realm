import { Server, Socket } from "socket.io";
import { prisma } from "../../lib/prisma";
import {
  activeBattles,
  battleLobbies,
  rematchLocks,
  rematchRequests,
  userToLobby,
} from "./battle-state";
import { cleanupBattle } from "./battle-timer";
import { deleteBattleFromDB } from "./battle-persistence";
import { createAndStartBattle, BOT_USER_ID } from "./battle-creation";

export function registerBattleRematchHandlers(
  io: Server,
  socket: Socket
): void {
  socket.on("battle:request_rematch", async ({ lobbyId, userId }) => {
    try {
      console.log(
        `[ARENA] request_rematch recebido: lobbyId=${lobbyId}, userId=${userId}`
      );

      const lobby = battleLobbies.get(lobbyId);
      if (!lobby) {
        console.log(
          `[ARENA] request_rematch ERRO: lobby não encontrado. Lobbies existentes: ${Array.from(
            battleLobbies.keys()
          ).join(", ")}`
        );
        return socket.emit("battle:error", { message: "Lobby não encontrado" });
      }

      const playerIds = lobby.players.map((p) => p.userId);
      console.log(
        `[ARENA] request_rematch: lobby encontrado com status=${
          lobby.status
        }, players=${playerIds.join(", ")}`
      );

      // Verificar se o usuário está no lobby
      if (!playerIds.includes(userId)) {
        return socket.emit("battle:error", {
          message: "Você não está neste lobby",
        });
      }

      if (lobby.status !== "ENDED") {
        console.log(
          `[ARENA] request_rematch ERRO: batalha ainda não terminou (status=${lobby.status})`
        );
        return socket.emit("battle:error", {
          message: "A batalha ainda não terminou",
        });
      }

      // Verificar se os outros jogadores ainda estão presentes
      const otherPlayers = playerIds.filter(
        (id) => id !== userId && id !== BOT_USER_ID
      );
      const missingPlayer = otherPlayers.find((id) => !userToLobby.has(id));
      if (missingPlayer) {
        console.log(
          `[ARENA] request_rematch ERRO: oponente ${missingPlayer} já saiu do lobby`
        );
        return socket.emit("battle:error", {
          message: "O oponente já saiu. Não é possível pedir revanche.",
        });
      }

      if (!rematchRequests.has(lobbyId)) {
        rematchRequests.set(lobbyId, new Set());
      }
      rematchRequests.get(lobbyId)!.add(userId);

      console.log(
        `[ARENA] ${userId} solicitou revanche no lobby ${lobbyId}. Pedidos: ${
          rematchRequests.get(lobbyId)!.size
        }/${lobby.players.filter((p) => p.userId !== BOT_USER_ID).length}`
      );

      io.to(lobbyId).emit("battle:rematch_requested", { lobbyId, userId });

      // Verificar se todos os jogadores humanos querem revanche
      const requests = rematchRequests.get(lobbyId)!;
      const humanPlayers = lobby.players.filter(
        (p) => p.userId !== BOT_USER_ID
      );
      const allHumansWantRematch = humanPlayers.every((p) =>
        requests.has(p.userId)
      );

      if (allHumansWantRematch) {
        if (rematchLocks.has(lobbyId)) {
          console.log(
            `[ARENA] Rematch já em processamento para lobby ${lobbyId}`
          );
          return;
        }
        rematchLocks.set(lobbyId, true);

        try {
          console.log(
            `[ARENA] Todos jogadores querem revanche! Iniciando nova batalha...`
          );

          rematchRequests.delete(lobbyId);

          // Buscar todos os kingdoms dos jogadores
          const kingdomsData = await Promise.all(
            lobby.players.map(async (player) => {
              if (player.userId === BOT_USER_ID) {
                // Para bot, criar kingdom virtual (será tratado em createAndStartBattle)
                const { createBotKingdom } = await import("./battle-creation");
                return createBotKingdom();
              }
              const kingdom = await prisma.kingdom.findUnique({
                where: { id: player.kingdomId },
                include: { regent: true },
              });
              return kingdom;
            })
          );

          // Verificar se todos os jogadores humanos têm regentes
          const invalidKingdom = kingdomsData.find(
            (k, idx) => lobby.players[idx].userId !== BOT_USER_ID && !k?.regent
          );
          if (
            invalidKingdom !== undefined &&
            kingdomsData.some(
              (k, idx) =>
                lobby.players[idx].userId !== BOT_USER_ID && !k?.regent
            )
          ) {
            io.to(lobbyId).emit("battle:error", {
              message:
                "Não foi possível iniciar revanche - regentes não encontrados",
            });
            return;
          }

          // Pegar referência da batalha antiga ANTES de criar a nova
          const oldBattle = [...activeBattles.values()].find(
            (b) => b.lobbyId === lobbyId
          );
          const oldBattleId = oldBattle?.id;

          // Resetar status do lobby para permitir nova batalha
          lobby.status = "READY";

          // Criar nova batalha
          await createAndStartBattle({
            lobby,
            kingdoms: kingdomsData.filter((k) => k !== null),
            io,
          });

          // Depois de criar a nova, limpar a antiga
          if (oldBattleId) {
            cleanupBattle(oldBattleId);
            await deleteBattleFromDB(oldBattleId);
          }
        } finally {
          rematchLocks.delete(lobbyId);
        }
      }
    } catch (err) {
      console.error("[ARENA] request_rematch error:", err);
      socket.emit("battle:error", { message: "Erro ao solicitar revanche" });
    }
  });

  socket.on("battle:decline_rematch", ({ lobbyId, userId }) => {
    try {
      console.log(
        `[ARENA] decline_rematch recebido: lobbyId=${lobbyId}, userId=${userId}`
      );

      const lobby = battleLobbies.get(lobbyId);
      if (!lobby) {
        console.log(`[ARENA] decline_rematch: lobby ${lobbyId} não encontrado`);
        return;
      }

      if (rematchRequests.has(lobbyId)) {
        rematchRequests.get(lobbyId)!.delete(userId);
        console.log(
          `[ARENA] decline_rematch: removido pedido de ${userId}. Pedidos restantes: ${
            rematchRequests.get(lobbyId)!.size
          }`
        );

        if (rematchRequests.get(lobbyId)!.size === 0) {
          rematchRequests.delete(lobbyId);
        }
      }

      io.to(lobbyId).emit("battle:rematch_declined", {
        lobbyId,
        userId,
        message: "O oponente saiu da tela de resultado",
      });

      console.log(
        `[ARENA] decline_rematch: notificado lobby ${lobbyId} que ${userId} declinou revanche`
      );

      userToLobby.delete(userId);

      // Verificar se todos os jogadores humanos saíram
      const remainingPlayers = lobby.players.filter(
        (p) =>
          p.userId !== userId &&
          p.userId !== BOT_USER_ID &&
          userToLobby.has(p.userId)
      );
      if (remainingPlayers.length === 0) {
        console.log(
          `[ARENA] decline_rematch: todos jogadores saíram, limpando lobby ${lobbyId}`
        );
        battleLobbies.delete(lobbyId);
        rematchRequests.delete(lobbyId);
        rematchLocks.delete(lobbyId);
      }
    } catch (err) {
      console.error("[ARENA] decline_rematch error:", err);
    }
  });
}

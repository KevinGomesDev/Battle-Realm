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
import { createAndStartBattle } from "./battle-creation";

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

      console.log(
        `[ARENA] request_rematch: lobby encontrado com status=${lobby.status}, host=${lobby.hostUserId}, guest=${lobby.guestUserId}`
      );

      if (lobby.hostUserId !== userId && lobby.guestUserId !== userId) {
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

      // Verificar se ambos os jogadores ainda estão presentes no lobby
      const opponentId =
        userId === lobby.hostUserId ? lobby.guestUserId : lobby.hostUserId;
      if (!opponentId || !userToLobby.has(opponentId)) {
        console.log(
          `[ARENA] request_rematch ERRO: oponente ${opponentId} já saiu do lobby`
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
        }/2`
      );

      io.to(lobbyId).emit("battle:rematch_requested", { lobbyId, userId });

      const requests = rematchRequests.get(lobbyId)!;
      if (
        requests.has(lobby.hostUserId) &&
        lobby.guestUserId &&
        requests.has(lobby.guestUserId)
      ) {
        if (rematchLocks.has(lobbyId)) {
          console.log(
            `[ARENA] Rematch já em processamento para lobby ${lobbyId}`
          );
          return;
        }
        rematchLocks.set(lobbyId, true);

        try {
          console.log(
            `[ARENA] Ambos jogadores querem revanche! Iniciando nova batalha...`
          );

          rematchRequests.delete(lobbyId);

          const hostKingdom = await prisma.kingdom.findUnique({
            where: { id: lobby.hostKingdomId },
            include: { units: { where: { category: "REGENT" } } },
          });

          const guestKingdom = await prisma.kingdom.findUnique({
            where: { id: lobby.guestKingdomId },
            include: { units: { where: { category: "REGENT" } } },
          });

          if (!hostKingdom?.units[0] || !guestKingdom?.units[0]) {
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

          // Criar nova batalha PRIMEIRO (para não haver gap na sessão)
          await createAndStartBattle({
            lobby,
            hostKingdom,
            guestKingdom,
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

      const remainingPlayers = [lobby.hostUserId, lobby.guestUserId].filter(
        (id) => id && id !== userId && userToLobby.has(id)
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

import { Server, Socket } from "socket.io";
import {
  activeBattles,
  battleLobbies,
  disconnectedPlayers,
  rematchRequests,
  socketToUser,
  userToLobby,
} from "./battle-state";
import { pauseBattleTimerIfNoPlayers } from "./battle-timer";

export function registerBattleDisconnectHandler(
  io: Server,
  socket: Socket
): void {
  socket.on("disconnect", () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      const lobbyId = userToLobby.get(userId);
      if (lobbyId) {
        const lobby = battleLobbies.get(lobbyId);
        if (lobby && lobby.status === "BATTLING") {
          console.log(
            `[ARENA] Usuário ${userId} desconectou durante batalha. Aguardando reconexão...`
          );

          disconnectedPlayers.set(userId, lobbyId);

          io.to(lobbyId).emit("battle:player_disconnected", {
            lobbyId,
            userId,
          });

          const battle = Array.from(activeBattles.values()).find(
            (b) => b.lobbyId === lobbyId && b.status === "ACTIVE"
          );
          if (battle) {
            pauseBattleTimerIfNoPlayers(battle.id);
          }
        } else if (lobby && lobby.status === "ENDED") {
          // Jogador desconectou após batalha terminar - notificar oponente que revanche foi cancelada
          console.log(
            `[ARENA] Usuário ${userId} desconectou da tela de resultado. Cancelando revanche...`
          );

          // Limpar pedidos de revanche
          if (rematchRequests.has(lobbyId)) {
            rematchRequests.get(lobbyId)!.delete(userId);
            if (rematchRequests.get(lobbyId)!.size === 0) {
              rematchRequests.delete(lobbyId);
            }
          }

          // Notificar o outro jogador
          io.to(lobbyId).emit("battle:rematch_declined", {
            lobbyId,
            userId,
            message: "O oponente saiu da tela de resultado",
          });

          userToLobby.delete(userId);

          // Se ambos saíram, limpar lobby
          const remainingPlayers = [lobby.hostUserId, lobby.guestUserId].filter(
            (id) => id && id !== userId && userToLobby.has(id)
          );
          if (remainingPlayers.length === 0) {
            console.log(
              `[ARENA] Todos jogadores saíram do lobby ${lobbyId} após batalha. Limpando...`
            );
            battleLobbies.delete(lobbyId);
            rematchRequests.delete(lobbyId);
          }
        } else if (lobby && lobby.status !== "BATTLING") {
          if (lobby.hostUserId === userId) {
            if (lobby.guestUserId) {
              userToLobby.delete(lobby.guestUserId);
            }
            battleLobbies.delete(lobbyId);
            io.to(lobbyId).emit("battle:lobby_closed", {
              lobbyId,
              reason: "Host desconectou",
            });
          } else {
            lobby.guestUserId = undefined;
            lobby.guestSocketId = undefined;
            lobby.guestKingdomId = undefined;
            lobby.status = "WAITING";
            io.to(lobbyId).emit("battle:player_left", {
              lobbyId,
              userId,
              status: "WAITING",
            });
          }
          userToLobby.delete(userId);
        }
      }
      socketToUser.delete(socket.id);
    }
  });
}

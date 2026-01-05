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
import { BOT_USER_ID } from "./battle-creation";

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

          // Notificar os outros jogadores
          io.to(lobbyId).emit("battle:rematch_declined", {
            lobbyId,
            userId,
            message: "O oponente saiu da tela de resultado",
          });

          userToLobby.delete(userId);

          // Se todos os jogadores humanos saíram, limpar lobby
          const remainingPlayers = lobby.players.filter(
            (p) =>
              p.userId !== userId &&
              p.userId !== BOT_USER_ID &&
              userToLobby.has(p.userId)
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
            // Host desconectou - fechar lobby e limpar todos os jogadores
            for (const player of lobby.players) {
              if (player.userId !== userId) {
                userToLobby.delete(player.userId);
              }
            }
            battleLobbies.delete(lobbyId);
            io.to(lobbyId).emit("battle:lobby_closed", {
              lobbyId,
              reason: "Host desconectou",
            });
          } else {
            // Outro jogador desconectou - remover do lobby
            const playerIndex = lobby.players.findIndex(
              (p) => p.userId === userId
            );
            if (playerIndex > 0) {
              lobby.players.splice(playerIndex, 1);
              // Reindexar jogadores restantes
              lobby.players.forEach((p, idx) => {
                p.playerIndex = idx;
              });
            }
            lobby.status = "WAITING";
            io.to(lobbyId).emit("battle:player_left", {
              lobbyId,
              userId,
              status: "WAITING",
              players: lobby.players,
            });
          }
          userToLobby.delete(userId);
        }
      }
      socketToUser.delete(socket.id);
    }
  });
}

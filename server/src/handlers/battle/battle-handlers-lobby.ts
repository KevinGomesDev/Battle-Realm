import { Server, Socket } from "socket.io";
import { prisma } from "../../lib/prisma";
import { canJoinNewSession } from "../../utils/session.utils";
import { battleLobbies, socketToUser, userToLobby } from "./battle-state";
import { saveLobbyToDB, deleteLobbyFromDB } from "./battle-persistence";
import {
  createAndStartBattle,
  addBotPlayerToLobby,
  createBotKingdom,
} from "./battle-creation";
import type { BattleLobby } from "./battle-types";
import type { ArenaLobbyPlayer } from "../../../../shared/types/session.types";

export function registerBattleLobbyHandlers(io: Server, socket: Socket): void {
  socket.on(
    "battle:create_lobby",
    async ({ userId, kingdomId, maxPlayers = 2, vsBot }) => {
      try {
        const blockReason = await canJoinNewSession(userId);
        if (blockReason) {
          return socket.emit("battle:error", { message: blockReason });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          return socket.emit("battle:error", {
            message: "Usuário não encontrado",
          });
        }

        const kingdom = await prisma.kingdom.findUnique({
          where: { id: kingdomId },
          include: { regent: true },
        });
        if (!kingdom) {
          return socket.emit("battle:error", {
            message: "Reino não encontrado",
          });
        }
        if (kingdom.ownerId !== userId) {
          return socket.emit("battle:error", {
            message: "Este reino não pertence a você",
          });
        }
        if (!kingdom.regent) {
          return socket.emit("battle:error", {
            message: "Reino sem Regente definido",
          });
        }

        if (userToLobby.has(userId)) {
          return socket.emit("battle:error", {
            message: "Você já está em um lobby",
          });
        }

        // Validar maxPlayers (2-8)
        const validMaxPlayers = Math.max(2, Math.min(8, maxPlayers));

        const lobbyId = `battle_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Criar jogador host
        const hostPlayer: ArenaLobbyPlayer = {
          userId,
          socketId: socket.id,
          kingdomId,
          playerIndex: 0,
          isReady: true,
        };

        const lobby: BattleLobby = {
          lobbyId,
          hostUserId: userId,
          maxPlayers: validMaxPlayers,
          players: [hostPlayer],
          status: "WAITING",
          createdAt: new Date(),
          vsBot: vsBot === true,
        };

        battleLobbies.set(lobbyId, lobby);
        userToLobby.set(userId, lobbyId);
        socketToUser.set(socket.id, userId);

        await saveLobbyToDB(lobby);

        socket.join(lobbyId);

        // Se é contra BOT, adicionar bot ao lobby e iniciar batalha imediatamente
        if (vsBot === true) {
          console.log(
            `[ARENA] Lobby BOT criado: ${lobbyId} por ${user.username} - Iniciando batalha...`
          );

          try {
            // Adicionar jogador BOT ao lobby
            addBotPlayerToLobby(lobby);

            // Criar kingdom virtual do BOT
            const botKingdom = createBotKingdom();

            // Usar fluxo normal de criação de batalha
            // createAndStartBattle já emite battle:battle_started para todos na sala
            const battle = await createAndStartBattle({
              lobby,
              kingdoms: [kingdom, botKingdom],
              io,
            });

            console.log(`[ARENA] Batalha BOT iniciada: ${battle.id}`);
          } catch (err) {
            console.error("[ARENA] Erro ao criar batalha BOT:", err);
            socket.emit("battle:error", {
              message: "Erro ao criar batalha contra BOT",
            });
          }
          return;
        }

        socket.emit("battle:lobby_created", {
          lobbyId,
          hostUserId: userId,
          maxPlayers: validMaxPlayers,
          playerCount: 1,
          hostKingdomName: kingdom.name,
          status: "WAITING",
        });

        io.emit("battle:lobbies_updated", {
          action: "created",
          lobby: {
            lobbyId,
            hostUserId: userId,
            hostUsername: user.username,
            hostKingdomName: kingdom.name,
            maxPlayers: validMaxPlayers,
            playerCount: 1,
            createdAt: new Date(),
          },
        });

        console.log(
          `[ARENA] Lobby criado: ${lobbyId} por ${user.username} (max: ${validMaxPlayers})`
        );
      } catch (err) {
        console.error("[ARENA] create_lobby error:", err);
        socket.emit("battle:error", { message: "Erro ao criar lobby" });
      }
    }
  );

  socket.on("battle:list_lobbies", async () => {
    try {
      const availableLobbies: any[] = [];

      for (const [id, lobby] of battleLobbies) {
        if (
          lobby.status === "WAITING" &&
          lobby.players.length < lobby.maxPlayers
        ) {
          const hostPlayer = lobby.players[0];
          const hostKingdom = await prisma.kingdom.findUnique({
            where: { id: hostPlayer.kingdomId },
          });
          const hostUser = await prisma.user.findUnique({
            where: { id: lobby.hostUserId },
          });
          availableLobbies.push({
            lobbyId: id,
            hostUsername: hostUser?.username || "Unknown",
            hostKingdomName: hostKingdom?.name || "Unknown",
            maxPlayers: lobby.maxPlayers,
            playerCount: lobby.players.length,
            createdAt: lobby.createdAt,
          });
        }
      }

      socket.emit("battle:lobbies_list", { lobbies: availableLobbies });
    } catch (err) {
      console.error("[ARENA] list_lobbies error:", err);
      socket.emit("battle:error", { message: "Erro ao listar lobbies" });
    }
  });

  socket.on("battle:join_lobby", async ({ lobbyId, userId, kingdomId }) => {
    try {
      const blockReason = await canJoinNewSession(userId);
      if (blockReason) {
        return socket.emit("battle:error", { message: blockReason });
      }

      const lobby = battleLobbies.get(lobbyId);
      if (!lobby) {
        return socket.emit("battle:error", { message: "Lobby não encontrado" });
      }
      if (lobby.status !== "WAITING") {
        return socket.emit("battle:error", {
          message: "Lobby não está disponível",
        });
      }
      if (lobby.players.some((p) => p.userId === userId)) {
        return socket.emit("battle:error", {
          message: "Você já está neste lobby",
        });
      }
      if (lobby.players.length >= lobby.maxPlayers) {
        return socket.emit("battle:error", {
          message: "Lobby cheio",
        });
      }
      if (userToLobby.has(userId)) {
        return socket.emit("battle:error", {
          message: "Você já está em um lobby",
        });
      }

      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
        include: { regent: true },
      });
      if (!kingdom) {
        return socket.emit("battle:error", { message: "Reino não encontrado" });
      }
      if (kingdom.ownerId !== userId) {
        return socket.emit("battle:error", {
          message: "Este reino não pertence a você",
        });
      }
      if (!kingdom.regent) {
        return socket.emit("battle:error", {
          message: "Reino sem Regente definido",
        });
      }

      // Adicionar jogador ao lobby
      const newPlayer: ArenaLobbyPlayer = {
        userId,
        socketId: socket.id,
        kingdomId,
        playerIndex: lobby.players.length,
        isReady: true,
      };
      lobby.players.push(newPlayer);

      // Verificar se lobby está cheio
      const isLobbyFull = lobby.players.length >= lobby.maxPlayers;
      if (isLobbyFull) {
        lobby.status = "READY";
      }

      userToLobby.set(userId, lobbyId);
      socketToUser.set(socket.id, userId);

      socket.join(lobbyId);

      // Buscar informações de todos os jogadores
      const playersInfo = await Promise.all(
        lobby.players.map(async (p) => {
          const user = await prisma.user.findUnique({
            where: { id: p.userId },
          });
          const kingdom = await prisma.kingdom.findUnique({
            where: { id: p.kingdomId },
          });
          return {
            userId: p.userId,
            username: user?.username || "Unknown",
            kingdomId: p.kingdomId,
            kingdomName: kingdom?.name || "Unknown",
            playerIndex: p.playerIndex,
            isReady: p.isReady,
          };
        })
      );

      const user = await prisma.user.findUnique({ where: { id: userId } });

      socket.emit("battle:lobby_joined", {
        lobbyId,
        maxPlayers: lobby.maxPlayers,
        players: playersInfo,
        status: lobby.status,
        createdAt: lobby.createdAt,
      });

      io.to(lobbyId).emit("battle:player_joined", {
        lobbyId,
        playerCount: lobby.players.length,
        maxPlayers: lobby.maxPlayers,
        newPlayer: {
          userId,
          username: user?.username || "Unknown",
          kingdomName: kingdom.name,
          playerIndex: newPlayer.playerIndex,
        },
        players: playersInfo,
        status: lobby.status,
      });

      if (isLobbyFull) {
        io.emit("battle:lobbies_updated", {
          action: "removed",
          lobbyId,
        });
      } else {
        io.emit("battle:lobbies_updated", {
          action: "updated",
          lobbyId,
          playerCount: lobby.players.length,
          maxPlayers: lobby.maxPlayers,
        });
      }

      await saveLobbyToDB(lobby);

      console.log(
        `[ARENA] ${user?.username} entrou no lobby ${lobbyId} (${lobby.players.length}/${lobby.maxPlayers})`
      );
    } catch (err) {
      console.error("[ARENA] join_lobby error:", err);
      socket.emit("battle:error", { message: "Erro ao entrar no lobby" });
    }
  });

  socket.on("battle:leave_lobby", async ({ userId }) => {
    try {
      const lobbyId = userToLobby.get(userId);
      if (!lobbyId) {
        return socket.emit("battle:error", {
          message: "Você não está em um lobby",
        });
      }

      const lobby = battleLobbies.get(lobbyId);
      if (!lobby) {
        userToLobby.delete(userId);
        return;
      }

      socket.leave(lobbyId);
      userToLobby.delete(userId);
      socketToUser.delete(socket.id);

      if (lobby.hostUserId === userId) {
        // Host saiu - fechar lobby e remover todos
        for (const player of lobby.players) {
          userToLobby.delete(player.userId);
        }
        io.to(lobbyId).emit("battle:lobby_closed", {
          lobbyId,
          reason: "Host saiu do lobby",
        });
        battleLobbies.delete(lobbyId);
        io.emit("battle:lobbies_updated", {
          action: "removed",
          lobbyId,
        });
        await deleteLobbyFromDB(lobbyId);
        console.log(`[ARENA] Lobby ${lobbyId} fechado (host saiu)`);
      } else {
        // Remover jogador do array
        const playerIndex = lobby.players.findIndex((p) => p.userId === userId);
        if (playerIndex !== -1) {
          lobby.players.splice(playerIndex, 1);

          // Reindexar jogadores restantes
          lobby.players.forEach((p, idx) => {
            if (idx > 0) {
              // Host mantém index 0
              p.playerIndex = idx;
            }
          });
        }

        lobby.status = "WAITING";

        // Buscar info atualizada dos jogadores restantes
        const playersInfo = await Promise.all(
          lobby.players.map(async (p) => {
            const user = await prisma.user.findUnique({
              where: { id: p.userId },
            });
            const kingdom = await prisma.kingdom.findUnique({
              where: { id: p.kingdomId },
            });
            return {
              userId: p.userId,
              username: user?.username || "Unknown",
              kingdomId: p.kingdomId,
              kingdomName: kingdom?.name || "Unknown",
              playerIndex: p.playerIndex,
              isReady: p.isReady,
            };
          })
        );

        io.to(lobbyId).emit("battle:player_left", {
          lobbyId,
          userId,
          playerCount: lobby.players.length,
          maxPlayers: lobby.maxPlayers,
          players: playersInfo,
          status: "WAITING",
        });

        io.emit("battle:lobbies_updated", {
          action: "updated",
          lobbyId,
          playerCount: lobby.players.length,
          maxPlayers: lobby.maxPlayers,
        });

        await saveLobbyToDB(lobby);
      }
    } catch (err) {
      console.error("[ARENA] leave_lobby error:", err);
    }
  });

  socket.on("battle:start_battle", async ({ lobbyId, userId }) => {
    try {
      const lobby = battleLobbies.get(lobbyId);
      if (!lobby) {
        return socket.emit("battle:error", { message: "Lobby não encontrado" });
      }
      if (lobby.hostUserId !== userId) {
        return socket.emit("battle:error", {
          message: "Apenas o host pode iniciar",
        });
      }
      if (lobby.status !== "READY") {
        return socket.emit("battle:error", {
          message: "Lobby não está pronto",
        });
      }
      if (lobby.players.length < 2) {
        return socket.emit("battle:error", { message: "Aguardando jogadores" });
      }

      // Buscar todos os kingdoms dos jogadores
      const kingdomsData = await Promise.all(
        lobby.players.map(async (player) => {
          const kingdom = await prisma.kingdom.findUnique({
            where: { id: player.kingdomId },
            include: { regent: true },
          });
          return { player, kingdom };
        })
      );

      // Verificar se todos os kingdoms têm regente
      const invalidKingdom = kingdomsData.find((k) => !k.kingdom?.regent);
      if (invalidKingdom) {
        return socket.emit("battle:error", {
          message: "Um dos reinos não tem Regente",
        });
      }

      await createAndStartBattle({
        lobby,
        kingdoms: kingdomsData.map((k) => k.kingdom!),
        io,
      });
    } catch (err) {
      console.error("[ARENA] start_battle error:", err);
      socket.emit("battle:error", { message: "Erro ao iniciar batalha" });
    }
  });
}

import { Server, Socket } from "socket.io";
import { prisma } from "../../lib/prisma";
import { canJoinNewSession } from "../../utils/session.utils";
import { battleLobbies, socketToUser, userToLobby } from "./battle-state";
import { saveLobbyToDB, deleteLobbyFromDB } from "./battle-persistence";
import { createAndStartBattle } from "./battle-creation";
import type { BattleLobby } from "./battle-types";

export function registerBattleLobbyHandlers(io: Server, socket: Socket): void {
  socket.on("battle:create_lobby", async ({ userId, kingdomId }) => {
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
        include: { units: { where: { category: "REGENT" } } },
      });
      if (!kingdom) {
        return socket.emit("battle:error", { message: "Reino não encontrado" });
      }
      if (kingdom.ownerId !== userId) {
        return socket.emit("battle:error", {
          message: "Este reino não pertence a você",
        });
      }
      if (!kingdom.units.length) {
        return socket.emit("battle:error", {
          message: "Reino sem Regente definido",
        });
      }

      if (userToLobby.has(userId)) {
        return socket.emit("battle:error", {
          message: "Você já está em um lobby",
        });
      }

      const lobbyId = `battle_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const lobby: BattleLobby = {
        lobbyId,
        hostUserId: userId,
        hostSocketId: socket.id,
        hostKingdomId: kingdomId,
        status: "WAITING",
        createdAt: new Date(),
      };

      battleLobbies.set(lobbyId, lobby);
      userToLobby.set(userId, lobbyId);
      socketToUser.set(socket.id, userId);

      await saveLobbyToDB(lobby);

      socket.join(lobbyId);

      socket.emit("battle:lobby_created", {
        lobbyId,
        hostUserId: userId,
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
          createdAt: new Date(),
        },
      });

      console.log(`[ARENA] Lobby criado: ${lobbyId} por ${user.username}`);
    } catch (err) {
      console.error("[ARENA] create_lobby error:", err);
      socket.emit("battle:error", { message: "Erro ao criar lobby" });
    }
  });

  socket.on("battle:list_lobbies", async () => {
    try {
      const availableLobbies: any[] = [];

      for (const [id, lobby] of battleLobbies) {
        if (lobby.status === "WAITING") {
          const hostKingdom = await prisma.kingdom.findUnique({
            where: { id: lobby.hostKingdomId },
          });
          const hostUser = await prisma.user.findUnique({
            where: { id: lobby.hostUserId },
          });
          availableLobbies.push({
            lobbyId: id,
            hostUsername: hostUser?.username || "Unknown",
            hostKingdomName: hostKingdom?.name || "Unknown",
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
      if (lobby.hostUserId === userId) {
        return socket.emit("battle:error", {
          message: "Você é o host deste lobby",
        });
      }
      if (userToLobby.has(userId)) {
        return socket.emit("battle:error", {
          message: "Você já está em um lobby",
        });
      }

      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
        include: { units: { where: { category: "REGENT" } } },
      });
      if (!kingdom) {
        return socket.emit("battle:error", { message: "Reino não encontrado" });
      }
      if (kingdom.ownerId !== userId) {
        return socket.emit("battle:error", {
          message: "Este reino não pertence a você",
        });
      }
      if (!kingdom.units.length) {
        return socket.emit("battle:error", {
          message: "Reino sem Regente definido",
        });
      }

      lobby.guestUserId = userId;
      lobby.guestSocketId = socket.id;
      lobby.guestKingdomId = kingdomId;
      lobby.status = "READY";

      userToLobby.set(userId, lobbyId);
      socketToUser.set(socket.id, userId);

      socket.join(lobbyId);

      const hostKingdom = await prisma.kingdom.findUnique({
        where: { id: lobby.hostKingdomId },
      });
      const guestUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      const hostUser = await prisma.user.findUnique({
        where: { id: lobby.hostUserId },
      });

      socket.emit("battle:lobby_joined", {
        lobbyId,
        hostUserId: lobby.hostUserId,
        hostUsername: hostUser?.username || "Unknown",
        hostKingdomName: hostKingdom?.name || "Unknown",
        guestUserId: userId,
        guestUsername: guestUser?.username || "Unknown",
        guestKingdomName: kingdom.name,
        status: "READY",
        createdAt: lobby.createdAt,
      });

      io.to(lobbyId).emit("battle:player_joined", {
        lobbyId,
        guestUserId: userId,
        guestUsername: guestUser?.username || "Unknown",
        guestKingdomName: kingdom.name,
        status: "READY",
      });

      io.emit("battle:lobbies_updated", {
        action: "removed",
        lobbyId,
      });

      await saveLobbyToDB(lobby);

      console.log(`[ARENA] ${guestUser?.username} entrou no lobby ${lobbyId}`);
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
        if (lobby.guestUserId) {
          userToLobby.delete(lobby.guestUserId);
          io.to(lobbyId).emit("battle:lobby_closed", {
            lobbyId,
            reason: "Host saiu do lobby",
          });
        }
        battleLobbies.delete(lobbyId);
        io.emit("battle:lobbies_updated", {
          action: "removed",
          lobbyId,
        });
        await deleteLobbyFromDB(lobbyId);
        console.log(`[ARENA] Lobby ${lobbyId} fechado (host saiu)`);
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

        const hostUser = await prisma.user.findUnique({
          where: { id: lobby.hostUserId },
        });
        const hostKingdom = await prisma.kingdom.findUnique({
          where: { id: lobby.hostKingdomId },
        });
        io.emit("battle:lobbies_updated", {
          action: "created",
          lobby: {
            lobbyId,
            hostUsername: hostUser?.username || "Unknown",
            hostKingdomName: hostKingdom?.name || "Unknown",
            createdAt: lobby.createdAt,
          },
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
      if (!lobby.guestUserId || !lobby.guestKingdomId) {
        return socket.emit("battle:error", { message: "Aguardando oponente" });
      }

      const hostKingdom = await prisma.kingdom.findUnique({
        where: { id: lobby.hostKingdomId },
        include: { units: { where: { category: "REGENT" } } },
      });
      const guestKingdom = await prisma.kingdom.findUnique({
        where: { id: lobby.guestKingdomId },
        include: { units: { where: { category: "REGENT" } } },
      });

      if (!hostKingdom?.units.length || !guestKingdom?.units.length) {
        return socket.emit("battle:error", {
          message: "Um dos reinos não tem Regente",
        });
      }

      await createAndStartBattle({
        lobby,
        hostKingdom,
        guestKingdom,
        io,
      });
    } catch (err) {
      console.error("[ARENA] start_battle error:", err);
      socket.emit("battle:error", { message: "Erro ao iniciar batalha" });
    }
  });
}

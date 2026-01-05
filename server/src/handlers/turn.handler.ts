// src/handlers/turn.handler.ts
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { TurnType } from "../types";
import {
  advanceTurn,
  checkAllPlayersFinished,
  restoreAllPlayersResources,
  calculatePlayerResources,
} from "../utils/turn.utils";
import {
  buildStructure,
  getAvailableStructures,
  getTerritoryConstructionInfo,
} from "../utils/construction.utils";

/**
 * Broadcast estado completo da partida para todos os jogadores
 *
 * @param io - Socket.io Server
 * @param matchId - ID da partida
 */
async function broadcastMatchState(io: Server, matchId: string) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        players: { include: { user: true, kingdom: true } },
      },
    });

    if (!match) return;

    // Determinar quem deve agir agora
    let activePlayerIds: string[] = [];
    if (match.status === "ACTIVE") {
      activePlayerIds = match.players
        .filter((p) => {
          if (match.currentTurn === "ADMINISTRACAO") {
            return !p.hasFinishedAdminTurn;
          }
          return !p.hasPlayedTurn;
        })
        .map((p) => p.id);
    }

    const matchState = {
      matchId: match.id,
      status: match.status,
      currentRound: match.currentRound,
      currentTurn: match.currentTurn,
      activePlayerIds,
      players: match.players.map((p) => ({
        id: p.id,
        userId: p.userId,
        username: p.user?.username,
        kingdomName: p.kingdom?.name,
        playerIndex: p.playerIndex,
        playerColor: p.playerColor,
        resources: p.resources ? JSON.parse(p.resources) : {},
        hasFinishedCurrentTurn:
          match.currentTurn === "ADMINISTRACAO"
            ? p.hasFinishedAdminTurn
            : p.hasPlayedTurn,
      })),
      updatedAt: new Date(),
    };

    io.to(matchId).emit("match:state_updated", matchState);
  } catch (error) {
    console.error("[TURN] Erro ao broadcast estado:", error);
  }
}

export const registerTurnHandlers = (io: Server, socket: Socket) => {
  // --- INICIAR TURNO DE ADMINISTRAÇÃO ---
  // Este evento é chamado automaticamente quando a partida começa ou quando uma rodada termina
  socket.on("turn:start_administration", async ({ matchId }) => {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { players: true },
      });

      if (!match) {
        socket.emit("error", { message: "Partida não encontrada" });
        return;
      }

      // Verifica se realmente está no turno de administração
      if (match.currentTurn !== TurnType.ADMINISTRACAO) {
        socket.emit("error", {
          message: "Não está no turno de administração",
        });
        return;
      }

      // Restaura recursos de todos os jogadores
      await restoreAllPlayersResources(matchId);

      // Notifica todos os jogadores
      io.to(matchId).emit("turn:administration_started", {
        round: match.currentRound,
        turn: match.currentTurn,
        message: `Rodada ${match.currentRound} - Turno de Administração iniciado!`,
      });

      // Envia recursos atualizados para cada jogador
      for (const player of match.players) {
        const resources = await calculatePlayerResources(matchId, player.id);
        io.to(matchId).emit("player:resources_updated", {
          playerId: player.id,
          resources,
        });
      }

      // Broadcast estado completo
      await broadcastMatchState(io, matchId);
    } catch (error) {
      console.error("[TURN] Erro ao iniciar turno de administração:", error);
      socket.emit("error", {
        message: "Erro ao iniciar turno de administração",
      });
    }
  });

  // --- INICIAR TURNO DE EXÉRCITOS ---
  socket.on("turn:start_armies", async ({ matchId }) => {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!match) {
        socket.emit("error", { message: "Partida não encontrada" });
        return;
      }

      if (match.currentTurn !== TurnType.EXERCITOS) {
        socket.emit("error", {
          message: "Não está no turno de exércitos",
        });
        return;
      }

      // Notifica todos os jogadores
      io.to(matchId).emit("turn:armies_started", {
        round: match.currentRound,
        turn: match.currentTurn,
        message: `Rodada ${match.currentRound} - Turno de Exércitos iniciado!`,
      });
    } catch (error) {
      console.error("[TURN] Erro ao iniciar turno de exércitos:", error);
      socket.emit("error", {
        message: "Erro ao iniciar turno de exércitos",
      });
    }
  });

  // --- OBTER RECURSOS DO JOGADOR ---
  socket.on("turn:get_resources", async ({ matchId, playerId }) => {
    try {
      const player = await prisma.matchKingdom.findFirst({
        where: {
          matchId,
          id: playerId,
        },
      });

      if (!player) {
        socket.emit("error", { message: "Jogador não encontrado" });
        return;
      }

      const resources = JSON.parse(player.resources);
      socket.emit("turn:resources_result", { resources });
    } catch (error) {
      console.error("[TURN] Erro ao obter recursos:", error);
      socket.emit("error", { message: "Erro ao obter recursos" });
    }
  });

  // --- CONSTRUIR ESTRUTURA ---
  socket.on(
    "turn:build_structure",
    async ({ matchId, playerId, territoryId, structureType }) => {
      try {
        const match = await prisma.match.findUnique({
          where: { id: matchId },
        });

        if (!match) {
          socket.emit("error", { message: "Partida não encontrada" });
          return;
        }

        // Verifica se está no turno de administração
        if (match.currentTurn !== TurnType.ADMINISTRACAO) {
          socket.emit("error", {
            message:
              "Construções só podem ser feitas no Turno de Administração",
          });
          return;
        }

        // Tenta construir
        const result = await buildStructure(
          matchId,
          playerId,
          territoryId,
          structureType
        );

        if (result.success) {
          // Atualiza recursos do jogador
          const player = await prisma.matchKingdom.findUnique({
            where: { id: playerId },
          });
          const resources = JSON.parse(player!.resources);

          // Notifica o jogador
          socket.emit("turn:build_success", {
            message: result.message,
            structure: result.structure,
            resources,
          });

          // Notifica todos na sala sobre a nova estrutura
          io.to(matchId).emit("structure:created", {
            structure: result.structure,
            playerId,
            territoryId,
          });
        } else {
          socket.emit("turn:build_failed", { message: result.message });
        }
      } catch (error) {
        console.error("[TURN] Erro ao construir estrutura:", error);
        socket.emit("error", { message: "Erro ao construir estrutura" });
      }
    }
  );

  // --- LISTAR ESTRUTURAS DISPONÍVEIS ---
  socket.on("turn:list_available_structures", async () => {
    try {
      const structures = getAvailableStructures();
      socket.emit("turn:available_structures", { structures });
    } catch (error) {
      console.error("[TURN] Erro ao listar estruturas:", error);
      socket.emit("error", { message: "Erro ao listar estruturas" });
    }
  });

  // --- OBTER INFORMAÇÕES DE CONSTRUÇÃO DE UM TERRITÓRIO ---
  socket.on("turn:get_territory_construction_info", async ({ territoryId }) => {
    try {
      const info = await getTerritoryConstructionInfo(territoryId);

      if (!info) {
        socket.emit("error", { message: "Território não encontrado" });
        return;
      }

      socket.emit("turn:territory_construction_info", { info });
    } catch (error) {
      console.error("[TURN] Erro ao obter informações de construção:", error);
      socket.emit("error", {
        message: "Erro ao obter informações de construção",
      });
    }
  });

  // --- FINALIZAR TURNO DO JOGADOR ---
  socket.on("turn:finish_turn", async ({ matchId, playerId }) => {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!match) {
        socket.emit("error", { message: "Partida não encontrada" });
        return;
      }

      // Marca que o jogador terminou seu turno
      const currentTurn = match.currentTurn as TurnType;

      if (currentTurn === TurnType.ADMINISTRACAO) {
        await prisma.matchKingdom.update({
          where: { id: playerId },
          data: { hasFinishedAdminTurn: true },
        });
      } else {
        await prisma.matchKingdom.update({
          where: { id: playerId },
          data: { hasPlayedTurn: true },
        });
      }

      // Notifica que o jogador terminou
      io.to(matchId).emit("turn:player_finished", {
        playerId,
        turn: currentTurn,
      });

      // Broadcast estado para todos verem quem falta terminar
      await broadcastMatchState(io, matchId);

      // Verifica se todos os jogadores terminaram
      const allFinished = await checkAllPlayersFinished(matchId, currentTurn);

      if (allFinished) {
        // Avança para o próximo turno
        const { newRound, newTurn, roundAdvanced } = await advanceTurn(matchId);

        // Notifica sobre a mudança (deprecated, mantido para compatibilidade)
        if (roundAdvanced) {
          io.to(matchId).emit("round:advanced", {
            round: newRound,
            turn: newTurn,
            message: `Rodada ${newRound} iniciada! Turno: ${newTurn}`,
          });
        } else {
          io.to(matchId).emit("turn:advanced", {
            round: newRound,
            turn: newTurn,
            message: `Avançando para: ${newTurn}`,
          });
        }

        // Se iniciou novo turno de administração, restaura recursos
        if (newTurn === TurnType.ADMINISTRACAO) {
          await restoreAllPlayersResources(matchId);

          const players = await prisma.matchKingdom.findMany({
            where: { matchId },
          });

          for (const player of players) {
            const resources = JSON.parse(player.resources);
            io.to(matchId).emit("player:resources_updated", {
              playerId: player.id,
              resources,
            });
          }
        }

        // Broadcast estado completo com novo turno/rodada
        await broadcastMatchState(io, matchId);
      }
    } catch (error) {
      console.error("[TURN] Erro ao finalizar turno:", error);
      socket.emit("error", { message: "Erro ao finalizar turno" });
    }
  });

  // --- OBTER STATUS DA PARTIDA (Rodada e Turno atuais) ---
  socket.on("turn:get_match_status", async ({ matchId }) => {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          players: {
            select: {
              id: true,
              hasPlayedTurn: true,
              hasFinishedAdminTurn: true,
              resources: true,
            },
          },
        },
      });

      if (!match) {
        socket.emit("error", { message: "Partida não encontrada" });
        return;
      }

      socket.emit("turn:match_status", {
        round: match.currentRound,
        turn: match.currentTurn,
        status: match.status,
        players: match.players.map((p) => ({
          id: p.id,
          hasFinishedTurn:
            match.currentTurn === TurnType.ADMINISTRACAO
              ? p.hasFinishedAdminTurn
              : p.hasPlayedTurn,
          resources: JSON.parse(p.resources),
        })),
      });
    } catch (error) {
      console.error("[TURN] Erro ao obter status da partida:", error);
      socket.emit("error", { message: "Erro ao obter status da partida" });
    }
  });
};

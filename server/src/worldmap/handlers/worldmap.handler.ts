// server/src/worldmap/handlers/worldmap.handler.ts
import { Socket, Server } from "socket.io";
import { prisma } from "../../lib/prisma";
import { TERRAIN_TYPES } from "../../../../shared/data/terrains";

export const registerWorldMapHandlers = (io: Server, socket: Socket) => {
  // --- 1. DADOS ESTÁTICOS DE TERRENOS ---
  socket.on("worldmap:get_terrains", () => {
    if (Object.keys(TERRAIN_TYPES).length === 0) {
      console.error("[ERRO CRÍTICO] TERRAIN_TYPES está vazio no servidor!");
    }
    socket.emit("worldmap:terrains_data", TERRAIN_TYPES);
  });

  // --- 2. CARREGAR MAPA DE UMA PARTIDA ---
  socket.on("worldmap:request_map", async (data) => {
    try {
      let targetMatchId = data?.matchId;

      // Fallback: Se não passar matchId, busca a última partida ativa do usuário
      if (!targetMatchId) {
        const activeMatch = await prisma.match.findFirst({
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
        });

        if (!activeMatch) {
          return socket.emit("error", {
            message: "Nenhuma partida ativa encontrada.",
          });
        }

        targetMatchId = activeMatch.id;
      }

      // Busca os territórios
      const territories = await prisma.territory.findMany({
        where: { matchId: targetMatchId },
        orderBy: { mapIndex: "asc" },
      });

      console.log(`[WORLDMAP] Enviando mapa da partida ${targetMatchId}`);
      socket.emit("worldmap:map_data", territories);
    } catch (error) {
      console.error("[WORLDMAP] Erro ao carregar mapa:", error);
      socket.emit("error", { message: "Erro interno ao carregar o mapa." });
    }
  });

  // --- 3. DETALHES DE UM TERRITÓRIO ESPECÍFICO ---
  socket.on("worldmap:get_territory", async ({ territoryId }) => {
    try {
      const territory = await prisma.territory.findUnique({
        where: { id: territoryId },
      });

      if (!territory) {
        return socket.emit("error", {
          message: "Território não encontrado.",
        });
      }

      // Busca informações adicionais se houver dono
      let ownerData = null;
      if (territory.ownerId) {
        ownerData = await prisma.matchKingdom.findUnique({
          where: { id: territory.ownerId },
          include: {
            kingdom: true,
            user: true,
          },
        });
      }

      // Busca units e structures no território (baseado em locationIndex)
      const units = await prisma.unit.findMany({
        where: {
          matchId: territory.matchId,
          locationIndex: territory.mapIndex,
        },
      });

      const structures = await prisma.structure.findMany({
        where: {
          matchId: territory.matchId,
          locationIndex: territory.mapIndex,
        },
      });

      socket.emit("worldmap:territory_data", {
        ...territory,
        owner: ownerData,
        units,
        structures,
      });
    } catch (error) {
      console.error("[WORLDMAP] Erro ao buscar território:", error);
      socket.emit("error", {
        message: "Erro ao carregar detalhes do território.",
      });
    }
  });
};

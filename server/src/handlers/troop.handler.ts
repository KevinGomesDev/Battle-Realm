// src/handlers/troop.handler.ts
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { TurnType, TROOP_LEVELUP_COSTS } from "../types";
import {
  recruitTroop,
  upgradeTroopCategory,
  calculateTroopRecruitmentCost,
  getTroopCategoryInfo,
  getKingdomTroopTemplates,
} from "../utils/army/troop.utils";

export const registerTroopHandlers = (io: Server, socket: Socket) => {
  // --- RECRUTAR TROPA ---
  // troopSlotIndex: 0-4 (índice do template de tropa do reino)
  socket.on(
    "army:recruit_troop",
    async ({ matchId, playerId, troopSlotIndex, name }) => {
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
            message: "Tropas só podem ser recrutadas no Turno de Exércitos",
          });
          return;
        }

        const slotIndex =
          typeof troopSlotIndex === "number"
            ? troopSlotIndex
            : parseInt(troopSlotIndex, 10);

        if (isNaN(slotIndex) || slotIndex < 0 || slotIndex > 4) {
          socket.emit("error", { message: "Índice de tropa inválido (0-4)" });
          return;
        }

        const result = await recruitTroop(matchId, playerId, slotIndex, name);

        if (result.success) {
          const player = await prisma.matchKingdom.findUnique({
            where: { id: playerId },
          });
          const resources = JSON.parse(player!.resources);

          socket.emit("army:troop_recruited", {
            unit: result.unit,
            resources,
          });

          io.to(matchId).emit("unit:created", {
            unit: result.unit,
            playerId: player!.id,
          });
        } else {
          socket.emit("error", { message: result.message });
        }
      } catch (error: any) {
        socket.emit("error", {
          message: error.message || "Erro ao recrutar tropa.",
        });
      }
    }
  );

  // --- EVOLUIR CATEGORIA DE TROPA ---
  socket.on(
    "army:upgrade_troop",
    async ({ matchId, playerId, troopSlotIndex }) => {
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
            message:
              "Level up de tropas só pode ser feito no Turno de Exércitos",
          });
          return;
        }

        const slotIndex =
          typeof troopSlotIndex === "number"
            ? troopSlotIndex
            : parseInt(troopSlotIndex, 10);

        if (isNaN(slotIndex) || slotIndex < 0 || slotIndex > 4) {
          socket.emit("error", { message: "Índice de tropa inválido (0-4)" });
          return;
        }

        const result = await upgradeTroopCategory(matchId, playerId, slotIndex);

        if (result.success) {
          const player = await prisma.matchKingdom.findUnique({
            where: { id: playerId },
          });
          const resources = JSON.parse(player!.resources);

          socket.emit("army:troop_upgraded", { ...result, resources });

          io.to(matchId).emit("troop:category_upgraded", {
            playerId: player!.id,
            troopSlotIndex: slotIndex,
            newStats: result.newStats,
            newLevel: result.newLevel,
          });
        } else {
          socket.emit("error", { message: result.message });
        }
      } catch (error: any) {
        socket.emit("error", {
          message: error.message || "Erro ao evoluir tropa.",
        });
      }
    }
  );

  // --- OBTER CUSTO DE RECRUTAMENTO DE TROPA ---
  socket.on(
    "army:get_troop_recruitment_cost",
    async ({ matchId, playerId, troopSlotIndex }) => {
      try {
        const slotIndex =
          typeof troopSlotIndex === "number"
            ? troopSlotIndex
            : parseInt(troopSlotIndex, 10);

        const cost = await calculateTroopRecruitmentCost(
          matchId,
          playerId,
          slotIndex
        );

        const troopCount = await prisma.unit.count({
          where: {
            matchId,
            ownerId: playerId,
            troopSlot: slotIndex,
            category: "TROOP",
          },
        });

        socket.emit("army:troop_recruitment_cost", {
          troopSlotIndex: slotIndex,
          cost,
          currentCount: troopCount,
        });
      } catch (error: any) {
        socket.emit("error", {
          message: error.message || "Erro ao obter custo.",
        });
      }
    }
  );

  // --- OBTER CUSTO DE LEVEL UP DE TROPA ---
  socket.on(
    "army:get_troop_upgrade_cost",
    async ({ playerId, troopSlotIndex }) => {
      try {
        const slotIndex =
          typeof troopSlotIndex === "number"
            ? troopSlotIndex
            : parseInt(troopSlotIndex, 10);

        const info = await getTroopCategoryInfo(playerId, slotIndex);
        const nextLevel = info.level + 1;
        const cost = TROOP_LEVELUP_COSTS[info.level];

        if (!cost) {
          socket.emit("error", { message: "Nível máximo atingido" });
          return;
        }

        socket.emit("army:troop_upgrade_cost", {
          troopSlotIndex: slotIndex,
          template: info.template,
          currentLevel: info.level,
          nextLevel,
          cost,
          troopCount: info.troopCount,
        });
      } catch (error: any) {
        socket.emit("error", {
          message: error.message || "Erro ao obter custo.",
        });
      }
    }
  );

  // --- LISTAR TODAS AS TROPAS DO JOGADOR ---
  socket.on("army:list_all_troops", async ({ matchId, playerId }) => {
    try {
      const units = await prisma.unit.findMany({
        where: {
          matchId,
          ownerId: playerId,
          category: { in: ["TROOP", "INVOCACAO"] },
        },
      } as any);

      // Agrupar por slotIndex (armazenado em troopSlot)
      const groupedBySlot: { [key: string]: typeof units } = {};
      for (const unit of units) {
        const slotKey = String(unit.troopSlot ?? "other");
        if (!groupedBySlot[slotKey]) {
          groupedBySlot[slotKey] = [];
        }
        groupedBySlot[slotKey].push(unit);
      }

      socket.emit("army:all_troops", { groupedBySlot, units });
    } catch (error: any) {
      socket.emit("error", { message: "Erro ao listar tropas" });
    }
  });

  // --- OBTER INFO DE UMA CATEGORIA DE TROPA ---
  socket.on("army:get_troop_info", async ({ playerId, troopSlotIndex }) => {
    try {
      const slotIndex =
        typeof troopSlotIndex === "number"
          ? troopSlotIndex
          : parseInt(troopSlotIndex, 10);

      const info = await getTroopCategoryInfo(playerId, slotIndex);

      socket.emit("army:troop_info", {
        troopSlotIndex: slotIndex,
        template: info.template,
        level: info.level,
        stats: info.stats,
        count: info.troopCount,
      });
    } catch (error: any) {
      socket.emit("error", { message: "Erro ao obter informações" });
    }
  });

  // --- LISTAR TEMPLATES DE TROPAS DO REINO ---
  socket.on("army:get_troop_templates", async ({ kingdomId }) => {
    try {
      const templates = await getKingdomTroopTemplates(kingdomId);
      socket.emit("army:troop_templates", { templates });
    } catch (error: any) {
      socket.emit("error", { message: "Erro ao obter templates de tropas" });
    }
  });
};

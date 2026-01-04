// src/handlers/unit.handler.ts
// Handler genérico para operações de unidades (TROOP, HERO, REGENT)
// Level Up, XP, e outras operações que funcionam para todas as categorias

import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import {
  canLevelUp,
  processLevelUp,
  canHeroChooseFeature,
  addHeroSkill,
  addExperience,
} from "../utils/army/hero.utils";

export const registerUnitHandlers = (io: Server, socket: Socket) => {
  // ==========================================================================
  // LEVEL UP DE UNIDADE (Genérico - funciona para TROOP, HERO, REGENT)
  // ==========================================================================
  socket.on(
    "unit:levelup",
    async ({ matchId, playerId, unitId, attributeDistribution, skillCode }) => {
      try {
        const match = await prisma.match.findUnique({
          where: { id: matchId },
        });

        if (!match) {
          socket.emit("unit:error", { message: "Partida não encontrada" });
          return;
        }

        // Verifica se a unidade pertence ao jogador
        const unit = await prisma.unit.findUnique({
          where: { id: unitId },
        });

        if (!unit || unit.ownerId !== playerId) {
          socket.emit("unit:error", {
            message: "Unidade não encontrada ou não pertence a você",
          });
          return;
        }

        // Verifica se pode subir de nível
        const canLevel = await canLevelUp(unitId);
        if (!canLevel.canLevel) {
          socket.emit("unit:error", { message: canLevel.reason });
          return;
        }

        // Processa level up
        const result = await processLevelUp(unitId, attributeDistribution);

        if (!result.success) {
          socket.emit("unit:error", { message: result.message });
          return;
        }

        // Se for herói e pode escolher skill, adiciona
        if (unit.category === "HERO" && skillCode) {
          const newLevel = result.unit?.level || unit.level + 1;
          if (canHeroChooseFeature(newLevel)) {
            await addHeroSkill(unitId, skillCode);
          }
        }

        socket.emit("unit:levelup_success", {
          message: result.message,
          unit: result.unit,
          canChooseSkill:
            unit.category === "HERO" &&
            canHeroChooseFeature(result.unit?.level || 1),
        });

        io.to(matchId).emit("unit:updated", {
          unit: result.unit,
          playerId,
        });
      } catch (error) {
        console.error("[UNIT] Erro ao fazer level up:", error);
        socket.emit("unit:error", { message: "Erro ao fazer level up" });
      }
    }
  );

  // ==========================================================================
  // VERIFICAR SE UNIDADE PODE SUBIR DE NÍVEL
  // ==========================================================================
  socket.on("unit:check_levelup", async ({ unitId }) => {
    try {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
      });

      if (!unit) {
        socket.emit("unit:error", { message: "Unidade não encontrada" });
        return;
      }

      const result = await canLevelUp(unitId);

      socket.emit("unit:levelup_status", {
        unitId,
        canLevelUp: result.canLevel,
        pendingLevels: result.pendingLevels || 0,
        reason: result.reason,
        currentLevel: unit.level,
        currentXP: unit.experience,
      });
    } catch (error) {
      console.error("[UNIT] Erro ao verificar level up:", error);
      socket.emit("unit:error", { message: "Erro ao verificar level up" });
    }
  });

  // ==========================================================================
  // OBTER DETALHES DE UNIDADE
  // ==========================================================================
  socket.on("unit:get_details", async ({ unitId }) => {
    try {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
      });

      if (!unit) {
        socket.emit("unit:error", { message: "Unidade não encontrada" });
        return;
      }

      const levelUpStatus = await canLevelUp(unitId);
      const features = JSON.parse(unit.classFeatures || "[]");
      const spells = JSON.parse(unit.spells || "[]");
      const conditions = JSON.parse(unit.conditions || "[]");

      socket.emit("unit:details", {
        unit,
        classFeatures: features,
        spells,
        conditions,
        canLevelUp: levelUpStatus.canLevel,
        pendingLevels: levelUpStatus.pendingLevels || 0,
      });
    } catch (error) {
      console.error("[UNIT] Erro ao obter detalhes:", error);
      socket.emit("unit:error", { message: "Erro ao obter detalhes" });
    }
  });

  // ==========================================================================
  // LISTAR UNIDADES DO JOGADOR
  // ==========================================================================
  socket.on("unit:list_mine", async ({ matchId, playerId, category }) => {
    try {
      const where: any = {
        matchId,
        ownerId: playerId,
      };

      if (category) {
        where.category = category;
      }

      const units = await prisma.unit.findMany({ where });

      socket.emit("unit:my_list", {
        units,
        count: units.length,
        category: category || "ALL",
      });
    } catch (error) {
      console.error("[UNIT] Erro ao listar unidades:", error);
      socket.emit("unit:error", { message: "Erro ao listar unidades" });
    }
  });
};

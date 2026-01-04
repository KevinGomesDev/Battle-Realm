// src/handlers/hero.handler.ts
// Handler para recrutamento e gerenciamento de heróis
// Heróis são ÚNICOS por partida - se um jogador recrutar, outro não pode

import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { TurnType } from "../types";
import {
  revealHeroesForRecruitment,
  canRecruitHero,
  recruitHeroFromTemplate,
  getAvailableHeroesInMatch,
  HERO_REVEAL_COST,
} from "../utils/army/hero.utils";
import { getResourceName } from "../../../shared/config/global.config";

export const registerHeroHandlers = (io: Server, socket: Socket) => {
  // ==========================================================================
  // REVELAR HERÓIS PARA RECRUTAMENTO
  // O jogador paga X recursos. Para cada 10, revela 1 herói aleatório.
  // ==========================================================================
  socket.on(
    "hero:reveal_for_recruitment",
    async ({ matchId, playerId, resourceType, resourceAmount }) => {
      try {
        // Validações básicas
        const match = await prisma.match.findUnique({
          where: { id: matchId },
        });

        if (!match) {
          socket.emit("hero:error", { message: "Partida não encontrada" });
          return;
        }

        if (match.currentTurn !== TurnType.EXERCITOS) {
          socket.emit("hero:error", {
            message: "Recrutamento só pode ser feito no Turno de Exércitos",
          });
          return;
        }

        const player = await prisma.matchPlayer.findUnique({
          where: { id: playerId },
        });

        if (!player) {
          socket.emit("hero:error", { message: "Jogador não encontrado" });
          return;
        }

        // Verifica recursos do jogador
        const resources = JSON.parse(player.resources || "{}");
        const resourceKey = getResourceKey(resourceType);
        const currentAmount = resources[resourceKey] || 0;

        if (currentAmount < resourceAmount) {
          socket.emit("hero:error", {
            message: `${getResourceName(
              resourceType
            )} insuficiente. Você tem: ${currentAmount}`,
          });
          return;
        }

        if (resourceAmount < HERO_REVEAL_COST) {
          socket.emit("hero:error", {
            message: `Mínimo de ${HERO_REVEAL_COST} ${getResourceName(
              resourceType
            )} para revelar heróis`,
          });
          return;
        }

        // Gasta recursos
        resources[resourceKey] = currentAmount - resourceAmount;
        await prisma.matchPlayer.update({
          where: { id: playerId },
          data: { resources: JSON.stringify(resources) },
        });

        // Revela heróis aleatórios
        const { heroes, count } = await revealHeroesForRecruitment(
          matchId,
          resourceAmount
        );

        if (heroes.length === 0) {
          socket.emit("hero:reveal_result", {
            success: false,
            message: "Nenhum herói disponível para recrutamento",
            heroes: [],
            resourcesSpent: resourceAmount,
            resourcesRemaining: resources[resourceKey],
          });
          return;
        }

        socket.emit("hero:reveal_result", {
          success: true,
          message: `${count} herói(s) revelado(s)! Escolha um para recrutar.`,
          heroes: heroes.map((h) => ({
            code: h.code,
            name: h.name,
            description: h.description,
            classCode: h.classCode,
            icon: h.icon,
            themeColor: h.themeColor,
            level: h.level,
            combat: h.combat,
            speed: h.speed,
            focus: h.focus,
            armor: h.armor,
            vitality: h.vitality,
            initialSkills: h.initialSkills,
            initialSpells: h.initialSpells,
            recruitCost: h.recruitCost,
          })),
          resourcesSpent: resourceAmount,
          resourcesRemaining: resources[resourceKey],
        });
      } catch (error) {
        console.error("[HERO] Erro ao revelar heróis:", error);
        socket.emit("hero:error", { message: "Erro ao revelar heróis" });
      }
    }
  );

  // ==========================================================================
  // RECRUTAR HERÓI SELECIONADO
  // Após revelar, o jogador escolhe UM herói para recrutar
  // ==========================================================================
  socket.on("hero:recruit", async ({ matchId, playerId, heroCode }) => {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!match) {
        socket.emit("hero:error", { message: "Partida não encontrada" });
        return;
      }

      if (match.currentTurn !== TurnType.EXERCITOS) {
        socket.emit("hero:error", {
          message: "Recrutamento só pode ser feito no Turno de Exércitos",
        });
        return;
      }

      // Verifica se pode recrutar
      const validation = await canRecruitHero(matchId, playerId, heroCode);
      if (!validation.canRecruit) {
        socket.emit("hero:error", { message: validation.reason });
        return;
      }

      // Recruta o herói
      const result = await recruitHeroFromTemplate(matchId, playerId, heroCode);

      if (!result.success) {
        socket.emit("hero:error", { message: result.message });
        return;
      }

      // Busca recursos atualizados
      const player = await prisma.matchPlayer.findUnique({
        where: { id: playerId },
      });
      const resources = JSON.parse(player!.resources || "{}");

      socket.emit("hero:recruit_success", {
        message: result.message,
        hero: result.hero,
        resources,
      });

      // Notifica todos na partida
      io.to(matchId).emit("unit:created", {
        unit: result.hero,
        playerId,
        category: "HERO",
      });

      // Notifica que o herói não está mais disponível
      io.to(matchId).emit("hero:recruited_in_match", {
        heroCode,
        recruitedBy: playerId,
      });
    } catch (error) {
      console.error("[HERO] Erro ao recrutar herói:", error);
      socket.emit("hero:error", { message: "Erro ao recrutar herói" });
    }
  });

  // ==========================================================================
  // LISTAR HERÓIS DISPONÍVEIS NA PARTIDA
  // ==========================================================================
  socket.on("hero:list_available", async ({ matchId }) => {
    try {
      const heroes = await getAvailableHeroesInMatch(matchId);

      socket.emit("hero:available_list", {
        heroes: heroes.map((h) => ({
          code: h.code,
          name: h.name,
          description: h.description,
          classCode: h.classCode,
          icon: h.icon,
          themeColor: h.themeColor,
          recruitCost: h.recruitCost,
        })),
        totalAvailable: heroes.length,
      });
    } catch (error) {
      console.error("[HERO] Erro ao listar heróis disponíveis:", error);
      socket.emit("hero:error", { message: "Erro ao listar heróis" });
    }
  });

  // ⚠️ hero:get_details e hero:list_mine foram removidos
  // Use unit:get_details e unit:list_mine (com category="HERO") que são genéricos
};

// =============================================================================
// HELPERS
// =============================================================================

function getResourceKey(resourceType: string): string {
  const map: Record<string, string> = {
    ore: "minerio",
    supplies: "suprimentos",
    arcane: "arcana",
    experience: "experiencia",
    devotion: "devocao",
    // Aliases em português
    minerio: "minerio",
    suprimentos: "suprimentos",
    arcana: "arcana",
    experiencia: "experiencia",
    devocao: "devocao",
  };
  return map[resourceType.toLowerCase()] || resourceType;
}

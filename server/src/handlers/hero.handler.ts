// src/handlers/hero.handler.ts
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { TurnType } from "../types";
import {
  levelUpHero,
  recruitHero,
  canHeroChooseFeature,
  addHeroClassFeature,
} from "../utils/army/hero.utils";

export const registerHeroHandlers = (io: Server, socket: Socket) => {
  // --- LEVEL UP DE HERÓI ---
  socket.on(
    "army:levelup_hero",
    async ({
      matchId,
      playerId,
      unitId,
      attributeDistribution,
      classFeature,
    }) => {
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
            message: "Level up só pode ser feito no Turno de Exércitos",
          });
          return;
        }

        const result = await levelUpHero(
          unitId,
          playerId,
          attributeDistribution
        );

        if (result.success) {
          const unit = result.unit;
          const canChoose = canHeroChooseFeature(unit!.level);

          if (canChoose && classFeature) {
            await addHeroClassFeature(unitId, classFeature);
          }

          const player = await prisma.matchPlayer.findUnique({
            where: { id: playerId },
          });
          const resources = JSON.parse(player!.resources);

          socket.emit("army:hero_levelup_success", {
            message: result.message,
            unit: result.unit,
            resources,
            canChooseFeature: canChoose,
          });

          io.to(matchId).emit("unit:updated", {
            unit: result.unit,
            playerId,
          });
        } else {
          socket.emit("army:hero_levelup_failed", { message: result.message });
        }
      } catch (error) {
        console.error("[HERO] Erro ao fazer level up de herói:", error);
        socket.emit("error", { message: "Erro ao fazer level up" });
      }
    }
  );

  // --- RECRUTAR HERÓI ---
  socket.on(
    "army:recruit_hero",
    async ({
      matchId,
      playerId,
      heroClass,
      attributeDistribution,
      initialFeature,
      name,
    }) => {
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
            message: "Recrutamento só pode ser feito no Turno de Exércitos",
          });
          return;
        }

        const result = await recruitHero(matchId, playerId, {
          name,
          heroClass,
          attributeDistribution,
        });

        if (result.success) {
          if (initialFeature && result.hero) {
            await addHeroClassFeature(result.hero.id, initialFeature);
          }

          const player = await prisma.matchPlayer.findUnique({
            where: { id: playerId },
          });
          const resources = JSON.parse(player!.resources);

          socket.emit("army:recruit_success", {
            message: result.message,
            hero: result.hero,
            resources,
          });

          io.to(matchId).emit("unit:created", {
            unit: result.hero,
            playerId,
          });
        } else {
          socket.emit("army:recruit_failed", { message: result.message });
        }
      } catch (error) {
        console.error("[HERO] Erro ao recrutar herói:", error);
        socket.emit("error", { message: "Erro ao recrutar herói" });
      }
    }
  );

  // --- OBTER DETALHES DE UM HERÓI ---
  socket.on("army:get_hero_details", async ({ unitId }) => {
    try {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
      });

      if (!unit) {
        socket.emit("error", { message: "Unidade não encontrada" });
        return;
      }

      if (unit.category !== "HERO") {
        socket.emit("error", { message: "Esta não é uma unidade Herói" });
        return;
      }

      const features = JSON.parse(unit.classFeatures || "[]");
      const canChoose = canHeroChooseFeature(unit.level);

      socket.emit("army:hero_details", {
        unit,
        classFeatures: features,
        canChooseNewFeature: canChoose,
      });
    } catch (error) {
      console.error("[HERO] Erro ao obter detalhes do herói:", error);
      socket.emit("error", { message: "Erro ao obter detalhes" });
    }
  });

  // --- LISTAR HERÓIS DO JOGADOR ---
  socket.on("army:list_heroes", async ({ matchId, playerId }) => {
    try {
      const units = await prisma.unit.findMany({
        where: {
          matchId,
          ownerId: playerId,
          category: "HERO",
        },
      });

      socket.emit("army:heroes_list", { units });
    } catch (error) {
      console.error("[HERO] Erro ao listar heróis:", error);
      socket.emit("error", { message: "Erro ao listar heróis" });
    }
  });
};

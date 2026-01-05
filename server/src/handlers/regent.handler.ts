// src/handlers/regent.handler.ts
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { TurnType } from "../types";
import {
  levelUpRegent,
  canRegentChooseFeature,
  recruitRegent,
} from "../utils/army/regent.utils";
import { addHeroClassFeature } from "../utils/army/hero.utils";

export const registerRegentHandlers = (io: Server, socket: Socket) => {
  // --- LEVEL UP DE REGENTE ---
  socket.on(
    "army:levelup_regent",
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

        const result = await levelUpRegent(
          unitId,
          playerId,
          attributeDistribution
        );

        if (result.success) {
          const unit = result.unit;
          const canChoose = canRegentChooseFeature(unit!.level);

          if (canChoose && classFeature) {
            await addHeroClassFeature(unitId, classFeature);
          }

          const player = await prisma.matchKingdom.findUnique({
            where: { id: playerId },
          });
          const resources = JSON.parse(player!.resources);

          socket.emit("army:regent_levelup_success", {
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
          socket.emit("army:regent_levelup_failed", {
            message: result.message,
          });
        }
      } catch (error) {
        console.error("[REGENT] Erro ao fazer level up de regente:", error);
        socket.emit("error", { message: "Erro ao fazer level up" });
      }
    }
  );

  // --- RECRUTAR REGENTE ---
  socket.on(
    "army:recruit_regent",
    async ({ matchId, initialFeature, attributeDistribution, name }) => {
      try {
        const userId = socket.data.userId;

        if (!userId) {
          socket.emit("error", { message: "Usuário não autenticado" });
          return;
        }

        // Determina o playerId correto
        let finalPlayerId: string;

        if (matchId) {
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

          // Busca o matchKingdom
          const matchKingdom = await prisma.matchKingdom.findFirst({
            where: { matchId, userId },
          });

          if (!matchKingdom) {
            socket.emit("error", {
              message: "Jogador não encontrado na partida",
            });
            return;
          }

          finalPlayerId = matchKingdom.id;
        } else {
          finalPlayerId = userId;
        }

        const result = await recruitRegent(
          matchId,
          finalPlayerId,
          attributeDistribution,
          name
        );

        if (result.success) {
          if (initialFeature && result.regent && matchId) {
            // For regents, add to classFeatures array directly (not using addHeroClassFeature)
            const currentFeatures = JSON.parse(
              result.regent.classFeatures
            ) as string[];
            if (!currentFeatures.includes(initialFeature)) {
              currentFeatures.push(initialFeature);
              await prisma.unit.update({
                where: { id: result.regent.id },
                data: {
                  classFeatures: JSON.stringify(currentFeatures),
                },
              });
              result.regent.classFeatures = JSON.stringify(currentFeatures);
            }
          }

          const player = matchId
            ? await prisma.matchKingdom.findUnique({
                where: { id: finalPlayerId },
              })
            : null;

          const resources = player ? JSON.parse(player.resources) : null;

          socket.emit("army:recruit_regent_success", {
            message: result.message,
            regent: result.regent,
            resources,
          });

          if (matchId) {
            io.to(matchId).emit("unit:created", {
              unit: result.regent,
              playerId: finalPlayerId,
            });
          }
        } else {
          socket.emit("army:recruit_regent_failed", {
            message: result.message,
          });
        }
      } catch (error) {
        console.error("[REGENT] Erro ao recrutar regente:", error);
        socket.emit("error", { message: "Erro ao recrutar regente" });
      }
    }
  );

  // --- OBTER DETALHES DE UM REGENTE ---
  socket.on("army:get_regent_details", async ({ unitId }) => {
    try {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
      });

      if (!unit) {
        socket.emit("error", { message: "Unidade não encontrada" });
        return;
      }

      if (unit.category !== "REGENT") {
        socket.emit("error", { message: "Esta não é uma unidade Regente" });
        return;
      }

      const features = JSON.parse(unit.classFeatures || "[]");
      const canChoose = canRegentChooseFeature(unit.level);

      socket.emit("army:regent_details", {
        unit,
        classFeatures: features,
        canChooseNewFeature: canChoose,
      });
    } catch (error) {
      console.error("[REGENT] Erro ao obter detalhes do regente:", error);
      socket.emit("error", { message: "Erro ao obter detalhes" });
    }
  });

  // --- LISTAR REGENTES DO JOGADOR ---
  socket.on("army:list_regents", async ({ matchId, playerId }) => {
    try {
      const units = await prisma.unit.findMany({
        where: {
          matchId,
          ownerId: playerId,
          category: "REGENT",
        },
      });

      socket.emit("army:regents_list", { units });
    } catch (error) {
      console.error("[REGENT] Erro ao listar regentes:", error);
      socket.emit("error", { message: "Erro ao listar regentes" });
    }
  });
};

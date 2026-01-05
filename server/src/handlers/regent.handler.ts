// src/handlers/regent.handler.ts
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { TurnType } from "../types";
import {
  levelUpRegent,
  canRegentChooseFeature,
} from "../utils/army/regent.utils";
import { addUnitFeature } from "../utils/army/unit.utils";

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
            await addUnitFeature(unitId, classFeature, "features", false);
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

      const features = JSON.parse(unit.features || "[]");
      const canChoose = canRegentChooseFeature(unit.level);

      socket.emit("army:regent_details", {
        unit,
        features,
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

// src/handlers/skills.handler.ts
import { Socket, Server } from "socket.io";
import {
  listAllClasses,
  getClassInfo,
  getSkillInfo,
  useSkill,
} from "../utils/skills.utils";

export const registerSkillsHandlers = (io: Server, socket: Socket) => {
  // --- LISTAR TODAS AS CLASSES ---
  socket.on("skills:list_classes", () => {
    try {
      const classes = listAllClasses();

      socket.emit("skills:classes_list", {
        classes,
        count: classes.length,
      });
    } catch (error) {
      console.error("[SKILLS] Erro ao listar classes:", error);
      socket.emit("error", { message: "Erro ao listar classes" });
    }
  });

  // --- OBTER DETALHES DE UMA CLASSE ---
  socket.on("skills:get_class", ({ classCode }) => {
    try {
      const classInfo = getClassInfo(classCode);

      if (!classInfo) {
        socket.emit("error", { message: "Classe não encontrada" });
        return;
      }

      socket.emit("skills:class_info", classInfo);
    } catch (error) {
      console.error("[SKILLS] Erro ao obter classe:", error);
      socket.emit("error", { message: "Erro ao obter informações da classe" });
    }
  });

  // --- OBTER DETALHES DE UMA HABILIDADE ---
  socket.on(
    "skills:get_skill",
    async ({ skillId, unitId, playerId, usageCount = 0 }) => {
      try {
        const skillInfo = await getSkillInfo(
          skillId,
          unitId,
          playerId,
          usageCount
        );

        socket.emit("skills:skill_info", skillInfo);
      } catch (error) {
        console.error("[SKILLS] Erro ao obter habilidade:", error);
        socket.emit("error", {
          message: "Erro ao obter informações da habilidade",
        });
      }
    }
  );

  // --- USAR UMA HABILIDADE ---
  socket.on(
    "skills:use_skill",
    async ({
      matchId,
      playerId,
      unitId,
      skillId,
      usageCountThisBattle = 0,
    }) => {
      try {
        const result = await useSkill(
          unitId,
          skillId,
          playerId,
          usageCountThisBattle
        );

        if (result.success) {
          // Notifica todos na partida sobre o uso da habilidade
          io.to(matchId).emit("skills:skill_used", {
            unitId,
            playerId,
            skillId,
            message: result.message,
            cost: result.cost,
            resourceType: result.resourceType,
          });

          socket.emit("skills:use_success", {
            message: result.message,
            cost: result.cost,
            resourceType: result.resourceType,
          });
        } else {
          socket.emit("error", { message: result.message });
        }
      } catch (error) {
        console.error("[SKILLS] Erro ao usar habilidade:", error);
        socket.emit("error", { message: "Erro ao usar habilidade" });
      }
    }
  );
};

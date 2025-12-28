// src/handlers/kingdom.handler.ts
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { CreateKingdomData } from "../types";
import { RACE_DEFINITIONS } from "../data/races";
import { ALIGNMENT_DEFINITIONS } from "../data/alignments";
import { TROOP_PASSIVES } from "../data/troop-passives";
import {
  createTroopTemplatesForKingdom,
  TroopTemplateData,
} from "../utils/army/troop.utils";

const MAP_SIZE = 100;

export const registerKingdomHandlers = (io: Server, socket: Socket) => {
  socket.on("kingdom:create", async (data: any = {}) => {
    try {
      const {
        name,
        capitalName,
        alignment,
        race,
        raceMetadata,
        troopTemplates, // Nova propriedade: array de 5 templates de tropas
      } = data;

      const userId = socket.data.userId;

      if (!userId) {
        console.error("[KINGDOM] Tentativa de criação sem User ID.");
        return socket.emit("error", {
          message: "Sessão inválida. Por favor, faça login novamente.",
        });
      }

      // Validações de Regra de Negócio
      if (race === "ELEMENTAL") {
        const elements = JSON.parse(raceMetadata || "[]");
        if (!Array.isArray(elements) || elements.length !== 2) {
          return socket.emit("error", {
            message: "Elementais precisam de 2 elementos.",
          });
        }
      }

      if (race === "INSETO" && !raceMetadata) {
        return socket.emit("error", {
          message: "Insetos precisam de um recurso bônus.",
        });
      }

      // Templates de tropas podem ser enviados no ato da criação (opcional)
      if (troopTemplates) {
        if (!Array.isArray(troopTemplates) || troopTemplates.length !== 5) {
          return socket.emit("error", {
            message: "Se enviar tropas, devem ser exatamente 5 templates.",
          });
        }
      }

      const randomLocation = Math.floor(Math.random() * MAP_SIZE) + 1;

      const newKingdom = await prisma.kingdom.create({
        data: {
          name,
          capitalName,
          alignment,
          race,
          raceMetadata,
          locationIndex: randomLocation,
          ownerId: userId,
        },
      });

      // Criar templates de tropas vinculados ao reino, se enviados
      if (
        troopTemplates &&
        Array.isArray(troopTemplates) &&
        troopTemplates.length === 5
      ) {
        const troopResult = await createTroopTemplatesForKingdom(
          newKingdom.id,
          troopTemplates as TroopTemplateData[]
        );

        if (!troopResult.success) {
          // Rollback: deletar reino se falhar criação de tropas
          await prisma.kingdom.delete({ where: { id: newKingdom.id } });
          return socket.emit("error", {
            message: troopResult.message || "Erro ao criar tropas do reino.",
          });
        }
      }

      // Buscar reino com tropas
      const kingdomWithTroops = await prisma.kingdom.findUnique({
        where: { id: newKingdom.id },
        include: { troopTemplates: true },
      });

      console.log(
        `[KINGDOM] Reino criado: ${newKingdom.name} (${newKingdom.race}) com 5 tropas`
      );
      socket.emit("kingdom:created", kingdomWithTroops);
    } catch (error) {
      console.error("[KINGDOM] Erro:", error);
      socket.emit("error", {
        message: "Erro ao criar reino. Verifique os dados.",
      });
    }
  });

  socket.on("kingdom:list", async (data: any = {}) => {
    try {
      // Fallback: tenta socket.data.userId primeiro, depois do payload
      const userId = socket.data.userId;

      console.log("[KINGDOM:LIST] Tentativa de listar reinos", {
        fromSocketData: socket.data.userId,
        fromPayload: data?.userId,
        finalUserId: userId,
      });

      if (!userId) {
        console.log("[KINGDOM:LIST] Usuário não autenticado");
        socket.emit("error", {
          message: "Usuário não autenticado. Faça login primeiro.",
        });
        return;
      }

      const kingdoms = await prisma.kingdom.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          name: true,
          race: true,
          alignment: true,
          capitalName: true,
        },
      });

      console.log(`[KINGDOM:LIST] ${kingdoms.length} reino(s) encontrado(s)`);
      socket.emit("kingdom:list_success", kingdoms);
    } catch (error) {
      console.error("[KINGDOM:LIST] Erro ao listar reinos:", error);
      socket.emit("error", { message: "Erro ao buscar seus reinos." });
    }
  });

  socket.on("kingdom:get_races", () => {
    socket.emit("kingdom:races_data", RACE_DEFINITIONS);
  });

  socket.on("kingdom:get_alignments", () => {
    socket.emit("kingdom:alignments_data", ALIGNMENT_DEFINITIONS);
  });

  // Obter lista de passivas disponíveis para tropas
  socket.on("kingdom:get_troop_passives", () => {
    socket.emit("kingdom:troop_passives_data", TROOP_PASSIVES);
  });

  // Obter detalhes de um reino (incluindo tropas)
  socket.on("kingdom:get_details", async ({ kingdomId }) => {
    try {
      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
        include: {
          troopTemplates: {
            orderBy: { slotIndex: "asc" },
          },
          units: {
            where: { category: "REGENTE" },
          },
        },
      });

      if (!kingdom) {
        socket.emit("error", { message: "Reino não encontrado." });
        return;
      }

      socket.emit("kingdom:details", kingdom);
    } catch (error) {
      console.error("[KINGDOM] Erro ao buscar detalhes:", error);
      socket.emit("error", { message: "Erro ao buscar detalhes do reino." });
    }
  });

  // Definir (ou redefinir) os 5 templates de tropas do reino
  socket.on("kingdom:set_troop_templates", async ({ kingdomId, templates }) => {
    try {
      if (!kingdomId) {
        socket.emit("error", { message: "kingdomId é obrigatório." });
        return;
      }
      if (!templates || !Array.isArray(templates) || templates.length !== 5) {
        socket.emit("error", {
          message: "Envie exatamente 5 templates de tropas.",
        });
        return;
      }

      const userId = socket.data.userId;
      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
      });
      if (!kingdom || kingdom.ownerId !== userId) {
        socket.emit("error", { message: "Acesso negado a este reino." });
        return;
      }

      // Remover templates anteriores e criar novos
      await prisma.troopTemplate.deleteMany({ where: { kingdomId } });

      const result = await createTroopTemplatesForKingdom(
        kingdomId,
        templates as TroopTemplateData[]
      );
      if (!result.success) {
        socket.emit("error", {
          message: result.message || "Erro ao definir tropas.",
        });
        return;
      }

      const updated = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
        include: { troopTemplates: { orderBy: { slotIndex: "asc" } } },
      });
      socket.emit("kingdom:set_troop_templates_success", updated);
    } catch (error) {
      console.error("[KINGDOM] Erro ao definir tropas:", error);
      socket.emit("error", { message: "Erro ao definir tropas do reino." });
    }
  });
};

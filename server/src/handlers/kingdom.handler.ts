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
import {
  getKingdomTemplateById,
  getKingdomTemplatesSummary,
} from "../data/kingdom-templates";

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
            where: { category: "REGENT" },
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

  // ============================================
  // KINGDOM TEMPLATES (Reinos Pré-definidos)
  // ============================================

  // Listar todos os templates de reino (versão resumida)
  socket.on("kingdom:list_templates", async () => {
    try {
      const templates = getKingdomTemplatesSummary();
      socket.emit("kingdom:templates_list", { templates });
    } catch (error) {
      console.error("[KINGDOM] Erro ao listar templates:", error);
      socket.emit("error", { message: "Erro ao listar templates de reino." });
    }
  });

  // Obter um template de reino completo por ID
  socket.on("kingdom:get_template", async ({ templateId }) => {
    try {
      const template = getKingdomTemplateById(templateId);
      if (!template) {
        return socket.emit("error", { message: "Template não encontrado." });
      }
      socket.emit("kingdom:template_details", { template });
    } catch (error) {
      console.error("[KINGDOM] Erro ao buscar template:", error);
      socket.emit("error", { message: "Erro ao buscar template de reino." });
    }
  });

  // Criar reino a partir de um template pré-definido
  socket.on("kingdom:create_from_template", async ({ templateId }) => {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        return socket.emit("error", {
          message: "Sessão inválida. Faça login novamente.",
        });
      }

      const template = getKingdomTemplateById(templateId);
      if (!template) {
        return socket.emit("error", { message: "Template não encontrado." });
      }

      const randomLocation = Math.floor(Math.random() * MAP_SIZE) + 1;

      // Criar o reino
      const newKingdom = await prisma.kingdom.create({
        data: {
          name: template.name,
          capitalName: template.capitalName,
          description: template.description,
          alignment: template.alignment,
          race: template.race,
          raceMetadata: template.raceMetadata,
          locationIndex: randomLocation,
          ownerId: userId,
        },
      });

      // Criar o Regente
      // Primeiro, buscar a classe pelo código
      let heroClass = await prisma.heroClass.findUnique({
        where: { code: template.regent.classCode },
      });

      await prisma.unit.create({
        data: {
          kingdomId: newKingdom.id,
          name: template.regent.name,
          description: template.regent.description,
          category: "REGENT",
          classId: heroClass?.id || null,
          combat: template.regent.combat,
          acuity: template.regent.acuity,
          focus: template.regent.focus,
          armor: template.regent.armor,
          vitality: template.regent.vitality,
          currentHp: template.regent.vitality,
          movesLeft: template.regent.acuity,
          actionsLeft: 3, // Regentes têm 3 ações
        },
      });

      // Criar templates de tropas
      const troopTemplatesData = template.troopTemplates.map((t) => ({
        kingdomId: newKingdom.id,
        slotIndex: t.slotIndex,
        name: t.name,
        description: t.description,
        passiveId: t.passiveId,
        resourceType: t.resourceType,
        combat: t.combat,
        acuity: t.acuity,
        focus: t.focus,
        armor: t.armor,
        vitality: t.vitality,
      }));

      await prisma.troopTemplate.createMany({ data: troopTemplatesData });

      // Buscar reino completo
      const kingdomWithData = await prisma.kingdom.findUnique({
        where: { id: newKingdom.id },
        include: {
          units: true,
          troopTemplates: { orderBy: { slotIndex: "asc" } },
        },
      });

      socket.emit("kingdom:created_from_template", {
        kingdom: kingdomWithData,
        message: `Reino "${template.name}" criado com sucesso!`,
      });

      console.log(
        `[KINGDOM] Reino criado de template: ${template.name} por userId=${userId}`
      );
    } catch (error) {
      console.error("[KINGDOM] Erro ao criar de template:", error);
      socket.emit("error", { message: "Erro ao criar reino do template." });
    }
  });

  // Atualizar descrição de um reino
  socket.on(
    "kingdom:update_description",
    async ({ kingdomId, description }) => {
      try {
        const userId = socket.data.userId;
        const kingdom = await prisma.kingdom.findUnique({
          where: { id: kingdomId },
        });

        if (!kingdom || kingdom.ownerId !== userId) {
          return socket.emit("error", {
            message: "Acesso negado a este reino.",
          });
        }

        const updated = await prisma.kingdom.update({
          where: { id: kingdomId },
          data: { description },
        });

        socket.emit("kingdom:description_updated", { kingdom: updated });
      } catch (error) {
        console.error("[KINGDOM] Erro ao atualizar descrição:", error);
        socket.emit("error", { message: "Erro ao atualizar descrição." });
      }
    }
  );

  // Atualizar descrição de uma unidade (herói/regente)
  socket.on("unit:update_description", async ({ unitId, description }) => {
    try {
      const userId = socket.data.userId;
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: { kingdom: true },
      });

      if (!unit || !unit.kingdom || unit.kingdom.ownerId !== userId) {
        return socket.emit("error", {
          message: "Acesso negado a esta unidade.",
        });
      }

      const updated = await prisma.unit.update({
        where: { id: unitId },
        data: { description },
      });

      socket.emit("unit:description_updated", { unit: updated });
    } catch (error) {
      console.error("[UNIT] Erro ao atualizar descrição:", error);
      socket.emit("error", { message: "Erro ao atualizar descrição." });
    }
  });

  // Atualizar descrição de um template de tropa
  socket.on(
    "troop_template:update_description",
    async ({ templateId, description }) => {
      try {
        const userId = socket.data.userId;
        const template = await prisma.troopTemplate.findUnique({
          where: { id: templateId },
          include: { kingdom: true },
        });

        if (!template || template.kingdom.ownerId !== userId) {
          return socket.emit("error", {
            message: "Acesso negado a este template.",
          });
        }

        const updated = await prisma.troopTemplate.update({
          where: { id: templateId },
          data: { description },
        });

        socket.emit("troop_template:description_updated", {
          template: updated,
        });
      } catch (error) {
        console.error("[TROOP_TEMPLATE] Erro ao atualizar descrição:", error);
        socket.emit("error", { message: "Erro ao atualizar descrição." });
      }
    }
  );
};

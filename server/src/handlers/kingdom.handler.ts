// src/handlers/kingdom.handler.ts
import { Socket, Server } from "socket.io";
import { prisma, requireAuth, validateOrEmitError } from "../lib";
import {
  CreateKingdomSchema,
  KingdomIdSchema,
  SetTroopTemplatesSchema,
  UpdateDescriptionSchema,
  TemplateIdSchema,
  UnitDescriptionSchema,
  TroopTemplateDescriptionSchema,
} from "../lib/validation/kingdom.schemas";
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
const ERROR_EVENT = "kingdom:error";

// ============ ERROR HELPER ============

type KingdomErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "ACCESS_DENIED"
  | "INVALID_RACE_METADATA"
  | "INVALID_TROOP_TEMPLATES"
  | "TEMPLATE_NOT_FOUND"
  | "DATABASE_ERROR"
  | "UNKNOWN_ERROR";

function emitError(
  socket: Socket,
  message: string,
  code: KingdomErrorCode = "UNKNOWN_ERROR"
) {
  socket.emit(ERROR_EVENT, { message, code });
}

function handleError(socket: Socket, error: unknown, context: string) {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  emitError(socket, `${context}: ${message}`, "DATABASE_ERROR");
}

// ============ HANDLER REGISTRATION ============

export const registerKingdomHandlers = (io: Server, socket: Socket) => {
  // ============================================
  // KINGDOM CRUD
  // ============================================

  /**
   * Cria um novo reino (custom)
   */
  socket.on(
    "kingdom:create",
    requireAuth(socket, async (userId, data: unknown) => {
      const validated = validateOrEmitError(
        socket,
        CreateKingdomSchema,
        data,
        ERROR_EVENT
      );
      if (!validated) return;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const randomLocation = Math.floor(Math.random() * MAP_SIZE) + 1;

          const newKingdom = await tx.kingdom.create({
            data: {
              name: validated.name,
              capitalName: validated.capitalName,
              alignment: validated.alignment,
              race: validated.race,
              raceMetadata: validated.raceMetadata,
              locationIndex: randomLocation,
              ownerId: userId,
            },
          });

          if (validated.troopTemplates?.length === 5) {
            const troopResult = await createTroopTemplatesForKingdom(
              newKingdom.id,
              validated.troopTemplates as TroopTemplateData[],
              tx
            );

            if (!troopResult.success) {
              throw new Error(
                troopResult.message || "Erro ao criar tropas do reino"
              );
            }
          }

          return tx.kingdom.findUnique({
            where: { id: newKingdom.id },
            include: { troopTemplates: { orderBy: { slotIndex: "asc" } } },
          });
        });

        socket.emit("kingdom:created", result);
      } catch (error) {
        handleError(socket, error, "Falha ao criar reino");
      }
    })
  );

  /**
   * Lista reinos do usuário
   */
  socket.on(
    "kingdom:list",
    requireAuth(socket, async (userId) => {
      try {
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

        socket.emit("kingdom:list_success", kingdoms);
      } catch (error) {
        handleError(socket, error, "Falha ao listar reinos");
      }
    })
  );

  /**
   * Obtém detalhes de um reino
   */
  socket.on(
    "kingdom:get_details",
    requireAuth(socket, async (userId, data: unknown) => {
      const validated = validateOrEmitError(
        socket,
        KingdomIdSchema,
        data,
        ERROR_EVENT
      );
      if (!validated) return;

      try {
        const kingdom = await prisma.kingdom.findUnique({
          where: { id: validated.kingdomId },
          include: {
            troopTemplates: { orderBy: { slotIndex: "asc" } },
            units: { where: { category: "REGENT" } },
          },
        });

        if (!kingdom) {
          return emitError(socket, "Reino não encontrado", "NOT_FOUND");
        }

        socket.emit("kingdom:details", kingdom);
      } catch (error) {
        handleError(socket, error, "Falha ao obter detalhes do reino");
      }
    })
  );

  /**
   * Define templates de tropas de um reino
   */
  socket.on(
    "kingdom:set_troop_templates",
    requireAuth(socket, async (userId, data: unknown) => {
      const validated = validateOrEmitError(
        socket,
        SetTroopTemplatesSchema,
        data,
        ERROR_EVENT
      );
      if (!validated) return;

      try {
        const kingdom = await prisma.kingdom.findUnique({
          where: { id: validated.kingdomId },
        });

        if (!kingdom) {
          return emitError(socket, "Reino não encontrado", "NOT_FOUND");
        }

        if (kingdom.ownerId !== userId) {
          return emitError(
            socket,
            "Acesso negado a este reino",
            "ACCESS_DENIED"
          );
        }

        const result = await prisma.$transaction(async (tx) => {
          await tx.troopTemplate.deleteMany({
            where: { kingdomId: validated.kingdomId },
          });

          const troopResult = await createTroopTemplatesForKingdom(
            validated.kingdomId,
            validated.templates as TroopTemplateData[],
            tx
          );

          if (!troopResult.success) {
            throw new Error(troopResult.message || "Erro ao definir tropas");
          }

          return tx.kingdom.findUnique({
            where: { id: validated.kingdomId },
            include: { troopTemplates: { orderBy: { slotIndex: "asc" } } },
          });
        });

        socket.emit("kingdom:set_troop_templates_success", result);
      } catch (error) {
        handleError(socket, error, "Falha ao definir templates de tropas");
      }
    })
  );

  /**
   * Atualiza descrição de um reino
   */
  socket.on(
    "kingdom:update_description",
    requireAuth(socket, async (userId, data: unknown) => {
      const validated = validateOrEmitError(
        socket,
        UpdateDescriptionSchema,
        data,
        ERROR_EVENT
      );
      if (!validated) return;

      try {
        const kingdom = await prisma.kingdom.findUnique({
          where: { id: validated.kingdomId },
        });

        if (!kingdom) {
          return emitError(socket, "Reino não encontrado", "NOT_FOUND");
        }

        if (kingdom.ownerId !== userId) {
          return emitError(
            socket,
            "Acesso negado a este reino",
            "ACCESS_DENIED"
          );
        }

        const updated = await prisma.kingdom.update({
          where: { id: validated.kingdomId },
          data: { description: validated.description },
        });

        socket.emit("kingdom:description_updated", { kingdom: updated });
      } catch (error) {
        handleError(socket, error, "Falha ao atualizar descrição");
      }
    })
  );

  // ============================================
  // KINGDOM TEMPLATES (Reinos Pré-definidos)
  // ============================================

  /**
   * Lista templates disponíveis (público)
   */
  socket.on("kingdom:list_templates", () => {
    try {
      const templates = getKingdomTemplatesSummary();
      socket.emit("kingdom:templates_list", { templates });
    } catch (error) {
      handleError(socket, error, "Falha ao listar templates");
    }
  });

  /**
   * Obtém detalhes de um template (público)
   */
  socket.on("kingdom:get_template", (data: unknown) => {
    const validated = validateOrEmitError(
      socket,
      TemplateIdSchema,
      data,
      ERROR_EVENT
    );
    if (!validated) return;

    try {
      const template = getKingdomTemplateById(validated.templateId);
      if (!template) {
        return emitError(
          socket,
          "Template não encontrado",
          "TEMPLATE_NOT_FOUND"
        );
      }
      socket.emit("kingdom:template_details", { template });
    } catch (error) {
      handleError(socket, error, "Falha ao obter template");
    }
  });

  /**
   * Cria reino a partir de template (protegido)
   */
  socket.on(
    "kingdom:create_from_template",
    requireAuth(socket, async (userId, data: unknown) => {
      const validated = validateOrEmitError(
        socket,
        TemplateIdSchema,
        data,
        ERROR_EVENT
      );
      if (!validated) return;

      const template = getKingdomTemplateById(validated.templateId);
      if (!template) {
        return emitError(
          socket,
          "Template não encontrado",
          "TEMPLATE_NOT_FOUND"
        );
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          const randomLocation = Math.floor(Math.random() * MAP_SIZE) + 1;

          const newKingdom = await tx.kingdom.create({
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

          await tx.unit.create({
            data: {
              kingdomId: newKingdom.id,
              name: template.regent.name,
              description: template.regent.description,
              category: "REGENT",
              classCode: template.regent.classCode, // Código da classe (dados estáticos)
              combat: template.regent.combat,
              acuity: template.regent.acuity,
              focus: template.regent.focus,
              armor: template.regent.armor,
              vitality: template.regent.vitality,
              currentHp: template.regent.vitality,
              movesLeft: template.regent.acuity,
              actionsLeft: 3,
            },
          });

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

          await tx.troopTemplate.createMany({ data: troopTemplatesData });

          return tx.kingdom.findUnique({
            where: { id: newKingdom.id },
            include: {
              units: true,
              troopTemplates: { orderBy: { slotIndex: "asc" } },
            },
          });
        });

        socket.emit("kingdom:created_from_template", {
          kingdom: result,
          message: `Reino "${template.name}" criado com sucesso!`,
        });
      } catch (error) {
        handleError(socket, error, "Falha ao criar reino do template");
      }
    })
  );

  // ============================================
  // STATIC DATA (Público)
  // ============================================

  socket.on("kingdom:get_races", () => {
    socket.emit("kingdom:races_data", RACE_DEFINITIONS);
  });

  socket.on("kingdom:get_alignments", () => {
    socket.emit("kingdom:alignments_data", ALIGNMENT_DEFINITIONS);
  });

  socket.on("kingdom:get_troop_passives", () => {
    socket.emit("kingdom:troop_passives_data", TROOP_PASSIVES);
  });

  // ============================================
  // UNIT & TEMPLATE DESCRIPTIONS
  // ============================================

  /**
   * Atualiza descrição de uma unidade (herói/regente)
   */
  socket.on(
    "unit:update_description",
    requireAuth(socket, async (userId, data: unknown) => {
      const validated = validateOrEmitError(
        socket,
        UnitDescriptionSchema,
        data,
        ERROR_EVENT
      );
      if (!validated) return;

      try {
        const unit = await prisma.unit.findUnique({
          where: { id: validated.unitId },
          include: { kingdom: true },
        });

        if (!unit) {
          return emitError(socket, "Unidade não encontrada", "NOT_FOUND");
        }

        if (!unit.kingdom || unit.kingdom.ownerId !== userId) {
          return emitError(
            socket,
            "Acesso negado a esta unidade",
            "ACCESS_DENIED"
          );
        }

        const updated = await prisma.unit.update({
          where: { id: validated.unitId },
          data: { description: validated.description },
        });

        socket.emit("unit:description_updated", { unit: updated });
      } catch (error) {
        handleError(socket, error, "Falha ao atualizar descrição da unidade");
      }
    })
  );

  /**
   * Atualiza descrição de um template de tropa
   */
  socket.on(
    "troop_template:update_description",
    requireAuth(socket, async (userId, data: unknown) => {
      const validated = validateOrEmitError(
        socket,
        TroopTemplateDescriptionSchema,
        data,
        ERROR_EVENT
      );
      if (!validated) return;

      try {
        const template = await prisma.troopTemplate.findUnique({
          where: { id: validated.templateId },
          include: { kingdom: true },
        });

        if (!template) {
          return emitError(socket, "Template não encontrado", "NOT_FOUND");
        }

        if (template.kingdom.ownerId !== userId) {
          return emitError(
            socket,
            "Acesso negado a este template",
            "ACCESS_DENIED"
          );
        }

        const updated = await prisma.troopTemplate.update({
          where: { id: validated.templateId },
          data: { description: validated.description },
        });

        socket.emit("troop_template:description_updated", {
          template: updated,
        });
      } catch (error) {
        handleError(socket, error, "Falha ao atualizar descrição do template");
      }
    })
  );
};

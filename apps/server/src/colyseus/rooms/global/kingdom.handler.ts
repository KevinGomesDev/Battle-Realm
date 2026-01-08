// server/src/colyseus/rooms/global/kingdom.handler.ts
// Handlers de Kingdom: CRUD, templates, static data

import { Client } from "@colyseus/core";
import { prisma } from "../../../lib/prisma";
import { getUserData, isAuthenticated, sendAuthError } from "./types";

// Imports de dados
import { KINGDOM_TEMPLATES } from "@boundless/shared/data/Templates/KingdomTemplates";
import { REGENT_TEMPLATES } from "@boundless/shared/data/Templates/RegentTemplates";
import { RACE_DEFINITIONS } from "@boundless/shared/data/Templates/RacesTemplates";
import { ALIGNMENT_DEFINITIONS } from "@boundless/shared/data/alignments.data";
import { HP_CONFIG } from "@boundless/shared/config/combat.config";

/**
 * Lista reinos do usuário autenticado
 */
export async function handleListKingdoms(client: Client): Promise<void> {
  if (!isAuthenticated(client)) {
    sendAuthError(client);
    return;
  }

  const userData = getUserData(client)!;

  try {
    const kingdoms = await prisma.kingdom.findMany({
      where: { ownerId: userData.userId },
      include: {
        regent: {
          select: { id: true, name: true, level: true },
        },
      },
    });

    client.send(
      "kingdom:list_success",
      kingdoms.map((k) => ({
        id: k.id,
        name: k.name,
        description: k.description,
        regent: k.regent
          ? {
              id: k.regent.id,
              name: k.regent.name,
              level: k.regent.level,
            }
          : null,
        createdAt: k.createdAt,
      }))
    );
  } catch (error) {
    client.send("kingdom:error", {
      message: "Erro ao listar reinos",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Cria um novo reino a partir de template
 */
export async function handleCreateKingdom(
  client: Client,
  data: { templateId?: string }
): Promise<void> {
  if (!isAuthenticated(client)) {
    sendAuthError(client, "kingdom:error");
    return;
  }

  const userData = getUserData(client)!;

  try {
    // templateId é OBRIGATÓRIO
    if (!data.templateId) {
      client.send("kingdom:error", {
        message: "templateId é obrigatório para criar um reino",
        code: "INVALID_DATA",
      });
      return;
    }

    // Buscar template do reino
    const template = KINGDOM_TEMPLATES.find((t) => t.id === data.templateId);
    if (!template) {
      client.send("kingdom:error", {
        message: "Template de reino não encontrado",
        code: "NOT_FOUND",
      });
      return;
    }

    // Buscar template do regente
    const regentTemplate = REGENT_TEMPLATES.find(
      (r) => r.code === template.regentCode
    );
    if (!regentTemplate) {
      client.send("kingdom:error", {
        message: "Template de regente não encontrado",
        code: "NOT_FOUND",
      });
      return;
    }

    // Verificar se template tem tropas
    if (!template.troopTemplates || template.troopTemplates.length === 0) {
      client.send("kingdom:error", {
        message: "Template de reino não possui tropas definidas",
        code: "INVALID_DATA",
      });
      return;
    }

    // Verificar duplicidade
    const existing = await prisma.kingdom.findFirst({
      where: {
        ownerId: userData.userId,
        name: template.name,
      },
    });

    if (existing) {
      client.send("kingdom:error", {
        message: "Você já possui um reino com este nome",
        code: "DUPLICATE",
      });
      return;
    }

    // Calcular HP máximo do regente
    const regentMaxHp = Math.max(
      1,
      regentTemplate.vitality * HP_CONFIG.multiplier
    );

    // Criar Reino + Regente + TroopTemplates em TRANSAÇÃO
    const kingdom = await prisma.$transaction(async (tx) => {
      // 1. Criar o Regente
      const regent = await tx.unit.create({
        data: {
          name: regentTemplate.name,
          description: regentTemplate.description,
          avatar: regentTemplate.avatar,
          category: "REGENT",
          level: 1,
          experience: 0,
          classCode: null,
          features: JSON.stringify(
            regentTemplate.initialSkillCode
              ? [regentTemplate.initialSkillCode]
              : []
          ),
          spells: JSON.stringify(regentTemplate.initialSpells || []),
          conditions: JSON.stringify([]),
          unitCooldowns: JSON.stringify({}),
          equipment: JSON.stringify([]),
          combat: regentTemplate.combat,
          speed: regentTemplate.speed,
          focus: regentTemplate.focus,
          resistance: regentTemplate.resistance,
          will: regentTemplate.will,
          vitality: regentTemplate.vitality,
          damageReduction: 0,
          maxHp: regentMaxHp,
          currentHp: regentMaxHp,
          maxMana: regentTemplate.will * 2,
          currentMana: regentTemplate.will * 2,
          movesLeft: regentTemplate.speed,
          actionsLeft: 1,
          isAlive: true,
        },
      });

      // 2. Criar o Reino
      const newKingdom = await tx.kingdom.create({
        data: {
          name: template.name,
          description: template.description,
          alignment: template.alignment as any,
          race: template.race as any,
          ownerId: userData.userId,
          regentId: regent.id,
        },
      });

      // 3. Criar os TroopTemplates
      for (const troopData of template.troopTemplates) {
        await tx.troopTemplate.create({
          data: {
            kingdomId: newKingdom.id,
            slotIndex: troopData.slotIndex,
            name: troopData.name,
            description: troopData.description || null,
            avatar: troopData.avatar || null,
            passiveId: troopData.passiveId || "NONE",
            resourceType: troopData.resourceType || "ore",
            combat: troopData.combat,
            speed: troopData.speed,
            focus: troopData.focus,
            resistance: troopData.resistance,
            will: troopData.will,
            vitality: troopData.vitality,
          },
        });
      }

      // 4. Retornar o reino completo
      return await tx.kingdom.findUnique({
        where: { id: newKingdom.id },
        include: {
          regent: true,
          troopTemplates: { orderBy: { slotIndex: "asc" } },
          owner: { select: { id: true, username: true } },
        },
      });
    });

    console.log(
      `[Kingdom] Reino "${template.name}" criado para ${userData.userId}`
    );

    client.send("kingdom:created", {
      kingdom,
      message: `Reino ${template.name} criado com sucesso!`,
    });
  } catch (error) {
    console.error("[Kingdom] Erro ao criar reino:", error);
    client.send("kingdom:error", {
      message: "Erro ao criar reino",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Busca dados de um reino
 */
export async function handleGetKingdom(
  client: Client,
  kingdomId: string
): Promise<void> {
  try {
    const kingdom = await prisma.kingdom.findUnique({
      where: { id: kingdomId },
      include: {
        regent: true,
        troopTemplates: true,
        owner: { select: { id: true, username: true } },
      },
    });

    if (!kingdom) {
      client.send("error", { message: "Reino não encontrado" });
      return;
    }

    client.send("kingdom:data", { kingdom });
  } catch (error) {
    client.send("error", { message: "Erro ao buscar reino" });
  }
}

/**
 * Busca detalhes completos de um reino
 */
export async function handleGetKingdomDetails(
  client: Client,
  kingdomId: string
): Promise<void> {
  if (!isAuthenticated(client)) {
    sendAuthError(client, "kingdom:error");
    return;
  }

  try {
    const kingdom = await prisma.kingdom.findUnique({
      where: { id: kingdomId },
      include: {
        regent: true,
        troopTemplates: true,
        owner: { select: { id: true, username: true } },
      },
    });

    if (!kingdom) {
      client.send("kingdom:error", {
        message: "Reino não encontrado",
        code: "NOT_FOUND",
      });
      return;
    }

    client.send("kingdom:details", kingdom);
  } catch (error) {
    client.send("kingdom:error", {
      message: "Erro ao buscar reino",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Lista templates de reinos disponíveis
 */
export async function handleListKingdomTemplates(
  client: Client
): Promise<void> {
  try {
    const templates = KINGDOM_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description.substring(0, 200) + "...",
      alignment: t.alignment,
      race: t.race,
      regentCode: t.regentCode,
    }));

    client.send("kingdom:templates_list", { templates });
  } catch (error) {
    client.send("kingdom:error", {
      message: "Erro ao listar templates",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Busca detalhes de um template
 */
export async function handleGetKingdomTemplate(
  client: Client,
  templateId: string
): Promise<void> {
  try {
    const template = KINGDOM_TEMPLATES.find((t) => t.id === templateId);

    if (!template) {
      client.send("kingdom:error", {
        message: "Template não encontrado",
        code: "NOT_FOUND",
      });
      return;
    }

    client.send("kingdom:template_details", { template });
  } catch (error) {
    client.send("kingdom:error", {
      message: "Erro ao buscar template",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Retorna lista de raças
 */
export async function handleGetRaces(client: Client): Promise<void> {
  try {
    client.send("kingdom:races_data", RACE_DEFINITIONS);
  } catch (error) {
    client.send("kingdom:error", {
      message: "Erro ao buscar raças",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Retorna lista de alinhamentos
 */
export async function handleGetAlignments(client: Client): Promise<void> {
  try {
    client.send("kingdom:alignments_data", ALIGNMENT_DEFINITIONS);
  } catch (error) {
    client.send("kingdom:error", {
      message: "Erro ao buscar alinhamentos",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Retorna lista de passivas de tropas
 */
export async function handleGetTroopPassives(client: Client): Promise<void> {
  try {
    // TODO: Implementar quando houver passivas definidas
    client.send("kingdom:troop_passives_data", []);
  } catch (error) {
    client.send("kingdom:error", {
      message: "Erro ao buscar passivas",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Atualiza descrição de um reino
 */
export async function handleUpdateKingdomDescription(
  client: Client,
  kingdomId: string,
  description: string
): Promise<void> {
  if (!isAuthenticated(client)) {
    sendAuthError(client, "kingdom:error");
    return;
  }

  const userData = getUserData(client)!;

  try {
    const kingdom = await prisma.kingdom.findUnique({
      where: { id: kingdomId },
    });

    if (!kingdom || kingdom.ownerId !== userData.userId) {
      client.send("kingdom:error", {
        message: "Reino não encontrado ou não autorizado",
        code: "NOT_FOUND",
      });
      return;
    }

    const updated = await prisma.kingdom.update({
      where: { id: kingdomId },
      data: { description },
    });

    client.send("kingdom:description_updated", { kingdom: updated });
  } catch (error) {
    client.send("kingdom:error", {
      message: "Erro ao atualizar descrição",
      code: "INTERNAL_ERROR",
    });
  }
}

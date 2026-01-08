// src/utils/army/troop.utils.ts

import { PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { TROOP_ABILITY_MAP as TROOP_SKILLS_MAP } from "../../../../shared/data/abilities.data";
import {
  TROOP_RECRUITMENT_BASE_COST,
  TROOP_LEVELUP_COSTS,
  TROOP_ATTRIBUTE_POINTS_PER_LEVEL,
  MAX_TROOP_LEVEL,
  PlayerResources,
} from "../../types";
import {
  getResourceName,
  HP_CONFIG,
  MANA_CONFIG,
} from "../../../../shared/config/global.config";
import {
  TroopTemplateData,
  TROOP_INITIAL_ATTRIBUTE_POINTS,
  TROOP_MAX_ATTRIBUTE_VALUE,
} from "../../../../shared/types/units.types";

// Re-export para compatibilidade
export type { TroopTemplateData } from "../../../../shared/types/units.types";

// Tipo para transação Prisma
type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
type PrismaClientOrTransaction = PrismaClient | PrismaTransaction;

// Validar que os pontos foram distribuídos corretamente
export function validateTroopAttributes(data: TroopTemplateData): {
  valid: boolean;
  message?: string;
} {
  const total =
    data.combat +
    data.speed +
    data.focus +
    data.resistance +
    data.will +
    data.vitality;

  if (total !== TROOP_INITIAL_ATTRIBUTE_POINTS) {
    return {
      valid: false,
      message: `A soma dos atributos deve ser ${TROOP_INITIAL_ATTRIBUTE_POINTS}. Atual: ${total}`,
    };
  }

  const attrs = [
    data.combat,
    data.speed,
    data.focus,
    data.resistance,
    data.will,
    data.vitality,
  ];
  for (const attr of attrs) {
    if (attr < 0) {
      return { valid: false, message: "Atributos não podem ser negativos." };
    }
    if (attr > TROOP_MAX_ATTRIBUTE_VALUE) {
      return {
        valid: false,
        message: `Atributos não podem exceder ${TROOP_MAX_ATTRIBUTE_VALUE}.`,
      };
    }
  }

  return { valid: true };
}

// Validar passiva
export function validateTroopPassive(passiveId: string): boolean {
  return TROOP_SKILLS_MAP[passiveId] !== undefined;
}

// Validar recurso
export function validateTroopResource(
  resourceType: string
): resourceType is keyof PlayerResources {
  return ["ore", "supplies", "arcane", "experience", "devotion"].includes(
    resourceType
  );
}

// Criar os 5 templates de tropas para um reino
export async function createTroopTemplatesForKingdom(
  kingdomId: string,
  templates: TroopTemplateData[],
  tx?: PrismaClientOrTransaction
): Promise<{ success: boolean; message?: string }> {
  const db = tx || prisma;
  // Validar quantidade
  if (templates.length !== 5) {
    return {
      success: false,
      message: "É necessário definir exatamente 5 tropas.",
    };
  }

  // Validar cada template
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];

    // Validar slotIndex
    if (t.slotIndex !== i) {
      return {
        success: false,
        message: `Template ${i} tem slotIndex incorreto.`,
      };
    }

    // Validar nome
    if (!t.name || t.name.trim().length === 0) {
      return {
        success: false,
        message: `Tropa ${i + 1} precisa de um nome.`,
      };
    }

    // Validar passiva
    if (!validateTroopPassive(t.passiveId)) {
      return {
        success: false,
        message: `Passiva "${t.passiveId}" inválida para tropa ${i + 1}.`,
      };
    }

    // Validar recurso
    if (!validateTroopResource(t.resourceType)) {
      return {
        success: false,
        message: `Recurso "${t.resourceType}" inválido para tropa ${i + 1}.`,
      };
    }

    // Validar atributos
    const attrValidation = validateTroopAttributes(t);
    if (!attrValidation.valid) {
      return {
        success: false,
        message: `Tropa ${i + 1}: ${attrValidation.message}`,
      };
    }
  }

  // Criar templates no banco
  try {
    await db.troopTemplate.createMany({
      data: templates.map((t) => ({
        kingdomId,
        slotIndex: t.slotIndex,
        name: t.name.trim(),
        description: t.description || null,
        avatar: t.avatar || null,
        passiveId: t.passiveId,
        resourceType: t.resourceType,
        combat: t.combat,
        speed: t.speed,
        focus: t.focus,
        resistance: t.resistance,
        will: t.will ?? 0,
        vitality: t.vitality,
      })),
    });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Erro ao criar templates de tropas.",
    };
  }
}

// Obter templates de tropas de um reino
export async function getKingdomTroopTemplates(kingdomId: string) {
  return prisma.troopTemplate.findMany({
    where: { kingdomId },
    orderBy: { slotIndex: "asc" },
  });
}

// Calcular custo de recrutamento de tropa
// Fórmula: (quantidade_atual + 1) × 2
export async function calculateTroopRecruitmentCost(
  matchId: string,
  ownerId: string,
  troopSlotIndex: number
): Promise<number> {
  const count = await prisma.unit.count({
    where: {
      matchId,
      ownerId,
      category: "TROOP",
      troopSlot: troopSlotIndex,
    },
  });

  return (count + 1) * TROOP_RECRUITMENT_BASE_COST;
}

// Recrutar uma tropa baseada no template do reino
export async function recruitTroop(
  matchId: string,
  playerId: string,
  troopSlotIndex: number,
  customName?: string
): Promise<{ success: boolean; unit?: any; message?: string }> {
  try {
    // Buscar jogador e reino
    const player = await prisma.matchKingdom.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return { success: false, message: "Jogador não encontrado." };
    }

    // Buscar template da tropa
    const template = await prisma.troopTemplate.findFirst({
      where: {
        kingdomId: player.kingdomId,
        slotIndex: troopSlotIndex,
      },
    });

    if (!template) {
      return { success: false, message: "Template de tropa não encontrado." };
    }

    // Calcular custo
    const cost = await calculateTroopRecruitmentCost(
      matchId,
      playerId,
      troopSlotIndex
    );

    // Verificar recursos
    let resources: PlayerResources;
    try {
      resources = JSON.parse(player.resources);
    } catch {
      resources = {
        ore: 0,
        supplies: 0,
        arcane: 0,
        experience: 0,
        devotion: 0,
      };
    }

    const resourceKey = template.resourceType as keyof PlayerResources;
    if ((resources[resourceKey] || 0) < cost) {
      return {
        success: false,
        message: `${getResourceName(
          resourceKey as any
        )} insuficiente. Custo: ${cost}, disponível: ${
          resources[resourceKey] || 0
        }`,
      };
    }

    // Deduzir recursos
    resources[resourceKey] -= cost;
    await prisma.matchKingdom.update({
      where: { id: playerId },
      data: { resources: JSON.stringify(resources) },
    });

    // Obter nível da tropa (armazenado em troopLevels do jogador)
    let troopLevels: Record<string, number>;
    try {
      troopLevels = JSON.parse(player.troopLevels);
    } catch {
      troopLevels = {};
    }
    const level = troopLevels[String(troopSlotIndex)] || 1;

    // Calcular bonus de atributos por nível
    const bonusPoints = (level - 1) * TROOP_ATTRIBUTE_POINTS_PER_LEVEL;
    // Distribuição uniforme do bônus (pode ser customizado depois)
    const bonusPerAttr = Math.floor(bonusPoints / 5);
    const remainder = bonusPoints % 5;

    // Buscar localização do jogador (capital)
    const capitalTerritory = await prisma.territory.findFirst({
      where: {
        matchId,
        ownerId: playerId,
        isCapital: true,
      },
    });

    // Criar unidade
    const finalVitality =
      template.vitality + bonusPerAttr + (remainder > 5 ? 1 : 0);
    const finalWill =
      (template.will ?? 0) + bonusPerAttr + (remainder > 4 ? 1 : 0);
    const unit = await prisma.unit.create({
      data: {
        matchId,
        ownerId: playerId,
        category: "TROOP",
        troopSlot: troopSlotIndex, // Armazena qual slot de tropa
        level,
        name: customName || template.name,
        avatar: template.avatar, // Sprite da tropa definido no template
        features: JSON.stringify([template.passiveId]),
        combat: template.combat + bonusPerAttr + (remainder > 0 ? 1 : 0),
        speed: template.speed + bonusPerAttr + (remainder > 1 ? 1 : 0),
        focus: template.focus + bonusPerAttr + (remainder > 2 ? 1 : 0),
        resistance:
          template.resistance + bonusPerAttr + (remainder > 3 ? 1 : 0),
        will: finalWill,
        vitality: finalVitality,
        maxHp: finalVitality * HP_CONFIG.multiplier,
        currentHp: finalVitality * HP_CONFIG.multiplier,
        maxMana: finalWill * MANA_CONFIG.multiplier,
        currentMana: finalWill * MANA_CONFIG.multiplier,
        movesLeft: 3,
        actionsLeft: 1,
        locationIndex: capitalTerritory?.mapIndex ?? null,
      },
    });

    return { success: true, unit };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Erro ao recrutar tropa.",
    };
  }
}

// Obter informações de uma categoria de tropa
export async function getTroopCategoryInfo(
  playerId: string,
  troopSlotIndex: number
): Promise<{
  level: number;
  stats: {
    combat: number;
    speed: number;
    focus: number;
    resistance: number;
    will: number;
    vitality: number;
  };
  troopCount: number;
  template: any;
}> {
  const player = await prisma.matchKingdom.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    throw new Error("Jogador não encontrado.");
  }

  // Buscar template
  const template = await prisma.troopTemplate.findFirst({
    where: {
      kingdomId: player.kingdomId,
      slotIndex: troopSlotIndex,
    },
  });

  if (!template) {
    throw new Error("Template de tropa não encontrado.");
  }

  // Obter nível
  let troopLevels: Record<string, number>;
  try {
    troopLevels = JSON.parse(player.troopLevels);
  } catch {
    troopLevels = {};
  }
  const level = troopLevels[String(troopSlotIndex)] || 1;

  // Calcular stats com bônus de nível
  const bonusPoints = (level - 1) * TROOP_ATTRIBUTE_POINTS_PER_LEVEL;
  const bonusPerAttr = Math.floor(bonusPoints / 5);
  const remainder = bonusPoints % 5;

  // Contar tropas
  const troopCount = await prisma.unit.count({
    where: {
      ownerId: playerId,
      category: "TROOP",
      troopSlot: troopSlotIndex,
    },
  });

  return {
    level,
    stats: {
      combat: template.combat + bonusPerAttr + (remainder > 0 ? 1 : 0),
      speed: template.speed + bonusPerAttr + (remainder > 1 ? 1 : 0),
      focus: template.focus + bonusPerAttr + (remainder > 2 ? 1 : 0),
      resistance: template.resistance + bonusPerAttr + (remainder > 3 ? 1 : 0),
      will: (template.will ?? 0) + bonusPerAttr + (remainder > 4 ? 1 : 0),
      vitality: template.vitality + bonusPerAttr + (remainder > 5 ? 1 : 0),
    },
    troopCount,
    template,
  };
}

// Evoluir categoria de tropa
export async function upgradeTroopCategory(
  matchId: string,
  playerId: string,
  troopSlotIndex: number
): Promise<{
  success: boolean;
  message?: string;
  newLevel?: number;
  newStats?: any;
}> {
  try {
    const player = await prisma.matchKingdom.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return { success: false, message: "Jogador não encontrado." };
    }

    // Obter nível atual
    let troopLevels: Record<string, number>;
    try {
      troopLevels = JSON.parse(player.troopLevels);
    } catch {
      troopLevels = {};
    }
    const currentLevel = troopLevels[String(troopSlotIndex)] || 1;

    if (currentLevel >= MAX_TROOP_LEVEL) {
      return { success: false, message: "Nível máximo atingido." };
    }

    // Verificar custo
    const cost = TROOP_LEVELUP_COSTS[currentLevel];
    if (!cost) {
      return { success: false, message: "Custo de level up não definido." };
    }

    // Verificar recursos (usa experiência para level up)
    let resources: PlayerResources;
    try {
      resources = JSON.parse(player.resources);
    } catch {
      resources = {
        ore: 0,
        supplies: 0,
        arcane: 0,
        experience: 0,
        devotion: 0,
      };
    }

    if (resources.experience < cost) {
      return {
        success: false,
        message: `${getResourceName(
          "experience"
        )} insuficiente. Custo: ${cost}, disponível: ${resources.experience}`,
      };
    }

    // Deduzir recursos e aumentar nível do TEMPLATE
    resources.experience -= cost;
    troopLevels[String(troopSlotIndex)] = currentLevel + 1;

    await prisma.matchKingdom.update({
      where: { id: playerId },
      data: {
        resources: JSON.stringify(resources),
        troopLevels: JSON.stringify(troopLevels),
      },
    });

    // Obter novos stats para futuras tropas
    const info = await getTroopCategoryInfo(playerId, troopSlotIndex);

    // NOTA: NÃO atualizamos tropas existentes!
    // Cada tropa é uma Unit única que pode ter modificações individuais.
    // O upgrade do template só afeta NOVAS tropas recrutadas.

    return {
      success: true,
      newLevel: currentLevel + 1,
      newStats: info.stats,
      message: `Template de tropa evoluído para nível ${
        currentLevel + 1
      }! Novas tropas recrutadas terão stats melhores.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Erro ao evoluir tropa.",
    };
  }
}

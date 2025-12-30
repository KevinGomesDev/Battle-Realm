// src/utils/skills.utils.ts
import { CostTier, SkillCategory, SkillRange } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ResourceType } from "../types";
import { spendResources } from "./turn.utils";

// Valores de custo para as enums do banco
const COST_VALUES: Record<CostTier, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  EXTREME: 4,
};

// Alcances aproximados em quadrados para as enums do banco
const RANGE_VALUES: Record<SkillRange, number> = {
  SELF: 0,
  ADJACENT: 1,
  RANGED: 6,
  AREA: 3,
};

const RESOURCE_KEY_MAP: Record<
  string,
  keyof ReturnType<typeof parseResources>
> = {
  ORE: "ore",
  FOOD: "supplies",
  SUPPLIES: "supplies",
  ARCANE: "arcane",
  ARCANA: "arcane",
  DEVOTION: "devotion",
  EXPERIENCE: "experience",
};

const RESOURCE_LABEL: Record<
  keyof ReturnType<typeof parseResources>,
  ResourceType
> = {
  ore: "ORE",
  supplies: "FOOD",
  arcane: "ARCANE",
  experience: "EXPERIENCE",
  devotion: "DEVOTION",
};

function parseResources(raw: string | null | undefined) {
  try {
    return JSON.parse(raw || "{}") as {
      ore?: number;
      supplies?: number;
      arcane?: number;
      experience?: number;
      devotion?: number;
    };
  } catch {
    return { ore: 0, supplies: 0, arcane: 0, experience: 0, devotion: 0 };
  }
}

function mapResource(resourceUsed: string | null | undefined) {
  if (!resourceUsed) return null;
  const key = RESOURCE_KEY_MAP[resourceUsed.toUpperCase()];
  if (!key) return null;
  return {
    resourceKey: key,
    resourceLabel: RESOURCE_LABEL[key],
  } as const;
}

/**
 * Obtém todas as habilidades de uma classe pelo code
 */
export async function getClassSkills(classCode: string) {
  const heroClass = await prisma.heroClass.findUnique({
    where: { code: classCode },
    include: { skills: true },
  });

  return heroClass?.skills ?? [];
}

/**
 * Obtém detalhes completos de uma habilidade
 */
export async function getSkillDefinition(skillCode: string) {
  return prisma.skill.findUnique({ where: { code: skillCode } });
}

/**
 * Calcula o custo base de uma habilidade
 */
export function calculateBaseCost(
  costTier: CostTier | null | undefined
): number {
  if (!costTier) return 0;
  return COST_VALUES[costTier] || 0;
}

/**
 * Calcula o custo com escalada (dobrado a cada uso na mesma batalha)
 */
export function calculateEscaledCost(
  baseCost: number,
  usageCount: number
): number {
  if (baseCost === 0) return 0;
  // Primeira vez: baseCost
  // Segunda vez: baseCost * 2
  // Terceira vez: baseCost * 2 * 2 = baseCost * 4
  // Etc.
  return baseCost * Math.pow(2, usageCount);
}

/**
 * Obtém o alcance em quadrados de uma habilidade
 */
export function getSkillRange(
  rangeType: SkillRange | null | undefined
): number {
  if (!rangeType) return 0;
  return RANGE_VALUES[rangeType] || 0;
}

/**
 * Valida se uma habilidade pode ser usada
 */
export async function validateSkillUsage(
  unitId: string,
  skillCode: string,
  playerId: string,
  usageCountThisBattle: number = 0
): Promise<{
  valid: boolean;
  reason?: string;
  cost?: number;
  resourceType?: ResourceType;
}> {
  // Busca a unidade com heroClass incluído
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { heroClass: true },
  });

  if (!unit) {
    return { valid: false, reason: "Unidade não encontrada" };
  }

  if (unit.ownerId !== playerId) {
    return { valid: false, reason: "Você não é dono desta unidade" };
  }

  // Busca a habilidade no banco
  const skill = await prisma.skill.findUnique({ where: { code: skillCode } });
  if (!skill) {
    return { valid: false, reason: "Habilidade não encontrada" };
  }

  // Se é passiva, sempre pode ser usada (já está ativa)
  if (skill.category === SkillCategory.PASSIVE) {
    return {
      valid: true,
      cost: 0,
    };
  }

  // Se é ativa ou reativa, verifica custo
  if (!skill.costTier) {
    // Sem custo
    return {
      valid: true,
      cost: 0,
    };
  }

  // Calcula custo escalado
  const baseCost = calculateBaseCost(skill.costTier);
  const escalatedCost = calculateEscaledCost(baseCost, usageCountThisBattle);

  // Obtém a classe da unidade para saber qual recurso é necessário
  if (!unit.heroClass) {
    return {
      valid: false,
      reason: "Unidade não possui classe definida",
    };
  }

  const resourceInfo = mapResource(unit.heroClass.resourceUsed);
  if (!resourceInfo) {
    return {
      valid: false,
      reason: "Recurso da classe não encontrado",
    };
  }

  // Verifica se jogador tem recursos suficientes
  const player = await prisma.matchPlayer.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    return {
      valid: false,
      reason: "Jogador não encontrado",
    };
  }

  const playerResources = parseResources(player.resources);
  const availableAmount = playerResources[resourceInfo.resourceKey] || 0;

  if (availableAmount < escalatedCost) {
    return {
      valid: false,
      reason: `Recursos insuficientes. Disponível: ${availableAmount} ${resourceInfo.resourceLabel}, Necessário: ${escalatedCost}`,
      cost: escalatedCost,
      resourceType: resourceInfo.resourceLabel,
    };
  }

  return {
    valid: true,
    cost: escalatedCost,
    resourceType: resourceInfo.resourceLabel,
  };
}

/**
 * Usa uma habilidade (gasta recurso e registra uso)
 */
export async function useSkill(
  unitId: string,
  skillCode: string,
  playerId: string,
  usageCountThisBattle: number = 0
): Promise<{
  success: boolean;
  message: string;
  cost?: number;
  resourceType?: ResourceType;
}> {
  // Valida uso
  const validation = await validateSkillUsage(
    unitId,
    skillCode,
    playerId,
    usageCountThisBattle
  );

  if (!validation.valid) {
    return {
      success: false,
      message: validation.reason || "Habilidade não pode ser usada",
    };
  }

  const skill = await prisma.skill.findUnique({ where: { code: skillCode } });
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { heroClass: true },
  });

  if (!unit || !unit.heroClass || !skill) {
    return {
      success: false,
      message: "Dados da unidade ou habilidade não encontrados",
    };
  }

  const resourceInfo = mapResource(unit.heroClass.resourceUsed);

  // Se tem custo, gasta o recurso
  if (validation.cost && validation.cost > 0 && resourceInfo) {
    try {
      const spendData: any = {};
      spendData[resourceInfo.resourceKey] = validation.cost;
      await spendResources(playerId, spendData);
    } catch (error) {
      return {
        success: false,
        message: `Erro ao gastar ${resourceInfo.resourceLabel}`,
      };
    }
  }

  return {
    success: true,
    message: `Habilidade "${skill.name}" usada com sucesso!`,
    cost: validation.cost,
    resourceType: validation.resourceType,
  };
}

/**
 * Obtém todas as informações de uma habilidade de forma detalhada
 */
export async function getSkillInfo(
  skillCode: string,
  unitId: string,
  playerId: string,
  usageCountThisBattle: number = 0
): Promise<{
  skill: any;
  isAvailable: boolean;
  canUse: boolean;
  cost: number;
  resourceType?: ResourceType;
  reason?: string;
}> {
  const skill = await prisma.skill.findUnique({ where: { code: skillCode } });

  if (!skill) {
    return {
      skill: null,
      isAvailable: false,
      canUse: false,
      cost: 0,
      reason: "Habilidade não encontrada",
    };
  }

  const validation = await validateSkillUsage(
    unitId,
    skillCode,
    playerId,
    usageCountThisBattle
  );

  return {
    skill,
    isAvailable: true,
    canUse: validation.valid,
    cost: validation.cost || 0,
    resourceType: validation.resourceType,
    reason: validation.reason,
  };
}

/**
 * Lista todas as classes disponíveis com suas habilidades
 */
export async function listAllClasses() {
  const classes = await prisma.heroClass.findMany({
    include: { skills: true },
    orderBy: { name: "asc" },
  });

  return classes.map((classDef) => ({
    id: classDef.code,
    name: classDef.name,
    archetype: classDef.archetype,
    description: classDef.description,
    resourceUsed: classDef.resourceUsed,
    skillCount: classDef.skills.length,
    skills: classDef.skills.map((skill) => ({
      id: skill.code,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      costTier: skill.costTier,
      baseCost: skill.costTier ? COST_VALUES[skill.costTier] : 0,
      range: skill.range,
      rangeSquares: skill.range ? RANGE_VALUES[skill.range] : 0,
    })),
  }));
}

/**
 * Obtém detalhes de uma classe específica
 */
export async function getClassInfo(classCode: string) {
  const classDef = await prisma.heroClass.findUnique({
    where: { code: classCode },
    include: { skills: true },
  });

  if (!classDef) {
    return null;
  }

  return {
    id: classDef.code,
    name: classDef.name,
    archetype: classDef.archetype,
    description: classDef.description,
    resourceUsed: classDef.resourceUsed,
    skills: classDef.skills.map((skill) => ({
      id: skill.code,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      costTier: skill.costTier,
      baseCost: skill.costTier ? COST_VALUES[skill.costTier] : 0,
      range: skill.range,
      rangeSquares: skill.range ? RANGE_VALUES[skill.range] : 0,
    })),
  };
}

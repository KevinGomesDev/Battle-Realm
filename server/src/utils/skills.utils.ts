// src/utils/skills.utils.ts
// Utilitários para o sistema de skills - usando dados estáticos

import { prisma } from "../lib/prisma";
import { spendResources } from "./turn.utils";
import {
  HERO_CLASSES,
  getClassByCode,
  getSkillByCode,
  getSkillsForClass,
  getAllClassesSummary,
} from "../../../shared/data/classes.data";
import {
  SkillCategory,
  SkillCostTier,
  SkillRange,
  SkillResourceType,
  SkillDefinition,
  HeroClassDefinition,
  COST_VALUES,
  DEFAULT_RANGE_VALUES,
  getSkillCost,
  getSkillEffectiveRange,
} from "../../../shared/types/skills.types";
import {
  getResourceName,
  ResourceKey,
} from "../../../shared/config/global.config";

// ================
// Resource Helpers
// ================

// Mapeia nomes de recursos para chaves de ParsedResources
const RESOURCE_KEY_MAP: Record<string, keyof ParsedResources> = {
  FOOD: "supplies",
  SUPPLIES: "supplies",
  ARCANA: "arcane",
  ARCANE: "arcane",
  DEVOTION: "devotion",
};

interface ParsedResources {
  ore?: number;
  supplies?: number;
  arcane?: number;
  experience?: number;
  devotion?: number;
}

function parseResources(raw: string | null | undefined): ParsedResources {
  try {
    return JSON.parse(raw || "{}") as ParsedResources;
  } catch {
    return { ore: 0, supplies: 0, arcane: 0, experience: 0, devotion: 0 };
  }
}

function mapResource(resourceUsed: SkillResourceType | null | undefined) {
  if (!resourceUsed) return null;
  const key = RESOURCE_KEY_MAP[resourceUsed.toUpperCase()];
  if (!key) return null;
  // Usa getResourceName para obter o nome localizado
  const resourceKey = key as ResourceKey;
  return {
    resourceKey: key,
    resourceLabel: getResourceName(resourceKey),
    skillResourceType: resourceUsed, // Mantém o tipo original para tipagem
  } as const;
}

// ================
// Skill Functions (usando dados estáticos)
// ================

/**
 * Obtém todas as habilidades de uma classe pelo code
 */
export function getClassSkills(classCode: string): SkillDefinition[] {
  return getSkillsForClass(classCode);
}

/**
 * Obtém detalhes completos de uma habilidade
 */
export function getSkillDefinition(skillCode: string): SkillDefinition | null {
  const result = getSkillByCode(skillCode);
  return result ? result.skill : null;
}

/**
 * Calcula o custo base de uma habilidade
 */
export function calculateBaseCost(
  costTier: SkillCostTier | null | undefined
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
  // Terceira vez: baseCost * 4
  return baseCost * Math.pow(2, usageCount);
}

/**
 * Obtém o alcance em quadrados de uma habilidade
 */
export function getSkillRange(
  rangeType: SkillRange | null | undefined
): number {
  if (!rangeType) return 0;
  return DEFAULT_RANGE_VALUES[rangeType] || 0;
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
  resourceType?: SkillResourceType;
}> {
  // Busca a unidade
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { valid: false, reason: "Unidade não encontrada" };
  }

  if (unit.ownerId !== playerId) {
    return { valid: false, reason: "Você não é dono desta unidade" };
  }

  // Busca a habilidade nos dados estáticos
  const skillResult = getSkillByCode(skillCode);
  if (!skillResult) {
    return { valid: false, reason: "Habilidade não encontrada" };
  }
  const skill = skillResult.skill;

  // Se é passiva, sempre pode ser usada (já está ativa)
  if (skill.category === "PASSIVE") {
    return { valid: true, cost: 0 };
  }

  // Se é ativa ou reativa, verifica custo
  if (!skill.costTier) {
    return { valid: true, cost: 0 };
  }

  // Calcula custo escalado
  const baseCost = getSkillCost(skill);
  const escalatedCost = calculateEscaledCost(baseCost, usageCountThisBattle);

  // Obtém a classe da unidade para saber qual recurso é necessário
  const classCode = unit.classCode;
  if (!classCode) {
    return { valid: false, reason: "Unidade não possui classe definida" };
  }

  const heroClass = getClassByCode(classCode);
  if (!heroClass) {
    return { valid: false, reason: `Classe ${classCode} não encontrada` };
  }

  const resourceInfo = mapResource(heroClass.resourceUsed);
  if (!resourceInfo) {
    return { valid: false, reason: "Recurso da classe não encontrado" };
  }

  // Verifica se jogador tem recursos suficientes
  const player = await prisma.matchKingdom.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    return { valid: false, reason: "Jogador não encontrado" };
  }

  const playerResources = parseResources(player.resources);
  const availableAmount = playerResources[resourceInfo.resourceKey] || 0;

  if (availableAmount < escalatedCost) {
    return {
      valid: false,
      reason: `Recursos insuficientes. Disponível: ${availableAmount} ${resourceInfo.resourceLabel}, Necessário: ${escalatedCost}`,
      cost: escalatedCost,
      resourceType: resourceInfo.skillResourceType,
    };
  }

  return {
    valid: true,
    cost: escalatedCost,
    resourceType: resourceInfo.skillResourceType,
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
  resourceType?: SkillResourceType;
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

  const skillResult = getSkillByCode(skillCode);
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });

  if (!unit || !skillResult) {
    return {
      success: false,
      message: "Dados da unidade ou habilidade não encontrados",
    };
  }

  const skill = skillResult.skill;
  const classCode = unit.classCode;
  const heroClass = classCode ? getClassByCode(classCode) : null;
  const resourceInfo = heroClass ? mapResource(heroClass.resourceUsed) : null;

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
  skill: SkillDefinition | null;
  isAvailable: boolean;
  canUse: boolean;
  cost: number;
  resourceType?: SkillResourceType;
  reason?: string;
}> {
  const skillResult = getSkillByCode(skillCode);

  if (!skillResult) {
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
    skill: skillResult.skill,
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
export function listAllClasses() {
  return HERO_CLASSES.map((classDef) => ({
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
      baseCost: getSkillCost(skill),
      range: skill.range,
      rangeSquares: getSkillEffectiveRange(skill),
    })),
  }));
}

/**
 * Obtém detalhes de uma classe específica
 */
export function getClassInfo(classCode: string) {
  const classDef = getClassByCode(classCode);

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
      baseCost: getSkillCost(skill),
      range: skill.range,
      rangeSquares: getSkillEffectiveRange(skill),
    })),
  };
}

// Re-exportar funções de dados para conveniência
export {
  getClassByCode,
  getSkillByCode,
  getSkillsForClass,
  getAllClassesSummary,
};

// server/src/modules/abilities/ability.utils.ts
// Utilitários UNIFICADOS para o sistema de abilities (skills + spells)
// FONTE DE VERDADE para operações de habilidades

import type {
  AbilityDefinition,
  HeroClassDefinition,
  AbilityCostTier,
  AbilityRange,
  AbilityResourceType,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import {
  DEFAULT_RANGE_VALUES,
  COST_VALUES,
  getAbilityCost,
} from "@boundless/shared/types/ability.types";
import { getAbilityMaxRange } from "@boundless/shared/utils/ability-validation";
import {
  HERO_CLASSES,
  getClassByCode,
  getAbilityByCode,
  getAbilitiesForClass,
  getAllClassesSummary,
  findAbilityByCode,
} from "@boundless/shared/data/abilities.data";
import { getResourceName, ResourceKey } from "@boundless/shared/config";
import { prisma } from "../../lib/prisma";
import { spendResources } from "../match/turn.utils";

// =============================================================================
// TIPOS
// =============================================================================

interface ParsedResources {
  ore?: number;
  supplies?: number;
  arcane?: number;
  experience?: number;
  devotion?: number;
}

// Mapeia nomes de recursos para chaves de ParsedResources
const RESOURCE_KEY_MAP: Record<string, keyof ParsedResources> = {
  FOOD: "supplies",
  SUPPLIES: "supplies",
  ARCANA: "arcane",
  ARCANE: "arcane",
  DEVOTION: "devotion",
};

// =============================================================================
// HELPERS
// =============================================================================

function parseResources(raw: string | null | undefined): ParsedResources {
  try {
    return JSON.parse(raw || "{}") as ParsedResources;
  } catch {
    return { ore: 0, supplies: 0, arcane: 0, experience: 0, devotion: 0 };
  }
}

function mapResource(resourceUsed: AbilityResourceType | null | undefined) {
  if (!resourceUsed) return null;
  const key = RESOURCE_KEY_MAP[resourceUsed.toUpperCase()];
  if (!key) return null;
  const resourceKey = key as ResourceKey;
  return {
    resourceKey: key,
    resourceLabel: getResourceName(resourceKey),
    abilityResourceType: resourceUsed,
  } as const;
}

// =============================================================================
// ABILITY FUNCTIONS (Unificado skills + spells)
// =============================================================================

/**
 * Obtém todas as habilidades de uma classe pelo code
 */
export function getClassAbilities(classCode: string): AbilityDefinition[] {
  return getAbilitiesForClass(classCode);
}

/**
 * Obtém detalhes completos de uma habilidade
 */
export function getAbilityDefinition(
  abilityCode: string
): AbilityDefinition | null {
  const result = getAbilityByCode(abilityCode);
  return result ? result.ability : null;
}

/**
 * Calcula o custo base de uma habilidade
 */
export function calculateBaseCost(
  costTier: AbilityCostTier | null | undefined
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
  return baseCost * Math.pow(2, usageCount);
}

/**
 * Obtém o alcance em quadrados de uma habilidade
 */
export function getAbilityRange(
  rangeType: AbilityRange | null | undefined
): number {
  if (!rangeType) return 0;
  return DEFAULT_RANGE_VALUES[rangeType] || 0;
}

/**
 * Obtém o alcance efetivo de uma ability
 */
export function getAbilityEffectiveRange(
  ability: AbilityDefinition,
  caster?: BattleUnit
): number {
  // Se não tiver caster, usar valores padrão
  if (!caster) {
    const DEFAULT_RANGE_VALUES: Record<string, number> = {
      SELF: 0,
      MELEE: 1,
      RANGED: 5,
      AREA: 5,
    };
    return DEFAULT_RANGE_VALUES[ability.range || "MELEE"] || 1;
  }
  return getAbilityMaxRange(ability, caster);
}

/**
 * Valida se uma habilidade pode ser usada
 */
export async function validateAbilityUsage(
  unitId: string,
  abilityCode: string,
  playerId: string,
  usageCountThisBattle: number = 0
): Promise<{
  valid: boolean;
  reason?: string;
  cost?: number;
  resourceType?: AbilityResourceType;
}> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { valid: false, reason: "Unidade não encontrada" };
  }

  if (unit.ownerId !== playerId) {
    return { valid: false, reason: "Você não é dono desta unidade" };
  }

  const abilityResult = getAbilityByCode(abilityCode);
  if (!abilityResult) {
    return { valid: false, reason: "Habilidade não encontrada" };
  }
  const ability = abilityResult.ability;

  // Se é passiva, sempre pode ser usada (já está ativa)
  if (ability.activationType === "PASSIVE") {
    return { valid: true, cost: 0 };
  }

  // Se é ativa ou reativa, verifica custo
  if (!ability.costTier) {
    return { valid: true, cost: 0 };
  }

  const baseCost = getAbilityCost(ability);
  const escalatedCost = calculateEscaledCost(baseCost, usageCountThisBattle);

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
      resourceType: resourceInfo.abilityResourceType,
    };
  }

  return {
    valid: true,
    cost: escalatedCost,
    resourceType: resourceInfo.abilityResourceType,
  };
}

/**
 * Usa uma habilidade (gasta recurso e registra uso)
 */
export async function useAbility(
  unitId: string,
  abilityCode: string,
  playerId: string,
  usageCountThisBattle: number = 0
): Promise<{
  success: boolean;
  message: string;
  cost?: number;
  resourceType?: AbilityResourceType;
}> {
  const validation = await validateAbilityUsage(
    unitId,
    abilityCode,
    playerId,
    usageCountThisBattle
  );

  if (!validation.valid) {
    return {
      success: false,
      message: validation.reason || "Habilidade não pode ser usada",
    };
  }

  const abilityResult = getAbilityByCode(abilityCode);
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });

  if (!unit || !abilityResult) {
    return {
      success: false,
      message: "Dados da unidade ou habilidade não encontrados",
    };
  }

  const ability = abilityResult.ability;
  const classCode = unit.classCode;
  const heroClass = classCode ? getClassByCode(classCode) : null;
  const resourceInfo = heroClass ? mapResource(heroClass.resourceUsed) : null;

  if (validation.cost && validation.cost > 0 && resourceInfo) {
    try {
      const spendData: Record<string, number> = {};
      spendData[resourceInfo.resourceKey] = validation.cost;
      await spendResources(playerId, spendData);
    } catch {
      return {
        success: false,
        message: `Erro ao gastar ${resourceInfo.resourceLabel}`,
      };
    }
  }

  return {
    success: true,
    message: `Habilidade "${ability.name}" usada com sucesso!`,
    cost: validation.cost,
    resourceType: validation.resourceType,
  };
}

/**
 * Obtém todas as informações de uma habilidade de forma detalhada
 */
export async function getAbilityInfo(
  abilityCode: string,
  unitId: string,
  playerId: string,
  usageCountThisBattle: number = 0
): Promise<{
  ability: AbilityDefinition | null;
  isAvailable: boolean;
  canUse: boolean;
  cost: number;
  resourceType?: AbilityResourceType;
  reason?: string;
}> {
  const abilityResult = getAbilityByCode(abilityCode);

  if (!abilityResult) {
    return {
      ability: null,
      isAvailable: false,
      canUse: false,
      cost: 0,
      reason: "Habilidade não encontrada",
    };
  }

  const validation = await validateAbilityUsage(
    unitId,
    abilityCode,
    playerId,
    usageCountThisBattle
  );

  return {
    ability: abilityResult.ability,
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
    abilityCount: classDef.abilities.length,
    abilities: classDef.abilities.map((ability: AbilityDefinition) => ({
      id: ability.code,
      name: ability.name,
      description: ability.description,
      category: ability.category,
      costTier: ability.costTier,
      baseCost: getAbilityCost(ability),
      range: ability.range,
      rangeSquares: ability.range
        ? DEFAULT_RANGE_VALUES[ability.range] ?? 0
        : 0,
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
    abilities: classDef.abilities.map((ability: AbilityDefinition) => ({
      id: ability.code,
      name: ability.name,
      description: ability.description,
      category: ability.category,
      costTier: ability.costTier,
      baseCost: getAbilityCost(ability),
      range: ability.range,
      rangeSquares: ability.range
        ? DEFAULT_RANGE_VALUES[ability.range] ?? 0
        : 0,
    })),
  };
}

// =============================================================================
// SPELL-SPECIFIC FUNCTIONS (Spells são persistidas no banco)
// =============================================================================

/**
 * Adiciona uma spell/ability a uma unidade (persiste no banco)
 */
export async function grantAbilityToUnit(
  unitId: string,
  abilityCode: string
): Promise<{ success: boolean; message: string }> {
  try {
    const ability = findAbilityByCode(abilityCode);
    if (!ability) {
      return {
        success: false,
        message: `Ability não encontrada: ${abilityCode}`,
      };
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, spells: true },
    });

    if (!unit) {
      return {
        success: false,
        message: "Unidade não encontrada",
      };
    }

    const currentAbilities: string[] = JSON.parse(unit.spells || "[]");

    if (currentAbilities.includes(abilityCode)) {
      return {
        success: false,
        message: `${unit.name} já possui a ability ${ability.name}`,
      };
    }

    currentAbilities.push(abilityCode);

    await prisma.unit.update({
      where: { id: unitId },
      data: { spells: JSON.stringify(currentAbilities) },
    });

    return {
      success: true,
      message: `${ability.name} concedida a ${unit.name}!`,
    };
  } catch (error) {
    console.error("[ABILITIES] Erro ao conceder ability:", error);
    return {
      success: false,
      message: "Erro ao conceder ability",
    };
  }
}

/**
 * Remove uma ability de uma unidade
 */
export async function removeAbilityFromUnit(
  unitId: string,
  abilityCode: string
): Promise<{ success: boolean; message: string }> {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, spells: true },
    });

    if (!unit) {
      return {
        success: false,
        message: "Unidade não encontrada",
      };
    }

    let currentAbilities: string[] = JSON.parse(unit.spells || "[]");

    if (!currentAbilities.includes(abilityCode)) {
      return {
        success: false,
        message: `${unit.name} não possui essa ability`,
      };
    }

    currentAbilities = currentAbilities.filter((s) => s !== abilityCode);

    await prisma.unit.update({
      where: { id: unitId },
      data: { spells: JSON.stringify(currentAbilities) },
    });

    const ability = findAbilityByCode(abilityCode);
    return {
      success: true,
      message: `${ability?.name || abilityCode} removida de ${unit.name}`,
    };
  } catch (error) {
    console.error("[ABILITIES] Erro ao remover ability:", error);
    return {
      success: false,
      message: "Erro ao remover ability",
    };
  }
}

/**
 * Lista todas as abilities (spells) de uma unidade do banco
 */
export async function getUnitAbilitiesFromDB(
  unitId: string
): Promise<string[]> {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { spells: true },
    });

    if (!unit) {
      return [];
    }

    return JSON.parse(unit.spells || "[]");
  } catch (error) {
    console.error("[ABILITIES] Erro ao buscar abilities:", error);
    return [];
  }
}

/**
 * Verifica se uma unidade possui uma ability específica
 */
export async function unitHasAbilityInDB(
  unitId: string,
  abilityCode: string
): Promise<boolean> {
  const abilities = await getUnitAbilitiesFromDB(unitId);
  return abilities.includes(abilityCode);
}

/**
 * Concede múltiplas abilities de uma vez
 */
export async function grantMultipleAbilities(
  unitId: string,
  abilityCodes: string[]
): Promise<{ success: boolean; message: string; granted: string[] }> {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, spells: true },
    });

    if (!unit) {
      return {
        success: false,
        message: "Unidade não encontrada",
        granted: [],
      };
    }

    const currentAbilities: string[] = JSON.parse(unit.spells || "[]");
    const granted: string[] = [];

    for (const abilityCode of abilityCodes) {
      const ability = findAbilityByCode(abilityCode);
      if (!ability) {
        console.warn(`[ABILITIES] Ability inválida ignorada: ${abilityCode}`);
        continue;
      }

      if (!currentAbilities.includes(abilityCode)) {
        currentAbilities.push(abilityCode);
        granted.push(abilityCode);
      }
    }

    if (granted.length === 0) {
      return {
        success: false,
        message: "Nenhuma ability nova foi concedida",
        granted: [],
      };
    }

    await prisma.unit.update({
      where: { id: unitId },
      data: { spells: JSON.stringify(currentAbilities) },
    });

    return {
      success: true,
      message: `${granted.length} ability(ies) concedida(s) a ${unit.name}`,
      granted,
    };
  } catch (error) {
    console.error("[ABILITIES] Erro ao conceder múltiplas abilities:", error);
    return {
      success: false,
      message: "Erro ao conceder abilities",
      granted: [],
    };
  }
}

// =============================================================================
// ALIASES PARA COMPATIBILIDADE (deprecated)
// =============================================================================

/** @deprecated Use getClassAbilities */
export const getClassSkills = getClassAbilities;

/** @deprecated Use getAbilityDefinition */
export const getSkillDefinition = getAbilityDefinition;

/** @deprecated Use validateAbilityUsage */
export const validateSkillUsage = validateAbilityUsage;

/** @deprecated Use useAbility */
export const useSkill = useAbility;

/** @deprecated Use getAbilityInfo */
export const getSkillInfo = getAbilityInfo;

/** @deprecated Use grantAbilityToUnit */
export const grantSpellToUnit = grantAbilityToUnit;

/** @deprecated Use removeAbilityFromUnit */
export const removeSpellFromUnit = removeAbilityFromUnit;

/** @deprecated Use getUnitAbilitiesFromDB */
export const getUnitSpells = getUnitAbilitiesFromDB;

/** @deprecated Use unitHasAbilityInDB */
export const unitHasSpell = unitHasAbilityInDB;

/** @deprecated Use grantMultipleAbilities */
export const grantMultipleSpells = grantMultipleAbilities;

// Re-exportar funções de dados para conveniência
export {
  getClassByCode,
  getAbilityByCode,
  getAbilitiesForClass,
  getAllClassesSummary,
  findAbilityByCode,
};

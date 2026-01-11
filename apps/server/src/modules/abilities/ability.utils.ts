// server/src/modules/abilities/ability.utils.ts
// Utilitários UNIFICADOS para o sistema de abilities
// Todas as abilities usam Mana (da unidade) como recurso

import type { AbilityDefinition } from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { getAbilityCost } from "@boundless/shared/types/ability.types";
import { getAbilityMaxRange } from "@boundless/shared/utils/ability-validation";
import {
  HERO_CLASSES,
  getClassByCode,
  getAbilityByCode,
  getAbilitiesForClass,
  getAllClassesSummary,
  findAbilityByCode,
} from "@boundless/shared/data/abilities.data";
import { prisma } from "../../lib/prisma";

// =============================================================================
// ABILITY FUNCTIONS (Unificado)
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
 * Obtém o custo de mana de uma habilidade
 */
export function getManaCost(ability: AbilityDefinition): number {
  return getAbilityCost(ability);
}

/**
 * Obtém o alcance efetivo de uma ability
 */
export function getAbilityEffectiveRange(
  ability: AbilityDefinition,
  caster?: BattleUnit
): number {
  // Se não tiver caster, usar maxRange do pattern
  if (!caster) {
    const pattern = ability.targetingPattern;
    if (!pattern) return 1; // fallback melee

    // SELF abilities têm range 0
    if (pattern.origin === "CASTER") return 0;

    // Resolver maxRange se for número
    if (typeof pattern.maxRange === "number") {
      return pattern.maxRange;
    }

    return 1; // fallback melee
  }
  return getAbilityMaxRange(ability, caster);
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Lista todas as abilities (da coluna spells) de uma unidade do banco
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
 * Concede uma ability a uma unidade (salva no banco)
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
        message: `Ability "${abilityCode}" not found`,
      };
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, spells: true },
    });

    if (!unit) {
      return { success: false, message: "Unit not found" };
    }

    const currentAbilities: string[] = JSON.parse(unit.spells || "[]");

    if (currentAbilities.includes(abilityCode)) {
      return {
        success: false,
        message: `${unit.name} already has ${ability.name}`,
      };
    }

    currentAbilities.push(abilityCode);

    await prisma.unit.update({
      where: { id: unitId },
      data: { spells: JSON.stringify(currentAbilities) },
    });

    return {
      success: true,
      message: `${ability.name} granted to ${unit.name}!`,
    };
  } catch (error) {
    console.error("[ABILITIES] Error granting ability:", error);
    return { success: false, message: "Error granting ability" };
  }
}

/**
 * Remove uma ability de uma unidade (remove do banco)
 */
export async function removeAbilityFromUnit(
  unitId: string,
  abilityCode: string
): Promise<{ success: boolean; message: string }> {
  try {
    const ability = findAbilityByCode(abilityCode);

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, spells: true },
    });

    if (!unit) {
      return { success: false, message: "Unit not found" };
    }

    const currentAbilities: string[] = JSON.parse(unit.spells || "[]");

    if (!currentAbilities.includes(abilityCode)) {
      return {
        success: false,
        message: `${unit.name} does not have ${ability?.name || abilityCode}`,
      };
    }

    const updatedAbilities = currentAbilities.filter(
      (code) => code !== abilityCode
    );

    await prisma.unit.update({
      where: { id: unitId },
      data: { spells: JSON.stringify(updatedAbilities) },
    });

    return {
      success: true,
      message: `${ability?.name || abilityCode} removed from ${unit.name}`,
    };
  } catch (error) {
    console.error("[ABILITIES] Error removing ability:", error);
    return { success: false, message: "Error removing ability" };
  }
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
        message: "Unit not found",
        granted: [],
      };
    }

    const currentAbilities: string[] = JSON.parse(unit.spells || "[]");
    const granted: string[] = [];

    for (const abilityCode of abilityCodes) {
      const ability = findAbilityByCode(abilityCode);
      if (!ability) {
        console.warn(`[ABILITIES] Invalid ability ignored: ${abilityCode}`);
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
        message: "No new abilities were granted",
        granted: [],
      };
    }

    await prisma.unit.update({
      where: { id: unitId },
      data: { spells: JSON.stringify(currentAbilities) },
    });

    return {
      success: true,
      message: `${granted.length} ability(ies) granted to ${unit.name}`,
      granted,
    };
  } catch (error) {
    console.error("[ABILITIES] Error granting multiple abilities:", error);
    return {
      success: false,
      message: "Error granting abilities",
      granted: [],
    };
  }
}

// Re-exportar funções de dados para conveniência
export {
  getClassByCode,
  getAbilityByCode,
  getAbilitiesForClass,
  getAllClassesSummary,
  findAbilityByCode,
};

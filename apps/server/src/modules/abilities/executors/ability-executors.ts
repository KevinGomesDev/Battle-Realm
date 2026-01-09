// server/src/modules/abilities/executors/ability-executors.ts
// Executores UNIFICADOS de abilities (skills + spells)
// Funções de alto nível para execução de habilidades

import type {
  AbilityExecutionResult,
  AbilityDefinition,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type { AbilityExecutionContext } from "./types";
import { findAbilityByCode as findSkillByCode } from "@boundless/shared/data/abilities.data";
import {
  getAbilityExecutor,
  SKILL_EXECUTORS,
  SPELL_EXECUTORS,
} from "./registry";

// Re-export types
export type {
  SkillExecutionContext,
  SkillExecutorFn,
  SpellExecutorFn,
  AbilityExecutorFn,
  AttackActionResult,
} from "./types";

// Re-export registries
export {
  SKILL_EXECUTORS,
  SPELL_EXECUTORS,
  ALL_ABILITY_EXECUTORS,
  getAbilityExecutor,
} from "./registry";

// Re-export individual executors
export * from "./skills";
export * from "./spells";

// Re-export helpers
export * from "./helpers";

// =============================================================================
// SKILL EXECUTION
// =============================================================================

/**
 * Multiplicação de cooldown em Batalhas PvP
 * Skills em Batalhas têm cooldown dobrado
 */
export const BATTLE_COOLDOWN_MULTIPLIER = 2;

/**
 * Executa uma skill pelo seu functionName
 * Gerencia consumo de ação e cooldown automaticamente
 * @param isBattle - Se true, cooldowns são dobrados
 * @param context - Contexto opcional (targetPosition, obstacles)
 */
export function executeSkill(
  caster: BattleUnit,
  skillCode: string,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  isBattle: boolean = false,
  context?: AbilityExecutionContext
): AbilityExecutionResult {
  const skill = findSkillByCode(skillCode);
  if (!skill) {
    return { success: false, error: "Skill não encontrada" };
  }

  if (!skill.functionName) {
    return { success: false, error: "Skill não possui executor definido" };
  }

  // Usar ALL_ABILITY_EXECUTORS para incluir skills E spells (ex: TELEPORT)
  const executor = getAbilityExecutor(skill.functionName);
  if (!executor) {
    return {
      success: false,
      error: `Executor '${skill.functionName}' não implementado`,
    };
  }

  // Verificar cooldown
  if (
    caster.unitCooldowns?.[skillCode] &&
    caster.unitCooldowns[skillCode] > 0
  ) {
    return {
      success: false,
      error: `Skill em cooldown (${caster.unitCooldowns[skillCode]} rodadas)`,
    };
  }

  // Verificar se tem ações disponíveis (a menos que consumesAction === false)
  if (skill.consumesAction !== false && caster.actionsLeft <= 0) {
    return {
      success: false,
      error: "Sem ações disponíveis",
    };
  }

  // Executar a skill (com contexto)
  const result = executor(caster, target, allUnits, skill, context as any);

  // Se sucesso, aplicar consumo de ação e cooldown
  if (result.success) {
    // Consumir ação (a menos que consumesAction === false)
    if (skill.consumesAction !== false) {
      caster.actionsLeft = Math.max(0, caster.actionsLeft - 1);
    }
    result.casterActionsLeft = caster.actionsLeft;

    // Aplicar cooldown (dobrado em Batalhas PvP)
    if (skill.cooldown && skill.cooldown > 0) {
      if (!caster.unitCooldowns) {
        caster.unitCooldowns = {};
      }
      const cooldownValue = isBattle
        ? skill.cooldown * BATTLE_COOLDOWN_MULTIPLIER
        : skill.cooldown;
      caster.unitCooldowns[skillCode] = cooldownValue;
    }

    result.abilityCode = skillCode;
  }

  return result;
}

/**
 * Reduz todos os cooldowns de uma unidade em 1 (chamado no início de cada rodada)
 */
export function tickUnitCooldowns(unit: BattleUnit): void {
  if (!unit.unitCooldowns) return;

  for (const code of Object.keys(unit.unitCooldowns)) {
    if (unit.unitCooldowns[code] > 0) {
      unit.unitCooldowns[code]--;
    }
  }
}

/**
 * Verifica se uma skill/spell está em cooldown
 */
export function isOnCooldown(unit: BattleUnit, code: string): boolean {
  return (unit.unitCooldowns?.[code] ?? 0) > 0;
}

/**
 * Obtém o cooldown restante de uma skill/spell
 */
export function getCooldown(unit: BattleUnit, code: string): number {
  return unit.unitCooldowns?.[code] ?? 0;
}

// =============================================================================
// SPELL EXECUTION
// =============================================================================

/**
 * Executa uma spell
 */
export function executeSpell(
  spell: AbilityDefinition,
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  context?: AbilityExecutionContext
): AbilityExecutionResult {
  if (!spell.functionName) {
    return {
      success: false,
      error: `Spell ${spell.code} não tem functionName definido`,
    };
  }

  const executor = SPELL_EXECUTORS[spell.functionName];

  if (!executor) {
    return {
      success: false,
      error: `Executor não encontrado: ${spell.functionName}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (executor as any)(caster, target, allUnits, spell, context);
}

// =============================================================================
// UNIFIED ABILITY EXECUTION
// =============================================================================

/**
 * Executa uma ability (skill ou spell) de forma unificada
 * Detecta automaticamente o tipo baseado na definição
 */
export function executeAbility(
  ability: AbilityDefinition,
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  context?: AbilityExecutionContext
): AbilityExecutionResult {
  if (!ability.functionName) {
    return {
      success: false,
      error: `Ability ${ability.code} não tem functionName definido`,
    };
  }

  const executor = getAbilityExecutor(ability.functionName);

  if (!executor) {
    return {
      success: false,
      error: `Executor não encontrado: ${ability.functionName}`,
    };
  }

  // Executar (os executores lidam com seus próprios tipos de target)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return executor(caster, target as any, allUnits, ability, context as any);
}

// shared/utils/skill-validation.ts
// Validação centralizada de skills - Compartilhado entre Frontend e Backend

import type { SkillDefinition } from "../types/skills.types";
import type { BattleUnit } from "../types/battle.types";
import { DEFAULT_RANGE_VALUES } from "../types/skills.types";
import {
  getManhattanDistance,
  isAdjacentOmnidirectional,
  isAdjacent,
  getChebyshevDistance,
  isWithinRange,
} from "./spell-validation";

// Re-exportar para manter compatibilidade com imports existentes
export {
  getManhattanDistance,
  isAdjacentOmnidirectional,
  isAdjacent,
  getChebyshevDistance,
  isWithinRange,
};

// =============================================================================
// TIPOS
// =============================================================================

export interface SkillValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: SkillValidationErrorCode;
}

export type SkillValidationErrorCode =
  | "SKILL_NOT_FOUND"
  | "NOT_ACTIVE_SKILL"
  | "UNIT_NOT_HAS_SKILL"
  | "UNIT_DEAD"
  | "NO_ACTIONS_LEFT"
  | "ON_COOLDOWN"
  | "TARGET_REQUIRED"
  | "SELF_ONLY"
  | "OUT_OF_RANGE"
  | "INVALID_TARGET_TYPE"
  | "TARGET_NOT_ALLY"
  | "TARGET_NOT_ENEMY";

// =============================================================================
// VALIDAÇÃO PRINCIPAL
// =============================================================================

/**
 * Valida se uma skill pode ser usada
 * Usada tanto no cliente (para UI) quanto no servidor (para execução)
 */
export function validateSkillUse(
  caster: BattleUnit,
  skill: SkillDefinition,
  target: BattleUnit | null,
  options: {
    checkCooldown?: boolean;
    checkActions?: boolean;
    isArena?: boolean;
  } = {}
): SkillValidationResult {
  const { checkCooldown = true, checkActions = true } = options;

  // Verificar se é uma skill ativa
  if (skill.category !== "ACTIVE") {
    return {
      valid: false,
      error: "Apenas skills ativas podem ser usadas",
      errorCode: "NOT_ACTIVE_SKILL",
    };
  }

  // Verificar se a unidade tem essa skill nas features
  if (!caster.features.includes(skill.code)) {
    return {
      valid: false,
      error: "Unidade não possui esta skill",
      errorCode: "UNIT_NOT_HAS_SKILL",
    };
  }

  // Verificar se está vivo
  if (!caster.isAlive) {
    return {
      valid: false,
      error: "Unidade morta não pode usar skills",
      errorCode: "UNIT_DEAD",
    };
  }

  // Verificar se tem ações disponíveis (APENAS se a skill consome ação)
  const skillConsumesAction = skill.consumesAction !== false;
  if (checkActions && skillConsumesAction && caster.actionsLeft <= 0) {
    return {
      valid: false,
      error: "Sem ações restantes neste turno",
      errorCode: "NO_ACTIONS_LEFT",
    };
  }

  // Verificar cooldown
  if (checkCooldown && caster.unitCooldowns?.[skill.code] > 0) {
    return {
      valid: false,
      error: `Skill em cooldown (${caster.unitCooldowns[skill.code]} rodadas)`,
      errorCode: "ON_COOLDOWN",
    };
  }

  // Validar range e alvo
  const rangeValidation = validateSkillRange(caster, skill, target);
  if (!rangeValidation.valid) {
    return rangeValidation;
  }

  // Validar tipo de alvo
  const targetValidation = validateSkillTargetType(caster, skill, target);
  if (!targetValidation.valid) {
    return targetValidation;
  }

  return { valid: true };
}

/**
 * Valida o alcance da skill
 */
export function validateSkillRange(
  caster: BattleUnit,
  skill: SkillDefinition,
  target: BattleUnit | null
): SkillValidationResult {
  if (skill.range === "SELF") {
    // Skills SELF não precisam de alvo ou o alvo é o próprio caster
    if (target && target.id !== caster.id) {
      return {
        valid: false,
        error: "Esta skill só pode ser usada em si mesmo",
        errorCode: "SELF_ONLY",
      };
    }
  } else if (skill.range === "ADJACENT") {
    // Para skills ALLY, permitir self-cast (target pode ser null)
    if (!target && skill.targetType !== "ALLY") {
      return {
        valid: false,
        error: "Skill requer um alvo",
        errorCode: "TARGET_REQUIRED",
      };
    }
    // Se há target, validar adjacência (exceto se for self-cast)
    if (target && target.id !== caster.id) {
      if (
        !isAdjacentOmnidirectional(
          caster.posX,
          caster.posY,
          target.posX,
          target.posY
        )
      ) {
        return {
          valid: false,
          error: "Alvo não está adjacente",
          errorCode: "OUT_OF_RANGE",
        };
      }
    }
  } else if (skill.range === "RANGED" || skill.range === "AREA") {
    if (!target && skill.targetType !== "SELF") {
      return {
        valid: false,
        error: "Skill requer um alvo",
        errorCode: "TARGET_REQUIRED",
      };
    }
    // Se há target, validar alcance (exceto se for self-cast)
    if (target && target.id !== caster.id) {
      const rangeValue = skill.rangeValue ?? DEFAULT_RANGE_VALUES[skill.range];
      const distance = getManhattanDistance(
        caster.posX,
        caster.posY,
        target.posX,
        target.posY
      );
      if (distance > rangeValue) {
        return {
          valid: false,
          error: `Alvo fora de alcance (máx: ${rangeValue})`,
          errorCode: "OUT_OF_RANGE",
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Valida o tipo de alvo da skill
 */
export function validateSkillTargetType(
  caster: BattleUnit,
  skill: SkillDefinition,
  target: BattleUnit | null
): SkillValidationResult {
  if (!target || !skill.targetType) {
    return { valid: true };
  }

  const isSameOwner = caster.ownerId === target.ownerId;

  if (skill.targetType === "ALLY" && !isSameOwner) {
    return {
      valid: false,
      error: "Skill só pode ser usada em aliados",
      errorCode: "TARGET_NOT_ALLY",
    };
  }

  if (skill.targetType === "ENEMY" && isSameOwner) {
    return {
      valid: false,
      error: "Skill só pode ser usada em inimigos",
      errorCode: "TARGET_NOT_ENEMY",
    };
  }

  return { valid: true };
}

// =============================================================================
// HELPERS PARA UI
// =============================================================================

/**
 * Verifica se uma unidade é um alvo válido para uma skill
 * Útil para destacar alvos válidos na UI
 */
export function isValidSkillTarget(
  caster: BattleUnit,
  skill: SkillDefinition,
  potentialTarget: BattleUnit
): boolean {
  // Self-cast é sempre válido para skills ALLY
  if (skill.targetType === "ALLY" && potentialTarget.id === caster.id) {
    return true;
  }

  const validation = validateSkillRange(caster, skill, potentialTarget);
  if (!validation.valid) return false;

  const targetValidation = validateSkillTargetType(
    caster,
    skill,
    potentialTarget
  );
  if (!targetValidation.valid) return false;

  // Verificar se o alvo está vivo (para maioria das skills)
  if (!potentialTarget.isAlive) return false;

  return true;
}

/**
 * Retorna todos os alvos válidos para uma skill
 */
export function getValidSkillTargets(
  caster: BattleUnit,
  skill: SkillDefinition,
  allUnits: BattleUnit[]
): BattleUnit[] {
  return allUnits.filter((unit) => isValidSkillTarget(caster, skill, unit));
}

/**
 * Verifica se uma skill pode ser usada (sem considerar alvo específico)
 */
export function canUseSkill(
  caster: BattleUnit,
  skill: SkillDefinition
): { canUse: boolean; reason?: string } {
  if (skill.category !== "ACTIVE") {
    return { canUse: false, reason: "Skill passiva" };
  }

  if (!caster.features.includes(skill.code)) {
    return { canUse: false, reason: "Não possui skill" };
  }

  if (!caster.isAlive) {
    return { canUse: false, reason: "Morto" };
  }

  // Só verificar actionsLeft se a skill consome ação
  const skillConsumesAction = skill.consumesAction !== false;
  if (skillConsumesAction && caster.actionsLeft <= 0) {
    return { canUse: false, reason: "Sem ações" };
  }

  if (caster.unitCooldowns?.[skill.code] > 0) {
    return {
      canUse: false,
      reason: `Cooldown: ${caster.unitCooldowns[skill.code]}`,
    };
  }

  return { canUse: true };
}

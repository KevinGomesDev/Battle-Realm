// shared/utils/ability-validation.ts
// FONTE DE VERDADE - Validação UNIFICADA de Habilidades (Skills + Spells)
// Compartilhado entre Frontend e Backend

import type { BattleUnit } from "../types/battle.types";
import {
  type AbilityDefinition,
  resolveDynamicValue,
  DEFAULT_RANGE_DISTANCE,
  mapLegacyRange,
  isActive,
  isSpell,
} from "../types/ability.types";
import {
  getManhattanDistance,
  getChebyshevDistance,
  isAdjacentOmnidirectional,
  isAdjacent,
  isWithinRange,
} from "./distance.utils";

// Re-exportar funções de distância para compatibilidade
export {
  getManhattanDistance,
  getChebyshevDistance,
  isAdjacentOmnidirectional,
  isAdjacent,
  isWithinRange,
};

// =============================================================================
// TIPOS
// =============================================================================

export interface AbilityValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: AbilityValidationErrorCode;
}

export type AbilityValidationErrorCode =
  | "ABILITY_NOT_FOUND"
  | "NOT_ACTIVE_ABILITY"
  | "UNIT_NOT_HAS_ABILITY"
  | "UNIT_DEAD"
  | "NO_ACTIONS_LEFT"
  | "NO_MANA"
  | "ON_COOLDOWN"
  | "TARGET_REQUIRED"
  | "SELF_ONLY"
  | "OUT_OF_RANGE"
  | "INVALID_TARGET_TYPE"
  | "TARGET_NOT_ALLY"
  | "TARGET_NOT_ENEMY"
  | "TARGET_DEAD"
  | "POSITION_OCCUPIED";

// =============================================================================
// VERIFICAÇÃO DE POSSE
// =============================================================================

/**
 * Verifica se uma unidade possui uma habilidade
 * Skills usam features[], Spells usam spells[]
 */
export function unitHasAbility(
  unit: BattleUnit,
  ability: AbilityDefinition
): boolean {
  if (isSpell(ability)) {
    return unit.spells?.includes(ability.code) ?? false;
  }
  return unit.features.includes(ability.code);
}

// =============================================================================
// CÁLCULO DE ALCANCE
// =============================================================================

/**
 * Calcula o alcance máximo de uma habilidade baseado no range e no caster
 * Suporta valores dinâmicos (números ou referências a atributos)
 */
export function getAbilityMaxRange(
  ability: AbilityDefinition,
  caster: BattleUnit
): number {
  // Mapear range legado (ADJACENT -> MELEE)
  const normalizedRange = mapLegacyRange(ability.range || "MELEE");

  // Se ability tem rangeDistance definido, usar valor dinâmico
  if (ability.rangeDistance !== undefined) {
    return resolveDynamicValue(ability.rangeDistance, caster);
  }

  // Fallback para valores padrão baseado no tipo de range
  return DEFAULT_RANGE_DISTANCE[normalizedRange];
}

// =============================================================================
// VALIDAÇÃO PRINCIPAL
// =============================================================================

/**
 * Valida se uma habilidade pode ser usada
 * Usada tanto no cliente (para UI) quanto no servidor (para execução)
 */
export function validateAbilityUse(
  caster: BattleUnit,
  ability: AbilityDefinition,
  target: BattleUnit | { x: number; y: number } | null,
  options: {
    checkCooldown?: boolean;
    checkActions?: boolean;
    checkMana?: boolean;
    isBattle?: boolean;
  } = {}
): AbilityValidationResult {
  const {
    checkCooldown = true,
    checkActions = true,
    checkMana = true,
  } = options;

  // Verificar se é uma habilidade ativa
  if (!isActive(ability)) {
    return {
      valid: false,
      error: "Apenas habilidades ativas podem ser usadas",
      errorCode: "NOT_ACTIVE_ABILITY",
    };
  }

  // Verificar se a unidade tem essa habilidade
  if (!unitHasAbility(caster, ability)) {
    return {
      valid: false,
      error: "Unidade não possui esta habilidade",
      errorCode: "UNIT_NOT_HAS_ABILITY",
    };
  }

  // Verificar se está vivo
  if (!caster.isAlive) {
    return {
      valid: false,
      error: "Unidade morta não pode usar habilidades",
      errorCode: "UNIT_DEAD",
    };
  }

  // Verificar se tem ações disponíveis (APENAS se a habilidade consome ação)
  const consumesAction = ability.consumesAction !== false;
  if (checkActions && consumesAction && caster.actionsLeft <= 0) {
    return {
      valid: false,
      error: "Sem ações restantes neste turno",
      errorCode: "NO_ACTIONS_LEFT",
    };
  }

  // Verificar mana para spells
  if (checkMana && isSpell(ability) && ability.manaCost) {
    const currentMana = caster.currentMana ?? 0;
    if (currentMana < ability.manaCost) {
      return {
        valid: false,
        error: `Mana insuficiente (${currentMana}/${ability.manaCost})`,
        errorCode: "NO_MANA",
      };
    }
  }

  // Verificar cooldown
  if (checkCooldown && caster.unitCooldowns?.[ability.code] > 0) {
    return {
      valid: false,
      error: `Habilidade em cooldown (${
        caster.unitCooldowns[ability.code]
      } rodadas)`,
      errorCode: "ON_COOLDOWN",
    };
  }

  // Validar range e alvo
  const rangeValidation = validateAbilityRange(caster, ability, target);
  if (!rangeValidation.valid) {
    return rangeValidation;
  }

  // Validar tipo de alvo
  const targetValidation = validateAbilityTargetType(caster, ability, target);
  if (!targetValidation.valid) {
    return targetValidation;
  }

  return { valid: true };
}

// =============================================================================
// VALIDAÇÃO DE ALCANCE
// =============================================================================

/**
 * Valida o alcance da habilidade
 */
export function validateAbilityRange(
  caster: BattleUnit,
  ability: AbilityDefinition,
  target: BattleUnit | { x: number; y: number } | null
): AbilityValidationResult {
  // Calcular alcance máximo dinamicamente
  const maxRange = getAbilityMaxRange(ability, caster);
  const normalizedRange = mapLegacyRange(ability.range || "MELEE");

  if (normalizedRange === "SELF") {
    // Habilidades SELF não precisam de alvo ou o alvo é o próprio caster
    if (target && "id" in target && target.id !== caster.id) {
      return {
        valid: false,
        error: "Esta habilidade só pode ser usada em si mesmo",
        errorCode: "SELF_ONLY",
      };
    }
    return { valid: true };
  }

  // Para outros ranges, pode precisar de alvo
  if (!target) {
    // Skills UNIT permitem self-cast implícito
    if (ability.targetType === "UNIT" || ability.targetType === "SELF") {
      return { valid: true };
    }
    return {
      valid: false,
      error: "Habilidade requer um alvo",
      errorCode: "TARGET_REQUIRED",
    };
  }

  // Calcular distância - usar Chebyshev para consistência
  let targetX: number;
  let targetY: number;

  if ("id" in target) {
    // Alvo é uma unidade
    targetX = target.posX;
    targetY = target.posY;

    // Self-cast é sempre válido
    if (target.id === caster.id) {
      return { valid: true };
    }
  } else {
    // Alvo é uma posição
    targetX = target.x;
    targetY = target.y;
  }

  const distance = getChebyshevDistance(
    caster.posX,
    caster.posY,
    targetX,
    targetY
  );

  // Validar distância
  if (distance > maxRange) {
    return {
      valid: false,
      error: `Alvo fora de alcance (${distance} > ${maxRange})`,
      errorCode: "OUT_OF_RANGE",
    };
  }

  return { valid: true };
}

// =============================================================================
// VALIDAÇÃO DE TIPO DE ALVO
// =============================================================================

/**
 * Valida o tipo de alvo da habilidade
 */
export function validateAbilityTargetType(
  caster: BattleUnit,
  ability: AbilityDefinition,
  target: BattleUnit | { x: number; y: number } | null
): AbilityValidationResult {
  // SELF - válido sem alvo ou com self
  if (ability.targetType === "SELF") {
    return { valid: true };
  }

  // POSITION/GROUND - precisa ser uma posição
  if (ability.targetType === "POSITION" || ability.targetType === "GROUND") {
    if (target && "id" in target) {
      return {
        valid: false,
        error: "Esta habilidade requer uma posição como alvo",
        errorCode: "INVALID_TARGET_TYPE",
      };
    }
    return { valid: true };
  }

  // Se não tem alvo, ainda pode ser válido para UNIT (self-cast)
  if (!target) {
    return { valid: true };
  }

  // UNIT/ALL - precisa ser uma unidade
  if (!("id" in target)) {
    return {
      valid: false,
      error: "Esta habilidade requer uma unidade como alvo",
      errorCode: "INVALID_TARGET_TYPE",
    };
  }

  const targetUnit = target as BattleUnit;

  // Verificar se alvo está vivo
  if (!targetUnit.isAlive) {
    return {
      valid: false,
      error: "Alvo não está vivo",
      errorCode: "TARGET_DEAD",
    };
  }

  return { valid: true };
}

// =============================================================================
// HELPERS PARA UI
// =============================================================================

/**
 * Verifica se uma habilidade pode ser usada (para habilitar/desabilitar botão)
 */
export function canUseAbility(
  caster: BattleUnit,
  ability: AbilityDefinition,
  options: {
    checkActions?: boolean;
    checkCooldown?: boolean;
    checkMana?: boolean;
  } = {}
): { canUse: boolean; reason?: string } {
  // Verificar se é ativa
  if (!isActive(ability)) {
    return { canUse: false, reason: "Passiva" };
  }

  // Verificar se possui
  if (!unitHasAbility(caster, ability)) {
    return { canUse: false, reason: "Não possui" };
  }

  // Verificar se está vivo
  if (!caster.isAlive) {
    return { canUse: false, reason: "Morto" };
  }

  // Verificar ações
  const consumesAction = ability.consumesAction !== false;
  if (consumesAction && caster.actionsLeft <= 0) {
    return { canUse: false, reason: "Sem ações" };
  }

  // Verificar mana para spells
  if (isSpell(ability) && ability.manaCost) {
    const currentMana = caster.currentMana ?? 0;
    if (currentMana < ability.manaCost) {
      return {
        canUse: false,
        reason: `Mana: ${currentMana}/${ability.manaCost}`,
      };
    }
  }

  // Verificar cooldown
  if (caster.unitCooldowns?.[ability.code] > 0) {
    return {
      canUse: false,
      reason: `CD: ${caster.unitCooldowns[ability.code]}`,
    };
  }

  return { canUse: true };
}

/**
 * Verifica se uma unidade é um alvo válido para uma habilidade
 * Útil para destacar alvos válidos na UI
 */
export function isValidAbilityTarget(
  caster: BattleUnit,
  ability: AbilityDefinition,
  potentialTarget: BattleUnit
): boolean {
  // Self-cast é sempre válido para habilidades UNIT e SELF
  if (
    (ability.targetType === "UNIT" || ability.targetType === "SELF") &&
    potentialTarget.id === caster.id
  ) {
    return true;
  }

  const validation = validateAbilityRange(caster, ability, potentialTarget);
  if (!validation.valid) return false;

  const targetValidation = validateAbilityTargetType(
    caster,
    ability,
    potentialTarget
  );
  if (!targetValidation.valid) return false;

  // Verificar se o alvo está vivo (para maioria das habilidades)
  if (!potentialTarget.isAlive) return false;

  return true;
}

/**
 * Retorna todos os alvos válidos para uma habilidade
 */
export function getValidAbilityTargets(
  caster: BattleUnit,
  ability: AbilityDefinition,
  allUnits: BattleUnit[]
): BattleUnit[] {
  // Habilidades de posição não retornam unidades
  if (ability.targetType === "POSITION" || ability.targetType === "GROUND") {
    return [];
  }

  return allUnits.filter((unit) => isValidAbilityTarget(caster, ability, unit));
}

/**
 * Verifica se uma posição é válida como alvo para uma habilidade
 */
export function isValidAbilityPosition(
  caster: BattleUnit,
  ability: AbilityDefinition,
  position: { x: number; y: number },
  allUnits: BattleUnit[],
  gridWidth: number,
  gridHeight: number
): boolean {
  // Verificar se habilidade aceita posição
  if (ability.targetType !== "POSITION" && ability.targetType !== "GROUND") {
    return false;
  }

  // Verificar limites do grid
  if (
    position.x < 0 ||
    position.x >= gridWidth ||
    position.y < 0 ||
    position.y >= gridHeight
  ) {
    return false;
  }

  // Verificar alcance
  const distance = getChebyshevDistance(
    caster.posX,
    caster.posY,
    position.x,
    position.y
  );
  const maxRange = getAbilityMaxRange(ability, caster);
  if (distance > maxRange) {
    return false;
  }

  // Para TELEPORT, verificar se posição não está ocupada
  if (ability.code === "TELEPORT") {
    const occupied = allUnits.some(
      (u) => u.isAlive && u.posX === position.x && u.posY === position.y
    );
    if (occupied) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// ALIASES PARA COMPATIBILIDADE (DEPRECADOS)
// =============================================================================

/** @deprecated Use validateAbilityUse */
export const validateSkillUse = validateAbilityUse;
/** @deprecated Use validateAbilityUse */
export const validateSpellUse = validateAbilityUse;
/** @deprecated Use canUseAbility */
export const canUseSkill = canUseAbility;
/** @deprecated Use canUseAbility */
export const canUseSpell = (
  caster: BattleUnit,
  ability: AbilityDefinition,
  options?: { checkActions?: boolean; checkCooldown?: boolean }
): boolean => canUseAbility(caster, ability, options).canUse;
/** @deprecated Use isValidAbilityTarget */
export const isValidSkillTarget = isValidAbilityTarget;
/** @deprecated Use isValidAbilityTarget */
export const isValidSpellTarget = isValidAbilityTarget;
/** @deprecated Use getValidAbilityTargets */
export const getValidSkillTargets = getValidAbilityTargets;
/** @deprecated Use getValidAbilityTargets */
export const getValidSpellTargets = getValidAbilityTargets;
/** @deprecated Use getAbilityMaxRange */
export const getSkillMaxRange = getAbilityMaxRange;
/** @deprecated Use getAbilityMaxRange */
export const getSpellMaxRange = getAbilityMaxRange;
/** @deprecated Use isValidAbilityPosition */
export const isValidSkillPosition = isValidAbilityPosition;
/** @deprecated Use isValidAbilityPosition */
export const isValidSpellPosition = isValidAbilityPosition;

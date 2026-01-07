// shared/utils/spell-validation.ts
// Validação centralizada de spells - Compartilhado entre Frontend e Backend

import type { SpellDefinition } from "../types/spells.types";
import type { BattleUnit } from "../types/battle.types";
import {
  resolveDynamicValue,
  DEFAULT_RANGE_DISTANCE,
  mapLegacyRange,
} from "../types/ability.types";

// =============================================================================
// TIPOS
// =============================================================================

export interface SpellValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: SpellValidationErrorCode;
}

export type SpellValidationErrorCode =
  | "SPELL_NOT_FOUND"
  | "UNIT_NOT_HAS_SPELL"
  | "UNIT_DEAD"
  | "NO_ACTIONS_LEFT"
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
// FUNÇÕES DE DISTÂNCIA
// =============================================================================

/**
 * Calcula distância Manhattan entre duas posições
 */
export function getManhattanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * Verifica se uma posição está adjacente (distância Manhattan = 1)
 */
export function isAdjacent(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  return getManhattanDistance(x1, y1, x2, y2) === 1;
}

/**
 * Calcula distância Chebyshev (permite 8 direções incluindo diagonais)
 */
export function getChebyshevDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

/**
 * Verifica se uma posição está adjacente (8 direções - Chebyshev)
 */
export function isAdjacentOmnidirectional(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  return getChebyshevDistance(x1, y1, x2, y2) === 1;
}

/**
 * Verifica se uma posição está dentro de um alcance específico (8 direções - Chebyshev)
 */
export function isWithinRange(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  range: number
): boolean {
  return getChebyshevDistance(x1, y1, x2, y2) <= range;
}

// =============================================================================
// VALIDAÇÃO PRINCIPAL
// =============================================================================

/**
 * Calcula o alcance máximo de uma spell baseado no range e no caster
 * Suporta valores dinâmicos (números ou referências a atributos)
 */
export function getSpellMaxRange(
  spell: SpellDefinition,
  caster: BattleUnit
): number {
  // Mapear range legado (ADJACENT -> MELEE)
  const normalizedRange = mapLegacyRange(spell.range);

  // Se spell tem rangeDistance definido, usar valor dinâmico
  if (spell.rangeDistance !== undefined) {
    return resolveDynamicValue(spell.rangeDistance, caster);
  }

  // Fallback para valores padrão baseado no tipo de range
  return DEFAULT_RANGE_DISTANCE[normalizedRange];
}

/**
 * Valida se uma spell pode ser usada
 * Usada tanto no cliente (para UI) quanto no servidor (para execução)
 */
export function validateSpellUse(
  caster: BattleUnit,
  spell: SpellDefinition,
  target: BattleUnit | { x: number; y: number } | null,
  options: {
    checkCooldown?: boolean;
    checkActions?: boolean;
  } = {}
): SpellValidationResult {
  const { checkCooldown = true, checkActions = true } = options;

  // Verificar se a unidade tem essa spell
  if (!caster.spells?.includes(spell.code)) {
    return {
      valid: false,
      error: "Unidade não possui esta spell",
      errorCode: "UNIT_NOT_HAS_SPELL",
    };
  }

  // Verificar se está vivo
  if (!caster.isAlive) {
    return {
      valid: false,
      error: "Unidade morta não pode usar spells",
      errorCode: "UNIT_DEAD",
    };
  }

  // Verificar se tem ações disponíveis
  if (checkActions && caster.actionsLeft <= 0) {
    return {
      valid: false,
      error: "Sem ações restantes neste turno",
      errorCode: "NO_ACTIONS_LEFT",
    };
  }

  // Verificar cooldown
  if (checkCooldown && spell.cooldown) {
    const cooldown = caster.unitCooldowns?.[spell.code] ?? 0;
    if (cooldown > 0) {
      return {
        valid: false,
        error: `Spell em cooldown (${cooldown} rodadas)`,
        errorCode: "ON_COOLDOWN",
      };
    }
  }

  // Validar range e alvo
  const rangeValidation = validateSpellRange(caster, spell, target);
  if (!rangeValidation.valid) {
    return rangeValidation;
  }

  // Validar tipo de alvo
  const targetValidation = validateSpellTargetType(caster, spell, target);
  if (!targetValidation.valid) {
    return targetValidation;
  }

  return { valid: true };
}

/**
 * Valida o alcance da spell
 */
export function validateSpellRange(
  caster: BattleUnit,
  spell: SpellDefinition,
  target: BattleUnit | { x: number; y: number } | null
): SpellValidationResult {
  const maxRange = getSpellMaxRange(spell, caster);

  // SELF - não precisa de alvo ou alvo é o próprio caster
  if (spell.range === "SELF") {
    if (target && "id" in target && target.id !== caster.id) {
      return {
        valid: false,
        error: "Esta spell só pode ser usada em si mesmo",
        errorCode: "SELF_ONLY",
      };
    }
    return { valid: true };
  }

  // Para outros ranges, precisa de alvo
  if (!target) {
    return {
      valid: false,
      error: "Spell requer um alvo",
      errorCode: "TARGET_REQUIRED",
    };
  }

  // Calcular distância - usar Chebyshev para consistência com preview visual
  let distance: number;
  if ("id" in target) {
    // Alvo é uma unidade
    distance = getChebyshevDistance(
      caster.posX,
      caster.posY,
      target.posX,
      target.posY
    );
  } else {
    // Alvo é uma posição
    distance = getChebyshevDistance(
      caster.posX,
      caster.posY,
      target.x,
      target.y
    );
  }

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

/**
 * Valida o tipo de alvo da spell
 */
export function validateSpellTargetType(
  caster: BattleUnit,
  spell: SpellDefinition,
  target: BattleUnit | { x: number; y: number } | null
): SpellValidationResult {
  // SELF - válido sem alvo ou com self
  if (spell.targetType === "SELF") {
    return { valid: true };
  }

  // POSITION/GROUND - precisa ser uma posição
  if (spell.targetType === "POSITION" || spell.targetType === "GROUND") {
    if (target && "id" in target) {
      return {
        valid: false,
        error: "Esta spell requer uma posição como alvo",
        errorCode: "INVALID_TARGET_TYPE",
      };
    }
    return { valid: true };
  }

  // UNIT/ALL - precisa ser uma unidade
  if (!target || !("id" in target)) {
    return {
      valid: false,
      error: "Esta spell requer uma unidade como alvo",
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
 * Verifica se uma unidade pode usar determinada spell (para habilitar/desabilitar botão)
 */
export function canUseSpell(
  caster: BattleUnit,
  spell: SpellDefinition,
  options: { checkActions?: boolean; checkCooldown?: boolean } = {}
): boolean {
  const result = validateSpellUse(caster, spell, null, {
    ...options,
    checkActions: options.checkActions ?? true,
    checkCooldown: options.checkCooldown ?? true,
  });

  // Se o único erro é precisar de alvo, ainda pode usar
  if (!result.valid && result.errorCode === "TARGET_REQUIRED") {
    return true;
  }

  return result.valid;
}

/**
 * Verifica se um alvo é válido para uma spell
 */
export function isValidSpellTarget(
  caster: BattleUnit,
  spell: SpellDefinition,
  target: BattleUnit | { x: number; y: number }
): boolean {
  const rangeResult = validateSpellRange(caster, spell, target);
  if (!rangeResult.valid) return false;

  const targetResult = validateSpellTargetType(caster, spell, target);
  if (!targetResult.valid) return false;

  return true;
}

/**
 * Obtém todas as unidades válidas como alvo para uma spell
 */
export function getValidSpellTargets(
  caster: BattleUnit,
  spell: SpellDefinition,
  allUnits: BattleUnit[]
): BattleUnit[] {
  // Spells de posição não retornam unidades
  if (spell.targetType === "POSITION" || spell.targetType === "GROUND") {
    return [];
  }

  return allUnits.filter((unit) => {
    // Self sempre é válido para SELF e UNIT
    if (unit.id === caster.id) {
      return spell.targetType === "SELF" || spell.targetType === "UNIT";
    }

    return isValidSpellTarget(caster, spell, unit);
  });
}

/**
 * Verifica se uma posição é válida como alvo para uma spell
 */
export function isValidSpellPosition(
  caster: BattleUnit,
  spell: SpellDefinition,
  position: { x: number; y: number },
  allUnits: BattleUnit[],
  gridWidth: number,
  gridHeight: number
): boolean {
  // Verificar se spell aceita posição
  if (spell.targetType !== "POSITION" && spell.targetType !== "GROUND") {
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

  // Verificar alcance - usar Chebyshev para consistência com preview visual
  const distance = getChebyshevDistance(
    caster.posX,
    caster.posY,
    position.x,
    position.y
  );
  const maxRange = getSpellMaxRange(spell, caster);
  if (distance > maxRange) {
    return false;
  }

  // Para TELEPORT, verificar se posição não está ocupada
  if (spell.code === "TELEPORT") {
    const occupied = allUnits.some(
      (u) => u.isAlive && u.posX === position.x && u.posY === position.y
    );
    if (occupied) {
      return false;
    }
  }

  return true;
}

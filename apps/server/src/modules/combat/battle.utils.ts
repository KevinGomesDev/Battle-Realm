import type { AbilityDefinition as SkillDefinition } from "@boundless/shared/types/ability.types";
import { COST_VALUES } from "@boundless/shared/types/ability.types";
import { calculateActiveEffects } from "../conditions/conditions";
import type { ActiveEffectsMap } from "@boundless/shared/types/conditions.types";

// Re-exportar do global.config para manter compatibilidade
export { getMaxMarksByCategory } from "@boundless/shared/config";

// Re-exportar de engagement.utils para manter compatibilidade
export {
  calculateEngagementCost,
  validateMove,
} from "@boundless/shared/utils/engagement.utils";

export function calculateSkillCost(
  skill: SkillDefinition,
  timesUsedInBattle: number
): number {
  if (skill.activationType === "PASSIVE" || !skill.costTier) {
    return 0;
  }

  const baseCost = COST_VALUES[skill.costTier];

  return baseCost * Math.pow(2, timesUsedInBattle);
}

// Ordena BattleUnits por iniciativa (decrescente)
export function rollInitiative<T extends { id: string; initiative: number }>(
  battleUnits: T[]
): T[] {
  return [...battleUnits].sort((a, b) => b.initiative - a.initiative);
}

// Calcula Velocidade efetiva dada lista de condições
export function getEffectiveSpeedWithConditions(
  baseSpeed: number,
  conditions: string[]
): number {
  let speed = baseSpeed;
  if (conditions.includes("ELETRIFICADA")) speed *= 2;
  if (conditions.includes("CONGELADA")) speed = Math.min(1, speed);
  if (conditions.includes("DERRUBADA")) speed = 0;
  return speed;
}

// Aplica efeito de queimando ao usar uma ação
export function applyBurningOnAction(
  currentHp: number,
  conditions: string[]
): number {
  if (conditions.includes("QUEIMANDO")) {
    return Math.max(0, currentHp - 2);
  }
  return currentHp;
}

// =============================================================================
// PREPARAÇÃO DE DADOS DE UNIDADE PARA ENVIO AO CLIENTE
// =============================================================================

/**
 * Interface para dados parciais de unidade enviados em eventos de atualização
 */
export interface UnitUpdateData {
  id: string;
  hasStartedAction?: boolean;
  movesLeft?: number;
  actionsLeft?: number;
  attacksLeftThisTurn?: number;
  conditions?: string[];
  activeEffects?: ActiveEffectsMap;
  currentHp?: number;
  isAlive?: boolean;
  unitCooldowns?: Record<string, number>;
  physicalProtection?: number;
  magicalProtection?: number;
}

/**
 * Prepara dados de unidade para envio, calculando activeEffects se conditions estiver presente
 */
export function prepareUnitUpdateData(unit: {
  id: string;
  hasStartedAction?: boolean;
  movesLeft?: number;
  actionsLeft?: number;
  attacksLeftThisTurn?: number;
  conditions?: string[];
  currentHp?: number;
  isAlive?: boolean;
  unitCooldowns?: Record<string, number>;
  physicalProtection?: number;
  magicalProtection?: number;
}): UnitUpdateData {
  const data: UnitUpdateData = { id: unit.id };

  if (unit.hasStartedAction !== undefined)
    data.hasStartedAction = unit.hasStartedAction;
  if (unit.movesLeft !== undefined) data.movesLeft = unit.movesLeft;
  if (unit.actionsLeft !== undefined) data.actionsLeft = unit.actionsLeft;
  if (unit.attacksLeftThisTurn !== undefined)
    data.attacksLeftThisTurn = unit.attacksLeftThisTurn;
  if (unit.currentHp !== undefined) data.currentHp = unit.currentHp;
  if (unit.isAlive !== undefined) data.isAlive = unit.isAlive;
  if (unit.unitCooldowns !== undefined) data.unitCooldowns = unit.unitCooldowns;
  if (unit.physicalProtection !== undefined)
    data.physicalProtection = unit.physicalProtection;
  if (unit.magicalProtection !== undefined)
    data.magicalProtection = unit.magicalProtection;

  // Se conditions estiver presente, calcular activeEffects
  if (unit.conditions !== undefined) {
    data.conditions = unit.conditions;
    data.activeEffects = calculateActiveEffects(unit.conditions);
  }

  return data;
}

/**
 * Prepara array de unidades para envio em eventos de nova rodada
 */
export function prepareUnitsForNewRound(
  units: Array<{
    id: string;
    hasStartedAction: boolean;
    movesLeft: number;
    actionsLeft: number;
    attacksLeftThisTurn: number;
    conditions: string[];
    currentHp: number;
    isAlive: boolean;
    unitCooldowns: Record<string, number>;
  }>
): UnitUpdateData[] {
  return units.map((u) => prepareUnitUpdateData(u));
}

/**
 * Prepara dados de unidade para evento de fim de turno
 */
export function prepareTurnEndedData(
  battleId: string,
  unit: {
    id: string;
    actionMarks: number;
    currentHp: number;
    isAlive: boolean;
    conditions: string[];
    hasStartedAction: boolean;
    movesLeft: number;
    actionsLeft: number;
    attacksLeftThisTurn: number;
  },
  turnEndResult: {
    damageFromConditions: number;
    conditionsRemoved: string[];
  }
) {
  return {
    battleId,
    unitId: unit.id,
    actionMarks: unit.actionMarks,
    currentHp: unit.currentHp,
    isAlive: unit.isAlive,
    conditions: unit.conditions,
    activeEffects: calculateActiveEffects(unit.conditions),
    damageFromConditions: turnEndResult.damageFromConditions,
    conditionsRemoved: turnEndResult.conditionsRemoved,
    hasStartedAction: unit.hasStartedAction,
    movesLeft: unit.movesLeft,
    actionsLeft: unit.actionsLeft,
    attacksLeftThisTurn: unit.attacksLeftThisTurn,
  };
}

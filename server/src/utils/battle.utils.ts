import { SkillDefinition, COST_VALUES } from "../types";
import { calculateActiveEffects } from "../logic/conditions";
import type { ActiveEffectsMap } from "../../../shared/types/conditions.types";

// Re-exportar do global.config para manter compatibilidade
export { getMaxMarksByCategory } from "../../../shared/config/global.config";

// Re-exportar de engagement.utils para manter compatibilidade
export {
  calculateEngagementCost,
  validateMove,
} from "../../../shared/utils/engagement.utils";

export function calculateSkillCost(
  skill: SkillDefinition,
  timesUsedInBattle: number
): number {
  if (skill.category === "PASSIVE" || !skill.costTier) {
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

/**
 * Aplica dano com sistema de proteção física e mágica.
 * O dano excedente (quando proteção zera) passa para o HP.
 *
 * @param physicalProtection Proteção física atual
 * @param magicalProtection Proteção mágica atual
 * @param currentHp HP atual
 * @param damage Dano a aplicar
 * @param damageType "FISICO" | "MAGICO" | "VERDADEIRO"
 */
export function applyDualProtectionDamage(
  physicalProtection: number,
  magicalProtection: number,
  currentHp: number,
  damage: number,
  damageType: string
): {
  newPhysicalProtection: number;
  newMagicalProtection: number;
  newHp: number;
  damageAbsorbed: number;
  damageToHp: number;
} {
  let newPhysicalProtection = physicalProtection;
  let newMagicalProtection = magicalProtection;
  let newHp = currentHp;
  let damageAbsorbed = 0;
  let damageToHp = 0;

  if (damageType === "VERDADEIRO") {
    // Dano verdadeiro ignora toda proteção, vai direto no HP
    damageToHp = damage;
    newHp = Math.max(0, currentHp - damage);
  } else if (damageType === "FISICO") {
    // Dano físico usa proteção física
    if (physicalProtection > 0) {
      if (damage >= physicalProtection) {
        // Proteção absorve o que pode, excedente vai para HP
        damageAbsorbed = physicalProtection;
        damageToHp = damage - physicalProtection;
        newPhysicalProtection = 0;
        newHp = Math.max(0, currentHp - damageToHp);
      } else {
        // Proteção absorve todo o dano
        damageAbsorbed = damage;
        newPhysicalProtection = physicalProtection - damage;
      }
    } else {
      // Sem proteção física, dano vai direto no HP
      damageToHp = damage;
      newHp = Math.max(0, currentHp - damage);
    }
  } else if (damageType === "MAGICO") {
    // Dano mágico usa proteção mágica
    if (magicalProtection > 0) {
      if (damage >= magicalProtection) {
        // Proteção absorve o que pode, excedente vai para HP
        damageAbsorbed = magicalProtection;
        damageToHp = damage - magicalProtection;
        newMagicalProtection = 0;
        newHp = Math.max(0, currentHp - damageToHp);
      } else {
        // Proteção absorve todo o dano
        damageAbsorbed = damage;
        newMagicalProtection = magicalProtection - damage;
      }
    } else {
      // Sem proteção mágica, dano vai direto no HP
      damageToHp = damage;
      newHp = Math.max(0, currentHp - damage);
    }
  }

  return {
    newPhysicalProtection,
    newMagicalProtection,
    newHp,
    damageAbsorbed,
    damageToHp,
  };
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

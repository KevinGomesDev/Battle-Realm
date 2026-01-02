import {
  validateGridMove,
  applyDualProtectionDamage,
} from "../utils/battle.utils";
import {
  scanConditionsForAction,
  applyConditionScanResult,
} from "./conditions";
import {
  getManhattanDistance,
  isAdjacent,
  isAdjacentOmnidirectional,
  getAdjacentPositions,
} from "../../../shared/types/skills.types";
import type { BattleObstacle } from "../../../shared/types/battle.types";
import { OBSTACLE_CONFIG } from "../../../shared/config/global.config";
import {
  rollD6Test,
  rollContestedTest,
  calculateDamageFromSuccesses,
  calculateDefenseReduction,
  combineAdvantages,
  calculatePhysicalProtection,
  calculateMagicalProtection,
  AdvantageMod,
  DiceRollResult,
  ContestedRollResult as DiceContestedResult,
} from "./dice-system";

export interface CombatUnit {
  id: string;
  ownerId: string;
  ownerKingdomId: string;
  name: string;
  category: string;
  combat: number;
  acuity: number; // Movement = floor(acuity / 2), minimum 1
  focus: number;
  armor: number;
  vitality: number;
  damageReduction: number; // Fixed DR, most units have 0
  currentHp: number;
  posX: number;
  posY: number;
  movesLeft: number;
  actionsLeft: number;
  isAlive: boolean;
  // Proteção Física - ver shared/config/balance.config.ts
  physicalProtection: number;
  maxPhysicalProtection: number;
  // Proteção Mágica - ver shared/config/balance.config.ts
  magicalProtection: number;
  maxMagicalProtection: number;
  conditions: string[];
  actions: string[];
}

export interface MoveActionResult {
  success: boolean;
  error?: string;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  movesLeft?: number;
  moveCost?: number;
}

export interface AttackActionResult {
  success: boolean;
  error?: string;
  missed?: boolean; // True se o ataque errou (ex: dodge)
  // Tipo de alvo
  targetType?: "unit" | "corpse" | "obstacle";
  // Rolagem de ataque
  attackDiceCount?: number;
  attackRolls?: number[];
  attackSuccesses?: number;
  rawDamage?: number;
  // Rolagem de defesa (0 para obstáculos/cadáveres)
  defenseDiceCount?: number;
  defenseRolls?: number[];
  defenseSuccesses?: number;
  damageReduction?: number;
  // Resultado final
  finalDamage?: number;
  damageType?: string;
  targetHpAfter?: number;
  targetPhysicalProtection?: number;
  targetMagicalProtection?: number;
  targetDefeated?: boolean;
  // Para obstáculos
  obstacleDestroyed?: boolean;
  obstacleId?: string;
}

export interface DashActionResult {
  success: boolean;
  error?: string;
  newMovesLeft?: number;
}

export interface DodgeActionResult {
  success: boolean;
  error?: string;
}

// Calcula movimento base: retorna acuidade completa (mínimo 1)
export function calculateBaseMovement(acuity: number): number {
  return Math.max(1, acuity);
}

export function executeMoveAction(
  unit: CombatUnit,
  toX: number,
  toY: number,
  gridWidth: number,
  gridHeight: number,
  allUnits: CombatUnit[],
  obstacles: BattleObstacle[] = []
): MoveActionResult {
  if (!unit.actions.includes("move")) {
    return { success: false, error: "Unit cannot move" };
  }
  if (!unit.isAlive) {
    return { success: false, error: "Dead unit cannot move" };
  }

  // Varredura de condições
  const scan = scanConditionsForAction(unit.conditions, "move");
  if (!scan.canPerform) {
    return { success: false, error: scan.blockReason };
  }

  const moveValidation = validateGridMove(
    unit.posX,
    unit.posY,
    toX,
    toY,
    gridWidth,
    gridHeight,
    unit.movesLeft
  );

  if (!moveValidation.valid) {
    return { success: false, error: moveValidation.reason };
  }

  // Verificar se há unidade viva ocupando a célula
  const isOccupied = allUnits.some(
    (u) => u.posX === toX && u.posY === toY && u.isAlive && u.id !== unit.id
  );

  if (isOccupied) {
    return { success: false, error: "Target cell is occupied" };
  }

  // Verificar se há cadáver bloqueando (se configurado para bloquear)
  const hasCorpse = allUnits.some(
    (u) =>
      u.posX === toX &&
      u.posY === toY &&
      !u.isAlive &&
      !u.conditions.includes("CORPSE_REMOVED")
  );

  if (hasCorpse) {
    return { success: false, error: "Target cell is blocked by corpse" };
  }

  // Verificar se há obstáculo bloqueando (não destruído)
  const hasObstacle = obstacles.some(
    (obs) => obs.posX === toX && obs.posY === toY && !obs.destroyed
  );

  if (hasObstacle) {
    return { success: false, error: "Target cell is blocked by obstacle" };
  }

  const fromX = unit.posX;
  const fromY = unit.posY;

  unit.posX = toX;
  unit.posY = toY;
  unit.movesLeft -= moveValidation.cost;

  // Aplicar expiração de condições
  unit.conditions = applyConditionScanResult(unit.conditions, scan);

  return {
    success: true,
    fromX,
    fromY,
    toX,
    toY,
    movesLeft: unit.movesLeft,
    moveCost: moveValidation.cost,
  };
}

/**
 * Parâmetros de ataque unificados
 * Pode atacar: unidade viva, cadáver (unidade morta) ou obstáculo
 */
export interface AttackParams {
  attacker: CombatUnit;
  // Alvo: unidade (viva ou morta)
  targetUnit?: CombatUnit;
  // Alvo: obstáculo (posição)
  targetObstacle?: BattleObstacle;
  // Tipo de dano
  damageType?: string;
}

/**
 * Executa ataque unificado: unidade, cadáver ou obstáculo
 * - Unidade viva: rola ataque E defesa
 * - Cadáver/Obstáculo: rola apenas ataque (sem defesa)
 */
export function executeAttackAction(
  attacker: CombatUnit,
  target: CombatUnit | null,
  damageType: string = "FISICO",
  obstacle?: BattleObstacle
): AttackActionResult {
  if (!attacker.actions.includes("attack")) {
    return { success: false, error: "Unit cannot attack" };
  }
  if (!attacker.isAlive) {
    return { success: false, error: "Dead unit cannot attack" };
  }
  if (attacker.actionsLeft <= 0) {
    return { success: false, error: "No actions left this turn" };
  }

  // Varredura de condições do atacante
  const attackerScan = scanConditionsForAction(attacker.conditions, "attack");
  if (!attackerScan.canPerform) {
    return { success: false, error: attackerScan.blockReason };
  }

  // Determinar tipo de alvo e posição
  let targetX: number;
  let targetY: number;
  let targetType: "unit" | "corpse" | "obstacle";

  if (obstacle) {
    // Atacando obstáculo
    targetX = obstacle.posX;
    targetY = obstacle.posY;
    targetType = "obstacle";
  } else if (target) {
    targetX = target.posX;
    targetY = target.posY;
    targetType = target.isAlive ? "unit" : "corpse";
  } else {
    return { success: false, error: "No target specified" };
  }

  // Verificar adjacência omnidirecional (8 direções incluindo diagonais)
  if (
    !isAdjacentOmnidirectional(attacker.posX, attacker.posY, targetX, targetY)
  ) {
    return { success: false, error: "Target must be adjacent" };
  }

  // Consumir ação do atacante
  attacker.actionsLeft = Math.max(0, attacker.actionsLeft - 1);

  // === ROLAGEM DE ATAQUE ===
  const attackDiceCount = Math.max(1, attacker.combat);
  const attackRoll = rollD6Test(attackDiceCount, 0);
  const attackSuccesses = attackRoll.totalSuccesses;
  const rawDamage = calculateDamageFromSuccesses(
    attackSuccesses,
    attacker.combat
  );

  // === LÓGICA ESPECÍFICA POR TIPO DE ALVO ===

  if (targetType === "obstacle" && obstacle) {
    // Atacando obstáculo - sem defesa, dano vai direto no HP do obstáculo
    const obstacleHp = obstacle.hp ?? OBSTACLE_CONFIG.defaultHp;
    const newHp = Math.max(0, obstacleHp - rawDamage);
    const destroyed = newHp <= 0;

    // Atualizar obstáculo
    obstacle.hp = newHp;
    obstacle.destroyed = destroyed;

    // Aplicar expiração de condições do atacante
    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );

    return {
      success: true,
      targetType: "obstacle",
      attackDiceCount,
      attackRolls: attackRoll.allRolls,
      attackSuccesses,
      rawDamage,
      defenseDiceCount: 0,
      defenseRolls: [],
      defenseSuccesses: 0,
      damageReduction: 0,
      finalDamage: rawDamage,
      damageType,
      targetHpAfter: newHp,
      obstacleDestroyed: destroyed,
      obstacleId: obstacle.id,
      targetDefeated: destroyed,
    };
  }

  if (targetType === "corpse" && target) {
    // Atacando cadáver - sem defesa, marca como removido se dano >= HP do cadáver
    const corpseHp = OBSTACLE_CONFIG.corpseHp;
    const destroyed = rawDamage >= corpseHp;

    if (destroyed && !target.conditions.includes("CORPSE_REMOVED")) {
      target.conditions.push("CORPSE_REMOVED");
    }

    // Aplicar expiração de condições do atacante
    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );

    return {
      success: true,
      targetType: "corpse",
      attackDiceCount,
      attackRolls: attackRoll.allRolls,
      attackSuccesses,
      rawDamage,
      defenseDiceCount: 0,
      defenseRolls: [],
      defenseSuccesses: 0,
      damageReduction: 0,
      finalDamage: rawDamage,
      damageType,
      targetHpAfter: 0,
      targetDefeated: destroyed,
    };
  }

  // === ATACANDO UNIDADE VIVA ===
  if (!target || !target.isAlive) {
    return { success: false, error: "Target unit is not alive" };
  }

  // Varredura de condições do alvo (para dodge, damage reduction, etc)
  const targetScan = scanConditionsForAction(target.conditions, "attack");

  // Verificar se alvo esquiva
  if (
    targetScan.modifiers.dodgeChance > 0 &&
    Math.random() * 100 < targetScan.modifiers.dodgeChance
  ) {
    // Aplicar expiração de condições mesmo em miss
    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );
    return {
      success: true,
      missed: true,
      targetType: "unit",
      attackDiceCount: 0,
      attackRolls: [],
      attackSuccesses: 0,
      rawDamage: 0,
      defenseDiceCount: 0,
      defenseRolls: [],
      defenseSuccesses: 0,
      damageReduction: 0,
      finalDamage: 0,
      damageType,
      targetHpAfter: target.currentHp,
      targetPhysicalProtection: target.physicalProtection,
      targetMagicalProtection: target.magicalProtection,
      targetDefeated: false,
    };
  }

  // === ROLAGEM DE DEFESA (apenas para unidades vivas) ===
  const defenseDiceCount = Math.max(1, target.acuity);
  const defenseRoll = rollD6Test(defenseDiceCount, 0);
  const defenseSuccesses = defenseRoll.totalSuccesses;

  // Redução de dano = Sucessos * (Acuity / 2) do defensor
  const damageReductionFromDefense = calculateDefenseReduction(
    defenseSuccesses,
    target.acuity
  );

  // Aplicar redução de dano por condições do alvo + defesa
  const totalDamageReduction =
    targetScan.modifiers.damageReduction + damageReductionFromDefense;
  let damageToApply = Math.max(0, rawDamage - totalDamageReduction);

  // DEBUG: Log antes de aplicar proteção
  console.log("[COMBAT] Aplicando dano:", {
    damageToApply,
    damageType,
    targetPhysicalProtection: target.physicalProtection,
    targetMagicalProtection: target.magicalProtection,
    targetCurrentHp: target.currentHp,
  });

  // Aplicar dano na proteção apropriada
  const protectionResult = applyDualProtectionDamage(
    target.physicalProtection,
    target.magicalProtection,
    target.currentHp,
    damageToApply,
    damageType
  );

  // DEBUG: Log após aplicar proteção
  console.log("[COMBAT] Resultado proteção:", {
    newPhysicalProtection: protectionResult.newPhysicalProtection,
    newMagicalProtection: protectionResult.newMagicalProtection,
    newHp: protectionResult.newHp,
    damageAbsorbed: protectionResult.damageAbsorbed,
    damageToHp: protectionResult.damageToHp,
  });

  target.physicalProtection = protectionResult.newPhysicalProtection;
  target.magicalProtection = protectionResult.newMagicalProtection;
  target.currentHp = protectionResult.newHp;

  // Aplicar expiração de condições
  attacker.conditions = applyConditionScanResult(
    attacker.conditions,
    attackerScan
  );
  target.conditions = applyConditionScanResult(target.conditions, targetScan);

  let targetDefeated = false;
  if (target.currentHp <= 0) {
    targetDefeated = true;
    target.isAlive = false;
  }

  return {
    success: true,
    targetType: "unit",
    // Ataque
    attackDiceCount,
    attackRolls: attackRoll.allRolls,
    attackSuccesses,
    rawDamage,
    // Defesa
    defenseDiceCount,
    defenseRolls: defenseRoll.allRolls,
    defenseSuccesses,
    damageReduction: damageReductionFromDefense,
    // Resultado
    finalDamage: damageToApply,
    damageType,
    targetHpAfter: target.currentHp,
    targetPhysicalProtection: target.physicalProtection,
    targetMagicalProtection: target.magicalProtection,
    targetDefeated,
  };
}

export function executeDashAction(unit: CombatUnit): DashActionResult {
  if (!unit.actions.includes("dash")) {
    return { success: false, error: "Unit cannot dash" };
  }
  if (!unit.isAlive) {
    return { success: false, error: "Dead unit cannot dash" };
  }

  const scan = scanConditionsForAction(unit.conditions, "dash");
  if (!scan.canPerform) {
    return { success: false, error: scan.blockReason };
  }

  if (unit.actionsLeft <= 0) {
    return { success: false, error: "No actions left this turn" };
  }

  unit.actionsLeft = Math.max(0, unit.actionsLeft - 1);
  // SOMA movimentos extras ao invés de resetar
  unit.movesLeft = unit.movesLeft + calculateBaseMovement(unit.acuity);
  unit.conditions = applyConditionScanResult(unit.conditions, scan);

  return {
    success: true,
    newMovesLeft: unit.movesLeft,
  };
}

export function executeDodgeAction(unit: CombatUnit): DodgeActionResult {
  if (!unit.actions.includes("dodge")) {
    return { success: false, error: "Unit cannot dodge" };
  }
  if (!unit.isAlive) {
    return { success: false, error: "Dead unit cannot dodge" };
  }

  const scan = scanConditionsForAction(unit.conditions, "dodge");
  if (!scan.canPerform) {
    return { success: false, error: scan.blockReason };
  }

  if (unit.actionsLeft <= 0) {
    return { success: false, error: "No actions left this turn" };
  }

  unit.actionsLeft = Math.max(0, unit.actionsLeft - 1);
  unit.conditions = applyConditionScanResult(unit.conditions, scan);

  if (!unit.conditions.includes("DODGING")) {
    unit.conditions.push("DODGING");
  }

  return { success: true };
}

export const COMBAT_ACTIONS = {
  move: {
    id: "move",
    name: "Move",
    costType: "movement",
  },
  attack: {
    id: "attack",
    name: "Attack",
    costType: "action",
  },
  dash: {
    id: "dash",
    name: "Dash",
    costType: "action",
  },
  dodge: {
    id: "dodge",
    name: "Dodge",
    costType: "action",
  },
} as const;

export { DEFAULT_UNIT_ACTIONS } from "./unit-actions";

export function canUnitPerformAction(
  unit: CombatUnit,
  actionId: string
): boolean {
  if (!unit.actions.includes(actionId) || !unit.isAlive) return false;
  const scan = scanConditionsForAction(unit.conditions, actionId);
  return scan.canPerform;
}

export function getAvailableActions(unit: CombatUnit): string[] {
  if (!unit.isAlive) return [];

  const available: string[] = [];

  for (const actionId of unit.actions) {
    const scan = scanConditionsForAction(unit.conditions, actionId);
    if (!scan.canPerform) continue;

    // Verificar recursos necessários
    if (actionId === "move" && unit.movesLeft <= 0) continue;
    if (["attack", "dash", "dodge"].includes(actionId) && unit.actionsLeft <= 0)
      continue;

    available.push(actionId);
  }

  return available;
}

// =====================
// Ações Avançadas de Combate
// =====================

export interface ContestedRollResult {
  success: boolean;
  error?: string;
  attackerRolls?: number[];
  defenderRolls?: number[];
  attackerSuccesses?: number;
  defenderSuccesses?: number;
}

export interface HelpActionResult {
  success: boolean;
  error?: string;
}

export interface ProtectActionResult {
  success: boolean;
  error?: string;
  alreadyUsed?: boolean;
}

export interface ThrowActionResult {
  success: boolean;
  error?: string;
  rolls?: number[];
  successes?: number;
  finalX?: number;
  finalY?: number;
  collided?: boolean;
  attackerDamage?: number;
  targetDamage?: number;
}

export interface GrabActionResult extends ContestedRollResult {
  grabbed?: boolean;
}

export interface FleeActionResult extends ContestedRollResult {
  fled?: boolean;
}

export interface CastActionResult {
  success: boolean;
  error?: string;
  rolls?: number[];
  successes?: number;
  threshold?: number;
}

export interface AttackObstacleResult {
  success: boolean;
  error?: string;
  damage?: number;
  destroyed?: boolean;
}

// Ajuda: aplica HELP_NEXT na unidade adjacente (reduz CD em 1 na próxima ação)
export function executeHelpAction(
  helper: CombatUnit,
  target: CombatUnit
): HelpActionResult {
  if (!helper.isAlive) {
    return { success: false, error: "Unidade morta não pode ajudar" };
  }
  if (!target.isAlive) {
    return { success: false, error: "Não pode ajudar unidade morta" };
  }

  if (!isAdjacent(helper.posX, helper.posY, target.posX, target.posY)) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  if (!target.conditions.includes("HELP_NEXT")) {
    target.conditions.push("HELP_NEXT");
  }

  return { success: true };
}

// Proteger-se: reduz próximo dano em 5; uma vez por batalha
export function executeProtectAction(unit: CombatUnit): ProtectActionResult {
  if (!unit.isAlive) {
    return { success: false, error: "Unidade morta não pode se proteger" };
  }

  if (unit.conditions.includes("PROTECT_USED")) {
    return {
      success: false,
      error: "Já usou Proteger-se nesta batalha",
      alreadyUsed: true,
    };
  }

  if (!unit.conditions.includes("PROTECTED")) {
    unit.conditions.push("PROTECTED");
  }
  unit.conditions.push("PROTECT_USED");

  return { success: true };
}

// Derrubar: combate resistido contra acuidade; aplica DERRUBADA
export function executeKnockdownAction(
  attacker: CombatUnit,
  target: CombatUnit
): ContestedRollResult {
  if (!attacker.isAlive) {
    return { success: false, error: "Unidade morta não pode derrubar" };
  }
  if (!target.isAlive) {
    return { success: false, error: "Não pode derrubar unidade morta" };
  }

  if (!isAdjacent(attacker.posX, attacker.posY, target.posX, target.posY)) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  const contestedResult = rollContestedTest(attacker.combat, target.acuity);

  const success = contestedResult.attackerWins;
  if (success && !target.conditions.includes("DERRUBADA")) {
    target.conditions.push("DERRUBADA");
  }

  return {
    success,
    attackerRolls: contestedResult.attackerResult.allRolls,
    defenderRolls: contestedResult.defenderResult.allRolls,
    attackerSuccesses: contestedResult.attackerResult.totalSuccesses,
    defenderSuccesses: contestedResult.defenderResult.totalSuccesses,
  };
}

// Desarmar: combate resistido contra acuidade; aplica DISARMED
export function executeDisarmAction(
  attacker: CombatUnit,
  target: CombatUnit
): ContestedRollResult {
  if (!attacker.isAlive) {
    return { success: false, error: "Unidade morta não pode desarmar" };
  }
  if (!target.isAlive) {
    return { success: false, error: "Não pode desarmar unidade morta" };
  }

  if (!isAdjacent(attacker.posX, attacker.posY, target.posX, target.posY)) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  const contestedResult = rollContestedTest(attacker.combat, target.acuity);

  const success = contestedResult.attackerWins;
  if (success && !target.conditions.includes("DISARMED")) {
    target.conditions.push("DISARMED");
  }

  return {
    success,
    attackerRolls: contestedResult.attackerResult.allRolls,
    defenderRolls: contestedResult.defenderResult.allRolls,
    attackerSuccesses: contestedResult.attackerResult.totalSuccesses,
    defenderSuccesses: contestedResult.defenderResult.totalSuccesses,
  };
}

// Agarrar: combate resistido contra acuidade; ambos ficam AGARRADO
export function executeGrabAction(
  attacker: CombatUnit,
  target: CombatUnit
): GrabActionResult {
  if (!attacker.isAlive) {
    return { success: false, error: "Unidade morta não pode agarrar" };
  }
  if (!target.isAlive) {
    return { success: false, error: "Não pode agarrar unidade morta" };
  }

  if (!isAdjacent(attacker.posX, attacker.posY, target.posX, target.posY)) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  const contestedResult = rollContestedTest(attacker.combat, target.acuity);

  const grabbed = contestedResult.attackerWins;
  if (grabbed) {
    if (!attacker.conditions.includes("AGARRADO")) {
      attacker.conditions.push("AGARRADO");
    }
    if (!target.conditions.includes("AGARRADO")) {
      target.conditions.push("AGARRADO");
    }
  }

  return {
    success: true,
    grabbed,
    attackerRolls: contestedResult.attackerResult.allRolls,
    defenderRolls: contestedResult.defenderResult.allRolls,
    attackerSuccesses: contestedResult.attackerResult.totalSuccesses,
    defenderSuccesses: contestedResult.defenderResult.totalSuccesses,
  };
}

// Arremessar: teste Combate CS:4; empurra em direção, dano físico nos envolvidos
export function executeThrowAction(
  attacker: CombatUnit,
  target: CombatUnit,
  dirX: number,
  dirY: number,
  gridWidth: number,
  gridHeight: number,
  allUnits: CombatUnit[]
): ThrowActionResult {
  if (!attacker.isAlive) {
    return { success: false, error: "Unidade morta não pode arremessar" };
  }
  if (!target.isAlive) {
    return { success: false, error: "Não pode arremessar unidade morta" };
  }

  if (!isAdjacent(attacker.posX, attacker.posY, target.posX, target.posY)) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  const dx = Math.sign(dirX || 0);
  const dy = Math.sign(dirY || 0);
  if (dx === 0 && dy === 0) {
    return { success: false, error: "Direção inválida" };
  }

  const rollResult = rollD6Test(attacker.combat, 0);
  const successes = rollResult.totalSuccesses;

  let steps = successes;
  let finalX = target.posX;
  let finalY = target.posY;
  let collided = false;

  while (steps > 0) {
    const nx = finalX + dx;
    const ny = finalY + dy;

    // Limites do grid
    if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) {
      collided = true;
      break;
    }

    // Colisão com unidade viva ou cadáver
    const unitAt = allUnits.find(
      (u) => u.posX === nx && u.posY === ny && u.id !== target.id
    );
    if (
      unitAt &&
      (unitAt.isAlive || !unitAt.conditions.includes("CORPSE_REMOVED"))
    ) {
      collided = true;
      break;
    }

    finalX = nx;
    finalY = ny;
    steps--;
  }

  // Mover alvo
  target.posX = finalX;
  target.posY = finalY;

  // Dano em ambos igual aos sucessos
  let attackerDamage = 0;
  let targetDamage = 0;

  if (successes > 0) {
    // Aplicar dano no atacante (colisão causa dano físico)
    const attackerResult = applyDualProtectionDamage(
      attacker.physicalProtection,
      attacker.magicalProtection,
      attacker.currentHp,
      successes,
      "FISICO"
    );
    attacker.physicalProtection = attackerResult.newPhysicalProtection;
    attacker.magicalProtection = attackerResult.newMagicalProtection;
    attacker.currentHp = attackerResult.newHp;
    attackerDamage = successes;

    // Aplicar dano no alvo (colisão causa dano físico)
    const targetResult = applyDualProtectionDamage(
      target.physicalProtection,
      target.magicalProtection,
      target.currentHp,
      successes,
      "FISICO"
    );
    target.physicalProtection = targetResult.newPhysicalProtection;
    target.magicalProtection = targetResult.newMagicalProtection;
    target.currentHp = targetResult.newHp;
    targetDamage = successes;

    if (attacker.currentHp <= 0) attacker.isAlive = false;
    if (target.currentHp <= 0) target.isAlive = false;
  }

  return {
    success: true,
    rolls: rollResult.allRolls,
    successes,
    finalX,
    finalY,
    collided,
    attackerDamage,
    targetDamage,
  };
}

// Fuga: teste de Acuidade resistido pela Acuidade do inimigo mais próximo
export function executeFleeAction(
  unit: CombatUnit,
  nearestEnemy: CombatUnit
): FleeActionResult {
  if (!unit.isAlive) {
    return { success: false, error: "Unidade morta não pode fugir" };
  }

  // HELP_NEXT aplica +1 vantagem
  const hasHelp = unit.conditions.includes("HELP_NEXT");
  const advantageMod: AdvantageMod = hasHelp ? 1 : 0;

  if (hasHelp) {
    unit.conditions = unit.conditions.filter((c) => c !== "HELP_NEXT");
  }

  const contestedResult = rollContestedTest(
    unit.acuity,
    nearestEnemy.acuity,
    advantageMod,
    0
  );

  const fled = contestedResult.attackerWins;

  return {
    success: true,
    fled,
    attackerRolls: contestedResult.attackerResult.allRolls,
    defenderRolls: contestedResult.defenderResult.allRolls,
    attackerSuccesses: contestedResult.attackerResult.totalSuccesses,
    defenderSuccesses: contestedResult.defenderResult.totalSuccesses,
  };
}

// Conjurar: teste de Foco CD:4
export function executeCastAction(
  unit: CombatUnit,
  spellId: string
): CastActionResult {
  if (!unit.isAlive) {
    return { success: false, error: "Unidade morta não pode conjurar" };
  }

  // HELP_NEXT aplica +1 vantagem
  const hasHelp = unit.conditions.includes("HELP_NEXT");
  const advantageMod: AdvantageMod = hasHelp ? 1 : 0;

  if (hasHelp) {
    unit.conditions = unit.conditions.filter((c) => c !== "HELP_NEXT");
  }

  const rollResult = rollD6Test(unit.focus, advantageMod);

  return {
    success: true,
    rolls: rollResult.allRolls,
    successes: rollResult.totalSuccesses,
    threshold: rollResult.successThreshold,
  };
}

// executeAttackObstacle foi removido - use executeAttackAction com o parâmetro obstacle

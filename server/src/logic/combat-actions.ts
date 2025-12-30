import {
  validateGridMove,
  applyProtectionDamage,
  rollD6,
  countSuccesses,
} from "../utils/battle.utils";
import {
  scanConditionsForAction,
  applyConditionScanResult,
} from "./conditions";

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
  protection: number;
  protectionBroken: boolean;
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
  diceCount?: number;
  rolls?: number[];
  rawDamage?: number;
  finalDamage?: number;
  damageType?: string;
  targetHpAfter?: number;
  targetProtection?: number;
  targetDefeated?: boolean;
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
  allUnits: CombatUnit[]
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

  const isOccupied = allUnits.some(
    (u) => u.posX === toX && u.posY === toY && u.isAlive && u.id !== unit.id
  );

  if (isOccupied) {
    return { success: false, error: "Target cell is occupied" };
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

export function executeAttackAction(
  attacker: CombatUnit,
  target: CombatUnit,
  damageType: string = "FISICO"
): AttackActionResult {
  if (!attacker.actions.includes("attack")) {
    return { success: false, error: "Unit cannot attack" };
  }
  if (!attacker.isAlive) {
    return { success: false, error: "Dead unit cannot attack" };
  }

  // Varredura de condições do atacante
  const attackerScan = scanConditionsForAction(attacker.conditions, "attack");
  if (!attackerScan.canPerform) {
    return { success: false, error: attackerScan.blockReason };
  }

  if (!target.isAlive) {
    return { success: false, error: "Cannot attack dead unit" };
  }
  if (attacker.actionsLeft <= 0) {
    return { success: false, error: "No actions left this turn" };
  }

  const manhattanDistance =
    Math.abs(attacker.posX - target.posX) +
    Math.abs(attacker.posY - target.posY);

  if (manhattanDistance !== 1) {
    return { success: false, error: "Target must be adjacent" };
  }

  // Consumir ação do atacante
  attacker.actionsLeft = Math.max(0, attacker.actionsLeft - 1);

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
      diceCount: 0,
      rolls: [],
      rawDamage: 0,
      finalDamage: 0,
      damageType,
      targetHpAfter: target.currentHp,
      targetProtection: target.protection,
      targetDefeated: false,
    };
  }

  const diceCount = Math.max(1, Math.floor(attacker.combat / 4));
  const rolls = rollD6(diceCount);
  const rawDamage = rolls.reduce((sum, roll) => sum + roll, 0);

  // Aplicar redução de dano por condições do alvo
  let damageToApply = Math.max(
    0,
    rawDamage - targetScan.modifiers.damageReduction
  );

  const protectionResult = applyProtectionDamage(
    target.protection,
    target.protectionBroken,
    target.currentHp,
    damageToApply,
    damageType
  );

  target.protection = protectionResult.newProtection;
  target.protectionBroken = protectionResult.newProtectionBroken;
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
    diceCount,
    rolls,
    rawDamage,
    finalDamage: damageToApply,
    damageType,
    targetHpAfter: target.currentHp,
    targetProtection: target.protection,
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

  const manhattan =
    Math.abs(helper.posX - target.posX) + Math.abs(helper.posY - target.posY);
  if (manhattan !== 1) {
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

  const manhattan =
    Math.abs(attacker.posX - target.posX) +
    Math.abs(attacker.posY - target.posY);
  if (manhattan !== 1) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  const attackerRolls = rollD6(attacker.combat);
  const defenderRolls = rollD6(target.acuity);
  const attackerSuccesses = countSuccesses(attackerRolls, 4);
  const defenderSuccesses = countSuccesses(defenderRolls, 4);

  const success = attackerSuccesses > defenderSuccesses;
  if (success && !target.conditions.includes("DERRUBADA")) {
    target.conditions.push("DERRUBADA");
  }

  return {
    success,
    attackerRolls,
    defenderRolls,
    attackerSuccesses,
    defenderSuccesses,
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

  const manhattan =
    Math.abs(attacker.posX - target.posX) +
    Math.abs(attacker.posY - target.posY);
  if (manhattan !== 1) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  const attackerRolls = rollD6(attacker.combat);
  const defenderRolls = rollD6(target.acuity);
  const attackerSuccesses = countSuccesses(attackerRolls, 4);
  const defenderSuccesses = countSuccesses(defenderRolls, 4);

  const success = attackerSuccesses > defenderSuccesses;
  if (success && !target.conditions.includes("DISARMED")) {
    target.conditions.push("DISARMED");
  }

  return {
    success,
    attackerRolls,
    defenderRolls,
    attackerSuccesses,
    defenderSuccesses,
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

  const manhattan =
    Math.abs(attacker.posX - target.posX) +
    Math.abs(attacker.posY - target.posY);
  if (manhattan !== 1) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  const attackerRolls = rollD6(attacker.combat);
  const defenderRolls = rollD6(target.acuity);
  const attackerSuccesses = countSuccesses(attackerRolls, 4);
  const defenderSuccesses = countSuccesses(defenderRolls, 4);

  const grabbed = attackerSuccesses > defenderSuccesses;
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
    attackerRolls,
    defenderRolls,
    attackerSuccesses,
    defenderSuccesses,
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

  const manhattan =
    Math.abs(attacker.posX - target.posX) +
    Math.abs(attacker.posY - target.posY);
  if (manhattan !== 1) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  const dx = Math.sign(dirX || 0);
  const dy = Math.sign(dirY || 0);
  if (dx === 0 && dy === 0) {
    return { success: false, error: "Direção inválida" };
  }

  const rolls = rollD6(attacker.combat);
  const successes = countSuccesses(rolls, 4);

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
    const attackerResult = applyProtectionDamage(
      attacker.protection,
      attacker.protectionBroken,
      attacker.currentHp,
      successes,
      "FISICO"
    );
    attacker.protection = attackerResult.newProtection;
    attacker.protectionBroken = attackerResult.newProtectionBroken;
    attacker.currentHp = attackerResult.newHp;
    attackerDamage = successes;

    const targetResult = applyProtectionDamage(
      target.protection,
      target.protectionBroken,
      target.currentHp,
      successes,
      "FISICO"
    );
    target.protection = targetResult.newProtection;
    target.protectionBroken = targetResult.newProtectionBroken;
    target.currentHp = targetResult.newHp;
    targetDamage = successes;

    if (attacker.currentHp <= 0) attacker.isAlive = false;
    if (target.currentHp <= 0) target.isAlive = false;
  }

  return {
    success: true,
    rolls,
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

  const attackerRolls = rollD6(unit.acuity);
  let attackerSuccesses = countSuccesses(attackerRolls, 4);

  // HELP_NEXT bonus
  if (unit.conditions.includes("HELP_NEXT")) {
    attackerSuccesses += 1;
    unit.conditions = unit.conditions.filter((c) => c !== "HELP_NEXT");
  }

  const defenderRolls = rollD6(nearestEnemy.acuity);
  const defenderSuccesses = countSuccesses(defenderRolls, 4);

  const fled = attackerSuccesses > defenderSuccesses;

  return {
    success: true,
    fled,
    attackerRolls,
    defenderRolls,
    attackerSuccesses,
    defenderSuccesses,
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

  // HELP_NEXT reduz threshold
  const hasHelp = unit.conditions.includes("HELP_NEXT");
  const threshold = hasHelp ? Math.max(2, 4 - 1) : 4;

  if (hasHelp) {
    unit.conditions = unit.conditions.filter((c) => c !== "HELP_NEXT");
  }

  const rolls = rollD6(unit.focus);
  const successes = countSuccesses(rolls, threshold);

  return {
    success: true,
    rolls,
    successes,
    threshold,
  };
}

// Atacar obstáculo: cadáver ou objeto; se dano >= 5, remove obstáculo
export function executeAttackObstacle(
  attacker: CombatUnit,
  targetX: number,
  targetY: number,
  allUnits: CombatUnit[]
): AttackObstacleResult {
  if (!attacker.isAlive) {
    return { success: false, error: "Unidade morta não pode atacar" };
  }
  if (attacker.actionsLeft <= 0) {
    return { success: false, error: "Sem ações restantes" };
  }

  const manhattan =
    Math.abs(attacker.posX - targetX) + Math.abs(attacker.posY - targetY);
  if (manhattan !== 1) {
    return { success: false, error: "Obstáculo deve estar adjacente" };
  }

  // Consumir ação
  attacker.actionsLeft = Math.max(0, attacker.actionsLeft - 1);

  // Dano = combate (obstáculo não tem armadura)
  const damage = Math.max(1, attacker.combat);
  const destroyed = damage >= 5;

  // Marcar cadáver como removido se destruído
  if (destroyed) {
    const corpse = allUnits.find(
      (u) => u.posX === targetX && u.posY === targetY && !u.isAlive
    );
    if (corpse && !corpse.conditions.includes("CORPSE_REMOVED")) {
      corpse.conditions.push("CORPSE_REMOVED");
    }
  }

  return {
    success: true,
    damage,
    destroyed,
  };
}

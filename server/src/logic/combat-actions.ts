import { applyDualProtectionDamage } from "../utils/battle.utils";
import {
  scanConditionsForAction,
  applyConditionScanResult,
  getExtraAttacksFromConditions,
} from "./conditions";
import {
  isAdjacent,
  isWithinRange,
} from "../../../shared/utils/spell-validation";
import type {
  BattleObstacle,
  BattleUnit,
} from "../../../shared/types/battle.types";
import {
  OBSTACLE_CONFIG,
  DEFENSE_CONFIG,
} from "../../../shared/config/global.config";
import {
  shouldTransferDamageToEidolon,
  transferDamageToEidolon,
  processUnitDeathForEidolon,
  processEidolonDeath,
  processSummonerDeath,
} from "./summon-logic";
import { validateMove } from "../../../shared/utils/engagement.utils";

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
  missed?: boolean; // True se o ataque foi esquivado
  dodged?: boolean; // True se o alvo esquivou (sinônimo de missed)
  targetType?: "unit" | "corpse" | "obstacle";
  rawDamage?: number;
  damageReduction?: number;
  finalDamage?: number;
  damageType?: string;
  targetHpAfter?: number;
  targetPhysicalProtection?: number;
  targetMagicalProtection?: number;
  targetDefeated?: boolean;
  obstacleDestroyed?: boolean;
  obstacleId?: string;
  attacksLeftThisTurn?: number; // Ataques restantes após este
  dodgeChance?: number; // % de chance de esquiva
  dodgeRoll?: number; // Rolagem de 1-100
  // Eidolon (Invocador)
  damageTransferredToEidolon?: boolean; // Dano foi transferido para Eidolon
  eidolonDefeated?: boolean; // Eidolon morreu ao receber dano transferido
  // Invocações mortas quando o invocador morre
  killedSummonIds?: string[]; // IDs dos summons que morreram com o invocador
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

// Calcula movimento base: retorna Velocidade completa (mínimo 1)
export function calculateBaseMovement(speed: number): number {
  return Math.max(1, speed);
}

export function executeMoveAction(
  unit: BattleUnit,
  toX: number,
  toY: number,
  gridWidth: number,
  gridHeight: number,
  allUnits: BattleUnit[],
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

  // Validação centralizada de movimento (custo, caminho, ocupação, obstáculos)
  const moveValidation = validateMove(
    unit,
    toX,
    toY,
    allUnits,
    obstacles,
    gridWidth,
    gridHeight
  );

  if (!moveValidation.valid) {
    return { success: false, error: moveValidation.error };
  }

  const fromX = unit.posX;
  const fromY = unit.posY;

  unit.posX = toX;
  unit.posY = toY;
  unit.movesLeft -= moveValidation.totalCost;

  // Aplicar expiração de condições
  unit.conditions = applyConditionScanResult(unit.conditions, scan);

  return {
    success: true,
    fromX,
    fromY,
    toX,
    toY,
    movesLeft: unit.movesLeft,
    moveCost: moveValidation.totalCost,
  };
}

/**
 * Parâmetros de ataque unificados
 * Pode atacar: unidade viva, cadáver (unidade morta) ou obstáculo
 */
export interface AttackParams {
  attacker: BattleUnit;
  // Alvo: unidade (viva ou morta)
  targetUnit?: BattleUnit;
  // Alvo: obstáculo (posição)
  targetObstacle?: BattleObstacle;
  // Tipo de dano
  damageType?: string;
}

/**
 * Executa ataque unificado: unidade, cadáver ou obstáculo
 * NOVO SISTEMA SEM DADOS:
 * - Dano = Combat × Multiplicador (do ATTACK_CONFIG)
 * - Esquiva = 1D100 vs Speed × dodgeMultiplier (máximo maxDodgeChance)
 */
export function executeAttackAction(
  attacker: BattleUnit,
  target: BattleUnit | null,
  damageType: string = "FISICO",
  obstacle?: BattleObstacle,
  allUnits: BattleUnit[] = []
): AttackActionResult {
  if (!attacker.actions.includes("attack")) {
    return { success: false, error: "Unit cannot attack" };
  }
  if (!attacker.isAlive) {
    return { success: false, error: "Dead unit cannot attack" };
  }

  // === MAGIC_WEAPON: Converter dano físico em mágico ===
  let effectiveDamageType = damageType;
  if (
    attacker.conditions.includes("MAGIC_WEAPON") &&
    effectiveDamageType === "FISICO"
  ) {
    effectiveDamageType = "MAGICO";
  }

  // === SISTEMA DE MÚLTIPLOS ATAQUES (extraAttacks) ===
  const hasAttacksRemaining = attacker.attacksLeftThisTurn > 0;

  if (!hasAttacksRemaining) {
    if (attacker.actionsLeft <= 0) {
      return { success: false, error: "No actions left this turn" };
    }
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

  // Calcula alcance de ataque dinâmico (base 1 + modificadores de condições)
  const baseAttackRange = 1;
  const attackRangeMod = attackerScan.modifiers.basicAttackRangeMod || 0;
  const effectiveAttackRange = baseAttackRange + attackRangeMod;

  // Verificar se o alvo está dentro do alcance de ataque (8 direções)
  if (
    !isWithinRange(
      attacker.posX,
      attacker.posY,
      targetX,
      targetY,
      effectiveAttackRange
    )
  ) {
    return {
      success: false,
      error:
        effectiveAttackRange === 1
          ? "Target must be adjacent"
          : `Target must be within ${effectiveAttackRange} tiles`,
    };
  }

  // === CONSUMO DE AÇÃO E ATAQUES EXTRAS ===
  if (!hasAttacksRemaining) {
    attacker.actionsLeft = Math.max(0, attacker.actionsLeft - 1);
    const hasProtection = attacker.physicalProtection > 0;
    const extraAttacks = getExtraAttacksFromConditions(
      attacker.conditions,
      hasProtection
    );
    attacker.attacksLeftThisTurn = extraAttacks;
  } else {
    attacker.attacksLeftThisTurn = Math.max(
      0,
      attacker.attacksLeftThisTurn - 1
    );
  }

  // === CÁLCULO DE DANO (SEM DADOS) ===
  // Dano = Combat × Multiplicador + bônus de condições
  const bonusDamage = attackerScan.modifiers.bonusDamage || 0;
  const rawDamage = Math.max(1, attacker.combat) + bonusDamage;

  // === LÓGICA ESPECÍFICA POR TIPO DE ALVO ===

  if (targetType === "obstacle" && obstacle) {
    const obstacleHp = obstacle.hp ?? OBSTACLE_CONFIG.defaultHp;
    const newHp = Math.max(0, obstacleHp - rawDamage);
    const destroyed = newHp <= 0;

    obstacle.hp = newHp;
    obstacle.destroyed = destroyed;

    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );

    return {
      success: true,
      targetType: "obstacle",
      rawDamage,
      damageReduction: 0,
      finalDamage: rawDamage,
      damageType: effectiveDamageType,
      targetHpAfter: newHp,
      obstacleDestroyed: destroyed,
      obstacleId: obstacle.id,
      targetDefeated: destroyed,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
    };
  }

  if (targetType === "corpse" && target) {
    const corpseHp = OBSTACLE_CONFIG.corpseHp;
    const destroyed = rawDamage >= corpseHp;

    if (destroyed && !target.conditions.includes("CORPSE_REMOVED")) {
      target.conditions.push("CORPSE_REMOVED");
    }

    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );

    return {
      success: true,
      targetType: "corpse",
      rawDamage,
      damageReduction: 0,
      finalDamage: rawDamage,
      damageType: effectiveDamageType,
      targetHpAfter: 0,
      targetDefeated: destroyed,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
    };
  }

  // === ATACANDO UNIDADE VIVA ===
  if (!target || !target.isAlive) {
    return { success: false, error: "Target unit is not alive" };
  }

  // Varredura de condições do alvo
  const targetScan = scanConditionsForAction(target.conditions, "attack");

  // === SISTEMA DE ESQUIVA (1D100) ===
  // Chance = Speed × dodgeMultiplier + bônus de condições (cap: maxDodgeChance)
  const baseDodgeChance =
    target.speed * DEFENSE_CONFIG.dodgeMultiplier +
    (targetScan.modifiers.dodgeChance || 0);
  const dodgeChance = Math.min(baseDodgeChance, DEFENSE_CONFIG.maxDodgeChance);
  const dodgeRoll = Math.floor(Math.random() * 100) + 1; // 1-100

  if (dodgeRoll <= dodgeChance) {
    // Alvo esquivou!
    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );
    return {
      success: true,
      missed: true,
      dodged: true,
      targetType: "unit",
      rawDamage: 0,
      damageReduction: 0,
      finalDamage: 0,
      damageType: effectiveDamageType,
      targetHpAfter: target.currentHp,
      targetPhysicalProtection: target.physicalProtection,
      targetMagicalProtection: target.magicalProtection,
      targetDefeated: false,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
      dodgeChance,
      dodgeRoll,
    };
  }

  // === APLICAR DANO ===
  // Redução de dano apenas por condições (não mais por dados)
  const damageReduction = targetScan.modifiers.damageReduction || 0;
  const damageToApply = Math.max(0, rawDamage - damageReduction);

  console.log("[COMBAT] Aplicando dano (novo sistema):", {
    targetName: target.name,
    targetRace: target.race,
    targetConditions: target.conditions,
    rawDamage,
    damageReduction,
    damageToApply,
    damageType: effectiveDamageType,
    dodgeChance,
    dodgeRoll,
  });

  // === VERIFICAR TRANSFERÊNCIA DE DANO PARA EIDOLON ===
  // Se o alvo tem EIDOLON_PROTECTION e está adjacente ao Eidolon
  const eidolonToTransfer = shouldTransferDamageToEidolon(target, allUnits);

  let eidolonDefeated = false;
  let damageTransferredToEidolon = false;

  if (eidolonToTransfer) {
    // Dano é transferido como DANO VERDADEIRO para o Eidolon
    const transferResult = transferDamageToEidolon(
      eidolonToTransfer,
      damageToApply
    );
    eidolonDefeated = transferResult.eidolonDefeated;
    damageTransferredToEidolon = true;

    console.log(
      `[COMBAT] 🛡️ Dano transferido para Eidolon: ${damageToApply} (Verdadeiro)`
    );

    // Se Eidolon morreu, processar reset de bônus
    if (eidolonDefeated) {
      processEidolonDeath(eidolonToTransfer, "arena");
    }

    // Aplicar expiração de condições (mesmo sem dano no alvo)
    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );
    target.conditions = applyConditionScanResult(target.conditions, targetScan);

    return {
      success: true,
      targetType: "unit",
      rawDamage,
      damageReduction,
      finalDamage: damageToApply,
      damageType: effectiveDamageType,
      targetHpAfter: target.currentHp, // Alvo não recebeu dano
      targetPhysicalProtection: target.physicalProtection,
      targetMagicalProtection: target.magicalProtection,
      targetDefeated: false,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
      dodgeChance,
      dodgeRoll,
      damageTransferredToEidolon: true,
      eidolonDefeated,
    };
  }

  // Aplicar dano na proteção apropriada (fluxo normal)
  const protectionResult = applyDualProtectionDamage(
    target.physicalProtection,
    target.magicalProtection,
    target.currentHp,
    damageToApply,
    effectiveDamageType
  );

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
  let killedSummons: BattleUnit[] = [];
  if (target.currentHp <= 0) {
    targetDefeated = true;
    target.isAlive = false;

    // Processar morte para crescimento do Eidolon (se atacante for Eidolon)
    processUnitDeathForEidolon(attacker, target, "arena");

    // Se o alvo era um Eidolon, processar reset
    if (target.conditions.includes("EIDOLON_GROWTH")) {
      processEidolonDeath(target, "arena");
    }

    // Matar todas as invocações do alvo (summons morrem com o invocador)
    killedSummons = processSummonerDeath(target, allUnits, "arena");
  }

  return {
    success: true,
    targetType: "unit",
    rawDamage,
    damageReduction,
    finalDamage: damageToApply,
    damageType: effectiveDamageType,
    targetHpAfter: target.currentHp,
    targetPhysicalProtection: target.physicalProtection,
    targetMagicalProtection: target.magicalProtection,
    targetDefeated,
    attacksLeftThisTurn: attacker.attacksLeftThisTurn,
    dodgeChance,
    dodgeRoll,
    killedSummonIds: killedSummons.map((s) => s.id),
  };
}

export function executeDashAction(unit: BattleUnit): DashActionResult {
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
  unit.movesLeft = unit.movesLeft + calculateBaseMovement(unit.speed);
  unit.conditions = applyConditionScanResult(unit.conditions, scan);

  return {
    success: true,
    newMovesLeft: unit.movesLeft,
  };
}

export function executeDodgeAction(unit: BattleUnit): DodgeActionResult {
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

// Re-exportar do shared para compatibilidade
export {
  ALL_ACTIONS as COMBAT_ACTIONS,
  DEFAULT_UNIT_ACTIONS,
  findActionByCode,
  getActionCostType,
  isBasicAction,
} from "../../../shared/data/actions.data";

export function canUnitPerformAction(
  unit: BattleUnit,
  actionId: string
): boolean {
  if (!unit.actions.includes(actionId) || !unit.isAlive) return false;
  const scan = scanConditionsForAction(unit.conditions, actionId);
  return scan.canPerform;
}

export function getAvailableActions(unit: BattleUnit): string[] {
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
  // Campos legados (opcionais para compatibilidade)
  attackerRolls?: number[];
  defenderRolls?: number[];
  attackerSuccesses?: number;
  defenderSuccesses?: number;
  // Novos campos para sistema sem dados
  attackerRoll?: number;
  attackerChance?: number;
  defenderRoll?: number;
  defenderChance?: number;
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
  helper: BattleUnit,
  target: BattleUnit
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
export function executeProtectAction(unit: BattleUnit): ProtectActionResult {
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

// =============================================================================
// AÇÕES ESPECIAIS - SISTEMA SEM DADOS
// =============================================================================
// Usam teste de 1D100 vs atributo × modificador

/**
 * Resultado de teste resistido simplificado
 */
export interface SimpleContestedResult {
  success: boolean;
  error?: string;
  attackerRoll?: number; // 1-100
  attackerChance?: number; // % de sucesso
  defenderRoll?: number; // 1-100
  defenderChance?: number; // % de resistência
}

/**
 * Executa um teste resistido simplificado (Combat vs Speed)
 * Atacante precisa rolar acima de: 50 - (Combat × 5) + (targetSpeed × 3)
 * Resultado: 1D100 < (Combat × 5) - (targetSpeed × 3) + 50
 */
function simpleContestedCheck(
  attackerCombat: number,
  targetSpeed: number
): { success: boolean; roll: number; chance: number } {
  // Chance = 50 + (Combat × 5) - (Speed × 3), clamped 5-95
  const chance = Math.min(
    95,
    Math.max(5, 50 + attackerCombat * 5 - targetSpeed * 3)
  );
  const roll = Math.floor(Math.random() * 100) + 1;
  return { success: roll <= chance, roll, chance };
}

// Derrubar: teste Combat vs Speed; aplica DERRUBADA
export function executeKnockdownAction(
  attacker: BattleUnit,
  target: BattleUnit
): SimpleContestedResult {
  if (!attacker.isAlive) {
    return { success: false, error: "Unidade morta não pode derrubar" };
  }
  if (!target.isAlive) {
    return { success: false, error: "Não pode derrubar unidade morta" };
  }

  if (!isAdjacent(attacker.posX, attacker.posY, target.posX, target.posY)) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  const result = simpleContestedCheck(attacker.combat, target.speed);

  if (result.success && !target.conditions.includes("DERRUBADA")) {
    target.conditions.push("DERRUBADA");
  }

  return {
    success: result.success,
    attackerRoll: result.roll,
    attackerChance: result.chance,
  };
}

// Desarmar: teste Combat vs Speed; aplica DISARMED
export function executeDisarmAction(
  attacker: BattleUnit,
  target: BattleUnit
): SimpleContestedResult {
  if (!attacker.isAlive) {
    return { success: false, error: "Unidade morta não pode desarmar" };
  }
  if (!target.isAlive) {
    return { success: false, error: "Não pode desarmar unidade morta" };
  }

  if (!isAdjacent(attacker.posX, attacker.posY, target.posX, target.posY)) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  const result = simpleContestedCheck(attacker.combat, target.speed);

  if (result.success && !target.conditions.includes("DISARMED")) {
    target.conditions.push("DISARMED");
  }

  return {
    success: result.success,
    attackerRoll: result.roll,
    attackerChance: result.chance,
  };
}

// Agarrar: teste Combat vs Speed; ambos ficam AGARRADO
export function executeGrabAction(
  attacker: BattleUnit,
  target: BattleUnit
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

  const result = simpleContestedCheck(attacker.combat, target.speed);

  if (result.success) {
    if (!attacker.conditions.includes("AGARRADO")) {
      attacker.conditions.push("AGARRADO");
    }
    if (!target.conditions.includes("AGARRADO")) {
      target.conditions.push("AGARRADO");
    }
  }

  return {
    success: true,
    grabbed: result.success,
  };
}

// Arremessar: usa Combat para determinar distância, dano fixo
export function executeThrowAction(
  attacker: BattleUnit,
  target: BattleUnit,
  dirX: number,
  dirY: number,
  gridWidth: number,
  gridHeight: number,
  allUnits: BattleUnit[]
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

  // Distância = Combat (mínimo 1, máximo 5)
  const distance = Math.min(5, Math.max(1, attacker.combat));
  let steps = distance;
  let finalX = target.posX;
  let finalY = target.posY;
  let collided = false;

  while (steps > 0) {
    const nx = finalX + dx;
    const ny = finalY + dy;

    if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) {
      collided = true;
      break;
    }

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

  target.posX = finalX;
  target.posY = finalY;

  // Dano = Combat do atacante
  const damage = attacker.combat;
  let attackerDamage = 0;
  let targetDamage = 0;

  if (damage > 0) {
    const attackerResult = applyDualProtectionDamage(
      attacker.physicalProtection,
      attacker.magicalProtection,
      attacker.currentHp,
      damage,
      "FISICO"
    );
    attacker.physicalProtection = attackerResult.newPhysicalProtection;
    attacker.magicalProtection = attackerResult.newMagicalProtection;
    attacker.currentHp = attackerResult.newHp;
    attackerDamage = damage;

    const targetResult = applyDualProtectionDamage(
      target.physicalProtection,
      target.magicalProtection,
      target.currentHp,
      damage,
      "FISICO"
    );
    target.physicalProtection = targetResult.newPhysicalProtection;
    target.magicalProtection = targetResult.newMagicalProtection;
    target.currentHp = targetResult.newHp;
    targetDamage = damage;

    if (attacker.currentHp <= 0) attacker.isAlive = false;
    if (target.currentHp <= 0) target.isAlive = false;
  }

  return {
    success: true,
    finalX,
    finalY,
    collided,
    attackerDamage,
    targetDamage,
  };
}

// Fuga: teste de Speed vs Speed do inimigo
export function executeFleeAction(
  unit: BattleUnit,
  nearestEnemy: BattleUnit
): FleeActionResult {
  if (!unit.isAlive) {
    return { success: false, error: "Unidade morta não pode fugir" };
  }

  // Chance = 50 + (mySpeed × 5) - (enemySpeed × 3)
  const chance = Math.min(
    95,
    Math.max(5, 50 + unit.speed * 5 - nearestEnemy.speed * 3)
  );
  const roll = Math.floor(Math.random() * 100) + 1;
  const fled = roll <= chance;

  return {
    success: true,
    fled,
  };
}

// Conjurar: sucesso baseado em Focus (sempre funciona, Focus determina potência)
export function executeCastAction(
  unit: BattleUnit,
  spellId: string
): CastActionResult {
  if (!unit.isAlive) {
    return { success: false, error: "Unidade morta não pode conjurar" };
  }

  // No novo sistema, conjurar sempre funciona
  // O Focus determina a potência do feitiço (usado pelo executor da skill)
  return {
    success: true,
    successes: unit.focus, // Focus direto como "potência"
    threshold: 0,
  };
}

// =============================================================================
// SISTEMA DE SKILLS - Re-exportar do arquivo dedicado
// =============================================================================

import { findSkillByCode } from "../../../shared/data/skills.data";
import { type SkillExecutionResult } from "../../../shared/types/skills.types";
import { validateSkillUse as sharedValidateSkillUse } from "../../../shared/utils/skill-validation";

// Re-exportar tipos e funções do skill-executors
export {
  executeSkill,
  tickUnitCooldowns,
  isOnCooldown,
  getCooldown,
  SKILL_EXECUTORS,
} from "./skill-executors";

// Re-exportar condições de skills do shared
export {
  SKILL_CONDITIONS,
  getSkillCondition,
  isSkillCondition,
} from "../../../shared/data/conditions.data";

// Alias para compatibilidade
export type SkillActionResult = SkillExecutionResult;

/**
 * Valida se a unidade pode usar uma skill
 * Wrapper que usa a validação centralizada do shared
 */
export function validateSkillUse(
  caster: BattleUnit,
  skillCode: string,
  target: BattleUnit | null,
  _isArena: boolean
): { valid: boolean; error?: string } {
  // Buscar a skill para passar à validação centralizada
  const skill = findSkillByCode(skillCode);
  if (!skill) {
    return { valid: false, error: "Skill não encontrada" };
  }

  // Usar validação centralizada do shared/utils/skill-validation.ts
  const result = sharedValidateSkillUse(caster, skill, target, {
    checkCooldown: true,
    checkActions: true,
  });

  return { valid: result.valid, error: result.error };
}

/**
 * Executa uma skill ativa
 * Delega para o sistema de skill-executors
 */
export function executeSkillAction(
  caster: BattleUnit,
  skillCode: string,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  isArena: boolean = true
): SkillActionResult {
  // Importar dinamicamente para evitar dependência circular
  const { executeSkill } = require("./skill-executors");

  // Validar uso primeiro
  const validation = validateSkillUse(caster, skillCode, target, isArena);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Delegar para o executor centralizado (passa isArena para dobrar cooldown)
  return executeSkill(caster, skillCode, target, allUnits, isArena);
}

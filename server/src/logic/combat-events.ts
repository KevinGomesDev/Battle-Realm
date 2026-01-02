// server/src/logic/combat-events.ts
// Funções para emitir eventos de combate

import {
  createCombatEvent,
  createMovementEvent,
  createTurnEvent,
  createConditionEvent,
} from "../services/event.service";
import { EVENT_CODES } from "../../../shared/types/events.types";
import type {
  CombatUnit,
  AttackActionResult,
  MoveActionResult,
} from "./combat-actions";

// =============================================================================
// EVENTOS DE ATAQUE
// =============================================================================

/**
 * Emite evento quando ataque acerta
 */
export async function emitAttackHitEvent(
  battleId: string,
  attacker: CombatUnit,
  target: CombatUnit,
  result: AttackActionResult
): Promise<void> {
  await createCombatEvent({
    battleId,
    code: EVENT_CODES.ATTACK_HIT,
    message: `${attacker.name} atacou ${target.name} causando ${result.finalDamage} de dano!`,
    severity: "DANGER",
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: target.id,
    targetName: target.name,
    data: {
      attackDiceCount: result.attackDiceCount,
      attackRolls: result.attackRolls,
      rawDamage: result.rawDamage,
      finalDamage: result.finalDamage,
      damageType: result.damageType,
      targetHpAfter: result.targetHpAfter,
      targetPhysicalProtection: result.targetPhysicalProtection,
      targetMagicalProtection: result.targetMagicalProtection,
    },
  });

  // Se derrotou
  if (result.targetDefeated) {
    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_DEFEATED,
      message: `${target.name} foi derrotado por ${attacker.name}!`,
      severity: "DANGER",
      actorId: attacker.id,
      actorName: attacker.name,
      targetId: target.id,
      targetName: target.name,
    });
  }
}

/**
 * Emite evento quando ataque erra (dodge)
 */
export async function emitAttackDodgedEvent(
  battleId: string,
  attacker: CombatUnit,
  target: CombatUnit
): Promise<void> {
  await createCombatEvent({
    battleId,
    code: EVENT_CODES.ATTACK_DODGED,
    message: `${target.name} esquivou do ataque de ${attacker.name}!`,
    severity: "SUCCESS",
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: target.id,
    targetName: target.name,
  });
}

/**
 * Emite evento quando ataque é bloqueado
 */
export async function emitAttackBlockedEvent(
  battleId: string,
  attacker: CombatUnit,
  target: CombatUnit,
  damageBlocked: number
): Promise<void> {
  await createCombatEvent({
    battleId,
    code: EVENT_CODES.ATTACK_BLOCKED,
    message: `${target.name} bloqueou ${damageBlocked} de dano!`,
    severity: "INFO",
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: target.id,
    targetName: target.name,
    data: { damageBlocked },
  });
}

// =============================================================================
// EVENTOS DE MOVIMENTO
// =============================================================================

/**
 * Emite evento de movimento
 */
export async function emitMovementEvent(
  battleId: string,
  unit: CombatUnit,
  result: MoveActionResult
): Promise<void> {
  await createMovementEvent({
    battleId,
    code: EVENT_CODES.UNIT_MOVED,
    message: `${unit.name} moveu de (${result.fromX},${result.fromY}) para (${result.toX},${result.toY})`,
    actorId: unit.id,
    actorName: unit.name,
    data: {
      fromX: result.fromX,
      fromY: result.fromY,
      toX: result.toX,
      toY: result.toY,
      moveCost: result.moveCost,
      movesLeft: result.movesLeft,
    },
  });
}

/**
 * Emite evento de dash
 */
export async function emitDashEvent(
  battleId: string,
  unit: CombatUnit,
  newMovesLeft: number
): Promise<void> {
  await createMovementEvent({
    battleId,
    code: EVENT_CODES.UNIT_DASHED,
    message: `${unit.name} usou Corrida! (+${newMovesLeft} movimento)`,
    actorId: unit.id,
    actorName: unit.name,
    data: { newMovesLeft },
  });
}

// =============================================================================
// EVENTOS DE TURNO
// =============================================================================

/**
 * Emite evento de início de batalha
 */
export async function emitBattleStartEvent(battleId: string): Promise<void> {
  await createTurnEvent({
    battleId,
    code: EVENT_CODES.BATTLE_STARTED,
    message: "⚔️ A batalha começou!",
  });
}

/**
 * Emite evento de fim de batalha
 */
export async function emitBattleEndEvent(
  battleId: string,
  winnerId: string,
  winnerName: string,
  reason: string
): Promise<void> {
  await createTurnEvent({
    battleId,
    code: EVENT_CODES.BATTLE_ENDED,
    message: `🏆 ${winnerName} venceu a batalha! (${reason})`,
    data: { winnerId, winnerName, reason },
  });
}

/**
 * Emite evento de início de rodada
 */
export async function emitRoundStartEvent(
  battleId: string,
  round: number
): Promise<void> {
  await createTurnEvent({
    battleId,
    code: EVENT_CODES.ROUND_STARTED,
    message: `📍 Rodada ${round} iniciada`,
    data: { round },
  });
}

/**
 * Emite evento de início de turno de unidade
 */
export async function emitUnitTurnStartEvent(
  battleId: string,
  unit: CombatUnit
): Promise<void> {
  await createTurnEvent({
    battleId,
    code: EVENT_CODES.UNIT_TURN_STARTED,
    message: `🎯 Turno de ${unit.name}`,
    data: {
      unitId: unit.id,
      unitName: unit.name,
      ownerId: unit.ownerId,
    },
  });
}

/**
 * Emite evento de fim de turno de unidade
 */
export async function emitUnitTurnEndEvent(
  battleId: string,
  unit: CombatUnit,
  damageFromConditions?: number,
  conditionsRemoved?: string[]
): Promise<void> {
  await createTurnEvent({
    battleId,
    code: EVENT_CODES.UNIT_TURN_ENDED,
    message: `⏹️ ${unit.name} finalizou o turno`,
    data: {
      unitId: unit.id,
      unitName: unit.name,
      ownerId: unit.ownerId,
      damageFromConditions,
      conditionsRemoved,
    },
  });
}

// =============================================================================
// EVENTOS DE CONDIÇÃO
// =============================================================================

/**
 * Emite evento quando condição é aplicada
 */
export async function emitConditionAppliedEvent(
  battleId: string,
  unit: CombatUnit,
  conditionCode: string,
  conditionName: string
): Promise<void> {
  await createConditionEvent({
    battleId,
    code: EVENT_CODES.CONDITION_APPLIED,
    message: `${unit.name} recebeu ${conditionName}`,
    severity: "WARNING",
    targetId: unit.id,
    targetName: unit.name,
    data: { conditionCode, conditionName },
  });
}

/**
 * Emite evento quando condição é removida
 */
export async function emitConditionRemovedEvent(
  battleId: string,
  unit: CombatUnit,
  conditionCode: string,
  conditionName: string
): Promise<void> {
  await createConditionEvent({
    battleId,
    code: EVENT_CODES.CONDITION_REMOVED,
    message: `${conditionName} foi removido de ${unit.name}`,
    severity: "INFO",
    targetId: unit.id,
    targetName: unit.name,
    data: { conditionCode, conditionName },
  });
}

// =============================================================================
// EVENTOS DE AÇÕES ESPECIAIS
// =============================================================================

/**
 * Emite evento de agarrar
 */
export async function emitGrabEvent(
  battleId: string,
  attacker: CombatUnit,
  target: CombatUnit,
  success: boolean
): Promise<void> {
  if (success) {
    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_GRABBED,
      message: `${attacker.name} agarrou ${target.name}!`,
      severity: "WARNING",
      actorId: attacker.id,
      actorName: attacker.name,
      targetId: target.id,
      targetName: target.name,
    });
  } else {
    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_GRABBED,
      message: `${target.name} escapou da tentativa de agarrar de ${attacker.name}`,
      severity: "INFO",
      actorId: attacker.id,
      actorName: attacker.name,
      targetId: target.id,
      targetName: target.name,
      data: { success: false },
    });
  }
}

/**
 * Emite evento de arremesso
 */
export async function emitThrowEvent(
  battleId: string,
  attacker: CombatUnit,
  target: CombatUnit,
  finalX: number,
  finalY: number,
  damage: number
): Promise<void> {
  await createCombatEvent({
    battleId,
    code: EVENT_CODES.UNIT_THROWN,
    message: `${attacker.name} arremessou ${target.name}! (${damage} dano)`,
    severity: "DANGER",
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: target.id,
    targetName: target.name,
    data: { finalX, finalY, damage },
  });
}

/**
 * Emite evento de derrubada
 */
export async function emitKnockdownEvent(
  battleId: string,
  attacker: CombatUnit,
  target: CombatUnit,
  success: boolean
): Promise<void> {
  if (success) {
    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_KNOCKED_DOWN,
      message: `${attacker.name} derrubou ${target.name}!`,
      severity: "WARNING",
      actorId: attacker.id,
      actorName: attacker.name,
      targetId: target.id,
      targetName: target.name,
    });
  }
}

/**
 * Emite evento de desarme
 */
export async function emitDisarmEvent(
  battleId: string,
  attacker: CombatUnit,
  target: CombatUnit,
  success: boolean
): Promise<void> {
  if (success) {
    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_DISARMED,
      message: `${attacker.name} desarmou ${target.name}!`,
      severity: "WARNING",
      actorId: attacker.id,
      actorName: attacker.name,
      targetId: target.id,
      targetName: target.name,
    });
  }
}

/**
 * Emite evento de ajuda
 */
export async function emitHelpEvent(
  battleId: string,
  helper: CombatUnit,
  target: CombatUnit
): Promise<void> {
  await createCombatEvent({
    battleId,
    code: EVENT_CODES.UNIT_HELPED,
    message: `${helper.name} ajudou ${target.name}!`,
    severity: "SUCCESS",
    actorId: helper.id,
    actorName: helper.name,
    targetId: target.id,
    targetName: target.name,
  });
}

/**
 * Emite evento de proteção
 */
export async function emitProtectEvent(
  battleId: string,
  unit: CombatUnit
): Promise<void> {
  await createCombatEvent({
    battleId,
    code: EVENT_CODES.UNIT_PROTECTED,
    message: `${unit.name} se protegeu!`,
    severity: "INFO",
    actorId: unit.id,
    actorName: unit.name,
  });
}

/**
 * Emite evento de fuga
 */
export async function emitFleeEvent(
  battleId: string,
  unit: CombatUnit,
  success: boolean
): Promise<void> {
  if (success) {
    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_FLED,
      message: `${unit.name} fugiu da batalha!`,
      severity: "WARNING",
      actorId: unit.id,
      actorName: unit.name,
    });
  } else {
    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_FLED,
      message: `${unit.name} tentou fugir mas não conseguiu!`,
      severity: "INFO",
      actorId: unit.id,
      actorName: unit.name,
      data: { success: false },
    });
  }
}

// server/src/logic/combat-events.ts
// Funções para emitir eventos de combate

import {
  createCombatEvent,
  createMovementEvent,
  createTurnEvent,
  createConditionEvent,
  createSkillEvent,
} from "../services/event.service";
import { EVENT_CODES } from "../../../shared/types/events.types";
import type { AttackActionResult } from "./skill-executors";
import type { MoveActionResult } from "./movement-actions";
import type { AbilityExecutionResult as SpellExecutionResult } from "../../../shared/types/ability.types";
import { BattleUnit } from "../../../shared/types/battle.types";

// =============================================================================
// EVENTOS DE SKILL
// =============================================================================

/** Dados adicionais para evento de skill */
interface SkillEventData {
  healAmount?: number;
  damageDealt?: number;
  rawDamage?: number;
  damageReduction?: number;
  conditionApplied?: string;
  dodgeChance?: number;
  dodgeRoll?: number;
  dodged?: boolean;
}

/**
 * Emite evento quando uma skill é usada
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão do caster/target
 */
export async function emitSkillUsedEvent(
  battleId: string,
  caster: BattleUnit,
  skillName: string,
  skillCode: string,
  target?: BattleUnit | null,
  data?: SkillEventData,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Construir mensagem detalhada
  let message = `⚡ ${caster.name} usou ${skillName}`;
  if (target) {
    message += ` em ${target.name}`;
  }

  // Adicionar detalhes de combate
  if (data?.damageDealt !== undefined && data.damageDealt > 0) {
    if (data.damageReduction && data.damageReduction > 0) {
      message += ` [${data.rawDamage ?? data.damageDealt} - ${
        data.damageReduction
      } redução = ${data.damageDealt} dano]`;
    } else {
      message += ` [${data.damageDealt} dano]`;
    }
  }
  if (data?.healAmount) {
    message += ` [+${data.healAmount} HP]`;
  }
  if (data?.conditionApplied) {
    message += ` [aplicou ${data.conditionApplied}]`;
  }

  // Adicionar info de esquiva se houver
  if (data?.dodgeChance !== undefined && data?.dodgeRoll !== undefined) {
    if (data.dodged) {
      message += ` (🎲 ${data.dodgeRoll} <= ${data.dodgeChance}% - ESQUIVOU)`;
    } else {
      message += ` (🎲 ${data.dodgeRoll} vs ${data.dodgeChance}%)`;
    }
  }

  message += "!";

  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [
          { x: caster.posX, y: caster.posY },
          ...(target ? [{ x: target.posX, y: target.posY }] : []),
        ],
        alwaysInclude: [caster.ownerId, ...(target ? [target.ownerId] : [])],
      }
    : undefined;

  await createSkillEvent({
    battleId,
    code: EVENT_CODES.SKILL_USED,
    message,
    severity: data?.healAmount
      ? "SUCCESS"
      : data?.damageDealt
      ? "DANGER"
      : "INFO",
    actorId: caster.id,
    actorName: caster.name,
    targetId: target?.id,
    targetName: target?.name,
    data: {
      skillCode,
      skillName,
      ...data,
    },
    visibility,
  });
}

// =============================================================================
// EVENTOS DE SPELL (MAGIA)
// =============================================================================

/**
 * Emite evento quando uma spell é conjurada
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão do caster/alvos
 */
export async function emitSpellCastEvent(
  battleId: string,
  caster: BattleUnit,
  spellName: string,
  spellCode: string,
  result: SpellExecutionResult,
  targetUnits: BattleUnit[],
  allUnits?: BattleUnit[]
): Promise<void> {
  // Construir mensagem detalhada
  let message = `🔮 ${caster.name} conjurou ${spellName}`;

  // Se tem alvos específicos, listar
  if (targetUnits.length > 0) {
    const targetNames = targetUnits.map((u) => u.name).join(", ");
    message += ` em ${targetNames}`;
  }

  // Adicionar detalhes de dano
  if (result.damageDealt !== undefined && result.damageDealt > 0) {
    if (result.damageReduction && result.damageReduction > 0) {
      message += ` [${result.rawDamage ?? result.damageDealt} - ${
        result.damageReduction
      } redução = ${result.damageDealt} dano]`;
    } else {
      message += ` [${result.damageDealt} dano total]`;
    }
  }

  // Adicionar detalhes de esquiva
  if (result.dodgeResults && result.dodgeResults.length > 0) {
    const dodged = result.dodgeResults.filter((d) => d.dodged);
    const hit = result.dodgeResults.filter((d) => !d.dodged);

    if (dodged.length > 0 && hit.length > 0) {
      // Alguns esquivaram, alguns foram atingidos
      const dodgedNames = dodged
        .map((d) => `${d.targetName} (🎲${d.dodgeRoll}≤${d.dodgeChance}%)`)
        .join(", ");
      message += ` | Esquivaram: ${dodgedNames}`;
    } else if (dodged.length > 0) {
      // Todos esquivaram
      const dodgedInfo = dodged
        .map((d) => `${d.targetName} (🎲${d.dodgeRoll}≤${d.dodgeChance}%)`)
        .join(", ");
      message += ` | TODOS ESQUIVARAM: ${dodgedInfo}`;
    } else if (hit.length === 1) {
      // Apenas um alvo e foi atingido
      const h = hit[0];
      message += ` (🎲 ${h.dodgeRoll} vs ${h.dodgeChance}%)`;
    }
  }

  // Condições aplicadas
  if (result.conditionsApplied && result.conditionsApplied.length > 0) {
    const conditionIds = [
      ...new Set(result.conditionsApplied.map((c) => c.conditionId)),
    ];
    message += ` [aplicou: ${conditionIds.join(", ")}]`;
  }

  message += "!";

  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [
          { x: caster.posX, y: caster.posY },
          ...targetUnits.map((t) => ({ x: t.posX, y: t.posY })),
        ],
        alwaysInclude: [caster.ownerId, ...targetUnits.map((t) => t.ownerId)],
      }
    : undefined;

  await createCombatEvent({
    battleId,
    code: EVENT_CODES.SPELL_CAST || "SPELL_CAST",
    message,
    severity: result.damageDealt ? "DANGER" : "INFO",
    actorId: caster.id,
    actorName: caster.name,
    targetId: targetUnits[0]?.id,
    targetName: targetUnits[0]?.name,
    data: {
      spellCode,
      spellName,
      damageDealt: result.damageDealt,
      rawDamage: result.rawDamage,
      damageReduction: result.damageReduction,
      targetIds: result.targetIds,
      dodgeResults: result.dodgeResults,
      conditionsApplied: result.conditionsApplied,
    },
    visibility,
  });
}

// =============================================================================
// EVENTOS DE ATAQUE
// =============================================================================

/**
 * Emite evento quando ataque acerta
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão do atacante/alvo
 */
export async function emitAttackHitEvent(
  battleId: string,
  attacker: BattleUnit,
  target: BattleUnit,
  result: AttackActionResult,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [
          { x: attacker.posX, y: attacker.posY },
          { x: target.posX, y: target.posY },
        ],
        alwaysInclude: [attacker.ownerId, target.ownerId],
      }
    : undefined;

  // Construir mensagem detalhada
  const damageReduction = result.damageReduction ?? 0;
  let detailMessage = `⚔️ ${attacker.name} atacou ${target.name}!`;

  // Se houve redução de dano
  if (damageReduction > 0) {
    detailMessage += ` [${result.rawDamage} - ${damageReduction} redução = ${result.finalDamage} dano]`;
  } else {
    detailMessage += ` [${result.finalDamage} dano]`;
  }

  // Info de esquiva (caso não tenha esquivado mas rolou)
  if (result.dodgeChance !== undefined && result.dodgeRoll !== undefined) {
    detailMessage += ` (🎲 ${result.dodgeRoll} vs ${result.dodgeChance}% esquiva)`;
  }

  await createCombatEvent({
    battleId,
    code: EVENT_CODES.ATTACK_HIT,
    message: detailMessage,
    severity: "DANGER",
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: target.id,
    targetName: target.name,
    data: {
      rawDamage: result.rawDamage,
      finalDamage: result.finalDamage,
      damageReduction: result.damageReduction,
      damageType: result.damageType,
      targetHpAfter: result.targetHpAfter,
      targetPhysicalProtection: result.targetPhysicalProtection,
      targetMagicalProtection: result.targetMagicalProtection,
      dodgeChance: result.dodgeChance,
      dodgeRoll: result.dodgeRoll,
    },
    visibility,
  });

  // Se derrotou
  if (result.targetDefeated) {
    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_DEFEATED,
      message: `💀 ${target.name} foi derrotado por ${attacker.name}!`,
      severity: "DANGER",
      actorId: attacker.id,
      actorName: attacker.name,
      targetId: target.id,
      targetName: target.name,
      visibility,
    });
  }
}

/**
 * Emite evento quando ataque erra (dodge)
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão do atacante/alvo
 * @param dodgeChance - Chance de esquiva do alvo
 * @param dodgeRoll - Resultado do dado de esquiva
 */
export async function emitAttackDodgedEvent(
  battleId: string,
  attacker: BattleUnit,
  target: BattleUnit,
  allUnits?: BattleUnit[],
  dodgeChance?: number,
  dodgeRoll?: number
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [
          { x: attacker.posX, y: attacker.posY },
          { x: target.posX, y: target.posY },
        ],
        alwaysInclude: [attacker.ownerId, target.ownerId],
      }
    : undefined;

  // Construir mensagem detalhada
  let detailMessage = `💨 ${target.name} esquivou do ataque de ${attacker.name}!`;
  if (dodgeChance !== undefined && dodgeRoll !== undefined) {
    detailMessage += ` (🎲 ${dodgeRoll} <= ${dodgeChance}%)`;
  }

  await createCombatEvent({
    battleId,
    code: EVENT_CODES.ATTACK_DODGED,
    message: detailMessage,
    severity: "SUCCESS",
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: target.id,
    targetName: target.name,
    data: {
      dodgeChance,
      dodgeRoll,
    },
    visibility,
  });
}

/**
 * Emite evento quando ataque é bloqueado
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão do atacante/alvo
 */
export async function emitAttackBlockedEvent(
  battleId: string,
  attacker: BattleUnit,
  target: BattleUnit,
  damageBlocked: number,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [
          { x: attacker.posX, y: attacker.posY },
          { x: target.posX, y: target.posY },
        ],
        alwaysInclude: [attacker.ownerId, target.ownerId],
      }
    : undefined;

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
    visibility,
  });
}

// =============================================================================
// EVENTOS DE MOVIMENTO
// =============================================================================

/**
 * Emite evento de movimento
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão da origem OU destino
 */
export async function emitMovementEvent(
  battleId: string,
  unit: BattleUnit,
  result: MoveActionResult,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  // Para movimento, jogador deve ver a origem OU o destino
  const positions: Array<{ x: number; y: number }> = [];
  if (result.fromX !== undefined && result.fromY !== undefined) {
    positions.push({ x: result.fromX, y: result.fromY });
  }
  if (result.toX !== undefined && result.toY !== undefined) {
    positions.push({ x: result.toX, y: result.toY });
  }

  const visibility =
    allUnits && positions.length > 0
      ? {
          allUnits,
          positions,
          alwaysInclude: [unit.ownerId], // O dono sempre vê sua unidade
        }
      : undefined;

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
    visibility,
  });
}

/**
 * Emite evento de dash
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão da unidade
 */
export async function emitDashEvent(
  battleId: string,
  unit: BattleUnit,
  newMovesLeft: number,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [{ x: unit.posX, y: unit.posY }],
        alwaysInclude: [unit.ownerId],
      }
    : undefined;

  await createMovementEvent({
    battleId,
    code: EVENT_CODES.UNIT_DASHED,
    message: `${unit.name} usou Corrida! (+${newMovesLeft} movimento)`,
    actorId: unit.id,
    actorName: unit.name,
    data: { newMovesLeft },
    visibility,
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
  unit: BattleUnit
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
  unit: BattleUnit,
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
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão da unidade
 */
export async function emitConditionAppliedEvent(
  battleId: string,
  unit: BattleUnit,
  conditionCode: string,
  conditionName: string,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [{ x: unit.posX, y: unit.posY }],
        alwaysInclude: [unit.ownerId],
      }
    : undefined;

  await createConditionEvent({
    battleId,
    code: EVENT_CODES.CONDITION_APPLIED,
    message: `${unit.name} recebeu ${conditionName}`,
    severity: "WARNING",
    targetId: unit.id,
    targetName: unit.name,
    data: { conditionCode, conditionName },
    visibility,
  });
}

/**
 * Emite evento quando condição é removida
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão da unidade
 */
export async function emitConditionRemovedEvent(
  battleId: string,
  unit: BattleUnit,
  conditionCode: string,
  conditionName: string,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [{ x: unit.posX, y: unit.posY }],
        alwaysInclude: [unit.ownerId],
      }
    : undefined;

  await createConditionEvent({
    battleId,
    code: EVENT_CODES.CONDITION_REMOVED,
    message: `${conditionName} foi removido de ${unit.name}`,
    severity: "INFO",
    targetId: unit.id,
    targetName: unit.name,
    data: { conditionCode, conditionName },
    visibility,
  });
}

// =============================================================================
// EVENTOS DE AÇÕES ESPECIAIS
// =============================================================================

/**
 * Emite evento de agarrar
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão
 */
export async function emitGrabEvent(
  battleId: string,
  attacker: BattleUnit,
  target: BattleUnit,
  success: boolean,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [
          { x: attacker.posX, y: attacker.posY },
          { x: target.posX, y: target.posY },
        ],
        alwaysInclude: [attacker.ownerId, target.ownerId],
      }
    : undefined;

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
      visibility,
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
      visibility,
    });
  }
}

/**
 * Emite evento de arremesso
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão
 */
export async function emitThrowEvent(
  battleId: string,
  attacker: BattleUnit,
  target: BattleUnit,
  finalX: number,
  finalY: number,
  damage: number,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade - considera posição inicial, final do arremesso e atacante
  const visibility = allUnits
    ? {
        allUnits,
        positions: [
          { x: attacker.posX, y: attacker.posY },
          { x: target.posX, y: target.posY },
          { x: finalX, y: finalY },
        ],
        alwaysInclude: [attacker.ownerId, target.ownerId],
      }
    : undefined;

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
    visibility,
  });
}

/**
 * Emite evento de derrubada
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão
 */
export async function emitKnockdownEvent(
  battleId: string,
  attacker: BattleUnit,
  target: BattleUnit,
  success: boolean,
  allUnits?: BattleUnit[]
): Promise<void> {
  if (success) {
    // Calcular visibilidade se unidades foram fornecidas
    const visibility = allUnits
      ? {
          allUnits,
          positions: [
            { x: attacker.posX, y: attacker.posY },
            { x: target.posX, y: target.posY },
          ],
          alwaysInclude: [attacker.ownerId, target.ownerId],
        }
      : undefined;

    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_KNOCKED_DOWN,
      message: `${attacker.name} derrubou ${target.name}!`,
      severity: "WARNING",
      actorId: attacker.id,
      actorName: attacker.name,
      targetId: target.id,
      targetName: target.name,
      visibility,
    });
  }
}

/**
 * Emite evento de desarme
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão
 */
export async function emitDisarmEvent(
  battleId: string,
  attacker: BattleUnit,
  target: BattleUnit,
  success: boolean,
  allUnits?: BattleUnit[]
): Promise<void> {
  if (success) {
    // Calcular visibilidade se unidades foram fornecidas
    const visibility = allUnits
      ? {
          allUnits,
          positions: [
            { x: attacker.posX, y: attacker.posY },
            { x: target.posX, y: target.posY },
          ],
          alwaysInclude: [attacker.ownerId, target.ownerId],
        }
      : undefined;

    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_DISARMED,
      message: `${attacker.name} desarmou ${target.name}!`,
      severity: "WARNING",
      actorId: attacker.id,
      actorName: attacker.name,
      targetId: target.id,
      targetName: target.name,
      visibility,
    });
  }
}

/**
 * Emite evento de ajuda
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão
 */
export async function emitHelpEvent(
  battleId: string,
  helper: BattleUnit,
  target: BattleUnit,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [
          { x: helper.posX, y: helper.posY },
          { x: target.posX, y: target.posY },
        ],
        alwaysInclude: [helper.ownerId, target.ownerId],
      }
    : undefined;

  await createCombatEvent({
    battleId,
    code: EVENT_CODES.UNIT_HELPED,
    message: `${helper.name} ajudou ${target.name}!`,
    severity: "SUCCESS",
    actorId: helper.id,
    actorName: helper.name,
    targetId: target.id,
    targetName: target.name,
    visibility,
  });
}

/**
 * Emite evento de proteção
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão
 */
export async function emitProtectEvent(
  battleId: string,
  unit: BattleUnit,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [{ x: unit.posX, y: unit.posY }],
        alwaysInclude: [unit.ownerId],
      }
    : undefined;

  await createCombatEvent({
    battleId,
    code: EVENT_CODES.UNIT_PROTECTED,
    message: `${unit.name} se protegeu!`,
    severity: "INFO",
    actorId: unit.id,
    actorName: unit.name,
    visibility,
  });
}

/**
 * Emite evento de fuga
 * @param allUnits - Se fornecido, emite apenas para jogadores com visão
 */
export async function emitFleeEvent(
  battleId: string,
  unit: BattleUnit,
  success: boolean,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Calcular visibilidade se unidades foram fornecidas
  const visibility = allUnits
    ? {
        allUnits,
        positions: [{ x: unit.posX, y: unit.posY }],
        alwaysInclude: [unit.ownerId],
      }
    : undefined;

  if (success) {
    await createCombatEvent({
      battleId,
      code: EVENT_CODES.UNIT_FLED,
      message: `${unit.name} fugiu da batalha!`,
      severity: "WARNING",
      actorId: unit.id,
      actorName: unit.name,
      visibility,
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
      visibility,
    });
  }
}

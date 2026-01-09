// server/src/logic/combat-events.ts
// Funções para emitir eventos de combate

import {
  createCombatEvent,
  createMovementEvent,
  createTurnEvent,
  createConditionEvent,
  createSkillEvent,
} from "../match/services/event.service";
import { EVENT_CODES } from "@boundless/shared/types/events.types";
import type { AttackActionResult } from "../abilities/executors";
import type { MoveActionResult } from "./movement-actions";
import type {
  AbilityExecutionResult,
  AbilityDefinition,
} from "@boundless/shared/types/ability.types";
import { BattleUnit } from "@boundless/shared/types/battle.types";
import { getConditionInfo } from "@boundless/shared/data/conditions.data";

// Alias para compatibilidade
type SpellExecutionResult = AbilityExecutionResult;

// =============================================================================
// EVENTOS GENÉRICOS DE ABILITY
// =============================================================================

/**
 * Determina a severidade do evento baseado no resultado
 */
function getSeverityFromResult(
  result: AbilityExecutionResult
): "INFO" | "SUCCESS" | "WARNING" | "DANGER" | "NEUTRAL" {
  // Se causou dano ou derrotou alvo
  if (result.damageDealt && result.damageDealt > 0) return "DANGER";
  if (result.targetDefeated) return "DANGER";
  if (result.affectedUnits?.some((u) => u.damage > 0)) return "DANGER";

  // Se curou ou ganhou recursos
  if (result.healAmount && result.healAmount > 0) return "SUCCESS";
  if (result.movementGained && result.movementGained > 0) return "SUCCESS";
  if (result.actionsGained && result.actionsGained > 0) return "SUCCESS";

  // Se aplicou condição
  if (
    result.conditionApplied ||
    (result.conditionsApplied && result.conditionsApplied.length > 0)
  ) {
    return "WARNING";
  }

  return "INFO";
}

/**
 * Constrói uma mensagem detalhada baseada no resultado da ability
 */
function buildAbilityResultMessage(
  ability: AbilityDefinition,
  caster: BattleUnit,
  target: BattleUnit | null,
  result: AbilityExecutionResult
): string {
  const parts: string[] = [];

  // Ícone baseado no tipo de efeito
  const effectIcons: Record<string, string> = {
    OFFENSIVE: "⚔️",
    DEFENSIVE: "🛡️",
    HEALING: "💚",
    BUFF: "✨",
    DEBUFF: "💀",
    UTILITY: "⚡",
  };
  const icon = ability.effectType
    ? effectIcons[ability.effectType] || "⚡"
    : "⚡";

  // Mensagem principal
  parts.push(`${icon} ${caster.name} usou ${ability.name}`);

  // Alvo (se houver)
  if (target) {
    parts.push(`em ${target.name}`);
  }

  // Construir detalhes entre colchetes
  const details: string[] = [];

  // Dano
  if (result.damageDealt !== undefined && result.damageDealt > 0) {
    if (result.damageReduction && result.damageReduction > 0) {
      const raw = result.rawDamage ?? result.damageDealt;
      details.push(
        `${raw} - ${result.damageReduction} redução = ${result.damageDealt} dano`
      );
    } else {
      details.push(`${result.damageDealt} dano`);
    }
  }

  // Cura
  if (result.healAmount && result.healAmount > 0) {
    details.push(`+${result.healAmount} HP`);
  }

  // Movimento ganho
  if (result.movementGained && result.movementGained > 0) {
    details.push(`+${result.movementGained} movimento`);
  }

  // Ações ganhas
  if (result.actionsGained && result.actionsGained > 0) {
    details.push(`+${result.actionsGained} ação`);
  }

  // Condições aplicadas
  if (result.conditionApplied) {
    const condInfo = getConditionInfo(result.conditionApplied);
    details.push(`aplicou ${condInfo.name}`);
  } else if (result.conditionsApplied && result.conditionsApplied.length > 0) {
    const uniqueConditions = [
      ...new Set(result.conditionsApplied.map((c) => c.conditionId)),
    ];
    const names = uniqueConditions.map((id) => getConditionInfo(id).name);
    details.push(`aplicou ${names.join(", ")}`);
  }

  // Condições removidas
  if (result.conditionRemoved) {
    const condInfo = getConditionInfo(result.conditionRemoved);
    details.push(`removeu ${condInfo.name}`);
  } else if (result.conditionsRemoved && result.conditionsRemoved.length > 0) {
    const uniqueConditions = [
      ...new Set(result.conditionsRemoved.map((c) => c.conditionId)),
    ];
    const names = uniqueConditions.map((id) => getConditionInfo(id).name);
    details.push(`removeu ${names.join(", ")}`);
  }

  // Teleporte/Movimento forçado
  if (result.newPosX !== undefined && result.newPosY !== undefined) {
    details.push(`moveu para (${result.newPosX}, ${result.newPosY})`);
  }

  // Unidades afetadas por área
  if (result.affectedUnits && result.affectedUnits.length > 0) {
    const totalDamage = result.affectedUnits.reduce(
      (sum, u) => sum + u.damage,
      0
    );
    const defeated = result.affectedUnits.filter((u) => u.defeated).length;
    if (totalDamage > 0) {
      details.push(
        `${totalDamage} dano total em ${result.affectedUnits.length} alvos`
      );
    }
    if (defeated > 0) {
      details.push(`${defeated} derrotado(s)`);
    }
  }

  // Alvo derrotado (single target)
  if (result.targetDefeated && target) {
    details.push(`${target.name} derrotado!`);
  }

  // Obstáculo destruído
  if (result.obstacleDestroyed) {
    details.push("obstáculo destruído");
  }

  // Construir mensagem final
  let message = parts.join(" ");
  if (details.length > 0) {
    message += ` [${details.join(" | ")}]`;
  }
  message += "!";

  return message;
}

/**
 * Emite evento detalhado quando uma ability é executada com sucesso
 * @param battleId - ID da batalha
 * @param ability - Definição da ability executada
 * @param caster - Unidade que executou
 * @param target - Alvo (se houver)
 * @param result - Resultado da execução
 * @param allUnits - Todas as unidades (para calcular visibilidade)
 */
export async function emitAbilityExecutedEvent(
  battleId: string,
  ability: AbilityDefinition,
  caster: BattleUnit,
  target: BattleUnit | null,
  result: AbilityExecutionResult,
  allUnits?: BattleUnit[]
): Promise<void> {
  // Construir mensagem detalhada
  const message = buildAbilityResultMessage(ability, caster, target, result);
  const severity = getSeverityFromResult(result);

  // Calcular visibilidade
  const positions: Array<{ x: number; y: number }> = [
    { x: caster.posX, y: caster.posY },
  ];
  const alwaysInclude: string[] = [caster.ownerId];

  if (target) {
    positions.push({ x: target.posX, y: target.posY });
    if (!alwaysInclude.includes(target.ownerId)) {
      alwaysInclude.push(target.ownerId);
    }
  }

  // Adicionar posições de unidades afetadas
  if (result.affectedUnits && allUnits) {
    for (const affected of result.affectedUnits) {
      const unit = allUnits.find((u) => u.id === affected.unitId);
      if (unit) {
        positions.push({ x: unit.posX, y: unit.posY });
        if (!alwaysInclude.includes(unit.ownerId)) {
          alwaysInclude.push(unit.ownerId);
        }
      }
    }
  }

  // Adicionar posição de teleporte
  if (result.newPosX !== undefined && result.newPosY !== undefined) {
    positions.push({ x: result.newPosX, y: result.newPosY });
  }

  const visibility = allUnits
    ? { allUnits, positions, alwaysInclude }
    : undefined;

  // Determinar categoria baseada no tipo de ability
  const category = ability.category === "SPELL" ? "SKILL" : "SKILL";

  await createSkillEvent({
    battleId,
    code:
      ability.category === "SPELL"
        ? EVENT_CODES.SPELL_CAST
        : EVENT_CODES.SKILL_USED,
    message,
    severity,
    actorId: caster.id,
    actorName: caster.name,
    targetId: target?.id,
    targetName: target?.name,
    data: {
      abilityCode: ability.code,
      abilityName: ability.name,
      abilityCategory: ability.category,
      effectType: ability.effectType,
      ...result,
    },
    visibility,
  });
}

// =============================================================================
// EVENTOS DE SKILL (Legado - mantido para compatibilidade)
// =============================================================================

/** Dados adicionais para evento de skill */
interface SkillEventData {
  healAmount?: number;
  damageDealt?: number;
  rawDamage?: number;
  damageReduction?: number;
  conditionApplied?: string;
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
      dodgeResults: (result as any).dodgeResults,
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

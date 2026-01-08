// server/src/qte/qte-processor.ts
// Processamento de respostas e resultados de QTE

import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type {
  QTEConfig,
  QTEResponse,
  QTEResult,
  QTEResultGrade,
  DodgeDirection,
} from "@boundless/shared/qte";
import {
  DIRECTION_DELTAS,
  OPPOSITE_DIRECTION,
  QTE_FEEDBACK_COLORS,
  QTE_FEEDBACK_MESSAGES,
  QTE_DAMAGE_MULTIPLIERS,
  PERFECT_DODGE_BUFF,
} from "@boundless/shared/qte";

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * Determina o grau do resultado baseado na posição do hit
 */
export function determineResultGrade(
  hitPosition: number,
  hitZoneStart: number,
  hitZoneEnd: number,
  perfectZoneStart: number,
  perfectZoneEnd: number,
  timedOut: boolean
): QTEResultGrade {
  if (timedOut) return "FAIL";

  // Verificar se está na zona perfeita
  if (hitPosition >= perfectZoneStart && hitPosition <= perfectZoneEnd) {
    return "PERFECT";
  }

  // Verificar se está na zona de acerto
  if (hitPosition >= hitZoneStart && hitPosition <= hitZoneEnd) {
    return "HIT";
  }

  return "FAIL";
}

/**
 * Calcula as zonas baseado no tamanho
 * A zona fica no centro (posição 50%)
 */
export function calculateZones(
  hitZoneSize: number,
  perfectZoneSize: number
): {
  hitZoneStart: number;
  hitZoneEnd: number;
  perfectZoneStart: number;
  perfectZoneEnd: number;
} {
  const center = 50;
  const hitZoneStart = center - hitZoneSize / 2;
  const hitZoneEnd = center + hitZoneSize / 2;
  const perfectZoneStart = center - perfectZoneSize / 2;
  const perfectZoneEnd = center + perfectZoneSize / 2;

  return { hitZoneStart, hitZoneEnd, perfectZoneStart, perfectZoneEnd };
}

// =============================================================================
// PROCESSAMENTO DE RESPOSTAS
// =============================================================================

/**
 * Processa a resposta do QTE de ATAQUE
 */
export function processAttackQTEResponse(
  config: QTEConfig,
  response: QTEResponse | null
): QTEResult {
  const timedOut = !response || response.input === "NONE";
  const hitPosition = response?.hitPosition ?? 0;

  const zones = calculateZones(config.hitZoneSize, config.perfectZoneSize);
  const grade = determineResultGrade(
    hitPosition,
    zones.hitZoneStart,
    zones.hitZoneEnd,
    zones.perfectZoneStart,
    zones.perfectZoneEnd,
    timedOut
  );

  // Modificador de dano baseado no resultado
  let damageModifier: number;
  switch (grade) {
    case "PERFECT":
      damageModifier = QTE_DAMAGE_MULTIPLIERS.attackPerfect;
      break;
    case "HIT":
      damageModifier = QTE_DAMAGE_MULTIPLIERS.attackHit;
      break;
    case "FAIL":
    default:
      damageModifier = QTE_DAMAGE_MULTIPLIERS.attackFail;
      break;
  }

  const messages = QTE_FEEDBACK_MESSAGES.ATTACK;
  const colors = QTE_FEEDBACK_COLORS;

  return {
    qteId: config.qteId,
    battleId: config.battleId,
    grade,
    actionType: "ATTACK",
    responderId: config.responderId,
    damageModifier,
    feedbackMessage: messages[grade],
    feedbackColor: colors[grade],
    timedOut,
  };
}

/**
 * Processa a resposta do QTE de DEFESA
 */
export function processDefenseQTEResponse(
  config: QTEConfig,
  response: QTEResponse | null,
  allUnits: BattleUnit[]
): QTEResult {
  const timedOut = !response || response.input === "NONE";
  const input = response?.input ?? "NONE";
  const hitPosition = response?.hitPosition ?? 0;

  const zones = calculateZones(config.hitZoneSize, config.perfectZoneSize);

  // Determinar se é bloqueio ou esquiva
  const isBlock = input === "E";
  const isDodge = ["W", "A", "S", "D"].includes(input);

  // Se não apertou nada ou apertou a direção do ataque
  const isInvalidInput =
    timedOut || (config.invalidInputs?.includes(input) && isDodge);

  // === BLOQUEIO ===
  if (isBlock) {
    const grade = determineResultGrade(
      hitPosition,
      zones.hitZoneStart,
      zones.hitZoneEnd,
      zones.perfectZoneStart,
      zones.perfectZoneEnd,
      timedOut
    );

    let damageReductionModifier: number;
    switch (grade) {
      case "PERFECT":
        damageReductionModifier = QTE_DAMAGE_MULTIPLIERS.blockPerfect;
        break;
      case "HIT":
        damageReductionModifier = QTE_DAMAGE_MULTIPLIERS.blockHit;
        break;
      case "FAIL":
      default:
        damageReductionModifier = QTE_DAMAGE_MULTIPLIERS.blockFail;
        break;
    }

    const messages = QTE_FEEDBACK_MESSAGES.BLOCK;
    const colors = QTE_FEEDBACK_COLORS;

    return {
      qteId: config.qteId,
      battleId: config.battleId,
      grade,
      actionType: "BLOCK",
      responderId: config.responderId,
      damageModifier: 1.0,
      damageReductionModifier,
      dodgeSuccessful: false,
      feedbackMessage: messages[grade],
      feedbackColor: colors[grade],
      timedOut,
    };
  }

  // === ESQUIVA ===
  if (isDodge && !isInvalidInput) {
    const grade = determineResultGrade(
      hitPosition,
      zones.hitZoneStart,
      zones.hitZoneEnd,
      zones.perfectZoneStart,
      zones.perfectZoneEnd,
      false
    );

    // Mapear input para direção
    const inputToDirection: Record<string, DodgeDirection> = {
      W: "UP",
      S: "DOWN",
      A: "LEFT",
      D: "RIGHT",
    };
    const dodgeDirection = inputToDirection[input];

    // Calcular nova posição
    const delta = DIRECTION_DELTAS[dodgeDirection];

    // Verificar se a célula está bloqueada
    const defender = allUnits.find((u) => u.id === config.responderId);
    if (!defender) {
      // Fallback se não encontrar defensor
      return {
        qteId: config.qteId,
        battleId: config.battleId,
        grade: "FAIL",
        actionType: "DODGE",
        responderId: config.responderId,
        damageModifier: 1.0,
        dodgeSuccessful: false,
        feedbackMessage: "Erro: Unidade não encontrada",
        feedbackColor: QTE_FEEDBACK_COLORS.FAIL,
        timedOut: true,
      };
    }

    const newX = defender.posX + delta.dx;
    const newY = defender.posY + delta.dy;

    const isCellBlocked = config.blockedCells?.some(
      (c) => c.x === newX && c.y === newY
    );

    if (isCellBlocked) {
      // Tentou esquivar para célula bloqueada
      return {
        qteId: config.qteId,
        battleId: config.battleId,
        grade: "FAIL",
        actionType: "DODGE",
        responderId: config.responderId,
        damageModifier: 1.0,
        dodgeSuccessful: false,
        dodgeDirection,
        feedbackMessage: "Caminho Bloqueado!",
        feedbackColor: QTE_FEEDBACK_COLORS.FAIL,
        timedOut: false,
      };
    }

    // Esquiva bem-sucedida
    const dodgeSuccessful = grade !== "FAIL";

    // Verificar se projétil continua (alguém atrás?)
    let projectileContinues = false;
    let nextTargetId: string | undefined;

    if (dodgeSuccessful && config.attackDirection) {
      // Projétil continua na direção original do ataque
      // Direção oposta à direção do ataque (projetil vem de onde o atacante estava)
      const projectileDirection = OPPOSITE_DIRECTION[config.attackDirection];
      const projectileDelta = DIRECTION_DELTAS[projectileDirection];

      // Verificar se há unidade na trajetória
      const checkX = defender.posX + projectileDelta.dx;
      const checkY = defender.posY + projectileDelta.dy;

      const unitBehind = allUnits.find(
        (u) =>
          u.isAlive &&
          u.id !== defender.id &&
          u.posX === checkX &&
          u.posY === checkY
      );

      if (unitBehind) {
        projectileContinues = true;
        nextTargetId = unitBehind.id;
      }
    }

    const messages = QTE_FEEDBACK_MESSAGES.DODGE;
    const colors = QTE_FEEDBACK_COLORS;

    return {
      qteId: config.qteId,
      battleId: config.battleId,
      grade,
      actionType: "DODGE",
      responderId: config.responderId,
      damageModifier: dodgeSuccessful ? 0 : 1.0,
      dodgeSuccessful,
      dodgeDirection,
      newPosition: dodgeSuccessful ? { x: newX, y: newY } : undefined,
      projectileContinues,
      nextTargetId,
      perfectDodgeBuff: grade === "PERFECT" ? PERFECT_DODGE_BUFF : undefined,
      feedbackMessage: messages[grade],
      feedbackColor: colors[grade],
      timedOut: false,
    };
  }

  // === FALHA (timeout ou input inválido) ===
  const messages = QTE_FEEDBACK_MESSAGES.DODGE;

  return {
    qteId: config.qteId,
    battleId: config.battleId,
    grade: "FAIL",
    actionType: "DODGE",
    responderId: config.responderId,
    damageModifier: 1.0,
    dodgeSuccessful: false,
    feedbackMessage: isInvalidInput
      ? "Correu de Encontro ao Golpe!"
      : messages.FAIL,
    feedbackColor: QTE_FEEDBACK_COLORS.FAIL,
    timedOut,
  };
}

// =============================================================================
// APLICAÇÃO DE RESULTADOS
// =============================================================================

/**
 * Aplica o resultado do QTE de ataque ao dano
 */
export function applyAttackQTEResult(
  baseDamage: number,
  result: QTEResult
): number {
  return Math.round(baseDamage * result.damageModifier);
}

/**
 * Aplica o resultado do QTE de defesa ao dano
 */
export function applyDefenseQTEResult(
  baseDamage: number,
  result: QTEResult
): {
  finalDamage: number;
  dodged: boolean;
  newPosition?: { x: number; y: number };
} {
  if (result.dodgeSuccessful) {
    return {
      finalDamage: 0,
      dodged: true,
      newPosition: result.newPosition,
    };
  }

  const modifier = result.damageReductionModifier ?? 1.0;
  return {
    finalDamage: Math.round(baseDamage * modifier),
    dodged: false,
  };
}

/**
 * Aplica o buff de esquiva perfeita
 */
export function applyPerfectDodgeBuff(
  unit: BattleUnit,
  result: QTEResult
): void {
  if (
    result.perfectDodgeBuff &&
    !unit.conditions.includes(result.perfectDodgeBuff)
  ) {
    unit.conditions.push(result.perfectDodgeBuff);
  }
}

/**
 * Move a unidade após esquiva bem-sucedida
 */
export function applyDodgeMovement(unit: BattleUnit, result: QTEResult): void {
  if (result.dodgeSuccessful && result.newPosition) {
    unit.posX = result.newPosition.x;
    unit.posY = result.newPosition.y;
  }
}

// server/src/qte/qte-calculator.ts
// Calculadora de parâmetros do QTE baseado em atributos
// FONTE DE VERDADE para cálculos de QTE no servidor

import type {
  BattleUnit,
  BattleObstacle,
} from "@boundless/shared/types/battle.types";
import type {
  QTEConfig,
  QTEResponse,
  QTEResult,
  QTEResultGrade,
  DodgeDirection,
  QTEInput,
  QTECalculationConfig,
} from "@boundless/shared/qte";
import {
  DIRECTION_DELTAS,
  OPPOSITE_DIRECTION,
  QTE_FEEDBACK_COLORS,
  QTE_FEEDBACK_MESSAGES,
  QTE_FUTURE_DELAY,
  QTE_TIMEOUT_BUFFER,
  QTE_DEFAULT_CONFIG,
  QTE_DAMAGE_MULTIPLIERS,
  PERFECT_DODGE_BUFF,
} from "@boundless/shared/qte";

/**
 * Gera um ID único simples para QTE
 */
export function generateQTEId(): string {
  return "qte-" + Math.random().toString(36).substring(2, 15);
}

// =============================================================================
// FUNÇÕES DE CÁLCULO DE ATRIBUTOS
// =============================================================================

/**
 * Calcula a direção do ataque baseado nas posições
 */
export function calculateAttackDirection(
  attackerX: number,
  attackerY: number,
  targetX: number,
  targetY: number
): DodgeDirection {
  const dx = targetX - attackerX;
  const dy = targetY - attackerY;

  // Prioriza a maior diferença
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "RIGHT" : "LEFT";
  } else {
    return dy > 0 ? "DOWN" : "UP";
  }
}

/**
 * Calcula a duração do QTE baseado no duelo de Speed
 * Atacante mais rápido = QTE mais rápido para o defensor
 * Defensor mais rápido = QTE mais lento (mais tempo para reagir)
 */
export function calculateQTEDuration(
  attackerSpeed: number,
  defenderSpeed: number,
  config: QTECalculationConfig = QTE_DEFAULT_CONFIG
): number {
  const speedDelta = attackerSpeed - defenderSpeed;
  // Positivo = atacante mais rápido = menos tempo
  const duration = config.baseDuration - speedDelta * config.speedDurationMod;

  // Retorna duração calculada sem limites, apenas garante mínimo de 100ms para ser jogável
  return Math.max(100, Math.round(duration));
}

/**
 * Calcula a intensidade do shake baseado no duelo de poder
 * Físico: Combat vs Resistance
 * Mágico: Focus vs Will
 */
export function calculateShakeIntensity(
  attackerPower: number,
  defenderDefense: number,
  config: QTECalculationConfig = QTE_DEFAULT_CONFIG
): number {
  const powerDelta = attackerPower - defenderDefense;
  // Se defensor é mais forte, não treme
  if (powerDelta <= 0) return 0;

  const intensity =
    config.baseShakeIntensity + powerDelta * config.combatShakeMod;
  return Math.min(100, Math.round(intensity)); // Cap em 100
}

/**
 * Calcula o tamanho da zona de acerto baseado no duelo de Focus
 * Atacante: Focus aumenta zona (mira melhor)
 * Defensor: Focus diminui zona (lê a intenção e se posiciona melhor)
 */
export function calculateHitZoneSize(
  attackerFocus: number,
  defenderFocus: number,
  config: QTECalculationConfig = QTE_DEFAULT_CONFIG
): number {
  // Para ATAQUE: atacante quer zona grande
  // Focus do atacante aumenta, Focus do defensor diminui
  const focusDelta = attackerFocus - defenderFocus;
  const hitZone = config.baseHitZone + focusDelta * config.focusZoneMod;

  // Retorna zona calculada sem limites, apenas garante mínimo de 1% para ser visível
  return Math.max(1, Math.round(hitZone));
}

/**
 * Calcula o tamanho da zona de acerto para DEFESA
 * Defensor: Focus aumenta zona (lê melhor o ataque)
 * Atacante: Focus diminui zona (esconde intenção)
 */
export function calculateDefenseHitZoneSize(
  defenderFocus: number,
  attackerFocus: number,
  config: QTECalculationConfig = QTE_DEFAULT_CONFIG
): number {
  const focusDelta = defenderFocus - attackerFocus;
  const hitZone = config.baseHitZone + focusDelta * config.focusZoneMod;

  // Retorna zona calculada sem limites, apenas garante mínimo de 1% para ser visível
  return Math.max(1, Math.round(hitZone));
}

/**
 * Calcula células bloqueadas para esquiva
 */
export function calculateBlockedCells(
  unitX: number,
  unitY: number,
  allUnits: BattleUnit[],
  obstacles: BattleObstacle[],
  gridWidth: number,
  gridHeight: number
): { x: number; y: number }[] {
  const blockedCells: { x: number; y: number }[] = [];
  const directions = [
    { dx: 0, dy: -1 }, // UP
    { dx: 0, dy: 1 }, // DOWN
    { dx: -1, dy: 0 }, // LEFT
    { dx: 1, dy: 0 }, // RIGHT
  ];

  for (const { dx, dy } of directions) {
    const newX = unitX + dx;
    const newY = unitY + dy;

    // Fora do grid
    if (newX < 0 || newX >= gridWidth || newY < 0 || newY >= gridHeight) {
      blockedCells.push({ x: newX, y: newY });
      continue;
    }

    // Ocupado por outra unidade viva
    const unitInCell = allUnits.find(
      (u) => u.isAlive && u.posX === newX && u.posY === newY
    );
    if (unitInCell) {
      blockedCells.push({ x: newX, y: newY });
      continue;
    }

    // Ocupado por obstáculo não destruído
    const obstacleInCell = obstacles.find(
      (o) => !o.destroyed && o.posX === newX && o.posY === newY
    );
    if (obstacleInCell) {
      blockedCells.push({ x: newX, y: newY });
    }
  }

  return blockedCells;
}

/**
 * Converte direção bloqueada para input inválido
 */
function directionToInput(direction: DodgeDirection): QTEInput {
  const map: Record<DodgeDirection, QTEInput> = {
    UP: "W",
    DOWN: "S",
    LEFT: "A",
    RIGHT: "D",
  };
  return map[direction];
}

// =============================================================================
// GERAÇÃO DE QTE CONFIG
// =============================================================================

/**
 * Gera configuração de QTE para ATAQUE
 * O atacante faz o QTE para determinar a qualidade do golpe
 *
 * @param serverTime - Tempo atual do servidor (this.clock.currentTime)
 */
export function generateAttackQTE(
  attacker: BattleUnit,
  target: BattleUnit,
  battleId: string,
  isMagicAttack: boolean = false,
  serverTime: number = Date.now()
): QTEConfig {
  // Para ataque, o atacante é quem responde
  // Velocidade do alvo afeta a dificuldade (alvo rápido = menos tempo)
  const duration = calculateQTEDuration(target.speed, attacker.speed);

  // Shake baseado na resistência do alvo
  const defenderDefense = isMagicAttack ? target.will : target.resistance;
  const attackerPower = isMagicAttack ? attacker.focus : attacker.combat;
  const shakeIntensity = calculateShakeIntensity(
    attackerPower,
    defenderDefense
  );

  // Zona de acerto baseada em Focus vs Focus do alvo
  const hitZoneSize = calculateHitZoneSize(attacker.focus, target.focus);
  const perfectZoneSize = Math.round(
    hitZoneSize * QTE_DEFAULT_CONFIG.perfectZoneRatio
  );

  // Calcular timestamps com delay para sincronização
  const serverStartTime = serverTime + QTE_FUTURE_DELAY;
  const serverEndTime = serverStartTime + duration;

  return {
    qteId: generateQTEId(),
    actionType: "ATTACK",
    battleId,
    responderId: attacker.id, // Atacante faz o QTE
    responderOwnerId: attacker.ownerId, // Para validação no cliente
    attackerId: attacker.id,
    targetId: target.id,
    duration,
    shakeIntensity,
    hitZoneSize,
    perfectZoneSize,
    startPosition: 0,
    validInputs: ["E"], // Apenas E para ataque
    createdAt: serverTime,
    serverStartTime,
    serverEndTime,
    expiresAt: serverEndTime + QTE_TIMEOUT_BUFFER, // Compatibilidade
  };
}

/**
 * Gera configuração de QTE para DEFESA (Bloqueio ou Esquiva)
 * O defensor escolhe entre E (bloqueio) ou WASD (esquiva)
 *
 * @param serverTime - Tempo atual do servidor (this.clock.currentTime)
 */
export function generateDefenseQTE(
  attacker: BattleUnit,
  defender: BattleUnit,
  battleId: string,
  allUnits: BattleUnit[],
  obstacles: BattleObstacle[],
  gridWidth: number,
  gridHeight: number,
  isMagicAttack: boolean = false,
  isCascade: boolean = false,
  serverTime: number = Date.now()
): QTEConfig {
  // Direção do ataque (para determinar input inválido na esquiva)
  const attackDirection = calculateAttackDirection(
    attacker.posX,
    attacker.posY,
    defender.posX,
    defender.posY
  );

  // Duração baseada na velocidade do atacante vs defensor
  const duration = calculateQTEDuration(attacker.speed, defender.speed);

  // Shake baseado no poder do atacante vs defesa
  const attackerPower = isMagicAttack ? attacker.focus : attacker.combat;
  const defenderDefense = isMagicAttack ? defender.will : defender.resistance;
  const shakeIntensity = calculateShakeIntensity(
    attackerPower,
    defenderDefense
  );

  // Zona de acerto para defesa
  const hitZoneSize = calculateDefenseHitZoneSize(
    defender.focus,
    attacker.focus
  );
  const perfectZoneSize = Math.round(
    hitZoneSize * QTE_DEFAULT_CONFIG.perfectZoneRatio
  );

  // Células bloqueadas para esquiva
  const blockedCells = calculateBlockedCells(
    defender.posX,
    defender.posY,
    allUnits,
    obstacles,
    gridWidth,
    gridHeight
  );

  // Input inválido = direção DE ONDE o ataque vem (correr de encontro ao golpe)
  // Se o ataque vai para RIGHT, ele vem de LEFT, então LEFT (A) é inválido
  const attackOriginDirection = OPPOSITE_DIRECTION[attackDirection];
  const invalidInputs: QTEInput[] = [directionToInput(attackOriginDirection)];

  // Adicionar inputs bloqueados por obstáculos/unidades
  for (const [direction, delta] of Object.entries(DIRECTION_DELTAS) as [
    DodgeDirection,
    { dx: number; dy: number }
  ][]) {
    const targetX = defender.posX + delta.dx;
    const targetY = defender.posY + delta.dy;

    const isBlocked = blockedCells.some(
      (c) => c.x === targetX && c.y === targetY
    );
    if (isBlocked && !invalidInputs.includes(directionToInput(direction))) {
      invalidInputs.push(directionToInput(direction));
    }
  }

  // Calcular timestamps com delay para sincronização
  const serverStartTime = serverTime + QTE_FUTURE_DELAY;
  const serverEndTime = serverStartTime + duration;

  return {
    qteId: generateQTEId(),
    actionType: "DODGE", // Pode ser BLOCK ou DODGE dependendo do input
    battleId,
    responderId: defender.id,
    responderOwnerId: defender.ownerId, // Para validação no cliente
    attackerId: attacker.id,
    targetId: defender.id,
    attackDirection,
    duration,
    shakeIntensity,
    hitZoneSize,
    perfectZoneSize,
    startPosition: 0,
    validInputs: ["E", "W", "A", "S", "D"], // Todos os inputs são válidos
    invalidInputs,
    targetPosition: { x: defender.posX, y: defender.posY },
    blockedCells,
    createdAt: serverTime,
    serverStartTime,
    serverEndTime,
    expiresAt: serverEndTime + QTE_TIMEOUT_BUFFER, // Compatibilidade
    isCascade,
  };
}

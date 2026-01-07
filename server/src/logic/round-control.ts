// server/src/logic/round-control.ts
// =============================================================================
// ROUND CONTROL - Sistema de utilidades para controle de rodadas e turnos
// =============================================================================
// Este módulo contém funções puras para:
// - Processamento de efeitos de início/fim de turno
// - Processamento de condições que expiram
// - Verificação de condições de vitória
// =============================================================================
// NOTA: A lógica principal de turnos está nas Colyseus Rooms (ArenaRoom, MatchRoom)
// Este módulo fornece funções auxiliares reutilizáveis.
// =============================================================================

import type { BattleUnit } from "../utils/battle-unit.factory";
import { CONDITIONS, removeNextTurnConditions } from "./conditions";
import { getMaxMarksByCategory } from "../utils/battle.utils";
import { tickUnitCooldowns } from "./skill-executors";

// =============================================================================
// TIPOS
// =============================================================================

export interface TurnEndResult {
  unitUpdated: BattleUnit;
  conditionsRemoved: string[];
  damageFromConditions: number;
  unitDefeated: boolean;
}

export interface RoundAdvanceResult {
  newRound: number;
  roundAdvanced: boolean;
  allUnitsProcessed: BattleUnit[];
  unitsDefeatedByConditions: string[];
}

export interface TurnTransitionResult {
  previousPlayerId: string;
  nextPlayerId: string;
  previousTurnIndex: number;
  nextTurnIndex: number;
  roundAdvanced: boolean;
  newRound: number;
}

export interface VictoryCheckResult {
  battleEnded: boolean;
  winnerId: string | null;
  winnerKingdomId: string | null;
  reason: string;
}

export interface ExhaustionCheckResult {
  allExhausted: boolean;
  winnerId: string | null;
  winnerKingdomId: string | null;
}

// =============================================================================
// PROCESSAMENTO DE CONDIÇÕES NO FIM DO TURNO
// =============================================================================

/**
 * Processa efeitos de condições que ocorrem no fim do turno de uma unidade.
 * Isso inclui:
 * - Dano de condições como QUEIMANDO (BURNING)
 * - Remoção de condições que expiram em "end_of_turn"
 * - Remoção de condições temporárias como DERRUBADA (knocked down) e DODGING
 */
export function processUnitTurnEndConditions(unit: BattleUnit): TurnEndResult {
  let damageFromConditions = 0;
  const conditionsRemoved: string[] = [];
  const conditionsToRemove: string[] = [];

  // 1. Processar dano de condições
  for (const condId of unit.conditions) {
    const condition = CONDITIONS[condId];
    if (!condition) continue;

    // Aplicar dano de condições (BURNING, POISON, etc.)
    if (condition.effects.damagePerTurn) {
      damageFromConditions += condition.effects.damagePerTurn;
    }

    // Marcar condições que expiram no fim do turno
    if (condition.expiry === "end_of_turn") {
      conditionsToRemove.push(condId);
    }
  }

  // 2. Remover condições específicas que sempre saem no fim do turno
  const alwaysRemoveAtTurnEnd = ["DERRUBADA", "DODGING"];
  for (const condId of alwaysRemoveAtTurnEnd) {
    if (
      unit.conditions.includes(condId) &&
      !conditionsToRemove.includes(condId)
    ) {
      conditionsToRemove.push(condId);
    }
  }

  // 3. Aplicar dano
  if (damageFromConditions > 0) {
    unit.currentHp = Math.max(0, unit.currentHp - damageFromConditions);
    if (unit.currentHp <= 0) {
      unit.isAlive = false;
    }
  }

  // 4. Remover condições
  for (const condId of conditionsToRemove) {
    if (unit.conditions.includes(condId)) {
      conditionsRemoved.push(condId);
    }
  }
  unit.conditions = unit.conditions.filter(
    (c) => !conditionsToRemove.includes(c)
  );

  // 5. Atualizar action marks (decrementar apenas se usou ação)
  if (unit.actionsLeft < 1) {
    unit.actionMarks = Math.max(0, unit.actionMarks - 1);
  }

  // 6. Resetar recursos do turno
  unit.movesLeft = 0;
  unit.actionsLeft = 0;
  unit.attacksLeftThisTurn = 0;
  unit.hasStartedAction = false;

  return {
    unitUpdated: unit,
    conditionsRemoved,
    damageFromConditions,
    unitDefeated: !unit.isAlive,
  };
}

/**
 * Processa efeitos de condições que ocorrem no início do turno de uma unidade.
 * Isso inclui:
 * - Regeneração (HP regen)
 * - Recuperação de mana
 * - Remoção de condições que expiram em "next_turn"
 */
export function processUnitTurnStartConditions(
  unit: BattleUnit
): TurnEndResult {
  let healingFromConditions = 0;
  const conditionsRemoved: string[] = [];

  // 1. Processar regeneração de condições
  for (const condId of unit.conditions) {
    const condition = CONDITIONS[condId];
    if (!condition) continue;

    // Aplicar regeneração
    if (condition.effects.healPerTurn) {
      healingFromConditions += condition.effects.healPerTurn;
    }
  }

  // 2. Aplicar cura
  if (healingFromConditions > 0) {
    unit.currentHp = Math.min(
      unit.maxHp,
      unit.currentHp + healingFromConditions
    );
  }

  // 3. Remover condições que expiram no próximo turno
  const remainingConditions = removeNextTurnConditions(unit.conditions);
  const removed = unit.conditions.filter(
    (c) => !remainingConditions.includes(c)
  );
  conditionsRemoved.push(...removed);
  unit.conditions = remainingConditions;

  // 4. Preparar unidade para o turno
  unit.movesLeft = unit.speed;
  unit.actionsLeft = 1;
  unit.attacksLeftThisTurn = 1;

  // 5. Atualizar cooldowns
  tickUnitCooldowns(unit);

  return {
    unitUpdated: unit,
    conditionsRemoved,
    damageFromConditions: -healingFromConditions, // Negativo = cura
    unitDefeated: false,
  };
}

// =============================================================================
// VERIFICAÇÃO DE CONDIÇÕES DE VITÓRIA
// =============================================================================

/**
 * Verifica se a batalha terminou e determina o vencedor.
 * Retorna informações sobre o resultado.
 */
export function checkVictoryConditions(
  units: BattleUnit[]
): VictoryCheckResult {
  // Agrupar unidades vivas por jogador/reino
  const aliveByPlayer = new Map<string, BattleUnit[]>();

  for (const unit of units) {
    if (!unit.isAlive) continue;

    const playerId = unit.ownerId;
    const existing = aliveByPlayer.get(playerId) || [];
    existing.push(unit);
    aliveByPlayer.set(playerId, existing);
  }

  // Verificar quantos jogadores ainda têm unidades vivas
  const playersAlive = Array.from(aliveByPlayer.entries());

  if (playersAlive.length === 0) {
    // Empate - todos morreram
    return {
      battleEnded: true,
      winnerId: null,
      winnerKingdomId: null,
      reason: "Empate - todas as unidades foram derrotadas",
    };
  }

  if (playersAlive.length === 1) {
    // Apenas um jogador sobreviveu - vitória!
    const [winnerId, winnerUnits] = playersAlive[0];
    const winnerKingdomId = winnerUnits[0]?.ownerKingdomId || null;

    return {
      battleEnded: true,
      winnerId,
      winnerKingdomId,
      reason: "Vitória - último jogador com unidades vivas",
    };
  }

  // Batalha continua
  return {
    battleEnded: false,
    winnerId: null,
    winnerKingdomId: null,
    reason: "",
  };
}

/**
 * Verifica se todas as unidades estão exaustas (action marks máximos).
 */
export function checkExhaustion(units: BattleUnit[]): ExhaustionCheckResult {
  const aliveUnits = units.filter((u) => u.isAlive);

  if (aliveUnits.length === 0) {
    return {
      allExhausted: true,
      winnerId: null,
      winnerKingdomId: null,
    };
  }

  // Verificar se todas as unidades vivas estão exaustas
  const allExhausted = aliveUnits.every((unit) => {
    const maxMarks = getMaxMarksByCategory(unit.category);
    return unit.actionMarks >= maxMarks;
  });

  if (!allExhausted) {
    return {
      allExhausted: false,
      winnerId: null,
      winnerKingdomId: null,
    };
  }

  // Todas exaustas - encontrar quem tem mais HP total
  const hpByPlayer = new Map<string, { total: number; kingdomId: string }>();

  for (const unit of aliveUnits) {
    const current = hpByPlayer.get(unit.ownerId) || {
      total: 0,
      kingdomId: unit.ownerKingdomId,
    };
    current.total += unit.currentHp;
    hpByPlayer.set(unit.ownerId, current);
  }

  let winnerId: string | null = null;
  let winnerKingdomId: string | null = null;
  let maxHp = 0;

  for (const [playerId, data] of hpByPlayer.entries()) {
    if (data.total > maxHp) {
      maxHp = data.total;
      winnerId = playerId;
      winnerKingdomId = data.kingdomId;
    }
  }

  return {
    allExhausted: true,
    winnerId,
    winnerKingdomId,
  };
}

// =============================================================================
// CÁLCULO DE ORDEM DE AÇÃO
// =============================================================================

/**
 * Calcula a ordem de ação das unidades baseado em Speed.
 * Unidades mais rápidas agem primeiro.
 */
export function calculateActionOrder(units: BattleUnit[]): string[] {
  return units
    .filter((u) => u.isAlive)
    .sort((a, b) => {
      // Maior speed primeiro
      if (b.speed !== a.speed) return b.speed - a.speed;
      // Desempate por ID (determinístico)
      return a.id.localeCompare(b.id);
    })
    .map((u) => u.id);
}

/**
 * Recalcula a ordem de ação removendo unidades mortas.
 */
export function updateActionOrder(
  currentOrder: string[],
  units: BattleUnit[]
): string[] {
  const aliveIds = new Set(units.filter((u) => u.isAlive).map((u) => u.id));
  return currentOrder.filter((id) => aliveIds.has(id));
}

// =============================================================================
// PREPARAÇÃO DE UNIDADE PARA TURNO
// =============================================================================

/**
 * Prepara uma unidade para iniciar seu turno.
 * Define movimentos, ações e ataques disponíveis.
 */
export function prepareUnitForTurn(unit: BattleUnit): void {
  if (!unit.isAlive) return;

  // Definir recursos do turno
  unit.movesLeft = unit.speed;
  unit.actionsLeft = 1;
  unit.attacksLeftThisTurn = 1;
  unit.hasStartedAction = true;

  // Processar efeitos de início de turno
  processUnitTurnStartConditions(unit);
}

/**
 * Limpa o estado do turno de uma unidade.
 */
export function clearUnitTurnState(unit: BattleUnit): void {
  unit.movesLeft = 0;
  unit.actionsLeft = 0;
  unit.attacksLeftThisTurn = 0;
  unit.hasStartedAction = false;
}

// =============================================================================
// UTILITÁRIOS
// =============================================================================

/**
 * Encontra a próxima unidade viva na ordem de ação.
 */
export function findNextAliveUnit(
  actionOrder: string[],
  currentIndex: number,
  units: BattleUnit[]
): { unitId: string; index: number } | null {
  const aliveUnits = new Map(
    units.filter((u) => u.isAlive).map((u) => [u.id, u])
  );

  let index = (currentIndex + 1) % actionOrder.length;
  let attempts = 0;

  while (attempts < actionOrder.length) {
    const unitId = actionOrder[index];
    if (aliveUnits.has(unitId)) {
      return { unitId, index };
    }
    index = (index + 1) % actionOrder.length;
    attempts++;
  }

  return null;
}

/**
 * Obtém a unidade que controla o turno atual.
 */
export function getCurrentTurnUnit(
  actionOrder: string[],
  currentTurnIndex: number,
  units: BattleUnit[]
): BattleUnit | null {
  const unitId = actionOrder[currentTurnIndex];
  return units.find((u) => u.id === unitId && u.isAlive) || null;
}

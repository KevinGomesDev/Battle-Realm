// server/src/logic/round-control.ts
// =============================================================================
// ROUND CONTROL - Sistema centralizado de controle de rodadas e turnos
// =============================================================================
// Este módulo é a FONTE DE VERDADE para toda lógica de:
// - Troca de turnos (unit -> unit, player -> player)
// - Avanço de rodadas
// - Processamento de efeitos de início/fim de turno
// - Processamento de condições que expiram
// - Verificação de condições de vitória
// =============================================================================

import { Server } from "socket.io";
import type { BattleUnit } from "../utils/battle-unit.factory";
import type { Battle, BattleLobby } from "../handlers/battle/battle-types";
import { CONDITIONS, removeNextTurnConditions } from "./conditions";
import {
  emitRoundStartEvent,
  emitConditionRemovedEvent,
} from "./combat-events";
import { getMaxMarksByCategory } from "../utils/battle.utils";
import { tickUnitCooldowns } from "./skill-executors";
import { clearBattleEventsCache } from "../services/event.service";

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

  // 5. Atualizar action marks
  const maxMarks = getMaxMarksByCategory(unit.category);
  unit.actionMarks = Math.min(maxMarks, unit.actionMarks + 1);

  // 6. Resetar recursos do turno
  unit.movesLeft = 0;
  unit.actionsLeft = 0;
  unit.attacksLeftThisTurn = 0; // Resetar ataques extras
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
 * - Cura de condições como REGENERATING
 * - Remoção de condições que expiram em "next_turn"
 */
export function processUnitTurnStartConditions(unit: BattleUnit): {
  healFromConditions: number;
  conditionsRemoved: string[];
} {
  let healFromConditions = 0;
  const conditionsRemoved: string[] = [];

  for (const condId of unit.conditions) {
    const condition = CONDITIONS[condId];
    if (!condition) continue;

    // Aplicar cura de condições
    if (condition.effects.healPerTurn) {
      healFromConditions += condition.effects.healPerTurn;
    }
  }

  // Remover condições que expiram no próximo turno (next_turn)
  const beforeConditions = [...unit.conditions];
  unit.conditions = removeNextTurnConditions(unit.conditions);

  for (const condId of beforeConditions) {
    if (!unit.conditions.includes(condId)) {
      conditionsRemoved.push(condId);
    }
  }

  // Aplicar cura (respeitando HP máximo)
  if (healFromConditions > 0) {
    const maxHp = unit.vitality; // Vitality é o HP máximo
    unit.currentHp = Math.min(maxHp, unit.currentHp + healFromConditions);
  }

  return {
    healFromConditions,
    conditionsRemoved,
  };
}

// =============================================================================
// CONTROLE DE TROCA DE TURNO
// =============================================================================

/**
 * Avança para o próximo jogador no ciclo de turnos.
 * Retorna informações sobre a transição.
 */
export function advanceToNextPlayer(battle: Battle): TurnTransitionResult {
  const previousPlayerId = battle.actionOrder[battle.currentTurnIndex];
  const previousTurnIndex = battle.currentTurnIndex;

  // Incrementar index circular
  if (battle.actionOrder.length > 0) {
    battle.currentTurnIndex =
      (battle.currentTurnIndex + 1) % battle.actionOrder.length;
  }

  const nextPlayerId = battle.actionOrder[battle.currentTurnIndex];

  // Verificar se voltamos ao início (nova rodada)
  const allPlayersActed = battle.actionOrder.every(
    (playerId) => (battle.roundActionsCount.get(playerId) || 0) >= 1
  );

  let roundAdvanced = false;
  let newRound = battle.round;

  if (allPlayersActed) {
    roundAdvanced = true;
    newRound = battle.round + 1;
    battle.round = newRound;

    // Resetar contadores de ação
    for (const playerId of battle.actionOrder) {
      battle.roundActionsCount.set(playerId, 0);
    }
  }

  // Limpar unidade ativa
  battle.activeUnitId = undefined;

  return {
    previousPlayerId,
    nextPlayerId,
    previousTurnIndex,
    nextTurnIndex: battle.currentTurnIndex,
    roundAdvanced,
    newRound,
  };
}

/**
 * Registra que um jogador executou uma ação nesta rodada.
 */
export function recordPlayerAction(battle: Battle, playerId: string): void {
  const currentCount = battle.roundActionsCount.get(playerId) || 0;
  battle.roundActionsCount.set(playerId, currentCount + 1);
}

// =============================================================================
// PROCESSAMENTO DE NOVA RODADA
// =============================================================================

/**
 * Processa o início de uma nova rodada.
 * Aplica efeitos de início de rodada em todas as unidades.
 * Reseta hasStartedAction para permitir que cada jogador escolha uma nova unidade.
 */
export async function processNewRound(
  battle: Battle,
  io: Server,
  lobbyId: string
): Promise<RoundAdvanceResult> {
  const unitsDefeatedByConditions: string[] = [];
  const allUnitsProcessed: BattleUnit[] = [];

  // Emitir evento de início de rodada
  await emitRoundStartEvent(battle.id, battle.round);

  // === NOVA RODADA: Resetar estado de todas as unidades ===
  // Isso permite que cada jogador escolha qual unidade usar nesta rodada
  for (const unit of battle.units) {
    if (!unit.isAlive) continue;

    // Resetar flag de ação iniciada - agora o jogador pode escolher qualquer unidade
    unit.hasStartedAction = false;
    // Resetar movimentos e ações para 0 - serão definidos ao escolher a unidade
    unit.movesLeft = 0;
    unit.actionsLeft = 0;
    // Resetar ataques extras
    unit.attacksLeftThisTurn = 0;

    // Reduzir cooldowns de skills/spells em 1 a cada rodada
    tickUnitCooldowns(unit);
  }

  // Processar condições de início de turno para todas as unidades vivas
  for (const unit of battle.units) {
    if (!unit.isAlive) continue;

    const startResult = processUnitTurnStartConditions(unit);

    // Emitir eventos de condições removidas
    for (const condId of startResult.conditionsRemoved) {
      const conditionDef = CONDITIONS[condId];
      const conditionName = conditionDef?.name || condId;
      await emitConditionRemovedEvent(battle.id, unit, condId, conditionName);
    }

    allUnitsProcessed.push(unit);
  }

  return {
    newRound: battle.round,
    roundAdvanced: true,
    allUnitsProcessed,
    unitsDefeatedByConditions,
  };
}

// =============================================================================
// VERIFICAÇÃO DE CONDIÇÕES DE VITÓRIA
// =============================================================================

/**
 * Verifica se a batalha terminou (vitória/derrota/empate).
 */
export function checkVictoryCondition(battle: Battle): VictoryCheckResult {
  const aliveBySide = new Map<string, number>();

  console.log("[VICTORY_CHECK] Verificando condição de vitória...");
  console.log("[VICTORY_CHECK] Total de unidades:", battle.units.length);

  for (const unit of battle.units) {
    console.log(`[VICTORY_CHECK] Unidade ${unit.name} (${unit.id}):`, {
      isAlive: unit.isAlive,
      currentHp: unit.currentHp,
      maxHp: unit.maxHp,
      ownerId: unit.ownerId,
    });

    if (unit.isAlive) {
      const count = aliveBySide.get(unit.ownerId) || 0;
      aliveBySide.set(unit.ownerId, count + 1);
    }
  }

  console.log(
    "[VICTORY_CHECK] Unidades vivas por lado:",
    Array.from(aliveBySide.entries())
  );

  // Se só um lado tem unidades vivas, ele venceu
  if (aliveBySide.size === 0) {
    console.log("[VICTORY_CHECK] ❌ EMPATE - Nenhuma unidade viva");
    return {
      battleEnded: true,
      winnerId: null,
      winnerKingdomId: null,
      reason: "Empate - Todas as unidades foram derrotadas",
    };
  }

  if (aliveBySide.size === 1) {
    const winnerId = aliveBySide.keys().next().value || null;
    const winnerKingdom = battle.units.find(
      (u) => u.ownerId === winnerId
    )?.ownerKingdomId;

    console.log("[VICTORY_CHECK] ✅ VITÓRIA!", {
      winnerId,
      winnerKingdom,
    });

    return {
      battleEnded: true,
      winnerId,
      winnerKingdomId: winnerKingdom || null,
      reason: "Todas as unidades inimigas foram derrotadas",
    };
  }

  console.log("[VICTORY_CHECK] ⚔️ Batalha continua");
  return {
    battleEnded: false,
    winnerId: null,
    winnerKingdomId: null,
    reason: "",
  };
}

/**
 * Verifica se todas as unidades estão exaustas (para batalhas não-arena).
 * Determina vencedor por HP total.
 */
export function checkExhaustionCondition(
  battle: Battle
): ExhaustionCheckResult {
  const allUnitsExhausted = battle.units
    .filter((u) => u.isAlive)
    .every((u) => {
      const maxMarks = getMaxMarksByCategory(u.category);
      return u.actionMarks >= maxMarks;
    });

  if (!allUnitsExhausted) {
    return {
      allExhausted: false,
      winnerId: null,
      winnerKingdomId: null,
    };
  }

  // Calcular HP total por jogador
  const hpByPlayer = new Map<string, number>();
  for (const unit of battle.units) {
    if (unit.isAlive) {
      const currentHp = hpByPlayer.get(unit.ownerId) || 0;
      hpByPlayer.set(unit.ownerId, currentHp + unit.currentHp);
    }
  }

  // Determinar vencedor
  let winnerId: string | null = null;
  let maxHp = -1;
  for (const [playerId, totalHp] of hpByPlayer.entries()) {
    if (totalHp > maxHp) {
      maxHp = totalHp;
      winnerId = playerId;
    }
  }

  const winnerKingdom = battle.units.find(
    (u) => u.ownerId === winnerId
  )?.ownerKingdomId;

  return {
    allExhausted: true,
    winnerId,
    winnerKingdomId: winnerKingdom || null,
  };
}

// =============================================================================
// FUNÇÃO PRINCIPAL: FINALIZAR TURNO DE UNIDADE
// =============================================================================

/**
 * Fluxo completo de finalização do turno de uma unidade.
 * Retorna todos os dados necessários para emissão de eventos.
 */
export interface EndUnitTurnParams {
  battle: Battle;
  unit: BattleUnit;
  io: Server;
  lobby: BattleLobby;
}

export interface EndUnitTurnOutput {
  turnEndResult: TurnEndResult;
  turnTransition: TurnTransitionResult;
  victoryCheck: VictoryCheckResult;
  exhaustionCheck: ExhaustionCheckResult | null;
  shouldEmitNewRound: boolean;
}

export async function executeEndUnitTurn(
  params: EndUnitTurnParams
): Promise<EndUnitTurnOutput> {
  const { battle, unit, io, lobby } = params;

  // 1. Processar condições de fim de turno
  const turnEndResult = processUnitTurnEndConditions(unit);

  // 2. Registrar ação do jogador
  const currentPlayerId = battle.actionOrder[battle.currentTurnIndex];
  if (unit.hasStartedAction || true) {
    // Sempre registrar para avançar a rodada corretamente
    recordPlayerAction(battle, currentPlayerId);
  }

  // 3. Avançar para próximo jogador
  const turnTransition = advanceToNextPlayer(battle);

  // 4. Verificar vitória (pode ter morrido por condição)
  const victoryCheck = checkVictoryCondition(battle);

  // 5. Verificar exaustão (apenas para batalhas não-arena)
  let exhaustionCheck: ExhaustionCheckResult | null = null;
  if (!battle.isArena && !victoryCheck.battleEnded) {
    exhaustionCheck = checkExhaustionCondition(battle);
  }

  // 6. Processar nova rodada se necessário
  if (turnTransition.roundAdvanced && !victoryCheck.battleEnded) {
    await processNewRound(battle, io, lobby.lobbyId);
  }

  return {
    turnEndResult,
    turnTransition,
    victoryCheck,
    exhaustionCheck,
    shouldEmitNewRound: turnTransition.roundAdvanced,
  };
}

// =============================================================================
// EMISSÃO DE EVENTOS (helpers para uso nos handlers)
// =============================================================================

/**
 * Emite eventos de fim de batalha.
 */
export function emitBattleEndEvents(
  io: Server,
  lobbyId: string,
  battleId: string,
  victoryCheck: VictoryCheckResult,
  units: BattleUnit[],
  vsBot?: boolean
): void {
  io.to(lobbyId).emit("battle:battle_ended", {
    battleId,
    winnerId: victoryCheck.winnerId,
    winnerKingdomId: victoryCheck.winnerKingdomId,
    reason: victoryCheck.reason,
    finalUnits: units,
    vsBot: vsBot ?? false,
  });

  // Limpar cache de eventos da batalha (são mantidos apenas em memória)
  clearBattleEventsCache(battleId);
}

/**
 * Emite eventos de fim de batalha por exaustão.
 */
export function emitExhaustionEndEvents(
  io: Server,
  lobbyId: string,
  battleId: string,
  exhaustionCheck: ExhaustionCheckResult,
  units: BattleUnit[],
  vsBot?: boolean
): void {
  io.to(lobbyId).emit("battle:battle_ended", {
    battleId,
    winnerId: exhaustionCheck.winnerId,
    winnerKingdomId: exhaustionCheck.winnerKingdomId,
    reason: "Todas as unidades estão exaustas (Action Marks máximos)",
    finalUnits: units,
    vsBot: vsBot ?? false,
  });

  // Limpar cache de eventos da batalha (são mantidos apenas em memória)
  clearBattleEventsCache(battleId);
}

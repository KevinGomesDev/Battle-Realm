// turn.handler.ts - Controle de turnos, timer e ordem de ação
import type { Delayed, Room } from "@colyseus/core";
import type {
  BattleSessionState,
  BattleUnitSchema,
  BattlePlayerSchema,
} from "../../schemas";
import { TURN_CONFIG } from "@boundless/shared/config";

/**
 * Verifica se uma unidade pode agir no turno.
 * Uma unidade pode agir se está viva E não possui a condição DISABLED.
 */
export function canUnitAct(unit: BattleUnitSchema | undefined): boolean {
  if (!unit) return false;
  if (!unit.isAlive) return false;
  // Verifica se a unidade possui a condição DISABLED
  const conditions = Array.from(unit.conditions || []);
  if (conditions.includes("DISABLED")) return false;
  return true;
}

/**
 * Calcula a ordem de ação baseada na velocidade das unidades
 */
export function calculateActionOrder(
  state: BattleSessionState,
  onFirstUnitAI?: (unit: BattleUnitSchema) => void
): void {
  console.log(
    `[turn.handler] calculateActionOrder - actionOrder tem ${state.actionOrder.length} IDs`
  );

  const unitIds = Array.from(state.actionOrder).filter(
    (id): id is string => id !== undefined
  );

  console.log(`[turn.handler] unitIds filtrados: ${unitIds.length}`);

  unitIds.sort((a, b) => {
    const unitA = state.units.get(a);
    const unitB = state.units.get(b);
    if (!unitA || !unitB) return 0;
    return unitB.speed - unitA.speed;
  });

  state.actionOrder.clear();
  unitIds.forEach((id) => state.actionOrder.push(id));

  console.log(
    `[turn.handler] actionOrder após ordenação: ${state.actionOrder.length}`
  );

  if (state.actionOrder.length > 0) {
    state.currentTurnIndex = 0;
    // Usar .at(0) em vez de [0] para ArraySchema do Colyseus
    let firstUnitId = state.actionOrder.at(0);
    console.log(`[turn.handler] Primeira unidade (via .at(0)): ${firstUnitId}`);

    // Procurar primeira unidade que pode agir (viva e sem DISABLED)
    let index = 0;
    while (
      firstUnitId &&
      !canUnitAct(state.units.get(firstUnitId)) &&
      index < state.actionOrder.length - 1
    ) {
      index++;
      firstUnitId = state.actionOrder.at(index);
    }

    if (firstUnitId && canUnitAct(state.units.get(firstUnitId))) {
      state.currentTurnIndex = index;
      state.activeUnitId = firstUnitId;
      const unit = state.units.get(firstUnitId)!;
      console.log(`[turn.handler] Unidade encontrada:`, {
        id: unit.id,
        name: unit.name,
        ownerId: unit.ownerId,
        speed: unit.speed,
      });

      state.currentPlayerId = unit.ownerId || "";
      unit.movesLeft = unit.speed;
      unit.actionsLeft = 1;
      unit.attacksLeftThisTurn = 0;
      unit.hasStartedAction = false;

      console.log(
        `[turn.handler] currentPlayerId setado para: ${state.currentPlayerId}`
      );

      if (unit.isAIControlled && onFirstUnitAI) {
        console.log(
          `[BattleRoom] 🤖 Primeira unidade é IA: ${unit.name}, iniciando turno da IA`
        );
        onFirstUnitAI(unit);
      }
    } else {
      console.log(
        `[turn.handler] ERRO: Nenhuma unidade pode agir na actionOrder`
      );
    }
  } else {
    console.log(`[turn.handler] ERRO: actionOrder vazio após ordenação`);
  }
}

/**
 * @deprecated Use BattleTimerManager de battle-timer.handler.ts
 * Mantido temporariamente para compatibilidade
 */
export function startTurnTimer(
  state: BattleSessionState,
  clock: Room<BattleSessionState>["clock"],
  currentTimer: Delayed | null,
  setTimer: (timer: Delayed | null) => void,
  onTimeExpired: () => void,
  broadcast?: Room<BattleSessionState>["broadcast"]
): void {
  console.warn(
    "[turn.handler] startTurnTimer está deprecated. Use BattleTimerManager."
  );
  if (currentTimer) {
    currentTimer.clear();
  }

  const timer = clock.setInterval(() => {
    if (state.status !== "ACTIVE") {
      timer.clear();
      return;
    }

    state.turnTimer--;

    // Broadcast timer update a cada segundo
    if (broadcast) {
      broadcast("battle:timer_update", { turnTimer: state.turnTimer });
    }

    if (state.turnTimer <= 0) {
      onTimeExpired();
    }
  }, 1000);

  setTimer(timer);
}

/**
 * Avança para a próxima unidade viva
 */
export function advanceToNextUnit(
  state: BattleSessionState,
  broadcast: Room<BattleSessionState>["broadcast"],
  onRoundEnd: () => void,
  onAITurn: (unit: BattleUnitSchema) => void,
  onBattleEnd: () => void
): void {
  console.log(`[BattleRoom] advanceToNextUnit chamado`);

  // Verificar se a batalha já terminou
  if (state.status === "ENDED") {
    console.log(
      "[BattleRoom] advanceToNextUnit: batalha já encerrada, ignorando"
    );
    return;
  }

  let nextIndex = (state.currentTurnIndex + 1) % state.actionOrder.length;
  let attempts = 0;

  while (attempts < state.actionOrder.length) {
    const unitId = state.actionOrder.at(nextIndex);
    if (!unitId) {
      nextIndex = (nextIndex + 1) % state.actionOrder.length;
      attempts++;
      continue;
    }
    const unit = state.units.get(unitId);

    // Usa canUnitAct para verificar se a unidade pode agir (viva E sem DISABLED)
    if (unit && canUnitAct(unit)) {
      state.currentTurnIndex = nextIndex;
      state.activeUnitId = unitId;
      state.currentPlayerId = unit.ownerId;
      state.turnTimer = TURN_CONFIG.timerSeconds;

      unit.hasStartedAction = false;
      unit.movesLeft = unit.speed;
      unit.actionsLeft = 1;
      unit.attacksLeftThisTurn = 0;

      if (nextIndex === 0) {
        state.round++;
        onRoundEnd();
      }

      console.log(
        `[BattleRoom] Turno para: ${unit.name} (isAIControlled: ${unit.isAIControlled})`
      );

      broadcast("battle:turn_changed", {
        unitId: unitId,
        playerId: unit.ownerId,
        round: state.round,
        turnTimer: state.turnTimer,
        // Dados atualizados da unidade para sync no cliente
        unitUpdated: {
          movesLeft: unit.movesLeft,
          actionsLeft: unit.actionsLeft,
          attacksLeftThisTurn: unit.attacksLeftThisTurn,
          hasStartedAction: unit.hasStartedAction,
        },
      });

      if (unit.isAIControlled) {
        console.log(
          `[BattleRoom] 🤖 Unidade de IA detectada, executando turno`
        );
        onAITurn(unit);
      }

      return;
    }

    nextIndex = (nextIndex + 1) % state.actionOrder.length;
    attempts++;
  }

  // Não encontrou nenhuma unidade viva na actionOrder
  // Verificar se realmente não há unidades vivas antes de terminar
  console.log(
    "[BattleRoom] Nenhuma unidade viva encontrada na actionOrder, verificando fim de batalha"
  );
  onBattleEnd();
}

/**
 * Processa o fim de uma rodada
 */
export function processRoundEnd(
  state: BattleSessionState,
  broadcast: Room<BattleSessionState>["broadcast"]
): void {
  state.units.forEach((unit) => {
    if (!unit.isAlive) return;

    unit.unitCooldowns.forEach((value, key) => {
      if (value > 0) {
        unit.unitCooldowns.set(key, value - 1);
      }
    });
  });

  broadcast("battle:round_ended", { round: state.round - 1 });
}

/**
 * @deprecated Use BattleTimerManager.forceCheckBattleEnd() de battle-timer.handler.ts
 * A verificação de fim de batalha agora é feita pelo timer a cada segundo.
 * Mantido temporariamente para compatibilidade.
 */
export function checkBattleEnd(
  state: BattleSessionState,
  roomId: string,
  turnTimer: Delayed | null,
  broadcast: Room<BattleSessionState>["broadcast"],
  onBattleEnd: (winnerId: string | undefined, reason: string) => void
): void {
  console.warn(
    "[turn.handler] checkBattleEnd está deprecated. A verificação agora é feita pelo BattleTimerManager."
  );

  // Já terminou - não verificar novamente
  if (state.status === "ENDED") {
    console.log("[BattleRoom] checkBattleEnd: batalha já encerrada, ignorando");
    return;
  }

  const playersAlive: string[] = [];
  const playerUnitsInfo: Record<string, { alive: number; total: number }> = {};

  state.players.forEach((player: BattlePlayerSchema) => {
    if (player.surrendered) {
      console.log(`[BattleRoom] checkBattleEnd: ${player.oderId} se rendeu`);
      return;
    }

    // Contar unidades para debug
    let aliveCount = 0;
    let totalCount = 0;
    state.units.forEach((unit) => {
      if (unit.ownerId === player.oderId) {
        totalCount++;
        if (unit.isAlive) aliveCount++;
      }
    });
    playerUnitsInfo[player.oderId] = { alive: aliveCount, total: totalCount };

    if (state.playerHasAliveUnits(player.oderId)) {
      playersAlive.push(player.oderId);
    }
  });

  console.log("[BattleRoom] checkBattleEnd:", {
    playersAliveCount: playersAlive.length,
    playersAlive,
    playerUnitsInfo,
  });

  if (playersAlive.length <= 1) {
    state.status = "ENDED";

    if (playersAlive.length === 1) {
      state.winnerId = playersAlive[0];
      state.winReason = "Todas as unidades inimigas foram derrotadas";
    } else {
      state.winReason = "Empate - todos foram derrotados";
    }

    console.log("[BattleRoom] Batalha encerrada:", {
      winnerId: state.winnerId,
      winReason: state.winReason,
    });

    if (turnTimer) {
      turnTimer.clear();
    }

    onBattleEnd(state.winnerId || undefined, state.winReason || "");

    broadcast("battle:ended", {
      winnerId: state.winnerId,
      winReason: state.winReason,
    });
  }
}

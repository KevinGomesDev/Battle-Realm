// turn.handler.ts - Controle de turnos, timer e ordem de ação
import type { Delayed, Room } from "@colyseus/core";
import type {
  BattleSessionState,
  BattleUnitSchema,
  BattlePlayerSchema,
} from "../../schemas";
import { TURN_CONFIG } from "@boundless/shared/config";

/**
 * Calcula a ordem de ação baseada na velocidade das unidades
 */
export function calculateActionOrder(
  state: BattleSessionState,
  onFirstUnitAI?: (unit: BattleUnitSchema) => void
): void {
  const unitIds = Array.from(state.actionOrder).filter(
    (id): id is string => id !== undefined
  );

  unitIds.sort((a, b) => {
    const unitA = state.units.get(a);
    const unitB = state.units.get(b);
    if (!unitA || !unitB) return 0;
    return unitB.speed - unitA.speed;
  });

  state.actionOrder.clear();
  unitIds.forEach((id) => state.actionOrder.push(id));

  if (state.actionOrder.length > 0) {
    state.currentTurnIndex = 0;
    const firstUnitId = state.actionOrder[0];
    if (firstUnitId) {
      state.activeUnitId = firstUnitId;
      const unit = state.units.get(firstUnitId);
      if (unit) {
        state.currentPlayerId = unit.ownerId || "";
        unit.movesLeft = unit.speed;
        unit.actionsLeft = 1;
        unit.attacksLeftThisTurn = 1;
        unit.hasStartedAction = false;

        if (unit.isAIControlled && onFirstUnitAI) {
          console.log(
            `[BattleRoom] 🤖 Primeira unidade é IA: ${unit.name}, iniciando turno da IA`
          );
          onFirstUnitAI(unit);
        }
      }
    }
  }
}

/**
 * Inicia o timer de turno
 */
export function startTurnTimer(
  state: BattleSessionState,
  clock: Room<BattleSessionState>["clock"],
  currentTimer: Delayed | null,
  setTimer: (timer: Delayed | null) => void,
  onTimeExpired: () => void
): void {
  if (currentTimer) {
    currentTimer.clear();
  }

  const timer = clock.setInterval(() => {
    if (state.status !== "ACTIVE") {
      timer.clear();
      return;
    }

    state.turnTimer--;

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

  let nextIndex = (state.currentTurnIndex + 1) % state.actionOrder.length;
  let attempts = 0;

  while (attempts < state.actionOrder.length) {
    const unitId = state.actionOrder[nextIndex];
    if (!unitId) {
      nextIndex = (nextIndex + 1) % state.actionOrder.length;
      attempts++;
      continue;
    }
    const unit = state.units.get(unitId);

    if (unit && unit.isAlive) {
      state.currentTurnIndex = nextIndex;
      state.activeUnitId = unitId;
      state.currentPlayerId = unit.ownerId;
      state.turnTimer = TURN_CONFIG.timerSeconds;

      unit.hasStartedAction = false;
      unit.movesLeft = unit.speed;
      unit.actionsLeft = 1;
      unit.attacksLeftThisTurn = 1;

      if (nextIndex === 0) {
        state.round++;
        onRoundEnd();
      }

      console.log(
        `[BattleRoom] Turno para: ${unit.name} (isAIControlled: ${unit.isAIControlled})`
      );

      broadcast("battle:turn_changed", {
        activeUnitId: unitId,
        round: state.round,
        turnTimer: state.turnTimer,
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
 * Verifica se a batalha terminou
 */
export function checkBattleEnd(
  state: BattleSessionState,
  roomId: string,
  turnTimer: Delayed | null,
  broadcast: Room<BattleSessionState>["broadcast"],
  onBattleEnd: (winnerId: string | undefined, reason: string) => void
): void {
  const playersAlive: string[] = [];

  state.players.forEach((player: BattlePlayerSchema) => {
    if (player.surrendered) return;

    if (state.playerHasAliveUnits(player.oderId)) {
      playersAlive.push(player.oderId);
    }
  });

  if (playersAlive.length <= 1) {
    state.status = "ENDED";

    if (playersAlive.length === 1) {
      state.winnerId = playersAlive[0];
      state.winReason = "Todas as unidades inimigas foram derrotadas";
    } else {
      state.winReason = "Empate - todos foram derrotados";
    }

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

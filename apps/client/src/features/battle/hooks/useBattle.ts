// client/src/features/battle/hooks/useBattle.ts
// Hook para Batalha usando Zustand store

import { useEffect } from "react";
import { useBattleStore, useAuthStore } from "../../../stores";

export function useBattle() {
  const store = useBattleStore();
  const userId = useAuthStore((state) => state.user?.id);

  // Listeners são inicializados pelo StoreInitializer - não duplicar aqui

  // Recompute battle when relevant state changes
  useEffect(() => {
    store.computeBattle(userId);
  }, [
    userId,
    store.units.length,
    store.players.length,
    store.winnerId,
    store.rematchRequests.length,
  ]);

  return {
    state: {
      battleId: store.battleId,
      isInBattle: store.isInBattle,
      status: store.status,
      round: store.round,
      turnTimer: store.turnTimer,
      gridWidth: store.gridWidth,
      gridHeight: store.gridHeight,
      players: store.players,
      units: store.units,
      activeUnitId: store.activeUnitId,
      selectedUnitId: store.selectedUnitId,
      currentPlayerId: store.currentPlayerId,
      unitLocked: store.unitLocked,
      actionOrder: store.actionOrder,
      obstacles: store.obstacles,
      winnerId: store.winnerId,
      winReason: store.winReason,
      rematchRequests: store.rematchRequests,
      isLoading: store.isLoading,
      error: store.error,
      battle: store.battle,
      battleResult: store.battleResult,
      rematchPending: store.rematchPending,
      opponentWantsRematch: store.opponentWantsRematch,
    },

    // Battle
    selectUnit: store.selectUnit,
    beginAction: store.beginAction,
    moveUnit: store.moveUnit,
    attackUnit: store.attackUnit,
    endAction: store.endAction,
    executeAction: store.executeAction,
    castSpell: store.castSpell,
    surrender: store.surrender,
    requestRematch: store.requestRematch,
    leaveBattle: store.leaveBattle,

    // Utilities
    getUnit: store.getUnit,
    getMyUnits: () => store.getMyUnits(userId || ""),
    clearError: store.clearError,
    dismissBattleResult: store.dismissBattleResult,
  };
}

// Alias for compatibility
export { useBattle as useBattleColyseus };

export function useBattleOptional() {
  const store = useBattleStore();
  return store;
}

export function useBattleState() {
  const store = useBattleStore();
  return {
    battleId: store.battleId,
    isInBattle: store.isInBattle,
    status: store.status,
    round: store.round,
    turnTimer: store.turnTimer,
    gridWidth: store.gridWidth,
    gridHeight: store.gridHeight,
    players: store.players,
    units: store.units,
    activeUnitId: store.activeUnitId,
    selectedUnitId: store.selectedUnitId,
    currentPlayerId: store.currentPlayerId,
    unitLocked: store.unitLocked,
    actionOrder: store.actionOrder,
    obstacles: store.obstacles,
    winnerId: store.winnerId,
    winReason: store.winReason,
    rematchRequests: store.rematchRequests,
    isLoading: store.isLoading,
    error: store.error,
    battle: store.battle,
    battleResult: store.battleResult,
    rematchPending: store.rematchPending,
    opponentWantsRematch: store.opponentWantsRematch,
  };
}

export function useBattleSession() {
  const store = useBattleStore();
  return {
    status: store.status,
    units: store.units,
    selectedUnitId: store.selectedUnitId,
    unitLocked: store.unitLocked,
    isInBattle: store.status === "ACTIVE",
    selectUnit: store.selectUnit,
    beginAction: store.beginAction,
    moveUnit: store.moveUnit,
    attackUnit: store.attackUnit,
    endAction: store.endAction,
    executeAction: store.executeAction,
    castSpell: store.castSpell,
    surrender: store.surrender,
  };
}

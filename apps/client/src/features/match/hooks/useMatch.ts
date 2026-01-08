// client/src/features/match/hooks/useMatch.ts
// Hook para Match usando Zustand store

import { useMatchStore, useAuthStore } from "../../../stores";

export function useMatch() {
  const store = useMatchStore();
  const userId = useAuthStore((state) => state.user?.id);

  // Listeners são inicializados pelo StoreInitializer - não duplicar aqui

  return {
    state: {
      matchId: store.matchId,
      isHost: store.isHost,
      status: store.status,
      phase: store.phase,
      currentTurn: store.currentTurn,
      maxTurns: store.maxTurns,
      turnTimer: store.turnTimer,
      turnTimeLimit: store.turnTimeLimit,
      activePlayerId: store.activePlayerId,
      isMyTurn: store.isMyTurn,
      players: store.players,
      myPlayerId: store.myPlayerId,
      territories: store.territories,
      mapWidth: store.mapWidth,
      mapHeight: store.mapHeight,
      activeCrisis: store.activeCrisis,
      winnerId: store.winnerId,
      winReason: store.winReason,
      openMatches: store.openMatches,
      isLoading: store.isLoading,
      error: store.error,
    },

    // Room management
    createMatch: store.createMatch,
    joinMatch: store.joinMatch,
    leaveMatch: store.leaveMatch,

    // Lobby
    listOpenMatches: store.listOpenMatches,

    // Preparation phase
    setReady: store.setReady,
    placeUnit: store.placeUnit,

    // Turn actions
    startTurn: store.startTurn,
    endTurn: store.endTurn,
    moveArmy: store.moveArmy,
    attackTerritory: store.attackTerritory,
    buildStructure: store.buildStructure,
    recruitUnit: store.recruitUnit,
    collectResources: store.collectResources,

    // Utilities
    getTerritory: store.getTerritory,
    getMyTerritories: store.getMyTerritories,
    getPlayer: store.getPlayer,
    getMyPlayer: store.getMyPlayer,
    clearError: store.clearError,
  };
}

// Alias for compatibility
export { useMatch as useMatchColyseus };

export function useMatchState() {
  const store = useMatchStore();
  return {
    matchId: store.matchId,
    isHost: store.isHost,
    status: store.status,
    phase: store.phase,
    currentTurn: store.currentTurn,
    maxTurns: store.maxTurns,
    turnTimer: store.turnTimer,
    turnTimeLimit: store.turnTimeLimit,
    activePlayerId: store.activePlayerId,
    isMyTurn: store.isMyTurn,
    players: store.players,
    myPlayerId: store.myPlayerId,
    territories: store.territories,
    mapWidth: store.mapWidth,
    mapHeight: store.mapHeight,
    activeCrisis: store.activeCrisis,
    winnerId: store.winnerId,
    winReason: store.winReason,
    openMatches: store.openMatches,
    isLoading: store.isLoading,
    error: store.error,
  };
}

export function useCurrentMatch() {
  const store = useMatchStore();
  return {
    matchId: store.matchId,
    status: store.status,
    phase: store.phase,
  };
}

export function useOpenMatches() {
  return useMatchStore((state) => state.openMatches);
}

export function usePreparationData() {
  const store = useMatchStore();
  const myPlayer = store.players.find((p) => p.odataId === store.myPlayerId);
  return {
    players: store.players,
    territories: store.territories,
    isReady: myPlayer?.isReady,
  };
}

export function useMatchMapData() {
  const store = useMatchStore();
  return {
    territories: store.territories,
    mapWidth: store.mapWidth,
    mapHeight: store.mapHeight,
    players: store.players,
    status: store.status,
  };
}

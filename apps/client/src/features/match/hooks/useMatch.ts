// client/src/features/match/hooks/useMatch.ts
// Hook para Match usando Zustand store

import { useMatchStore } from "../../../stores";

export function useMatch() {
  const store = useMatchStore();

  // Listeners são inicializados pelo StoreInitializer - não duplicar aqui

  // Propriedades de compatibilidade
  const currentMatch = store.matchId
    ? {
        id: store.matchId,
        status: store.status,
        phase: store.phase,
      }
    : null;

  const completeMatchState = store.matchId
    ? {
        matchId: store.matchId,
        status: store.status,
        phase: store.phase,
        currentTurn: store.currentTurn,
        maxTurns: store.maxTurns,
        activePlayerId: store.activePlayerId,
        players: store.players,
        territories: store.territories,
      }
    : null;

  const myPlayer = store.players.find((p) => p.odataId === store.myPlayerId);
  const preparationData = {
    players: store.players,
    territories: store.territories,
    isReady: myPlayer?.isReady ?? false,
  };

  const matchMapData = {
    territories: store.territories,
    mapWidth: store.mapWidth,
    mapHeight: store.mapHeight,
    players: store.players,
    status: store.status,
  };

  const waitingForPlayers = store.players.filter((p) => !p.hasFinishedTurn);

  return {
    // State object for backwards compatibility
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

    // Direct properties for component compatibility
    currentMatch,
    completeMatchState,
    preparationData,
    matchMapData,
    myPlayerId: store.myPlayerId,
    isMyTurn: store.isMyTurn,
    isLoading: store.isLoading,
    error: store.error,
    waitingForPlayers,

    // Methods
    getPreparationData: () => preparationData,
    setPlayerReady: store.setReady,
    requestMatchState: () => {
      /* State is synced via Colyseus */
    },
    requestMapData: () => {
      /* Map data is synced via Colyseus */
    },
    finishTurn: store.endTurn,

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

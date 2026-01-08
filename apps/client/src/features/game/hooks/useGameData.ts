// client/src/features/game/hooks/useGameData.ts
// Hook para dados do jogo usando Zustand store

import { useGameDataStore } from "../../../stores";

export function useGameData() {
  const store = useGameDataStore();

  return {
    state: {
      terrains: store.terrains,
      structures: store.structures,
      isLoading: store.isLoading,
      error: store.error,
    },
    loadTerrains: store.loadTerrains,
    loadStructures: store.loadStructures,
  };
}

export function useGameDataState() {
  const store = useGameDataStore();
  return {
    terrains: store.terrains,
    structures: store.structures,
    isLoading: store.isLoading,
    error: store.error,
  };
}

export function useTerrains() {
  return useGameDataStore((state) => state.terrains);
}

export function useStructures() {
  return useGameDataStore((state) => state.structures);
}

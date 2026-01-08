// client/src/features/map/hooks/useMap.ts
// Hook para gerenciamento de mapa usando Zustand store

import { useMapStore } from "../../../stores";

export function useMap() {
  const store = useMapStore();

  return {
    state: {
      territories: store.territories,
      selectedTerritory: store.selectedTerritory,
      isLoading: store.isLoading,
      error: store.error,
    },
    requestMapData: store.requestMapData,
    selectTerritory: store.selectTerritory,
    loadMapData: store.loadMapData,
  };
}

export function useMapState() {
  const store = useMapStore();
  return {
    territories: store.territories,
    selectedTerritory: store.selectedTerritory,
    isLoading: store.isLoading,
    error: store.error,
  };
}

export function useTerritories() {
  return useMapStore((state) => state.territories);
}

export function useSelectedTerritory() {
  return useMapStore((state) => state.selectedTerritory);
}

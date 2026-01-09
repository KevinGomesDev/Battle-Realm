// client/src/stores/mapStore.ts
// Store Zustand para gerenciamento de mapa

import { create } from "zustand";
import { colyseusService } from "../services/colyseus.service";
import type { Territory } from "../features/map/types/map.types";
import type { MatchMapData } from "../features/match/types/match.types";

interface MapState {
  territories: Territory[];
  selectedTerritory: Territory | null;
  isLoading: boolean;
  error: string | null;
}

interface MapActions {
  requestMapData: (matchId?: string) => Promise<Territory[]>;
  selectTerritory: (territory: Territory | null) => void;
  loadMapData: () => Promise<void>;
  setTerritories: (territories: Territory[]) => void;
  setSelected: (territory: Territory | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: MapState = {
  territories: [],
  selectedTerritory: null,
  isLoading: false,
  error: null,
};

export const useMapStore = create<MapState & MapActions>((set, _get) => ({
  ...initialState,

  setTerritories: (territories) => set({ territories }),

  setSelected: (selectedTerritory) => set({ selectedTerritory }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),

  selectTerritory: (territory) => set({ selectedTerritory: territory }),

  requestMapData: async (matchId) => {
    set({ isLoading: true });

    try {
      const mapData = await colyseusService.sendToMatchAndWait<MatchMapData>(
        "request_map",
        { matchId },
        "match:map_data"
      );

      set({ territories: mapData.territories, isLoading: false });
      return mapData.territories;
    } catch (error: any) {
      set({ error: error?.message, isLoading: false });
      throw error;
    }
  },

  loadMapData: async () => {
    set({ isLoading: true });

    try {
      const mapData = await colyseusService.sendAndWait<{
        territories: Territory[];
      }>("map:load", undefined, "map:loaded");

      set({ territories: mapData.territories || [], isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },
}));

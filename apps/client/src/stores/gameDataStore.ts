// client/src/stores/gameDataStore.ts
// Store Zustand para dados do jogo

import { create } from "zustand";
import { colyseusService } from "../services/colyseus.service";
import type {
  TerrainType,
  StructureInfo,
} from "../features/game/types/game-data.types";

interface GameDataState {
  terrains: Record<string, TerrainType>;
  structures: StructureInfo[];
  isLoading: boolean;
  error: string | null;
}

interface GameDataActions {
  loadTerrains: () => Promise<Record<string, TerrainType>>;
  loadStructures: () => Promise<StructureInfo[]>;
  setTerrains: (terrains: Record<string, TerrainType>) => void;
  setStructures: (structures: StructureInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: GameDataState = {
  terrains: {},
  structures: [],
  isLoading: false,
  error: null,
};

export const useGameDataStore = create<GameDataState & GameDataActions>(
  (set, get) => ({
    ...initialState,

    setTerrains: (terrains) => set({ terrains }),

    setStructures: (structures) => set({ structures }),

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    reset: () => set(initialState),

    loadTerrains: async () => {
      set({ isLoading: true });

      try {
        const terrains = await colyseusService.sendAndWait<
          Record<string, TerrainType>
        >("game:get_terrains", undefined, "game:terrains_data");

        set({ terrains, isLoading: false });
        return terrains;
      } catch (error: any) {
        set({ error: error?.message, isLoading: false });
        throw error;
      }
    },

    loadStructures: async () => {
      set({ isLoading: true });

      try {
        const data = await colyseusService.sendAndWait<
          StructureInfo[] | { structures: StructureInfo[] }
        >("game:get_structures", {}, "game:structures_data");

        const structures = Array.isArray(data) ? data : data.structures || [];

        set({ structures, isLoading: false });
        return structures;
      } catch (error: any) {
        set({ error: error?.message, isLoading: false });
        throw error;
      }
    },
  })
);

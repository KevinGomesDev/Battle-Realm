// Game Data Types - Re-exports shared types and adds frontend-specific types
// FONTE DE VERDADE: shared/types/map.types.ts (for terrain/structure info)

// ============ RE-EXPORT SHARED TYPES ============
export type {
  TerrainTypeConfig as TerrainType,
  StructureInfo,
} from "../../../../../shared/types/map.types";

// ============ FRONTEND-SPECIFIC STATE ============

import type {
  TerrainTypeConfig,
  StructureInfo,
} from "../../../../../shared/types/map.types";

export interface GameDataState {
  terrains: Record<string, TerrainTypeConfig>;
  structures: StructureInfo[];
  isLoading: boolean;
  error: string | null;
}

export interface GameDataContextType {
  state: GameDataState;
  loadTerrains: () => Promise<Record<string, TerrainTypeConfig>>;
  loadStructures: () => Promise<StructureInfo[]>;
}

export type GameDataAction =
  | { type: "SET_TERRAINS"; payload: Record<string, TerrainTypeConfig> }
  | { type: "SET_STRUCTURES"; payload: StructureInfo[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

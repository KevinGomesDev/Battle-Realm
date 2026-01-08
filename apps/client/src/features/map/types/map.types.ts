// Map Types - Re-exports shared types and adds frontend-specific types
// FONTE DE VERDADE: shared/types/map.types.ts

// ============ RE-EXPORT SHARED TYPES ============
export type {
  TerrainName,
  TerritorySize,
  TerritoryType,
  Territory,
  TerrainTypeConfig,
  StructureInfo,
} from "@boundless/shared/types/map.types";

// ============ FRONTEND-SPECIFIC STATE ============

import type { Territory } from "@boundless/shared/types/map.types";

export interface MapState {
  territories: Territory[];
  selectedTerritory: Territory | null;
  isLoading: boolean;
  error: string | null;
}

export interface MapContextType {
  state: MapState;
  requestMapData: (matchId?: string) => Promise<Territory[]>;
  selectTerritory: (territory: Territory | null) => void;
  loadMapData: () => Promise<void>;
}

export type MapAction =
  | { type: "SET_TERRITORIES"; payload: Territory[] }
  | { type: "SET_SELECTED"; payload: Territory | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

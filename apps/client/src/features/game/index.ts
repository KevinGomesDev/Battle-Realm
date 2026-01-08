// Game Data Feature - Public API
// Migrado para Zustand - Context removido

export {
  useGameData,
  useGameDataState,
  useTerrains,
  useStructures,
} from "./hooks/useGameData";
export type {
  TerrainType,
  StructureInfo,
  GameDataState,
  GameDataContextType,
  GameDataAction,
} from "./types/game-data.types";

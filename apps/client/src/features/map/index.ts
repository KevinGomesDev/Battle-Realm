// Map Feature - Public API
// Migrado para Zustand - Context removido

export {
  useMap,
  useMapState,
  useTerritories,
  useSelectedTerritory,
} from "./hooks/useMap";
export { MapCanvas, TopHUD, RightSidebar, TerritoryModal } from "./components";
export type {
  Territory,
  TerrainName,
  MapState,
  MapContextType,
  MapAction,
} from "./types/map.types";
export type {
  TerritoryArea,
  AvailableStructure,
  MapTerritory,
  MapPlayer,
} from "./components";

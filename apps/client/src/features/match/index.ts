// Match Feature - Public API
// Migrado para Zustand - Context removido

// Hooks
export {
  useMatch,
  useMatchState,
  useCurrentMatch,
  useOpenMatches,
  usePreparationData,
  useMatchMapData,
} from "./hooks/useMatch";
export {
  MatchList,
  MatchLobby,
  MatchStatusDisplay,
  PlayerResourcesDisplay,
  MatchControls,
} from "./components";
export type {
  Match,
  MatchStatus,
  TurnType,
  OpenMatch,
  MatchKingdom,
  PlayerResources,
  MatchMapData,
  PreparationData,
  CompleteMatchState,
  MatchState,
  MatchContextType,
  MatchAction,
} from "./types/match.types";

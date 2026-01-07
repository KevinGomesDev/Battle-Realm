// Re-export from MatchColyseusContext
// Este arquivo mantém compatibilidade com código antigo

import { useMatchColyseus } from "../context/MatchColyseusContext";

export { useMatchColyseus as useMatch };

/**
 * Hook para acessar apenas o estado do Match
 */
export function useMatchState() {
  const { state } = useMatchColyseus();
  return state;
}

/**
 * Hook para acessar o match atual (por compatibilidade)
 */
export function useCurrentMatch() {
  const { state } = useMatchColyseus();
  return {
    matchId: state.matchId,
    status: state.status,
    phase: state.phase,
  };
}

/**
 * Hook para listar partidas abertas (stub - funcionalidade via Colyseus matchmaker)
 */
export function useOpenMatches() {
  // Com Colyseus, partidas abertas são gerenciadas via matchmaker
  return [];
}

/**
 * Hook para dados de preparação (por compatibilidade)
 */
export function usePreparationData() {
  const { state } = useMatchColyseus();
  return {
    players: state.players,
    territories: state.territories,
    isReady: state.players.find((p) => p.odataUserId === state.myPlayerId)
      ?.isReady,
  };
}

/**
 * Hook para dados do mapa (por compatibilidade)
 */
export function useMatchMapData() {
  const { state } = useMatchColyseus();
  return {
    territories: state.territories,
    mapWidth: state.mapWidth,
    mapHeight: state.mapHeight,
    players: state.players,
    status: state.status,
  };
}

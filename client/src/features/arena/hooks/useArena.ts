// Re-export from ArenaColyseusContext
// Este arquivo mantém compatibilidade com código antigo

import { useContext } from "react";
import {
  useArenaColyseus,
  ArenaColyseusContext,
} from "../context/ArenaColyseusContext";

export { useArenaColyseus as useArena };

// Hooks opcionais - podem ser removidos se não usados
export function useArenaOptional() {
  const context = useContext(ArenaColyseusContext);
  return context;
}

/**
 * Hook para acessar apenas o estado da Arena
 */
export function useArenaState() {
  const { state } = useArenaColyseus();
  return state;
}

/**
 * Hook para verificar se está em um lobby
 */
export function useArenaLobby() {
  const { state, leaveLobby, startBattle } = useArenaColyseus();
  return {
    lobbyId: state.lobbyId,
    isHost: state.isHost,
    isInLobby: state.lobbyId !== null,
    leaveLobby,
    startBattle,
  };
}

/**
 * Hook para acessar dados da batalha
 */
export function useArenaBattle() {
  const {
    state,
    beginAction,
    moveUnit,
    attackUnit,
    endAction,
    executeAction,
    castSpell,
    surrender,
  } = useArenaColyseus();
  return {
    status: state.status,
    units: state.units,
    isInBattle: state.status === "ACTIVE",
    beginAction,
    moveUnit,
    attackUnit,
    endAction,
    executeAction,
    castSpell,
    surrender,
  };
}

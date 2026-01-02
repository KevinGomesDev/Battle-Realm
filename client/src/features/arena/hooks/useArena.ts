import { useContext } from "react";
import { ArenaContext } from "../context/ArenaContext";
import type { ArenaContextType, ArenaState } from "../types/arena.types";

/**
 * Hook principal para acessar o contexto da Arena
 */
export function useArena(): ArenaContextType {
  const context = useContext(ArenaContext);
  if (!context) {
    throw new Error("useArena deve ser usado dentro de um ArenaProvider");
  }
  return context;
}

/**
 * Hook para acessar apenas o estado da Arena
 */
export function useArenaState(): ArenaState {
  const { state } = useArena();
  return state;
}

/**
 * Hook para verificar se está em um lobby
 */
export function useArenaLobby() {
  const { state, leaveLobby, startBattle } = useArena();
  return {
    lobby: state.currentLobby,
    isHost: state.isHost,
    isInLobby: state.currentLobby !== null,
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
    surrender,
  } = useArena();
  return {
    battle: state.battle,
    units: state.units,
    isInBattle: state.battle !== null && state.battle.status === "ACTIVE",
    beginAction,
    moveUnit,
    attackUnit,
    endAction,
    executeAction,
    surrender,
  };
}

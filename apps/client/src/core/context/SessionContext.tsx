// client/src/core/context/SessionContext.tsx
// Contexto de gerenciamento de sessão usando Colyseus

import {
  createContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
} from "react";
import type {
  SessionState,
  SessionAction,
  ActiveSessionFrontend,
  SessionType,
} from "../../../../shared/types/session.types";
import { colyseusService } from "../../services/colyseus.service";

// ============================================
// Types
// ============================================

export interface SessionContextType {
  state: SessionState;
  checkSession: (userId: string) => Promise<void>;
  canJoinSession: (userId: string) => Promise<boolean>;
  clearSession: () => void;
}

// ============================================
// Initial State & Reducer
// ============================================

const initialState: SessionState = {
  activeSession: null,
  isChecking: false,
  canJoin: true,
  canJoinReason: null,
};

function sessionReducer(
  state: SessionState,
  action: SessionAction
): SessionState {
  switch (action.type) {
    case "SET_ACTIVE_SESSION":
      return { ...state, activeSession: action.payload };
    case "SET_CHECKING":
      return { ...state, isChecking: action.payload };
    case "SET_CAN_JOIN":
      return {
        ...state,
        canJoin: action.payload.canJoin,
        canJoinReason: action.payload.reason,
      };
    case "CLEAR_SESSION":
      return initialState;
    default:
      return state;
  }
}

// ============================================
// Helpers
// ============================================

/**
 * Normaliza o tipo de sessão do backend (UPPER_CASE) para frontend
 */
function normalizeSessionType(type: string): SessionType | null {
  const typeMap: Record<string, SessionType> = {
    MATCH: "MATCH",
    BATTLE_LOBBY: "BATTLE_LOBBY",
    BATTLE_SESSION: "BATTLE_SESSION",
    match: "MATCH",
  };
  return typeMap[type] || null;
}

// ============================================
// Context
// ============================================

export const SessionContext = createContext<SessionContextType | undefined>(
  undefined
);

// ============================================
// Provider
// ============================================

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  // Ref para rastrear operações em andamento (evita memory leaks)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Escutar eventos de sessão do Colyseus
  useEffect(() => {
    const handleSessionActive = (data: {
      type: string;
      matchId?: string;
      battleId?: string;
      lobbyId?: string;
    }) => {
      dispatch({
        type: "SET_ACTIVE_SESSION",
        payload: {
          type: normalizeSessionType(data.type),
          matchId: data.matchId,
          battleId: data.battleId,
          lobbyId: data.lobbyId,
        },
      });
    };

    const handleSessionNone = () => {
      dispatch({ type: "SET_ACTIVE_SESSION", payload: null });
    };

    colyseusService.on("session:active", handleSessionActive);
    colyseusService.on("session:none", handleSessionNone);

    return () => {
      colyseusService.off("session:active", handleSessionActive);
      colyseusService.off("session:none", handleSessionNone);
    };
  }, []);

  /**
   * Verifica se há uma sessão ativa (partida/batalha)
   */
  const checkSession = useCallback(async (userId: string) => {
    if (!userId) return;

    // Abortar operação anterior se existir
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    dispatch({ type: "SET_CHECKING", payload: true });

    try {
      // Enviar mensagem para verificar sessão via GlobalRoom
      colyseusService.sendToGlobal("session:check", { userId });

      // Esperar resposta (com timeout)
      const result = await new Promise<{
        hasSession: boolean;
        session: ActiveSessionFrontend | null;
      }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          colyseusService.off("session:active", handleActive);
          colyseusService.off("session:none", handleNone);
          reject(new Error("Timeout ao verificar sessão"));
        }, 5000);

        const handleActive = (data: {
          type: string;
          matchId?: string;
          battleId?: string;
          lobbyId?: string;
        }) => {
          clearTimeout(timeout);
          colyseusService.off("session:active", handleActive);
          colyseusService.off("session:none", handleNone);
          resolve({
            hasSession: true,
            session: {
              type: normalizeSessionType(data.type),
              matchId: data.matchId,
              battleId: data.battleId,
              lobbyId: data.lobbyId,
            },
          });
        };

        const handleNone = () => {
          clearTimeout(timeout);
          colyseusService.off("session:active", handleActive);
          colyseusService.off("session:none", handleNone);
          resolve({ hasSession: false, session: null });
        };

        colyseusService.on("session:active", handleActive);
        colyseusService.on("session:none", handleNone);
      });

      // Verificar se a operação foi abortada
      if (signal.aborted) return;

      dispatch({ type: "SET_ACTIVE_SESSION", payload: result.session });
    } catch (error) {
      if (signal.aborted) return;
      console.error("[Session] Erro ao verificar sessão:", error);
      dispatch({ type: "SET_ACTIVE_SESSION", payload: null });
    } finally {
      if (!signal.aborted) {
        dispatch({ type: "SET_CHECKING", payload: false });
      }
    }
  }, []);

  /**
   * Verifica se pode entrar em nova sessão
   */
  const canJoinSession = useCallback(
    async (userId: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        // Com Colyseus, verificamos baseado no estado atual das rooms
        const isInBattle = colyseusService.isInBattle();
        const isInMatch = colyseusService.isInMatch();

        if (isInBattle || isInMatch) {
          dispatch({
            type: "SET_CAN_JOIN",
            payload: {
              canJoin: false,
              reason: isInBattle
                ? "Já está em uma Batalha"
                : "Já está em uma partida",
            },
          });
          return false;
        }

        dispatch({
          type: "SET_CAN_JOIN",
          payload: { canJoin: true, reason: null },
        });
        return true;
      } catch (error) {
        console.error("[Session] Erro ao verificar permissão:", error);
        dispatch({
          type: "SET_CAN_JOIN",
          payload: { canJoin: false, reason: "Erro ao verificar sessão" },
        });
        return false;
      }
    },
    []
  );

  /**
   * Limpa a sessão ativa
   */
  const clearSession = useCallback(() => {
    dispatch({ type: "CLEAR_SESSION" });
  }, []);

  const contextValue: SessionContextType = {
    state,
    checkSession,
    canJoinSession,
    clearSession,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

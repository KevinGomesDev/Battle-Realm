import React, { createContext, useReducer, useCallback } from "react";
import type {
  SessionState,
  SessionContextType,
  SessionAction,
  ActiveSession,
} from "../types/session.types";
import { socketService } from "../../services/socket.service";

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

export const SessionContext = createContext<SessionContextType | undefined>(
  undefined
);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  /**
   * Verifica se há uma sessão ativa (partida/arena)
   */
  const checkSession = useCallback(async (userId: string) => {
    if (!userId) return;

    dispatch({ type: "SET_CHECKING", payload: true });

    try {
      const session = await new Promise<ActiveSession | null>(
        (resolve, reject) => {
          const activeHandler = (data: {
            type: string;
            matchId?: string;
            battleId?: string;
            lobbyId?: string;
            data?: any;
          }) => {
            socketService.off("session:active", activeHandler);
            socketService.off("session:none", noneHandler);
            socketService.off("error", errorHandler);
            resolve({
              type: data.type as any,
              matchId: data.matchId,
              battleId: data.battleId,
              lobbyId: data.lobbyId,
              data: data.data,
            });
          };

          const noneHandler = () => {
            socketService.off("session:active", activeHandler);
            socketService.off("session:none", noneHandler);
            socketService.off("error", errorHandler);
            resolve(null);
          };

          const errorHandler = (data: { message: string }) => {
            socketService.off("session:active", activeHandler);
            socketService.off("session:none", noneHandler);
            socketService.off("error", errorHandler);
            reject(new Error(data.message));
          };

          socketService.on("session:active", activeHandler);
          socketService.on("session:none", noneHandler);
          socketService.on("error", errorHandler);

          socketService.emit("session:check", { userId });

          setTimeout(() => {
            socketService.off("session:active", activeHandler);
            socketService.off("session:none", noneHandler);
            socketService.off("error", errorHandler);
            reject(new Error("Timeout ao verificar sessão"));
          }, 5000);
        }
      );

      dispatch({ type: "SET_ACTIVE_SESSION", payload: session });
    } catch (error) {
      console.error("[Session] Erro ao verificar sessão:", error);
      dispatch({ type: "SET_ACTIVE_SESSION", payload: null });
    } finally {
      dispatch({ type: "SET_CHECKING", payload: false });
    }
  }, []);

  /**
   * Verifica se pode entrar em nova sessão
   */
  const canJoinSession = useCallback(
    async (userId: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        const result = await new Promise<{
          canJoin: boolean;
          reason: string | null;
        }>((resolve, reject) => {
          const resultHandler = (data: {
            canJoin: boolean;
            reason?: string;
          }) => {
            socketService.off("session:can_join_result", resultHandler);
            socketService.off("error", errorHandler);
            resolve({
              canJoin: data.canJoin,
              reason: data.reason || null,
            });
          };

          const errorHandler = (data: { message: string }) => {
            socketService.off("session:can_join_result", resultHandler);
            socketService.off("error", errorHandler);
            reject(new Error(data.message));
          };

          socketService.on("session:can_join_result", resultHandler);
          socketService.on("error", errorHandler);

          socketService.emit("session:can_join", { userId });

          setTimeout(() => {
            socketService.off("session:can_join_result", resultHandler);
            socketService.off("error", errorHandler);
            reject(new Error("Timeout ao verificar permissão"));
          }, 5000);
        });

        dispatch({
          type: "SET_CAN_JOIN",
          payload: { canJoin: result.canJoin, reason: result.reason },
        });

        return result.canJoin;
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

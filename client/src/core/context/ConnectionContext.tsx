import React, {
  createContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";
import type {
  ConnectionState,
  ConnectionContextType,
  ConnectionAction,
} from "../types/connection.types";
import { socketService } from "../../services/socket.service";

const initialState: ConnectionState = {
  isConnected: false,
  isReconnecting: false,
  reconnectAttempt: 0,
  error: null,
};

function connectionReducer(
  state: ConnectionState,
  action: ConnectionAction
): ConnectionState {
  switch (action.type) {
    case "SET_CONNECTED":
      return {
        ...state,
        isConnected: action.payload,
        isReconnecting: false,
        reconnectAttempt: 0,
      };
    case "SET_RECONNECTING":
      return { ...state, isReconnecting: action.payload };
    case "SET_RECONNECT_ATTEMPT":
      return { ...state, reconnectAttempt: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export const ConnectionContext = createContext<
  ConnectionContextType | undefined
>(undefined);

export function ConnectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(connectionReducer, initialState);

  const connect = useCallback(async (url: string = "http://localhost:3000") => {
    try {
      await socketService.connect(url);
      dispatch({ type: "SET_CONNECTED", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      // Setup global socket listeners
      socketService.on("socket:connected", (_data: { socketId: string }) => {
        // Conexão estabelecida
      });

      socketService.on(
        "socket:error",
        (data: { error: { message: string } }) => {
          console.error("[Connection] Socket error:", data.error);
          dispatch({ type: "SET_ERROR", payload: data.error?.message });
        }
      );
    } catch (error: any) {
      const errorMessage = error?.message || "Falha ao conectar ao servidor";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    socketService.disconnect();
    dispatch({ type: "SET_CONNECTED", payload: false });
  }, []);

  // Listen for socket.io native events
  useEffect(() => {
    const handleConnect = () => {
      dispatch({ type: "SET_CONNECTED", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });
    };

    const handleDisconnect = (reason: string) => {
      console.warn("🔴 Desconectado:", reason);
      dispatch({ type: "SET_CONNECTED", payload: false });

      // Se não foi desconexão intencional, marcar como reconectando
      if (reason !== "io client disconnect") {
        dispatch({ type: "SET_RECONNECTING", payload: true });
      }
    };

    const handleReconnect = (_attemptNumber: number) => {
      dispatch({ type: "SET_CONNECTED", payload: true });
      dispatch({ type: "SET_RECONNECTING", payload: false });
      dispatch({ type: "SET_RECONNECT_ATTEMPT", payload: 0 });
    };

    const handleReconnectAttempt = (attemptNumber: number) => {
      dispatch({ type: "SET_RECONNECT_ATTEMPT", payload: attemptNumber });
    };

    const handleReconnectError = (error: Error) => {
      console.error("❌ Erro ao reconectar:", error.message);
      dispatch({ type: "SET_ERROR", payload: "Erro ao reconectar" });
    };

    const handleReconnectFailed = () => {
      console.error("❌ Falha total na reconexão");
      dispatch({ type: "SET_RECONNECTING", payload: false });
      dispatch({
        type: "SET_ERROR",
        payload: "Falha ao reconectar. Recarregue a página.",
      });
    };

    // Socket.io native events
    socketService.on("connect", handleConnect);
    socketService.on("disconnect", handleDisconnect);
    socketService.on("reconnect", handleReconnect);
    socketService.on("reconnect_attempt", handleReconnectAttempt);
    socketService.on("reconnect_error", handleReconnectError);
    socketService.on("reconnect_failed", handleReconnectFailed);

    return () => {
      socketService.off("connect", handleConnect);
      socketService.off("disconnect", handleDisconnect);
      socketService.off("reconnect", handleReconnect);
      socketService.off("reconnect_attempt", handleReconnectAttempt);
      socketService.off("reconnect_error", handleReconnectError);
      socketService.off("reconnect_failed", handleReconnectFailed);
    };
  }, []);

  const contextValue: ConnectionContextType = {
    state,
    connect,
    disconnect,
  };

  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
    </ConnectionContext.Provider>
  );
}

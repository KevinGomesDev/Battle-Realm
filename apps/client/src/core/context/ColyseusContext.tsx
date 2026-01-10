// client/src/core/context/ColyseusContext.tsx
// Contexto principal de conexão Colyseus

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  colyseusService,
  type GlobalRoomState,
} from "../../services/colyseus.service";

// ============================================
// Types
// ============================================

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  error: string | null;
  globalState: GlobalRoomState | null;
}

type ConnectionAction =
  | { type: "SET_CONNECTING"; payload: boolean }
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_RECONNECTING"; payload: boolean }
  | { type: "SET_RECONNECT_ATTEMPT"; payload: number }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_GLOBAL_STATE"; payload: GlobalRoomState | null }
  | { type: "RESET" };

interface ColyseusContextType {
  state: ConnectionState;
  isConnected: boolean;
  connect: (url?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (type: string, message?: any) => void;
}

// ============================================
// Initial State & Reducer
// ============================================

const initialState: ConnectionState = {
  isConnected: false,
  isConnecting: false,
  isReconnecting: false,
  reconnectAttempt: 0,
  error: null,
  globalState: null,
};

function connectionReducer(
  state: ConnectionState,
  action: ConnectionAction
): ConnectionState {
  switch (action.type) {
    case "SET_CONNECTING":
      return { ...state, isConnecting: action.payload };
    case "SET_CONNECTED":
      return {
        ...state,
        isConnected: action.payload,
        isConnecting: false,
        isReconnecting: false,
        reconnectAttempt: 0,
      };
    case "SET_RECONNECTING":
      return { ...state, isReconnecting: action.payload };
    case "SET_RECONNECT_ATTEMPT":
      return { ...state, reconnectAttempt: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, isConnecting: false };
    case "SET_GLOBAL_STATE":
      return { ...state, globalState: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

const ColyseusContext = createContext<ColyseusContextType | undefined>(
  undefined
);

// ============================================
// Provider
// ============================================

export function ColyseusProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(connectionReducer, initialState);
  const mountedRef = useRef(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevenir múltiplas inicializações (StrictMode)
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    mountedRef.current = true;

    const handleConnected = () => {
      if (mountedRef.current) {
        dispatch({ type: "SET_CONNECTED", payload: true });
        dispatch({ type: "SET_ERROR", payload: null });
      }
    };

    const handleDisconnected = () => {
      if (mountedRef.current) {
        // Não marcar como desconectado se estiver reconectando
        if (!state.isReconnecting) {
          dispatch({ type: "SET_CONNECTED", payload: false });
        }
      }
    };

    const handleReconnecting = (data?: { attempt?: number }) => {
      if (mountedRef.current) {
        dispatch({ type: "SET_RECONNECTING", payload: true });
        dispatch({ type: "SET_CONNECTED", payload: false });
        if (data?.attempt !== undefined) {
          dispatch({ type: "SET_RECONNECT_ATTEMPT", payload: data.attempt });
        }
      }
    };

    const handleReconnected = () => {
      if (mountedRef.current) {
        dispatch({ type: "SET_CONNECTED", payload: true });
        dispatch({ type: "SET_RECONNECTING", payload: false });
        dispatch({ type: "SET_ERROR", payload: null });
      }
    };

    const handleReconnectFailed = () => {
      if (mountedRef.current) {
        dispatch({ type: "SET_RECONNECTING", payload: false });
        dispatch({ type: "SET_CONNECTED", payload: false });
        dispatch({
          type: "SET_ERROR",
          payload: "Não foi possível reconectar ao servidor",
        });
      }
    };

    const handleError = (data: { code?: number; message?: string }) => {
      if (mountedRef.current) {
        dispatch({
          type: "SET_ERROR",
          payload: data.message || "Erro de conexão",
        });
      }
    };

    const handleGlobalState = (globalState: GlobalRoomState) => {
      if (mountedRef.current) {
        dispatch({ type: "SET_GLOBAL_STATE", payload: globalState });
      }
    };

    const handleConnectionFailed = () => {
      if (mountedRef.current) {
        dispatch({
          type: "SET_ERROR",
          payload: "Falha ao conectar ao servidor",
        });
        dispatch({ type: "SET_CONNECTING", payload: false });
      }
    };

    // Registrar listeners
    colyseusService.on("connected", handleConnected);
    colyseusService.on("disconnected", handleDisconnected);
    colyseusService.on("reconnecting", handleReconnecting);
    colyseusService.on("reconnected", handleReconnected);
    colyseusService.on("reconnect_failed", handleReconnectFailed);
    colyseusService.on("error", handleError);
    colyseusService.on("global:state_changed", handleGlobalState);
    colyseusService.on("connection_failed", handleConnectionFailed);

    // Verificar se já está conectado
    if (colyseusService.isConnected()) {
      dispatch({ type: "SET_CONNECTED", payload: true });
      const globalState = colyseusService.getGlobalState();
      if (globalState) {
        dispatch({ type: "SET_GLOBAL_STATE", payload: globalState });
      }
    }

    return () => {
      mountedRef.current = false;
      colyseusService.off("connected", handleConnected);
      colyseusService.off("disconnected", handleDisconnected);
      colyseusService.off("reconnecting", handleReconnecting);
      colyseusService.off("reconnected", handleReconnected);
      colyseusService.off("reconnect_failed", handleReconnectFailed);
      colyseusService.off("error", handleError);
      colyseusService.off("global:state_changed", handleGlobalState);
      colyseusService.off("connection_failed", handleConnectionFailed);
    };
  }, []);

  const connect = useCallback(async (url: string = "ws://localhost:3000") => {
    dispatch({ type: "SET_CONNECTING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      await colyseusService.connect(url);
    } catch (error: any) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await colyseusService.disconnect();
    dispatch({ type: "RESET" });
  }, []);

  const sendMessage = useCallback((type: string, message?: any) => {
    colyseusService.sendToGlobal(type, message);
  }, []);

  return (
    <ColyseusContext.Provider
      value={{
        state,
        isConnected: state.isConnected,
        connect,
        disconnect,
        sendMessage,
      }}
    >
      {children}
    </ColyseusContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useColyseusConnection(): ColyseusContextType {
  const context = useContext(ColyseusContext);
  if (!context) {
    throw new Error(
      "useColyseusConnection must be used within ColyseusProvider"
    );
  }
  return context;
}

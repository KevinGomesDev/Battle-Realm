// client/src/stores/colyseusStore.ts
// Store Zustand para conexão Colyseus

import { create } from "zustand";
import {
  colyseusService,
  type GlobalRoomState,
} from "../services/colyseus.service";

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  error: string | null;
  globalState: GlobalRoomState | null;
}

interface ConnectionActions {
  connect: (url?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (type: string, message?: any) => void;
  setConnecting: (connecting: boolean) => void;
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setReconnectAttempt: (attempt: number) => void;
  setError: (error: string | null) => void;
  setGlobalState: (state: GlobalRoomState | null) => void;
  reset: () => void;
  initializeListeners: () => () => void;
}

const initialState: ConnectionState = {
  isConnected: false,
  isConnecting: false,
  isReconnecting: false,
  reconnectAttempt: 0,
  error: null,
  globalState: null,
};

export const useColyseusStore = create<ConnectionState & ConnectionActions>(
  (set, get) => ({
    ...initialState,

    setConnecting: (isConnecting) => set({ isConnecting }),

    setConnected: (isConnected) =>
      set({
        isConnected,
        isConnecting: false,
        isReconnecting: false,
        reconnectAttempt: 0,
      }),

    setReconnecting: (isReconnecting) => set({ isReconnecting }),

    setReconnectAttempt: (reconnectAttempt) => set({ reconnectAttempt }),

    setError: (error) => set({ error, isConnecting: false }),

    setGlobalState: (globalState) => set({ globalState }),

    reset: () => set(initialState),

    connect: async (url = "ws://localhost:3000") => {
      set({ isConnecting: true, error: null });

      try {
        await colyseusService.connect(url);
      } catch (error: any) {
        set({ error: error.message, isConnecting: false });
        throw error;
      }
    },

    disconnect: async () => {
      await colyseusService.disconnect();
      set(initialState);
    },

    sendMessage: (type, message) => {
      colyseusService.sendToGlobal(type, message);
    },

    initializeListeners: () => {
      const handleConnected = () => {
        set({
          isConnected: true,
          isConnecting: false,
          isReconnecting: false,
          reconnectAttempt: 0,
          error: null,
        });
      };

      const handleDisconnected = () => {
        set({ isConnected: false });
      };

      const handleError = (data: { code?: number; message?: string }) => {
        set({
          error: data.message || "Erro de conexão",
          isConnecting: false,
        });
      };

      const handleGlobalState = (globalState: GlobalRoomState) => {
        set({ globalState });
      };

      const handleConnectionFailed = () => {
        set({
          error: "Falha ao conectar ao servidor",
          isConnecting: false,
        });
      };

      colyseusService.on("connected", handleConnected);
      colyseusService.on("disconnected", handleDisconnected);
      colyseusService.on("error", handleError);
      colyseusService.on("global:state_changed", handleGlobalState);
      colyseusService.on("connection_failed", handleConnectionFailed);

      // Check if already connected
      if (colyseusService.isConnected()) {
        set({ isConnected: true });
        const globalState = colyseusService.getGlobalState();
        if (globalState) {
          set({ globalState });
        }
      }

      // Return cleanup function
      return () => {
        colyseusService.off("connected", handleConnected);
        colyseusService.off("disconnected", handleDisconnected);
        colyseusService.off("error", handleError);
        colyseusService.off("global:state_changed", handleGlobalState);
        colyseusService.off("connection_failed", handleConnectionFailed);
      };
    },
  })
);

// client/src/core/hooks/useColyseus.ts
// Hook principal para conexão Colyseus usando Zustand store

import { useEffect } from "react";
import { useColyseusStore } from "../../stores";
import { colyseusService } from "../../services/colyseus.service";

export function useColyseus(autoConnect: boolean = true) {
  const store = useColyseusStore();

  // Listeners são inicializados pelo StoreInitializer
  // Apenas auto-connect se necessário
  useEffect(() => {
    if (autoConnect && !colyseusService.isConnected()) {
      store.connect().catch((err) => {
        console.error("[Colyseus] Auto-connect failed:", err);
      });
    }
  }, [autoConnect]);

  return {
    isConnected: store.isConnected,
    isConnecting: store.isConnecting,
    error: store.error,
    globalState: store.globalState,
    connect: store.connect,
    disconnect: store.disconnect,
    sendToGlobal: store.sendMessage,
  };
}

// Hook para acessar apenas a conexão (usado pelo provider de inicialização)
export function useColyseusConnection() {
  const store = useColyseusStore();

  return {
    state: {
      isConnected: store.isConnected,
      isConnecting: store.isConnecting,
      isReconnecting: store.isReconnecting,
      reconnectAttempt: store.reconnectAttempt,
      error: store.error,
      globalState: store.globalState,
    },
    isConnected: store.isConnected,
    connect: store.connect,
    disconnect: store.disconnect,
    sendMessage: store.sendMessage,
  };
}

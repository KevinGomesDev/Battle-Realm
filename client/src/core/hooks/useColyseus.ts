// client/src/core/hooks/useColyseus.ts
// Hook principal para conexão Colyseus

import { useState, useEffect, useCallback, useRef } from "react";
import {
  colyseusService,
  type GlobalRoomState,
} from "../../services/colyseus.service";

interface UseColyseusReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  globalState: GlobalRoomState | null;
  connect: (url?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sendToGlobal: (type: string, message?: any) => void;
}

export function useColyseus(autoConnect: boolean = true): UseColyseusReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalState, setGlobalState] = useState<GlobalRoomState | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const handleConnected = () => {
      if (mountedRef.current) {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      }
    };

    const handleDisconnected = () => {
      if (mountedRef.current) {
        setIsConnected(false);
      }
    };

    const handleError = (data: { code?: number; message?: string }) => {
      if (mountedRef.current) {
        setError(data.message || "Erro de conexão");
        setIsConnecting(false);
      }
    };

    const handleStateChanged = (state: GlobalRoomState) => {
      if (mountedRef.current) {
        setGlobalState(state);
      }
    };

    const handleConnectionFailed = () => {
      if (mountedRef.current) {
        setError("Falha ao conectar ao servidor");
        setIsConnecting(false);
      }
    };

    colyseusService.on("connected", handleConnected);
    colyseusService.on("disconnected", handleDisconnected);
    colyseusService.on("error", handleError);
    colyseusService.on("global:state_changed", handleStateChanged);
    colyseusService.on("connection_failed", handleConnectionFailed);

    // Auto-connect se solicitado
    if (autoConnect && !colyseusService.isConnected()) {
      setIsConnecting(true);
      colyseusService.connect().catch((err) => {
        if (mountedRef.current) {
          setError(err.message);
          setIsConnecting(false);
        }
      });
    } else if (colyseusService.isConnected()) {
      setIsConnected(true);
      setGlobalState(colyseusService.getGlobalState());
    }

    return () => {
      mountedRef.current = false;
      colyseusService.off("connected", handleConnected);
      colyseusService.off("disconnected", handleDisconnected);
      colyseusService.off("error", handleError);
      colyseusService.off("global:state_changed", handleStateChanged);
      colyseusService.off("connection_failed", handleConnectionFailed);
    };
  }, [autoConnect]);

  const connect = useCallback(async (url?: string) => {
    setIsConnecting(true);
    setError(null);
    try {
      await colyseusService.connect(url);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await colyseusService.disconnect();
    setIsConnected(false);
    setGlobalState(null);
  }, []);

  const sendToGlobal = useCallback((type: string, message?: any) => {
    colyseusService.sendToGlobal(type, message);
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    globalState,
    connect,
    disconnect,
    sendToGlobal,
  };
}

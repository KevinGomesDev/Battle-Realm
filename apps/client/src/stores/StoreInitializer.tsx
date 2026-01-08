// client/src/stores/StoreInitializer.tsx
// Componente para inicializar listeners das stores Zustand

import { useEffect } from "react";
import { useColyseusStore } from "./colyseusStore";
import { useSessionStore } from "./sessionStore";
import { useBattleStore } from "./battleStore";
import { useMatchStore } from "./matchStore";
import { useEventStore } from "./eventStore";
import { useAuthStore } from "./authStore";
import { colyseusService } from "../services/colyseus.service";

/**
 * StoreInitializer - Inicializa os listeners de todas as stores
 * Este componente deve ser renderizado uma vez na árvore de componentes
 */
export function StoreInitializer({ children }: { children: React.ReactNode }) {
  const userId = useAuthStore((state) => state.user?.id);

  // Initialize Colyseus connection and listeners
  useEffect(() => {
    const cleanup = useColyseusStore.getState().initializeListeners();

    // Auto-connect
    if (!colyseusService.isConnected()) {
      useColyseusStore
        .getState()
        .connect()
        .catch((err) => {
          console.error("[StoreInitializer] Auto-connect failed:", err);
        });
    }

    return cleanup;
  }, []);

  // Initialize Session listeners
  useEffect(() => {
    const cleanup = useSessionStore.getState().initializeListeners();
    return cleanup;
  }, []);

  // Initialize Battle listeners (depends on userId)
  useEffect(() => {
    const cleanup = useBattleStore.getState().initializeListeners(userId);
    return cleanup;
  }, [userId]);

  // Initialize Match listeners (depends on userId)
  useEffect(() => {
    const cleanup = useMatchStore.getState().initializeListeners(userId);
    return cleanup;
  }, [userId]);

  // Initialize Event listeners
  useEffect(() => {
    const cleanup = useEventStore.getState().initializeListeners();
    return cleanup;
  }, []);

  return <>{children}</>;
}

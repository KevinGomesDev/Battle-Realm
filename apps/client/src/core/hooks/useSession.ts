// client/src/core/hooks/useSession.ts
// Hook para sessão usando Zustand store

import { useSessionStore } from "../../stores";

export function useSession() {
  const store = useSessionStore();

  // Listeners são inicializados pelo StoreInitializer - não duplicar aqui

  return {
    state: {
      activeSession: store.activeSession,
      isChecking: store.isChecking,
      canJoin: store.canJoin,
      canJoinReason: store.canJoinReason,
    },
    checkSession: store.checkSession,
    canJoinSession: store.canJoinSession,
    clearSession: store.clearSession,
  };
}

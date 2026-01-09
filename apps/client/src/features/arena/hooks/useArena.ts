// client/src/features/arena/hooks/useArena.ts
// Hook para expor funcionalidades da Arena

import { useEffect, useRef } from "react";
import { useArenaStore } from "../../../stores/arenaStore";
import { useAuth } from "../../auth";
import type {
  Challenge,
  ChallengeKingdomInfo,
} from "@boundless/shared/types/arena.types";

// ============================================
// Types
// ============================================

export interface UseArenaResult {
  // Estado
  state: {
    myPendingChallenges: Challenge[];
    incomingChallenges: Challenge[];
    openChallenges: Challenge[];
    availableOpponents: ChallengeKingdomInfo[];
    activeChallenge: Challenge | null;
    countdown: number | null;
    isLoading: boolean;
    isCreatingChallenge: boolean;
    error: string | null;
    isConnected: boolean;
    hasIncomingChallenges: boolean;
  };

  // Ações
  connect: () => Promise<void>;
  disconnect: () => void;
  createDirectChallenge: (
    challengerKingdomId: string,
    targetUserId: string,
    targetKingdomId: string
  ) => void;
  createOpenChallenge: (challengerKingdomId: string) => void;
  acceptChallenge: (challengeId: string, kingdomId: string) => void;
  declineChallenge: (challengeId: string) => void;
  cancelChallenge: (challengeId: string) => void;
  refreshOpenChallenges: () => void;
  refreshOpponents: () => void;
  clearError: () => void;
}

// ============================================
// Hook
// ============================================

export function useArena(): UseArenaResult {
  const store = useArenaStore();
  const { user } = useAuth();
  const hasInitialized = useRef(false);

  // Inicializar listeners quando o hook monta
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const cleanup = store.initializeListeners();
    return () => {
      hasInitialized.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-conectar quando usuário está autenticado
  useEffect(() => {
    if (user?.id && user?.username) {
      store.connect(user.id, user.username);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.username]);

  // ============================================
  // Actions - usar diretamente do store (estável)
  // ============================================

  const connect = async () => {
    if (!user?.id || !user?.username) {
      console.warn("[useArena] Usuário não autenticado");
      return;
    }
    await store.connect(user.id, user.username);
  };

  // ============================================
  // Return
  // ============================================

  return {
    state: {
      myPendingChallenges: store.myPendingChallenges,
      incomingChallenges: store.incomingChallenges,
      openChallenges: store.openChallenges,
      availableOpponents: store.availableOpponents,
      activeChallenge: store.activeChallenge,
      countdown: store.countdown,
      isLoading: store.isLoading,
      isCreatingChallenge: store.isCreatingChallenge,
      error: store.error,
      isConnected: !store.isLoading && store.error === null,
      hasIncomingChallenges: store.incomingChallenges.length > 0,
    },
    connect,
    disconnect: store.disconnect,
    createDirectChallenge: store.createDirectChallenge,
    createOpenChallenge: store.createOpenChallenge,
    acceptChallenge: store.acceptChallenge,
    declineChallenge: store.declineChallenge,
    cancelChallenge: store.cancelChallenge,
    refreshOpenChallenges: store.refreshOpenChallenges,
    refreshOpponents: store.refreshOpponents,
    clearError: () => store.setError(null),
  };
}

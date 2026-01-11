// client/src/stores/arenaStore.ts
// Store Zustand para Sistema de Arena

import { create } from "zustand";
import { colyseusService } from "../services/colyseus.service";
import type {
  ArenaState,
  Challenge,
  ChallengeKingdomInfo,
  BattleStartingNotification,
} from "@boundless/shared/types/arena.types";

// ============================================
// Constants
// ============================================

const MESSAGES = {
  CREATE_DIRECT: "arena:create_direct",
  CREATE_OPEN: "arena:create_open",
  ACCEPT: "arena:accept",
  DECLINE: "arena:decline",
  CANCEL: "arena:cancel",
  LIST_OPEN: "arena:list_open",
  LIST_OPPONENTS: "arena:list_opponents",
  CHALLENGE_CREATED: "arena:challenge_created",
  CHALLENGE_RECEIVED: "arena:challenge_received",
  CHALLENGE_ACCEPTED: "arena:challenge_accepted",
  CHALLENGE_DECLINED: "arena:challenge_declined",
  CHALLENGE_EXPIRED: "arena:challenge_expired",
  CHALLENGE_CANCELLED: "arena:challenge_cancelled",
  OPEN_CHALLENGES_LIST: "arena:open_challenges_list",
  OPPONENTS_LIST: "arena:opponents_list",
  COUNTDOWN_TICK: "arena:countdown_tick",
  BATTLE_STARTING: "arena:battle_starting",
  ERROR: "arena:error",
} as const;

// ============================================
// Types
// ============================================

interface ArenaActions {
  // Conexão
  connect: (userId: string, username: string) => Promise<void>;
  disconnect: () => void;

  // Desafios
  createDirectChallenge: (
    challengerKingdomId: string,
    targetUserId: string,
    targetKingdomId: string
  ) => void;
  createOpenChallenge: (challengerKingdomId: string) => void;
  acceptChallenge: (challengeId: string, kingdomId: string) => void;
  declineChallenge: (challengeId: string) => void;
  cancelChallenge: (challengeId: string) => void;

  // Listas
  refreshOpenChallenges: () => void;
  refreshOpponents: () => void;

  // Estado
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearActiveChallenge: () => void;
  reset: () => void;

  // Listeners
  initializeListeners: () => () => void;
}

// ============================================
// Initial State
// ============================================

const initialState: ArenaState = {
  myPendingChallenges: [],
  incomingChallenges: [],
  openChallenges: [],
  availableOpponents: [],
  activeChallenge: null,
  countdown: null,
  isLoading: false,
  isCreatingChallenge: false,
  error: null,
};

// ============================================
// Store
// ============================================

export const useArenaStore = create<ArenaState & ArenaActions>((set, get) => ({
  ...initialState,

  // ============================================
  // Conexão
  // ============================================

  connect: async (userId, username) => {
    set({ isLoading: true, error: null });

    try {
      await colyseusService.joinArena(userId, username);
      set({ isLoading: false });
    } catch (error: unknown) {
      console.error("[Arena] Erro ao conectar:", error);
      set({
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Erro ao conectar à arena",
      });
    }
  },

  disconnect: () => {
    colyseusService.leaveArena();
    set(initialState);
  },

  // ============================================
  // Desafios
  // ============================================

  createDirectChallenge: (
    challengerKingdomId,
    targetUserId,
    targetKingdomId
  ) => {
    set({ isCreatingChallenge: true, error: null });
    colyseusService.sendToArena(MESSAGES.CREATE_DIRECT, {
      challengerKingdomId,
      targetUserId,
      targetKingdomId,
    });
  },

  createOpenChallenge: (challengerKingdomId) => {
    set({ isCreatingChallenge: true, error: null });
    colyseusService.sendToArena(MESSAGES.CREATE_OPEN, {
      challengerKingdomId,
    });
  },

  acceptChallenge: (challengeId, kingdomId) => {
    set({ isLoading: true });
    colyseusService.sendToArena(MESSAGES.ACCEPT, { challengeId, kingdomId });
  },

  declineChallenge: (challengeId) => {
    colyseusService.sendToArena(MESSAGES.DECLINE, { challengeId });

    // Remover dos incoming localmente
    set((state) => ({
      incomingChallenges: state.incomingChallenges.filter(
        (c) => c.challengeId !== challengeId
      ),
    }));
  },

  cancelChallenge: (challengeId) => {
    colyseusService.sendToArena(MESSAGES.CANCEL, { challengeId });

    // Remover dos pending localmente
    set((state) => ({
      myPendingChallenges: state.myPendingChallenges.filter(
        (c) => c.challengeId !== challengeId
      ),
    }));
  },

  // ============================================
  // Listas
  // ============================================

  refreshOpenChallenges: () => {
    colyseusService.sendToArena(MESSAGES.LIST_OPEN, {});
  },

  refreshOpponents: () => {
    colyseusService.sendToArena(MESSAGES.LIST_OPPONENTS, {});
  },

  // ============================================
  // Estado
  // ============================================

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) =>
    set({ error, isLoading: false, isCreatingChallenge: false }),

  clearActiveChallenge: () => set({ activeChallenge: null, countdown: null }),

  reset: () => set(initialState),

  // ============================================
  // Listeners
  // ============================================

  initializeListeners: () => {
    // Desafio criado com sucesso
    const handleChallengeCreated = (data: {
      success: boolean;
      challenge?: Challenge;
      error?: string;
    }) => {
      if (data.success && data.challenge) {
        set((state) => ({
          myPendingChallenges: [...state.myPendingChallenges, data.challenge!],
          isCreatingChallenge: false,
        }));
      } else {
        set({
          isCreatingChallenge: false,
          error: data.error || "Erro ao criar desafio",
        });
      }
    };

    // Desafio recebido
    const handleChallengeReceived = (data: { challenge: Challenge }) => {
      set((state) => ({
        incomingChallenges: [...state.incomingChallenges, data.challenge],
      }));
    };

    // Desafio aceito (ambos recebem)
    const handleChallengeAccepted = (data: {
      challenge: Challenge;
      countdown: number;
    }) => {
      set({
        activeChallenge: data.challenge,
        countdown: data.countdown,
        isLoading: false,
        // Remover das listas pendentes
        myPendingChallenges: get().myPendingChallenges.filter(
          (c) => c.challengeId !== data.challenge.challengeId
        ),
        incomingChallenges: get().incomingChallenges.filter(
          (c) => c.challengeId !== data.challenge.challengeId
        ),
      });
    };

    // Desafio recusado
    const handleChallengeDeclined = (data: {
      challengeId: string;
      declinedBy: string;
    }) => {
      set((state) => ({
        myPendingChallenges: state.myPendingChallenges.filter(
          (c) => c.challengeId !== data.challengeId
        ),
      }));
    };

    // Desafio expirado
    const handleChallengeExpired = (data: { challengeId: string }) => {
      set((state) => ({
        myPendingChallenges: state.myPendingChallenges.filter(
          (c) => c.challengeId !== data.challengeId
        ),
        incomingChallenges: state.incomingChallenges.filter(
          (c) => c.challengeId !== data.challengeId
        ),
      }));
    };

    // Desafio cancelado
    const handleChallengeCancelled = (data: { challengeId: string }) => {
      set((state) => ({
        incomingChallenges: state.incomingChallenges.filter(
          (c) => c.challengeId !== data.challengeId
        ),
        openChallenges: state.openChallenges.filter(
          (c) => c.challengeId !== data.challengeId
        ),
      }));
    };

    // Lista de desafios abertos
    const handleOpenChallengesList = (data: { challenges: Challenge[] }) => {
      set({ openChallenges: data.challenges });
    };

    // Lista de oponentes
    const handleOpponentsList = (data: {
      opponents: ChallengeKingdomInfo[];
    }) => {
      set({ availableOpponents: data.opponents });
    };

    // Countdown tick
    const handleCountdownTick = (data: {
      challengeId: string;
      countdown: number;
    }) => {
      const { activeChallenge } = get();
      if (activeChallenge?.challengeId === data.challengeId) {
        set({ countdown: data.countdown });
      }
    };

    // Batalha iniciando
    const handleBattleStarting = (data: BattleStartingNotification) => {
      // Limpar estado da arena quando batalha inicia
      set({
        activeChallenge: null,
        countdown: null,
        isCreatingChallenge: false,
      });
      // Nota: O ArenaSection já escuta diretamente o evento arena:battle_starting
      // e cuida do join na BattleRoom e navegação
    };

    // Erro
    const handleError = (data: { error: string }) => {
      set({ error: data.error, isLoading: false, isCreatingChallenge: false });
      console.error("[Arena] ❌ Erro:", data.error);
    };

    // Registrar listeners
    colyseusService.on(MESSAGES.CHALLENGE_CREATED, handleChallengeCreated);
    colyseusService.on(MESSAGES.CHALLENGE_RECEIVED, handleChallengeReceived);
    colyseusService.on(MESSAGES.CHALLENGE_ACCEPTED, handleChallengeAccepted);
    colyseusService.on(MESSAGES.CHALLENGE_DECLINED, handleChallengeDeclined);
    colyseusService.on(MESSAGES.CHALLENGE_EXPIRED, handleChallengeExpired);
    colyseusService.on(MESSAGES.CHALLENGE_CANCELLED, handleChallengeCancelled);
    colyseusService.on(MESSAGES.OPEN_CHALLENGES_LIST, handleOpenChallengesList);
    colyseusService.on(MESSAGES.OPPONENTS_LIST, handleOpponentsList);
    colyseusService.on(MESSAGES.COUNTDOWN_TICK, handleCountdownTick);
    colyseusService.on(MESSAGES.BATTLE_STARTING, handleBattleStarting);
    colyseusService.on(MESSAGES.ERROR, handleError);

    // Cleanup
    return () => {
      colyseusService.off(MESSAGES.CHALLENGE_CREATED, handleChallengeCreated);
      colyseusService.off(MESSAGES.CHALLENGE_RECEIVED, handleChallengeReceived);
      colyseusService.off(MESSAGES.CHALLENGE_ACCEPTED, handleChallengeAccepted);
      colyseusService.off(MESSAGES.CHALLENGE_DECLINED, handleChallengeDeclined);
      colyseusService.off(MESSAGES.CHALLENGE_EXPIRED, handleChallengeExpired);
      colyseusService.off(
        MESSAGES.CHALLENGE_CANCELLED,
        handleChallengeCancelled
      );
      colyseusService.off(
        MESSAGES.OPEN_CHALLENGES_LIST,
        handleOpenChallengesList
      );
      colyseusService.off(MESSAGES.OPPONENTS_LIST, handleOpponentsList);
      colyseusService.off(MESSAGES.COUNTDOWN_TICK, handleCountdownTick);
      colyseusService.off(MESSAGES.BATTLE_STARTING, handleBattleStarting);
      colyseusService.off(MESSAGES.ERROR, handleError);
    };
  },
}));

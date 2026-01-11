// client/src/stores/sessionStore.ts
// Store Zustand para gerenciamento de sessão

import { create } from "zustand";
import { colyseusService } from "../services/colyseus.service";
import type {
  SessionState,
  ActiveSessionFrontend,
  SessionType,
} from "@boundless/shared/types/session.types";

/**
 * Normaliza o tipo de sessão do backend (UPPER_CASE) para frontend
 */
function normalizeSessionType(type: string): SessionType | null {
  const typeMap: Record<string, SessionType> = {
    MATCH: "MATCH",
    BATTLE_LOBBY: "BATTLE_LOBBY",
    BATTLE_SESSION: "BATTLE_SESSION",
    match: "MATCH",
    battle_lobby: "BATTLE_LOBBY",
    battle_session: "BATTLE_SESSION",
  };
  return typeMap[type] || null;
}

interface SessionActions {
  checkSession: (userId: string) => Promise<void>;
  canJoinSession: (userId: string) => Promise<boolean>;
  clearSession: () => void;
  setActiveSession: (session: ActiveSessionFrontend | null) => void;
  setChecking: (checking: boolean) => void;
  setCanJoin: (canJoin: boolean, reason: string | null) => void;
  initializeListeners: () => () => void;
  resetCheckFlag: () => void;
}

// Flag externa para evitar múltiplas verificações entre remontagens de componentes
let hasCheckedOnce = false;

const initialState: SessionState = {
  activeSession: null,
  isChecking: false,
  canJoin: true,
  canJoinReason: null,
};

export const useSessionStore = create<SessionState & SessionActions>(
  (set, _get) => ({
    ...initialState,

    setActiveSession: (activeSession) => set({ activeSession }),

    setChecking: (isChecking) => set({ isChecking }),

    setCanJoin: (canJoin, canJoinReason) => set({ canJoin, canJoinReason }),

    clearSession: () => {
      hasCheckedOnce = false;
      set(initialState);
    },

    resetCheckFlag: () => {
      hasCheckedOnce = false;
    },

    checkSession: async (userId) => {
      if (!userId) return;

      // Prevenir chamadas duplicadas enquanto ainda está checando
      const { isChecking, activeSession } = useSessionStore.getState();
      if (isChecking) {
        return;
      }

      // Se já está conectado a uma batalha, não precisa verificar no servidor
      // Também não precisa setar estado novamente para evitar re-renders
      if (colyseusService.isInBattle()) {
        // Só atualiza se ainda não tem activeSession ou se não marcou como verificado
        if (!hasCheckedOnce || !activeSession) {
          const room = colyseusService.getBattleRoom();
          if (room) {
            hasCheckedOnce = true;
            set({
              activeSession: {
                type: "BATTLE_LOBBY",
                lobbyId: room.id,
                battleId: room.id,
              },
              isChecking: false,
            });
          }
        }
        return;
      }

      // Se já verificou uma vez e tem sessão ativa, não re-emitir
      // para evitar loops
      if (hasCheckedOnce && activeSession) {
        return;
      }

      hasCheckedOnce = true;
      set({ isChecking: true });

      try {
        colyseusService.sendToGlobal("session:check", { userId });

        const result = await new Promise<{
          hasSession: boolean;
          session: ActiveSessionFrontend | null;
        }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            colyseusService.off("session:active", handleActive);
            colyseusService.off("session:none", handleNone);
            reject(new Error("Timeout ao verificar sessão"));
          }, 5000);

          const handleActive = (data: {
            type: string;
            matchId?: string;
            battleId?: string;
            lobbyId?: string;
          }) => {
            clearTimeout(timeout);
            colyseusService.off("session:active", handleActive);
            colyseusService.off("session:none", handleNone);
            resolve({
              hasSession: true,
              session: {
                type: normalizeSessionType(data.type),
                matchId: data.matchId,
                battleId: data.battleId,
                lobbyId: data.lobbyId,
              },
            });
          };

          const handleNone = () => {
            clearTimeout(timeout);
            colyseusService.off("session:active", handleActive);
            colyseusService.off("session:none", handleNone);
            resolve({ hasSession: false, session: null });
          };

          colyseusService.on("session:active", handleActive);
          colyseusService.on("session:none", handleNone);
        });

        set({ activeSession: result.session, isChecking: false });
      } catch (error) {
        console.error("[Session] Error checking session:", error);
        set({ activeSession: null, isChecking: false });
      }
    },

    canJoinSession: async (userId) => {
      if (!userId) return false;

      try {
        const isInBattle = colyseusService.isInBattle();
        const isInMatch = colyseusService.isInMatch();

        if (isInBattle || isInMatch) {
          set({
            canJoin: false,
            canJoinReason: isInBattle
              ? "Already in a battle"
              : "Already in a match",
          });
          return false;
        }

        set({ canJoin: true, canJoinReason: null });
        return true;
      } catch (error) {
        console.error("[Session] Error checking permission:", error);
        set({ canJoin: false, canJoinReason: "Error checking session" });
        return false;
      }
    },

    initializeListeners: () => {
      const handleSessionActive = (data: {
        type: string;
        matchId?: string;
        battleId?: string;
        lobbyId?: string;
      }) => {
        set({
          activeSession: {
            type: normalizeSessionType(data.type),
            matchId: data.matchId,
            battleId: data.battleId,
            lobbyId: data.lobbyId,
          },
        });
      };

      const handleSessionNone = () => {
        set({ activeSession: null });
      };

      colyseusService.on("session:active", handleSessionActive);
      colyseusService.on("session:none", handleSessionNone);

      return () => {
        colyseusService.off("session:active", handleSessionActive);
        colyseusService.off("session:none", handleSessionNone);
      };
    },
  })
);

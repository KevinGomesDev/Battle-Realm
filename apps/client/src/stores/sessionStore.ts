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
}

const initialState: SessionState = {
  activeSession: null,
  isChecking: false,
  canJoin: true,
  canJoinReason: null,
};

export const useSessionStore = create<SessionState & SessionActions>(
  (set, get) => ({
    ...initialState,

    setActiveSession: (activeSession) => set({ activeSession }),

    setChecking: (isChecking) => set({ isChecking }),

    setCanJoin: (canJoin, canJoinReason) => set({ canJoin, canJoinReason }),

    clearSession: () => set(initialState),

    checkSession: async (userId) => {
      if (!userId) return;

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
        console.error("[Session] Erro ao verificar sessão:", error);
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
              ? "Já está em uma batalha"
              : "Já está em uma partida",
          });
          return false;
        }

        set({ canJoin: true, canJoinReason: null });
        return true;
      } catch (error) {
        console.error("[Session] Erro ao verificar permissão:", error);
        set({ canJoin: false, canJoinReason: "Erro ao verificar sessão" });
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

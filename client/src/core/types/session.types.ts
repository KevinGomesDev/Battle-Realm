// Session Types
export type SessionType = "match" | "arena_lobby" | "arena_battle" | null;

export interface ActiveSession {
  type: SessionType;
  matchId?: string;
  battleId?: string;
  lobbyId?: string;
  data?: any;
}

export interface SessionState {
  activeSession: ActiveSession | null;
  isChecking: boolean;
  canJoin: boolean;
  canJoinReason: string | null;
}

export interface SessionContextType {
  state: SessionState;
  checkSession: (userId: string) => Promise<void>;
  canJoinSession: (userId: string) => Promise<boolean>;
  clearSession: () => void;
}

export type SessionAction =
  | { type: "SET_ACTIVE_SESSION"; payload: ActiveSession | null }
  | { type: "SET_CHECKING"; payload: boolean }
  | {
      type: "SET_CAN_JOIN";
      payload: { canJoin: boolean; reason: string | null };
    }
  | { type: "CLEAR_SESSION" };

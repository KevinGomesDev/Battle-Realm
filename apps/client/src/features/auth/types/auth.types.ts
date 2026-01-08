// Auth Types - Re-exports shared types and adds frontend-specific types
// FONTE DE VERDADE: shared/types/auth.types.ts

// ============ RE-EXPORT SHARED TYPES ============
export type {
  User,
  RegisterData,
  LoginData,
  AuthResponse,
} from "@boundless/shared/types/auth.types";

// ============ FRONTEND-SPECIFIC STATE ============

import type { User } from "@boundless/shared/types/auth.types";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isServerValidated: boolean; // true quando servidor confirmar autenticação
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType {
  state: AuthState;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<User>;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  restoreSession: () => Promise<boolean>;
}

export type AuthAction =
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

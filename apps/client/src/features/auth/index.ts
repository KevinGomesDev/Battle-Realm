// Auth Feature - Public API
// Migrado para Zustand - Context removido

export {
  useAuth,
  useAuthState,
  useUser,
  useIsAuthenticated,
} from "./hooks/useAuth";
export type {
  User,
  AuthState,
  AuthContextType,
  AuthAction,
} from "./types/auth.types";

import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  // Retorna uma API mais amigável
  return {
    // Métodos
    register: context.register,
    login: context.login,
    logout: context.logout,
    restoreSession: context.restoreSession,
    // Estado
    user: context.state.user,
    isAuthenticated: context.state.isAuthenticated,
    isServerValidated: context.state.isServerValidated,
    isLoading: context.state.isLoading,
    error: context.state.error,
    // Acesso ao state completo
    state: context.state,
  };
}

export function useAuthState() {
  const { state } = useAuth();
  return state;
}

export function useUser() {
  const { state } = useAuth();
  return state.user;
}

export function useIsAuthenticated() {
  const { state } = useAuth();
  return state.isAuthenticated;
}

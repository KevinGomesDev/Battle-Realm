// client/src/features/auth/hooks/useAuth.ts
// Hook para autenticação usando Zustand store

import { useAuthStore } from "../../../stores";

export function useAuth() {
  const store = useAuthStore();

  return {
    // Métodos
    register: store.register,
    login: store.login,
    logout: store.logout,
    restoreSession: store.restoreSession,
    // Estado
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isServerValidated: store.isServerValidated,
    isLoading: store.isLoading,
    error: store.error,
    // Acesso ao state completo
    state: {
      user: store.user,
      isAuthenticated: store.isAuthenticated,
      isServerValidated: store.isServerValidated,
      isLoading: store.isLoading,
      error: store.error,
    },
  };
}

export function useAuthState() {
  const store = useAuthStore();
  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isServerValidated: store.isServerValidated,
    isLoading: store.isLoading,
    error: store.error,
  };
}

export function useUser() {
  return useAuthStore((state) => state.user);
}

export function useIsAuthenticated() {
  return useAuthStore((state) => state.isAuthenticated);
}

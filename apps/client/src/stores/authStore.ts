// client/src/stores/authStore.ts
// Store Zustand para autenticação

import { create } from "zustand";
import { colyseusService } from "../services/colyseus.service";
import type { User } from "../../../shared/types/auth.types";

// Tipo da resposta do servidor para login/register
interface AuthServerResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isServerValidated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<User>;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  restoreSession: () => Promise<boolean>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isServerValidated: false,
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  ...initialState,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isServerValidated: !!user,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),

  register: async (username, email, password) => {
    set({ isLoading: true, error: null });

    try {
      const response =
        await colyseusService.waitForResponse<AuthServerResponse>(
          "auth:register",
          { username, email, password },
          "auth:success",
          "auth:error",
          10000
        );

      const user: User = {
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        token: response.token,
      };

      if (user.token) {
        localStorage.setItem("auth_token", user.token);
      }
      localStorage.setItem("auth_user", JSON.stringify(user));

      set({
        user,
        isAuthenticated: true,
        isServerValidated: true,
        isLoading: false,
      });

      return user;
    } catch (error: any) {
      set({
        error: error?.message || "Erro ao registrar",
        isLoading: false,
      });
      throw error;
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });

    try {
      const response =
        await colyseusService.waitForResponse<AuthServerResponse>(
          "auth:login",
          { username, password },
          "auth:success",
          "auth:error",
          10000
        );

      const user: User = {
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        token: response.token,
      };

      if (user.token) {
        localStorage.setItem("auth_token", user.token);
      }
      localStorage.setItem("auth_user", JSON.stringify(user));

      set({
        user,
        isAuthenticated: true,
        isServerValidated: true,
        isLoading: false,
      });

      return user;
    } catch (error: any) {
      set({
        error: error?.message || "Erro ao fazer login",
        isLoading: false,
      });
      throw error;
    }
  },

  logout: () => {
    colyseusService.sendToGlobal("auth:logout");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    set(initialState);
  },

  restoreSession: async () => {
    try {
      const savedUser = localStorage.getItem("auth_user");
      const savedToken = localStorage.getItem("auth_token");

      if (!savedUser || !savedToken) {
        return false;
      }

      try {
        const validatedData = await colyseusService.waitForResponse<{
          userId: string;
          username: string;
        }>(
          "auth:validate",
          { token: savedToken },
          "auth:validated",
          "auth:error",
          5000
        );

        const user: User = {
          id: validatedData.userId,
          username: validatedData.username,
          token: savedToken,
        };

        localStorage.setItem("auth_user", JSON.stringify(user));

        set({
          user,
          isAuthenticated: true,
          isServerValidated: true,
        });

        return true;
      } catch {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        return false;
      }
    } catch {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      return false;
    }
  },
}));

import React, { createContext, useReducer, useCallback } from "react";
import type {
  AuthState,
  AuthContextType,
  AuthAction,
  User,
} from "../types/auth.types";
import { socketService } from "../../../services/socket.service";

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        socketService.emit("auth:register", { username, email, password });

        const user = await new Promise<User>((resolve, reject) => {
          const successHandler = (data: User) => {
            socketService.off("auth:success", successHandler);
            socketService.off("error", errorHandler);
            resolve(data);
          };

          const errorHandler = (data: { message: string }) => {
            socketService.off("auth:success", successHandler);
            socketService.off("error", errorHandler);
            reject(new Error(data.message));
          };

          socketService.on("auth:success", successHandler);
          socketService.on("error", errorHandler);

          setTimeout(() => reject(new Error("Timeout na autenticação")), 10000);
        });

        // Save token to localStorage
        const token = (user as any).token || (user as any).accessToken;
        if (token) {
          localStorage.setItem("auth_token", token);
        }
        localStorage.setItem("auth_user", JSON.stringify(user));

        dispatch({ type: "SET_USER", payload: user });
        dispatch({ type: "SET_LOADING", payload: false });
      } catch (error: any) {
        dispatch({
          type: "SET_ERROR",
          payload: error?.message || "Erro ao registrar",
        });
        dispatch({ type: "SET_LOADING", payload: false });
        throw error;
      }
    },
    []
  );

  const login = useCallback(async (username: string, password: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      socketService.emit("auth:login", { username, password });

      const user = await new Promise<User>((resolve, reject) => {
        const successHandler = (data: User) => {
          socketService.off("auth:success", successHandler);
          socketService.off("error", errorHandler);
          resolve(data);
        };

        const errorHandler = (data: { message: string }) => {
          socketService.off("auth:success", successHandler);
          socketService.off("error", errorHandler);
          reject(new Error(data.message));
        };

        socketService.on("auth:success", successHandler);
        socketService.on("error", errorHandler);

        setTimeout(() => reject(new Error("Timeout na autenticação")), 10000);
      });

      const token = (user as any).token || (user as any).accessToken;
      if (token) {
        localStorage.setItem("auth_token", token);
      }
      localStorage.setItem("auth_user", JSON.stringify(user));

      dispatch({ type: "SET_USER", payload: user });
      dispatch({ type: "SET_LOADING", payload: false });

      // Nota: A verificação de sessão será feita no DashboardPage após login

      return user;
    } catch (error: any) {
      dispatch({
        type: "SET_ERROR",
        payload: error?.message || "Erro ao fazer login",
      });
      dispatch({ type: "SET_LOADING", payload: false });
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    socketService.emit("auth:logout");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    dispatch({ type: "RESET" });
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const savedUser = localStorage.getItem("auth_user");
      const savedToken = localStorage.getItem("auth_token");

      if (!savedUser || !savedToken) {
        return false;
      }

      const user = JSON.parse(savedUser);

      socketService.emit("auth:verify", { token: savedToken });

      const isValid = await new Promise<boolean>((resolve) => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const successHandler = () => {
          clearTimeout(timeoutId);
          socketService.off("auth:verified", successHandler);
          socketService.off("error", errorHandler);
          resolve(true);
        };

        const errorHandler = () => {
          clearTimeout(timeoutId);
          socketService.off("auth:verified", successHandler);
          socketService.off("error", errorHandler);
          resolve(false);
        };

        socketService.on("auth:verified", successHandler);
        socketService.on("error", errorHandler);

        timeoutId = setTimeout(() => {
          socketService.off("auth:verified", successHandler);
          socketService.off("error", errorHandler);
          resolve(false);
        }, 5000);
      });

      if (isValid) {
        dispatch({ type: "SET_USER", payload: user });
        return true;
      } else {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        return false;
      }
    } catch {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      return false;
    }
  }, []);

  const contextValue: AuthContextType = {
    state,
    register,
    login,
    logout,
    restoreSession,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

import React, { createContext, useReducer, useCallback, useMemo } from "react";
import { kingdomApi } from "../api";
import type {
  KingdomState,
  KingdomContextType,
  KingdomAction,
  KingdomWithRelations,
  KingdomSummary,
  CreateKingdomData,
} from "../types/kingdom.types";

// ============ INITIAL STATE ============

const initialState: KingdomState = {
  kingdom: null,
  kingdoms: [],
  isLoading: false,
  error: null,
};

// ============ REDUCER ============

function kingdomReducer(
  state: KingdomState,
  action: KingdomAction
): KingdomState {
  switch (action.type) {
    case "SET_KINGDOM":
      return { ...state, kingdom: action.payload };
    case "SET_KINGDOMS":
      return { ...state, kingdoms: action.payload };
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

// ============ CONTEXT ============

export const KingdomContext = createContext<KingdomContextType | undefined>(
  undefined
);

// ============ PROVIDER ============

export function KingdomProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(kingdomReducer, initialState);

  /**
   * Cria um novo reino customizado
   */
  const createKingdom = useCallback(
    async (data: CreateKingdomData): Promise<KingdomWithRelations> => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const response = await kingdomApi.create(data);

        if (!response.success || !response.data) {
          throw new Error(response.error || "Erro ao criar reino");
        }

        dispatch({ type: "SET_KINGDOM", payload: response.data });

        // Atualiza lista de reinos
        const listResponse = await kingdomApi.list();
        if (listResponse.success && listResponse.data) {
          dispatch({ type: "SET_KINGDOMS", payload: listResponse.data });
        }

        return response.data;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao criar reino";
        dispatch({ type: "SET_ERROR", payload: message });
        throw error;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    []
  );

  /**
   * Cria um reino a partir de um template pré-definido
   */
  const createFromTemplate = useCallback(
    async (templateId: string): Promise<KingdomWithRelations> => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const response = await kingdomApi.createFromTemplate(templateId);

        if (!response.success || !response.data) {
          throw new Error(response.error || "Erro ao criar reino do template");
        }

        dispatch({ type: "SET_KINGDOM", payload: response.data.kingdom });

        // Atualiza lista de reinos
        const listResponse = await kingdomApi.list();
        if (listResponse.success && listResponse.data) {
          dispatch({ type: "SET_KINGDOMS", payload: listResponse.data });
        }

        return response.data.kingdom;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao criar reino";
        dispatch({ type: "SET_ERROR", payload: message });
        throw error;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    []
  );

  /**
   * Carrega lista de reinos do usuário
   */
  const loadKingdoms = useCallback(async (): Promise<KingdomSummary[]> => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const response = await kingdomApi.list();

      if (!response.success) {
        throw new Error(response.error || "Erro ao carregar reinos");
      }

      const kingdoms = response.data || [];
      dispatch({ type: "SET_KINGDOMS", payload: kingdoms });
      return kingdoms;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar reinos";
      dispatch({ type: "SET_ERROR", payload: message });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  /**
   * Seleciona um reino como atual
   */
  const selectKingdom = useCallback((kingdom: KingdomWithRelations | null) => {
    dispatch({ type: "SET_KINGDOM", payload: kingdom });
  }, []);

  /**
   * Limpa erro atual
   */
  const clearError = useCallback(() => {
    dispatch({ type: "SET_ERROR", payload: null });
  }, []);

  // Memoiza o valor do contexto
  const contextValue = useMemo<KingdomContextType>(
    () => ({
      state,
      createKingdom,
      createFromTemplate,
      loadKingdoms,
      selectKingdom,
      clearError,
    }),
    [
      state,
      createKingdom,
      createFromTemplate,
      loadKingdoms,
      selectKingdom,
      clearError,
    ]
  );

  return (
    <KingdomContext.Provider value={contextValue}>
      {children}
    </KingdomContext.Provider>
  );
}

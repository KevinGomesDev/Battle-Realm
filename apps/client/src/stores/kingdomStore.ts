// client/src/stores/kingdomStore.ts
// Store Zustand para gerenciamento de reinos

import { create } from "zustand";
import { kingdomApi } from "../features/kingdom/api";
import type {
  KingdomWithRelations,
  KingdomSummary,
  CreateKingdomData,
} from "../features/kingdom/types/kingdom.types";

interface KingdomState {
  kingdom: KingdomWithRelations | null;
  kingdoms: KingdomSummary[];
  isLoading: boolean;
  error: string | null;
}

interface KingdomActions {
  createKingdom: (
    data: CreateKingdomData | { templateId: string }
  ) => Promise<KingdomWithRelations>;
  loadKingdoms: () => Promise<KingdomSummary[]>;
  deleteKingdom: (kingdomId: string) => Promise<void>;
  selectKingdom: (kingdom: KingdomWithRelations | null) => void;
  clearError: () => void;
  setKingdom: (kingdom: KingdomWithRelations | null) => void;
  setKingdoms: (kingdoms: KingdomSummary[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: KingdomState = {
  kingdom: null,
  kingdoms: [],
  isLoading: false,
  error: null,
};

export const useKingdomStore = create<KingdomState & KingdomActions>((set) => ({
  ...initialState,

  setKingdom: (kingdom) => set({ kingdom }),

  setKingdoms: (kingdoms) => set({ kingdoms }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),

  clearError: () => set({ error: null }),

  selectKingdom: (kingdom) => set({ kingdom }),

  createKingdom: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await kingdomApi.create(data);

      if (!response.success || !response.data) {
        throw new Error(response.error || "Erro ao criar reino");
      }

      set({ kingdom: response.data.kingdom });

      // Atualiza lista de reinos
      const listResponse = await kingdomApi.list();
      if (listResponse.success && listResponse.data) {
        set({ kingdoms: listResponse.data });
      }

      return response.data.kingdom;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao criar reino";
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadKingdoms: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await kingdomApi.list();

      if (!response.success) {
        throw new Error(response.error || "Erro ao carregar reinos");
      }

      const kingdoms = response.data || [];
      set({ kingdoms });
      return kingdoms;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar reinos";
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteKingdom: async (kingdomId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await kingdomApi.delete(kingdomId);

      if (!response.success) {
        throw new Error(response.error || "Erro ao deletar reino");
      }

      // Remove o reino da lista local
      set((state) => ({
        kingdoms: state.kingdoms.filter((k) => k.id !== kingdomId),
        // Se o reino deletado era o selecionado, limpa a seleção
        kingdom: state.kingdom?.id === kingdomId ? null : state.kingdom,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao deletar reino";
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));

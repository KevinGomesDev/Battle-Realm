// client/src/stores/kingdomStore.ts
// Store Zustand para gerenciamento de reinos

import { create } from "zustand";
import { persist } from "zustand/middleware";
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

export const useKingdomStore = create<KingdomState & KingdomActions>()(
  persist(
    (set) => ({
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
            throw new Error(response.error || "Error creating kingdom");
          }

          set({ kingdom: response.data.kingdom });

          // Update kingdoms list
          const listResponse = await kingdomApi.list();
          if (listResponse.success && listResponse.data) {
            set({ kingdoms: listResponse.data });
          }

          return response.data.kingdom;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Error creating kingdom";
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
            throw new Error(response.error || "Error loading kingdoms");
          }

          const kingdoms = response.data || [];
          set({ kingdoms });
          return kingdoms;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Error loading kingdoms";
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
            throw new Error(response.error || "Error deleting kingdom");
          }

          // Remove the kingdom from local list
          set((state) => ({
            kingdoms: state.kingdoms.filter((k) => k.id !== kingdomId),
            // If the deleted kingdom was selected, clear the selection
            kingdom: state.kingdom?.id === kingdomId ? null : state.kingdom,
          }));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Error deleting kingdom";
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "kingdom-storage",
      // Apenas persistir o kingdom selecionado, não o resto do estado
      partialize: (state) => ({ kingdom: state.kingdom }),
    }
  )
);

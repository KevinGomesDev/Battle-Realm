// Kingdom Types
// Re-exports shared types and adds frontend-specific types

// ============ RE-EXPORT SHARED TYPES ============
export type {
  Alignment,
  Race,
  ResourceType,
  UnitCategory,
  TemplateDifficulty,
  KingdomErrorCode,
  BaseAttributes,
  Kingdom,
  KingdomWithRelations,
  KingdomSummary,
  TroopTemplate,
  CreateTroopTemplateData,
  Unit,
  RegentData,
  CreateRegentData,
  CreateKingdomData,
  KingdomTemplateSummary,
  KingdomTemplateDetails,
  RaceDefinition,
  AlignmentDefinition,
  TroopPassiveDefinition,
  GameClassDefinition,
} from "../../../../../shared/types/kingdom.types";

// ============ FRONTEND-SPECIFIC STATE ============

import type {
  KingdomWithRelations,
  KingdomSummary,
  CreateKingdomData,
} from "../../../../../shared/types/kingdom.types";

export interface KingdomState {
  kingdom: KingdomWithRelations | null;
  kingdoms: KingdomSummary[];
  isLoading: boolean;
  error: string | null;
}

export interface KingdomContextType {
  state: KingdomState;
  createKingdom: (data: CreateKingdomData) => Promise<KingdomWithRelations>;
  createFromTemplate: (templateId: string) => Promise<KingdomWithRelations>;
  loadKingdoms: () => Promise<KingdomSummary[]>;
  selectKingdom: (kingdom: KingdomWithRelations | null) => void;
  clearError: () => void;
}

export type KingdomAction =
  | { type: "SET_KINGDOM"; payload: KingdomWithRelations | null }
  | { type: "SET_KINGDOMS"; payload: KingdomSummary[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

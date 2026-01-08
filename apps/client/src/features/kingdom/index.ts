// Kingdom Feature - Public API
// Migrado para Zustand - Context removido

// ============ HOOKS ============
export {
  useKingdom,
  useKingdomState,
  useKingdoms,
  useCurrentKingdom,
  useKingdomDetails,
  useKingdomStaticData,
  useKingdomTemplates,
} from "./hooks/useKingdom";

export {
  useKingdomForm,
  useRegentForm,
  useTroopsForm,
  useCreationWizard,
} from "./hooks/useKingdomForm";

// ============ API ============
export { kingdomApi, kingdomStaticApi } from "./api";

// ============ COMPONENTS ============
export { CreateKingdomModal } from "./components";

// ============ TYPES ============
export type {
  // Core types
  Kingdom,
  KingdomWithRelations,
  KingdomSummary,
  KingdomState,
  KingdomContextType,
  KingdomAction,
  // Create types
  CreateKingdomData,
  CreateTroopTemplateData,
  CreateRegentData,
  // Template types
  KingdomTemplateSummary,
  KingdomTemplateDetails,
  TroopTemplate,
  RegentData,
  Unit,
  // Enum types
  Alignment,
  Race,
  ResourceType,
  UnitCategory,
  TemplateDifficulty,
  KingdomErrorCode,
  // Static data types
  RaceDefinition,
  AlignmentDefinition,
  TroopPassiveDefinition,
  GameClassDefinition,
  BaseAttributes,
} from "./types/kingdom.types";

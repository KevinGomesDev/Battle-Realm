// CreateKingdom Component Types
// Re-exports and component-specific types

// Re-export from central types
export type {
  RaceDefinition as Race,
  AlignmentDefinition as Alignment,
  GameClassDefinition as GameClass,
  TroopPassiveDefinition as TroopPassive,
  CreateTroopTemplateData as TroopTemplate,
  KingdomTemplateSummary,
  KingdomTemplateDetails,
  BaseAttributes,
} from "../../types/kingdom.types";

// Component-specific form types
export interface KingdomFormData {
  name: string;
  capitalName: string;
  alignment: string;
  race: string;
  raceMetadata?: string;
}

export interface RegentFormData {
  name: string;
  avatar?: string; // Nome do arquivo sprite
  attributes: {
    combat: number;
    speed: number;
    focus: number;
    resistance: number;
    will: number;
    vitality: number;
  };
  initialSkillId?: string; // Skill inicial escolhida
}

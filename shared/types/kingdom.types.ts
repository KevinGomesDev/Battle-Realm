import type { SkillDefinition } from "./skills.types";
import type { ResourceKey, AttributeKey } from "../config/global.config";

// Re-exporta tipos do config global para uso em kingdom
export type { ResourceKey, AttributeKey };

// ===========================================
// KINGDOM TYPES - Shared between Client/Server
// ===========================================

// ============ ENUMS (Match Prisma schema) ============

export type Alignment = "BOM" | "MAL" | "NEUTRO";

export type Race =
  | "ABERRACAO"
  | "BESTA"
  | "CELESTIAL"
  | "CONSTRUTO"
  | "DRAGAO"
  | "ELEMENTAL"
  | "FADA"
  | "DIABO"
  | "GIGANTE"
  | "HUMANOIDE"
  | "MONSTRUOSIDADE"
  | "GOSMA"
  | "PLANTA"
  | "MORTO_VIVO"
  | "INSETO";

// Alias para compatibilidade (usa ResourceKey do global.config)
export type ResourceType = ResourceKey;

// ============ BASE INTERFACES ============

// Usa AttributeKey do global.config para garantir consistência
export interface BaseAttributes {
  combat: number;
  speed: number;
  focus: number;
  armor: number;
  vitality: number;
}

// ============ KINGDOM ============

export interface Kingdom {
  id: string;
  name: string;
  description?: string;
  alignment: Alignment;
  race: Race;
  ownerId: string;
  regentId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface KingdomWithRelations extends Kingdom {
  troopTemplates?: TroopTemplate[];
  regent?: Unit;
}

export interface KingdomSummary {
  id: string;
  name: string;
  race: Race;
  alignment: Alignment;
}

// ============ MATCH HISTORY ============

export type MatchResult = "WIN" | "LOSS" | "DRAW";

export interface MatchHistory {
  id: string;
  kingdomId: string;
  matchDate: Date;
  result: MatchResult;
  opponentName: string;
  opponentRace: string;
  finalRound: number;
  summary?: Record<string, unknown>;
}

// ============ TROOP TEMPLATE ============

export interface TroopTemplate {
  id: string;
  kingdomId: string;
  slotIndex: number;
  name: string;
  description?: string;
  avatar?: string; // ID do sprite (ex: "[1].png")
  passiveId: string;
  resourceType: ResourceType;
  combat: number;
  speed: number;
  focus: number;
  armor: number;
  vitality: number;
}

export interface CreateTroopTemplateData {
  slotIndex: number;
  name: string;
  description?: string;
  avatar?: string; // ID do sprite (ex: "[1].png")
  passiveId: string;
  resourceType: ResourceType;
  combat: number;
  speed: number;
  focus: number;
  armor: number;
  vitality: number;
}

// ============ UNIT ============

export type UnitCategory =
  | "TROOP"
  | "HERO"
  | "REGENT"
  | "PRISONER"
  | "SUMMON"
  | "MONSTER";

export interface Unit {
  id: string;
  matchId?: string;
  ownerId?: string;
  name: string;
  description?: string;
  avatar?: string; // ID do sprite (ex: "[1].png")
  category: UnitCategory;
  level: number;
  classCode?: string; // Heróis possuem classe, Regentes NÃO
  features?: string[]; // Skills aprendidas
  combat: number;
  speed: number;
  focus: number;
  armor: number;
  vitality: number;
  currentHp: number;
  movesLeft: number;
  actionsLeft: number;
}

// ============ REGENT ============

/** Dados do regente para exibição */
export interface RegentData {
  name: string;
  description?: string;
  avatar?: string;
  combat: number;
  speed: number;
  focus: number;
  armor: number;
  vitality: number;
  skills?: string[]; // Skills aprendidas
}

/** Dados para criar um regente */
export interface CreateRegentData {
  name: string;
  avatar?: string;
  attributes: BaseAttributes;
  initialSkillId?: string; // Skill inicial (nível 1)
}

// ============ CREATE KINGDOM ============

/** Dados completos para criar um reino (Reino + Regente + Tropas) */
export interface CreateKingdomData {
  name: string;
  description?: string;
  alignment: Alignment;
  race: Race;
  regent: CreateRegentData;
  troopTemplates: CreateTroopTemplateData[];
}

export interface CreateKingdomFromTemplateData {
  templateId: string;
}

// ============ KINGDOM TEMPLATES ============

export type TemplateDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface KingdomTemplateSummary {
  id: string;
  name: string;
  description: string;
  raceName: string;
  alignmentName: string;
  regentClassName: string;
  difficulty: TemplateDifficulty;
  icon: string;
}

export interface KingdomTemplateDetails {
  id: string;
  name: string;
  description: string;
  alignment: Alignment;
  race: Race;
  regent: RegentData;
  troopTemplates: CreateTroopTemplateData[];
}

// ============ SOCKET EVENTS ============

export interface KingdomEvents {
  // Requests
  "kingdom:create": CreateKingdomData;
  "kingdom:list": void;
  "kingdom:get_details": { kingdomId: string };
  "kingdom:set_troop_templates": {
    kingdomId: string;
    templates: CreateTroopTemplateData[];
  };
  "kingdom:create_from_template": CreateKingdomFromTemplateData;
  "kingdom:update_description": { kingdomId: string; description: string };
  "kingdom:list_templates": void;
  "kingdom:get_template": { templateId: string };

  // Responses (Success)
  "kingdom:created": KingdomWithRelations;
  "kingdom:list_success": KingdomSummary[];
  "kingdom:details": KingdomWithRelations;
  "kingdom:set_troop_templates_success": KingdomWithRelations;
  "kingdom:created_from_template": {
    kingdom: KingdomWithRelations;
    message: string;
  };
  "kingdom:description_updated": { kingdom: Kingdom };
  "kingdom:templates_list": { templates: KingdomTemplateSummary[] };
  "kingdom:template_details": { template: KingdomTemplateDetails };

  // Responses (Error)
  "kingdom:error": { message: string; code: KingdomErrorCode };

  // Public data
  "kingdom:get_races": void;
  "kingdom:get_alignments": void;
  "kingdom:get_troop_passives": void;
  "kingdom:races_data": RaceDefinition[];
  "kingdom:alignments_data": AlignmentDefinition[];
  "kingdom:troop_passives_data": TroopPassiveDefinition[];
}

// ============ ERROR CODES ============

export type KingdomErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "ACCESS_DENIED"
  | "INVALID_RACE_METADATA"
  | "INVALID_TROOP_TEMPLATES"
  | "TEMPLATE_NOT_FOUND"
  | "DATABASE_ERROR"
  | "UNKNOWN_ERROR";

// ============ STATIC DATA ============

export interface RaceDefinition {
  id: Race;
  name: string;
  description: string;
  passiveName: string;
  passiveEffect: string;
  color: number;
}

export interface AlignmentDefinition {
  id: Alignment;
  name: string;
  description: string;
  passiveName: string;
  passiveEffect: string;
  color: number;
}

export type TroopPassiveDefinition = SkillDefinition & {
  availableForTroops: true;
};

export interface GameClassDefinition {
  id: string;
  code: string;
  name: string;
  archetype: string;
  resourceUsed: string;
  description: string;
}

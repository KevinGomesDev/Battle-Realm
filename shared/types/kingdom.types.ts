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

export type ResourceType =
  | "ore"
  | "supplies"
  | "arcane"
  | "experience"
  | "devotion";

// ============ BASE INTERFACES ============

export interface BaseAttributes {
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
}

// ============ KINGDOM ============

export interface Kingdom {
  id: string;
  name: string;
  capitalName: string;
  description?: string;
  alignment: Alignment;
  race: Race;
  raceMetadata?: string;
  locationIndex: number;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KingdomWithRelations extends Kingdom {
  troopTemplates?: TroopTemplate[];
  units?: Unit[];
}

export interface KingdomSummary {
  id: string;
  name: string;
  race: Race;
  alignment: Alignment;
  capitalName: string;
}

// ============ TROOP TEMPLATE ============

export interface TroopTemplate {
  id: string;
  kingdomId: string;
  slotIndex: number;
  name: string;
  description?: string;
  passiveId: string;
  resourceType: ResourceType;
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
}

export interface CreateTroopTemplateData {
  slotIndex: number;
  name: string;
  description?: string;
  passiveId: string;
  resourceType: ResourceType;
  combat: number;
  acuity: number;
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
  kingdomId?: string;
  name: string;
  description?: string;
  category: UnitCategory;
  classCode?: string;
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
  currentHp: number;
  movesLeft: number;
  actionsLeft: number;
}

// ============ REGENT ============

export interface RegentData {
  name: string;
  description?: string;
  classCode: string;
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
}

export interface CreateRegentData {
  name: string;
  classCode: string;
  attributeDistribution: BaseAttributes;
}

// ============ CREATE KINGDOM ============

export interface CreateKingdomData {
  name: string;
  capitalName: string;
  alignment: Alignment;
  race: Race;
  raceMetadata?: string;
  troopTemplates?: CreateTroopTemplateData[];
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
  capitalName: string;
  description: string;
  alignment: Alignment;
  race: Race;
  raceMetadata?: string;
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

export interface TroopPassiveDefinition {
  id: string;
  name: string;
  description: string;
}

export interface GameClassDefinition {
  id: string;
  code: string;
  name: string;
  archetype: string;
  resourceUsed: string;
  description: string;
}

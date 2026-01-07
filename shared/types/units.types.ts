// shared/types/units.types.ts
// Tipos genéricos para unidades (usados em server e client)

import type { PlayerResources } from "./match.types";
import type { Alignment, Race } from "./kingdom.types";

// =============================================================================
// CATEGORIAS DE UNIDADE
// =============================================================================

export type UnitCategory = "TROOP" | "HERO" | "REGENT" | "SUMMON" | "MONSTER";

// =============================================================================
// ATRIBUTOS
// =============================================================================

export interface UnitStats {
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
}

// =============================================================================
// DEFINIÇÃO DE UNIDADE (Molde estático)
// =============================================================================

export interface UnitDefinition {
  id: string; // ex: "ARCHER"
  name: string;
  category: UnitCategory;
  baseStats: UnitStats;
  moveRange: number; // Quantos quadrados anda
  passive?: string; // Descrição ou ID da passiva
}

// =============================================================================
// TEMPLATE DE TROPA (para criar/editar tropas no reino)
// =============================================================================

export interface TroopTemplateData {
  slotIndex: number; // 0-4
  name: string;
  description?: string; // História/descrição opcional da tropa
  avatar?: string; // ID do sprite (ex: "1")
  passiveId: string;
  resourceType: keyof PlayerResources;
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
}

// =============================================================================
// TEMPLATE DE RAÇA
// =============================================================================

export interface RaceDefinition {
  id: string; // O Enum do Banco (HUMANOIDE, DRAGAO...)
  name: string;
  description: string; // Flavor text
  passiveName: string;
  passiveEffect: string; // Regra mecânica
  passiveConditionId: string; // ID da condição a aplicar
  color: number; // Cor temática (apenas para UI)
}

// =============================================================================
// TEMPLATE DE HERÓI
// =============================================================================

export interface HeroTemplate {
  code: string;
  name: string;
  description: string;
  classCode: string;
  avatar: string;
  level: number;
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
  initialSkills: string[];
  initialSpells: string[];
  recruitCost: {
    ore?: number;
    supplies?: number;
    arcane?: number;
    devotion?: number;
  };
  icon: string;
  themeColor: string;
}

// =============================================================================
// TEMPLATE DE REGENTE
// =============================================================================

export interface RegentTemplate {
  code: string;
  name: string;
  description: string;
  avatar: string;
  initialSkillCode?: string;
  initialSpells?: string[];
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
  icon: string;
  themeColor: string;
  alignment: Alignment;
  race: Race;
}

// =============================================================================
// TEMPLATE DE INVOCAÇÃO (SUMMON)
// =============================================================================

export type SummonAIBehavior =
  | "AGGRESSIVE"
  | "TACTICAL"
  | "DEFENSIVE"
  | "SUPPORT"
  | "RANGED";

export interface SummonTemplate {
  code: string;
  name: string;
  description: string;
  summoner: string;
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
  damageReduction: number;
  category: "SUMMON";
  avatar?: string;
  actionCodes?: string[];
  passiveCode?: string;
  aiBehavior?: SummonAIBehavior;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// TEMPLATE DE REINO
// =============================================================================

export interface KingdomTemplateDefinition {
  id: string;
  name: string;
  description: string;
  alignment: Alignment;
  race: Race;
  regentCode: string;
  troopTemplates: TroopTemplateData[];
}

// =============================================================================
// CONSTANTES DE ATRIBUTOS INICIAIS
// =============================================================================

/** Total de pontos de atributo para criar template de tropa */
export const TROOP_INITIAL_ATTRIBUTE_POINTS = 10;

/** Atributo máximo individual para tropas */
export const TROOP_MAX_ATTRIBUTE_VALUE = 10;

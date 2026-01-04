// shared/types/units.types.ts
// Tipos genéricos para unidades (usados em server e client)

import type { PlayerResources } from "./match.types";

// =============================================================================
// CATEGORIAS DE UNIDADE
// =============================================================================

export type UnitCategory =
  | "TROOP"
  | "HERO"
  | "REGENT"
  | "PRISONER"
  | "SUMMON"
  | "MONSTER";

// =============================================================================
// ATRIBUTOS
// =============================================================================

export interface UnitStats {
  combat: number;
  speed: number;
  focus: number;
  armor: number;
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
  armor: number;
  vitality: number;
}

// =============================================================================
// CONSTANTES DE ATRIBUTOS INICIAIS
// =============================================================================

/** Total de pontos de atributo para criar template de tropa */
export const TROOP_INITIAL_ATTRIBUTE_POINTS = 10;

/** Atributo máximo individual para tropas */
export const TROOP_MAX_ATTRIBUTE_VALUE = 10;

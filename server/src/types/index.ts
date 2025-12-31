// src/types/index.ts
import { Alignment, Race } from "@prisma/client";
import {
  TurnType,
  TURN_ORDER,
  CONSTRUCTION_COSTS,
  MAX_CONSTRUCTIONS_PER_TERRITORY,
  MAX_FORTRESSES_PER_TERRITORY,
  MOVEMENT_COST_BETWEEN_TERRITORIES,
  MOVEMENT_WITHIN_TERRITORY_COST,
} from "../data/turns";
import {
  REGENT_LEVELUP_BASE_COST,
  REGENT_LEVELUP_INCREMENT,
  HERO_LEVELUP_BASE_COST,
  HERO_LEVELUP_INCREMENT,
  HERO_RECRUITMENT_COSTS,
  MAX_HEROES_PER_PLAYER,
  MAX_HERO_LEVEL,
  REGENT_ATTRIBUTE_POINTS_PER_LEVEL,
  HERO_ATTRIBUTE_POINTS_PER_LEVEL,
  REGENT_INITIAL_ATTRIBUTE_POINTS,
  HERO_INITIAL_ATTRIBUTE_POINTS,
  TROOP_RECRUITMENT_BASE_COST,
  TROOP_LEVELUP_COSTS,
  MAX_TROOP_LEVEL,
  TROOP_ATTRIBUTE_POINTS_PER_LEVEL,
} from "../data/units";
import {
  TributeDecision,
  CRISIS_METER_START,
  CRISIS_METER_MAX,
  CRISIS_METER_TRIGGERED_AT_TURN,
} from "../data/crisis";
import {
  SkillCategory,
  SkillCostTier,
  SkillRange,
  COST_VALUES,
  DEFAULT_RANGE_VALUES,
  SkillDefinition,
} from "../../../shared/types/skills.types";
import {
  ClassArchetype,
  TroopCategory,
  TROOP_RESOURCE_MAP,
} from "../data/archetypes";

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface CreateKingdomData {
  name: string;
  capitalName: string;
  alignment: Alignment;
  race: Race;
  raceMetadata?: string;
}

// Tipos de Crise
export type CrisisType = "KAIJU" | "WALKERS" | "AMORPHOUS";

export interface CrisisState {
  type: CrisisType;
  isActive: boolean; // Se já apareceu no mapa
  revealedSpecials: number[]; // Lista de indices [1, 3] dos especiais descobertos pelos jogadores

  // Dados Vitais (Muda conforme o tipo)
  stats: {
    combat: number;
    acuity: number;
    focus: number;
    armor: number;
    vitality: number;
    maxVitality: number;
  };

  // Posição (Se for Kaiju/Amorfa é um numero, se for Walkers pode ser nulo pois são unidades)
  locationIndex?: number;

  // Regras Específicas salvas aqui
  extraData: {
    walkerUnitCount?: number; // Para a crise 2
    amorphousRegen?: number; // Para a crise 3
    kaijuDamageStack?: number; // Para a crise 1 (Dano recebido = +Combate)
  };

  // Territórios que revelam segredos (Sorteados no inicio)
  intelTerritoryIndices: number[];
}

export interface StartMatchData {
  players: {
    userId: string;
    kingdomId: string;
  }[];
}

export enum UnitCategory {
  TROOP = "TROOP",
  HERO = "HERO",
  REGENT = "REGENT",
  PRISONER = "PRISONER",
  SUMMON = "SUMMON",
  MONSTER = "MONSTER",
}

export interface UnitStats {
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
}

// Interface para o "Molde" de uma unidade (o que fica no arquivo estático)
export interface UnitDefinition {
  id: string; // ex: "ARCHER"
  name: string;
  category: UnitCategory;
  baseStats: UnitStats;
  moveRange: number; // Quantos quadrados anda
  passive?: string; // Descrição ou ID da passiva
}

// --- RECURSOS ---
export type ResourceType =
  | "ORE"
  | "ARCANE"
  | "FOOD"
  | "EXPERIENCE"
  | "DEVOTION";

// Interface para os recursos de um jogador
export interface PlayerResources {
  ore: number;
  supplies: number;
  arcane: number;
  experience: number;
  devotion: number;
}

// --- TURNOS E RODADAS ---
// Importado de ./data/turns

// Constantes importadas de ./data/turns

// --- UNIDADES (REGENTE E HERÓI) ---
// Constantes importadas de ./data/units
// Constantes importadas de ./data/archetypes para TroopCategory e TROOP_RESOURCE_MAP

// --- MOVIMENTO ---
// Constantes importadas de ./data/turns

// --- CLASSES ---
// ClassArchetype importado de ./data/archetypes

export interface ClassDefinition {
  id: string; // "WARRIOR"
  name: string; // "Guerreiro"
  archetype: ClassArchetype;
  resourceUsed: ResourceType; // Define qual recurso essa classe gasta
  description?: string; // Descrição da classe
  skills: SkillDefinition[];
}

// --- HABILIDADES ---
// Importado de ./data/skills-system
// SkillCategory, SkillCostTier, RangeType, SkillDefinition, COST_VALUES, RANGE_VALUES
// --- CRISE: MEDIDOR DE CRISE E PILHA DE TRIBUTO ---
// TributeDecision importado de ./data/crisis

export interface TributeSubmission {
  playerId: string;
  decision: TributeDecision;
  amount: number; // Quantidade de recurso enviado
  resourceType: ResourceType;
}

export interface TributePileResult {
  totalValue: number;
  contributionAmount: number; // Soma das contribuições
  sabotageAmount: number; // Soma das sabotagens
  topContributor?: string; // PlayerId que mais contribuiu
  topSaboteur?: string; // PlayerId que mais sabotou
  topContributionAmount: number;
  topSabotageAmount: number;
}

// Constantes importadas de ./data/crisis
// Re-exports para manter compatibilidade com imports antigos
export {
  TurnType,
  TURN_ORDER,
  CONSTRUCTION_COSTS,
  MAX_CONSTRUCTIONS_PER_TERRITORY,
  MAX_FORTRESSES_PER_TERRITORY,
  MOVEMENT_COST_BETWEEN_TERRITORIES,
  MOVEMENT_WITHIN_TERRITORY_COST,
} from "../data/turns";
export {
  REGENT_LEVELUP_BASE_COST,
  REGENT_LEVELUP_INCREMENT,
  HERO_LEVELUP_BASE_COST,
  HERO_LEVELUP_INCREMENT,
  HERO_RECRUITMENT_COSTS,
  MAX_HEROES_PER_PLAYER,
  MAX_HERO_LEVEL,
  REGENT_ATTRIBUTE_POINTS_PER_LEVEL,
  HERO_ATTRIBUTE_POINTS_PER_LEVEL,
  REGENT_INITIAL_ATTRIBUTE_POINTS,
  HERO_INITIAL_ATTRIBUTE_POINTS,
  TROOP_RECRUITMENT_BASE_COST,
  TROOP_LEVELUP_COSTS,
  MAX_TROOP_LEVEL,
  TROOP_ATTRIBUTE_POINTS_PER_LEVEL,
} from "../data/units";
export {
  TributeDecision,
  CRISIS_METER_START,
  CRISIS_METER_MAX,
  CRISIS_METER_TRIGGERED_AT_TURN,
} from "../data/crisis";
export {
  SkillCategory,
  SkillCostTier,
  SkillRange,
  SkillTargetType,
  COST_VALUES,
  DEFAULT_RANGE_VALUES,
  SkillDefinition,
  // Range helpers
  getManhattanDistance,
  isInSkillRange,
  isAdjacent,
  getAdjacentPositions,
  getPositionsInRadius,
  getPositionsInRange,
  getSkillEffectiveRange,
} from "../../../shared/types/skills.types";
export {
  ClassArchetype,
  TroopCategory,
  TROOP_RESOURCE_MAP,
} from "../data/archetypes";

// src/types/index.ts
import { Alignment, Race } from "@prisma/client";

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
  TROPA = "TROPA",
  HEROI = "HEROI",
  REGENTE = "REGENTE",
  PRISIONEIRO = "PRISIONEIRO",
  INVOCACAO = "INVOCACAO",
  MONSTRO = "MONSTRO",
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
  | "MINERIO"
  | "ARCANA"
  | "COMIDA"
  | "EXPERIENCIA"
  | "DEVOCAO";

// Interface para os recursos de um jogador
export interface PlayerResources {
  minerio: number;
  suprimentos: number;
  arcana: number;
  experiencia: number;
  devocao: number;
}

// --- TURNOS E RODADAS ---
export enum TurnType {
  ADMINISTRACAO = "ADMINISTRACAO",
  EXERCITOS = "EXERCITOS",
  MOVIMENTACAO = "MOVIMENTACAO",
  CRISE = "CRISE",
  ACAO = "ACAO",
  BATALHA = "BATALHA",
}

// Ordem dos turnos em uma rodada
export const TURN_ORDER: TurnType[] = [
  TurnType.ADMINISTRACAO,
  TurnType.EXERCITOS,
  TurnType.MOVIMENTACAO,
  TurnType.CRISE,
  TurnType.ACAO,
  TurnType.BATALHA,
];

// Custos de construção baseado na quantidade de construções já existentes
export const CONSTRUCTION_COSTS: Record<number, number> = {
  1: 0, // Primeira construção (capital) é grátis
  2: 2, // Segunda construção
  3: 4, // Terceira construção
  4: 6, // Quarta construção
  5: 8, // Quinta construção
  6: 10, // Sexta construção
  7: 12, // Sétima construção
  8: 14, // Oitava construção
};

// Limites de construção
export const MAX_CONSTRUCTIONS_PER_TERRITORY = 8;
export const MAX_FORTRESSES_PER_TERRITORY = 3;

// --- UNIDADES (REGENTE E HERÓI) ---
// Custos de Level Up de Regente (começa em 6 e incrementa 3 por nível)
export const REGENT_LEVELUP_BASE_COST = 6;
export const REGENT_LEVELUP_INCREMENT = 3;

// Custos de Level Up de Herói (começa em 4 e incrementa 2 por nível)
export const HERO_LEVELUP_BASE_COST = 4;
export const HERO_LEVELUP_INCREMENT = 2;

// Custos de recrutamento de Herói (baseado na quantidade de heróis que já tem)
export const HERO_RECRUITMENT_COSTS: Record<number, number> = {
  0: 4, // Primeiro herói
  1: 6, // Segundo herói
  2: 8, // Terceiro herói
  3: 10, // Quarto herói
  4: 12, // Quinto herói
  5: 14, // Sexto herói
};

export const MAX_HEROES_PER_PLAYER = 6;
export const MAX_HERO_LEVEL = 10;

// Pontos de atributo por level
export const REGENT_ATTRIBUTE_POINTS_PER_LEVEL = 6;
export const HERO_ATTRIBUTE_POINTS_PER_LEVEL = 4;

// Atributos iniciais
export const REGENT_INITIAL_ATTRIBUTE_POINTS = 30;
export const HERO_INITIAL_ATTRIBUTE_POINTS = 15;

// --- TROPAS ---
// Custos de recrutamento de Tropas (baseado na quantidade de tropas da mesma categoria)
// Fórmula: (quantidade_atual + 1) × 2
export const TROOP_RECRUITMENT_BASE_COST = 2;

// Custos de Level Up de Categoria de Tropa (Nível 1→2: 2, 2→3: 3, etc.)
export const TROOP_LEVELUP_COSTS: Record<number, number> = {
  1: 2, // Nível 1 → 2
  2: 3, // Nível 2 → 3
  3: 4, // Nível 3 → 4
  4: 5, // Nível 4 → 5
  5: 6, // Nível 5 → 6
  6: 7, // Nível 6 → 7
  7: 8, // Nível 7 → 8
  8: 9, // Nível 8 → 9
  9: 10, // Nível 9 → 10
};

export const MAX_TROOP_LEVEL = 10;
export const TROOP_ATTRIBUTE_POINTS_PER_LEVEL = 2;

// Categorias de tropas e seus recursos
export type TroopCategory =
  | "DEFENSOR"
  | "EMBOSCADOR"
  | "ATACANTE"
  | "CONJURADOR";

export const TROOP_RESOURCE_MAP: Record<TroopCategory, keyof PlayerResources> =
  {
    DEFENSOR: "minerio",
    EMBOSCADOR: "suprimentos",
    ATACANTE: "experiencia",
    CONJURADOR: "arcana",
  };

// --- MOVIMENTO ---
export const MOVEMENT_COST_BETWEEN_TERRITORIES = 1; // 1 Suprimento por movimento entre territórios
export const MOVEMENT_WITHIN_TERRITORY_COST = 0; // Movimento dentro do mesmo território é grátis

// --- CLASSES ---
export type ClassArchetype =
  | "MAGICA"
  | "MECANICA"
  | "FISICA"
  | "ESPIRITUAL"
  | "CAOTICA";

export interface ClassDefinition {
  id: string; // "WARRIOR"
  name: string; // "Guerreiro"
  archetype: ClassArchetype;
  resourceUsed: ResourceType; // Define qual recurso essa classe gasta
  description?: string; // Descrição da classe
  skills: SkillDefinition[];
}

// --- HABILIDADES ---
export type SkillCategory = "ATIVA" | "REATIVA" | "PASSIVA";
export type SkillCostTier = "BAIXO" | "MEDIO" | "ALTO"; // 1, 2, 3
export type RangeType = "ADJACENTE" | "BAIXO" | "MEDIO" | "ALTO"; // 1, 2, 4, 6

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;

  // Apenas para Ativas e Reativas
  costTier?: SkillCostTier;
  range?: RangeType;
}

// Helper para traduzir Tier em Número
export const COST_VALUES: Record<SkillCostTier, number> = {
  BAIXO: 1,
  MEDIO: 2,
  ALTO: 3,
};

export const RANGE_VALUES: Record<RangeType, number> = {
  ADJACENTE: 1,
  BAIXO: 2,
  MEDIO: 4,
  ALTO: 6,
};
// --- CRISE: MEDIDOR DE CRISE E PILHA DE TRIBUTO ---
export enum TributeDecision {
  CONTRIBUIR = "CONTRIBUIR", // Incrementa a pilha
  SABOTAR = "SABOTAR", // Reduz a pilha
  NAOINTERVIER = "NAOINTERVIER", // Não contribui
}

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

export const CRISIS_METER_START = 1; // MC começa em 1
export const CRISIS_METER_MAX = 15; // Quando chega a 15, crise começaexport const CRISIS_METER_TRIGGERED_AT_TURN = 5; // No 5º turno da rodada

// shared/data/Templates/CrisisTemplates.ts
// Templates raw de crises do jogo

import type { CrisisType } from "../../types/match.types";

// =============================================================================
// CONSTANTES DE SISTEMA DE CRISE
// =============================================================================

export const CRISIS_METER_START = 1; // MC começa em 1
export const CRISIS_METER_MAX = 15; // Quando chega a 15, crise é acionada
export const CRISIS_METER_TRIGGERED_AT_TURN = 5; // No 5º turno da rodada a crise é revelada

export enum TributeDecision {
  CONTRIBUIR = "CONTRIBUIR", // Incrementa a pilha
  SABOTAR = "SABOTAR", // Reduz a pilha
  NAOINTERVIER = "NAOINTERVIER", // Não contribui
}

// =============================================================================
// DEFINIÇÕES DE CRISE
// =============================================================================

interface CrisisDefinition {
  type: CrisisType;
  stats: {
    combat: number;
    speed: number;
    focus: number;
    resistance: number;
    will: number;
    vitality: number;
    maxVitality: number;
  };
  initialExtraData: {
    [key: string]: any;
  };
}

export const CRISIS_DEFINITIONS: Record<CrisisType, CrisisDefinition> = {
  KAIJU: {
    type: "KAIJU",
    stats: {
      combat: 10,
      speed: 20,
      focus: 15,
      resistance: 25,
      will: 2,
      vitality: 30,
      maxVitality: 30,
    },
    initialExtraData: {
      kaijuDamageStack: 0, // Começa com 0 de bônus acumulado
    },
  },
  WALKERS: {
    type: "WALKERS",
    stats: {
      combat: 10,
      speed: 10,
      focus: 10,
      resistance: 10,
      will: 1,
      vitality: 10,
      maxVitality: 10,
    },
    initialExtraData: {
      walkerUnitCount: 5, // Começa contando como 5 unidades
    },
  },

  AMORPHOUS: {
    type: "AMORPHOUS",
    stats: {
      combat: 8,
      speed: 5,
      focus: 3,
      resistance: 20,
      will: 1,
      vitality: 50,
      maxVitality: 50,
    },
    initialExtraData: {
      splitCount: 0, // Quantidade de vezes que se dividiu
    },
  },
};

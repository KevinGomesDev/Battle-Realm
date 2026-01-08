// shared/qte/qte-config.ts
// Configurações e constantes do sistema QTE

import type { QTEActionType, QTEResultGrade } from "./qte.types";

// =============================================================================
// CONSTANTES DE SINCRONIZAÇÃO (TRUST BUT VERIFY)
// =============================================================================

/**
 * Delay em ms para agendar o QTE no futuro
 * Garante que o pacote chegue antes do QTE começar
 */
export const QTE_FUTURE_DELAY = 300;

/**
 * Tolerância em ms para validação de timestamp
 * Compensa flutuação de rede/ping
 */
export const QTE_TOLERANCE_MS = 150;

/**
 * Buffer extra em ms após duration para timeout
 */
export const QTE_TIMEOUT_BUFFER = 500;

// =============================================================================
// CONFIGURAÇÃO DE CÁLCULO DO QTE
// =============================================================================

/**
 * Configuração base para cálculo dos parâmetros do QTE
 */
export interface QTECalculationConfig {
  /** Tempo base do QTE em ms */
  baseDuration: number;

  /** Duração mínima em ms */
  minDuration: number;

  /** Duração máxima em ms */
  maxDuration: number;

  /** Modificador de duração por ponto de Speed */
  speedDurationMod: number;

  /** Tamanho base da zona de acerto (%) */
  baseHitZone: number;

  /** Tamanho mínimo da zona de acerto (%) */
  minHitZone: number;

  /** Tamanho máximo da zona de acerto (%) */
  maxHitZone: number;

  /** Modificador de zona por ponto de Focus */
  focusZoneMod: number;

  /** Intensidade base de shake */
  baseShakeIntensity: number;

  /** Modificador de shake por ponto de diferença Combat vs Resistance */
  combatShakeMod: number;

  /** Razão da zona perfeita em relação à zona de acerto */
  perfectZoneRatio: number;
}

/**
 * Configuração padrão para cálculo dos parâmetros do QTE
 */
export const QTE_DEFAULT_CONFIG: QTECalculationConfig = {
  // Tempo
  baseDuration: 1000, // 1 segundo base
  minDuration: 400, // Mínimo 400ms (muito rápido)
  maxDuration: 2000, // Máximo 2 segundos (muito lento)
  speedDurationMod: 15, // Cada ponto de diferença de Speed = ±15ms

  // Zona de acerto
  baseHitZone: 25, // 25% base
  minHitZone: 8, // Mínimo 8%
  maxHitZone: 50, // Máximo 50%
  focusZoneMod: 1.5, // Cada ponto de Focus = ±1.5%

  // Shake/Tremor
  baseShakeIntensity: 0, // Sem shake base
  combatShakeMod: 3, // Cada ponto de diferença = 3 de intensidade

  // Perfect zone
  perfectZoneRatio: 0.3, // Perfect zone = 30% da hit zone
};

// =============================================================================
// MULTIPLICADORES DE DANO
// =============================================================================

/**
 * Multiplicadores de dano por resultado do QTE
 */
export interface QTEDamageMultipliers {
  /** Ataque - Falha */
  attackFail: number;

  /** Ataque - Acerto */
  attackHit: number;

  /** Ataque - Perfeito */
  attackPerfect: number;

  /** Bloqueio - Falha (dano recebido) */
  blockFail: number;

  /** Bloqueio - Acerto (dano recebido) */
  blockHit: number;

  /** Bloqueio - Perfeito (dano recebido) */
  blockPerfect: number;
}

/**
 * Multiplicadores padrão de dano
 */
export const QTE_DAMAGE_MULTIPLIERS: QTEDamageMultipliers = {
  // Ataque
  attackFail: 0.5, // 50% do dano
  attackHit: 1.0, // 100% do dano
  attackPerfect: 1.5, // 150% do dano

  // Bloqueio (multiplicador de dano RECEBIDO)
  blockFail: 1.0, // 100% do dano (falhou em bloquear)
  blockHit: 0.5, // 50% do dano
  blockPerfect: 0.25, // 25% do dano
};

// =============================================================================
// HELPERS E MAPEAMENTOS
// =============================================================================

import type { DodgeDirection, QTEInput } from "./qte.types";

/**
 * Mapa de input para direção de movimento
 */
export const INPUT_TO_DIRECTION: Record<QTEInput, DodgeDirection | null> = {
  W: "UP",
  S: "DOWN",
  A: "LEFT",
  D: "RIGHT",
  E: null,
  NONE: null,
};

/**
 * Mapa de direção para delta de posição
 */
export const DIRECTION_DELTAS: Record<
  DodgeDirection,
  { dx: number; dy: number }
> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

/**
 * Inverte uma direção (para calcular direção oposta ao ataque)
 */
export const OPPOSITE_DIRECTION: Record<DodgeDirection, DodgeDirection> = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT",
};

/**
 * Cores de feedback por grau de resultado
 */
export const QTE_FEEDBACK_COLORS: Record<QTEResultGrade, string> = {
  FAIL: "#ef4444", // Vermelho
  HIT: "#22c55e", // Verde
  PERFECT: "#eab308", // Dourado
};

/**
 * Mensagens de feedback por tipo e grau
 */
export const QTE_FEEDBACK_MESSAGES: Record<
  QTEActionType,
  Record<QTEResultGrade, string>
> = {
  ATTACK: {
    FAIL: "Golpe Fraco!",
    HIT: "Acertou!",
    PERFECT: "Crítico!",
  },
  BLOCK: {
    FAIL: "Defesa Quebrada!",
    HIT: "Bloqueou!",
    PERFECT: "Bloqueio Perfeito!",
  },
  DODGE: {
    FAIL: "Não Escapou!",
    HIT: "Esquivou!",
    PERFECT: "Reflexos Perfeitos!",
  },
  SKILL: {
    FAIL: "Falhou!",
    HIT: "Executou!",
    PERFECT: "Execução Magistral!",
  },
  SPELL: {
    FAIL: "Conjuração Fraca!",
    HIT: "Conjurou!",
    PERFECT: "Poder Máximo!",
  },
};

/**
 * Buff aplicado por esquiva perfeita
 */
export const PERFECT_DODGE_BUFF = "ADRENALINE_RUSH";

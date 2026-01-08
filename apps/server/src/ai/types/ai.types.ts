// server/src/ai/types/ai.types.ts
// Tipos do Sistema de IA para Batalhas

import type {
  BattleObstacle,
  BattleUnit,
} from "../../../../shared/types/battle.types";

/**
 * Comportamento base da IA
 * Define como a unidade decide suas ações
 */
export type AIBehaviorType =
  | "AGGRESSIVE" // Move em direção ao inimigo, ataca sempre que possível
  | "TACTICAL" // Considera HP, recua se baixo, prioriza alvos fracos
  | "RANGED" // Mantém distância, ataca de longe
  | "SUPPORT" // Prioriza curar/buffar aliados
  | "DEFENSIVE"; // Protege posição, contra-ataca

/**
 * Prioridade de skill da IA
 */
export type AISkillPriority =
  | "NONE" // Só usa ataque básico
  | "BASIC" // Usa skills se disponíveis, sem lógica especial
  | "SMART"; // Prioriza skills baseado em contexto (cura se HP baixo, etc)

/**
 * Perfil de IA de uma unidade
 * Define comportamento e prioridades
 */
export interface AIProfile {
  /** Tipo de comportamento principal */
  behavior: AIBehaviorType;
  /** Nível de uso de skills */
  skillPriority: AISkillPriority;
  /** Distância preferida do alvo (0 = melee, 1+ = ranged) */
  preferredRange: number;
  /** % de HP abaixo do qual considera recuar (0-1) */
  retreatThreshold: number;
  /** Prioriza alvos com HP baixo? */
  focusWeakTargets: boolean;
  /** Prioriza aliados com HP baixo para cura? */
  prioritizeHealingAllies: boolean;
}

/**
 * Ação decidida pela IA
 */
export type AIActionType =
  | "MOVE" // Mover para uma posição
  | "ATTACK" // Atacar um alvo
  | "SKILL" // Usar uma skill
  | "SPELL" // Usar uma magia
  | "DASH" // Usar corrida para dobrar movimento
  | "PASS"; // Passar turno (sem ações válidas)

/**
 * Decisão de ação da IA
 */
export interface AIDecision {
  /** Tipo da ação */
  type: AIActionType;
  /** ID da unidade que vai agir */
  unitId: string;
  /** Posição alvo (para MOVE/SPELL) */
  targetPosition?: { x: number; y: number };
  /** ID do alvo (para ATTACK/SKILL/SPELL) */
  targetId?: string;
  /** Código da skill (para SKILL) */
  skillCode?: string;
  /** Código da spell (para SPELL) */
  spellCode?: string;
  /** Razão da decisão (para debug/logs) */
  reason: string;
}

/**
 * Contexto de batalha para a IA tomar decisões
 */
export interface AIBattleContext {
  /** ID da batalha */
  battleId: string;
  /** Rodada atual */
  round: number;
  /** Todas as unidades na batalha */
  units: BattleUnit[];
  /** Obstáculos */
  obstacles: BattleObstacle[];
  /** Tamanho do grid */
  gridSize: {
    width: number;
    height: number;
  };
  /** Movimentos restantes da unidade atual */
  movesRemaining: number;
  /** Ações restantes da unidade atual */
  actionsRemaining: number;
}

/**
 * Avaliação do estado próprio da unidade IA
 */
export interface AISelfAssessment {
  /** HP atual em porcentagem (0-1) */
  hpPercent: number;
  /** Se está em estado crítico (HP <= 25%) */
  isCritical: boolean;
  /** Se está ferida (HP <= 50%) */
  isWounded: boolean;
  /** Se tem proteção física ativa */
  hasPhysicalProtection: boolean;
  /** Quantidade de proteção física */
  physicalProtectionAmount: number;
  /** Se tem proteção mágica ativa */
  hasMagicalProtection: boolean;
  /** Quantidade de proteção mágica */
  magicalProtectionAmount: number;
  /** Último tipo de dano recebido (se conhecido) */
  lastDamageType?: "FISICO" | "MAGICO" | "VERDADEIRO";
  /** Se deve priorizar defesa */
  shouldDefend: boolean;
  /** Se deve recuar */
  shouldRetreat: boolean;
}

/**
 * Configuração de timeout para a IA
 */
export interface AITimeoutConfig {
  /** Timeout máximo para uma decisão (ms) */
  decisionTimeout: number;
  /** Timeout máximo para um turno completo (ms) */
  turnTimeout: number;
  /** Máximo de iterações em loops */
  maxIterations: number;
}

/** Configuração padrão de timeout */
export const DEFAULT_AI_TIMEOUT: AITimeoutConfig = {
  decisionTimeout: 2000, // 2 segundos por decisão
  turnTimeout: 30000, // 30 segundos por turno
  maxIterations: 100, // Máximo 100 iterações em qualquer loop
};

/**
 * Estado da IA para uma batalha
 */
export interface AIBattleState {
  /** Se a IA está ativa nesta batalha */
  isActive: boolean;
  /** IDs das unidades que a IA controla */
  controlledUnitIds: string[];
  /** Índice da unidade atual no turno da IA */
  currentUnitIndex: number;
  /** Se o turno da IA está em andamento */
  isTurnInProgress: boolean;
}

/**
 * Resultado do turno da IA
 */
export interface AITurnResult {
  /** ID do jogador IA */
  aiPlayerId: string;
  /** Decisões tomadas */
  decisions: AIDecision[];
  /** IDs das unidades processadas */
  unitsProcessed: string[];
}

/**
 * Mapeamento de categoria de unidade para perfil de IA padrão
 */
export const DEFAULT_AI_PROFILES: Record<string, AIProfile> = {
  // Monstros genéricos são agressivos
  MONSTER: {
    behavior: "AGGRESSIVE",
    skillPriority: "NONE",
    preferredRange: 0,
    retreatThreshold: 0.15,
    focusWeakTargets: false,
    prioritizeHealingAllies: false,
  },
  // Summons herdam comportamento do tipo
  SUMMON: {
    behavior: "AGGRESSIVE",
    skillPriority: "BASIC",
    preferredRange: 0,
    retreatThreshold: 0.2,
    focusWeakTargets: true,
    prioritizeHealingAllies: false,
  },
  // Classes específicas terão perfis customizados
  WARRIOR: {
    behavior: "TACTICAL",
    skillPriority: "BASIC",
    preferredRange: 0,
    retreatThreshold: 0.25,
    focusWeakTargets: false,
    prioritizeHealingAllies: false,
  },
  ARCHER: {
    behavior: "RANGED",
    skillPriority: "SMART",
    preferredRange: 4,
    retreatThreshold: 0.3,
    focusWeakTargets: true,
    prioritizeHealingAllies: false,
  },
  MAGE: {
    behavior: "RANGED",
    skillPriority: "SMART",
    preferredRange: 4,
    retreatThreshold: 0.35,
    focusWeakTargets: true,
    prioritizeHealingAllies: false,
  },
  HEALER: {
    behavior: "SUPPORT",
    skillPriority: "SMART",
    preferredRange: 3,
    retreatThreshold: 0.4,
    focusWeakTargets: false,
    prioritizeHealingAllies: true,
  },
  TANK: {
    behavior: "DEFENSIVE",
    skillPriority: "BASIC",
    preferredRange: 0,
    retreatThreshold: 0.15,
    focusWeakTargets: false,
    prioritizeHealingAllies: false,
  },
};

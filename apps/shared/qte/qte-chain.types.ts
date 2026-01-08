// shared/qte/qte-chain.types.ts
// Tipos para Chain QTE (QTE em Cascata/Playlist)
// Usado para skills como Chain Lightning, Omnislash, Meteor Shower

import type {
  QTEActionType,
  QTEResultGrade,
  QTEInput,
  QTEConfig,
  QTEResult,
} from "./qte.types";

// =============================================================================
// CHAIN QTE - ARQUITETURA DE PLAYLIST
// =============================================================================

/**
 * Tipo de Chain QTE
 * - OFFENSIVE: Ataque em múltiplos alvos (Chain Lightning)
 * - DEFENSIVE: Defesa contra múltiplos ataques (Meteor Shower)
 * - FOCUSED: Múltiplos hits no mesmo alvo (Omnislash)
 */
export type ChainQTEType = "OFFENSIVE" | "DEFENSIVE" | "FOCUSED";

/**
 * Modo de comportamento quando erra um passo
 * - BREAK: A corrente quebra, passos seguintes cancelados
 * - CONTINUE: Continua para próximo passo com dano/efeito reduzido
 * - COMBO: Combo zera mas continua (dano base nos próximos)
 */
export type ChainFailMode = "BREAK" | "CONTINUE" | "COMBO";

/**
 * Dificuldade do passo (afeta tamanho das zonas)
 */
export type ChainStepDifficulty = "EASY" | "MEDIUM" | "HARD";

// =============================================================================
// STEP - UM PASSO DA CORRENTE
// =============================================================================

/**
 * Um passo individual do Chain QTE
 * O servidor pré-calcula todos os passos e envia de uma vez
 */
export interface ChainQTEStep {
  /** Índice do passo (0, 1, 2...) */
  stepIndex: number;

  /** ID da unidade alvo deste passo */
  targetId: string;

  /** Nome da unidade alvo (para UI) */
  targetName: string;

  /** Posição do alvo no grid */
  targetPosition: { x: number; y: number };

  /** Offset em ms desde o início do Chain QTE */
  offsetMs: number;

  /** Duração deste QTE específico em ms */
  duration: number;

  /** Dificuldade do passo (afeta zonas) */
  difficulty: ChainStepDifficulty;

  /** Tamanho da zona de acerto (%) */
  hitZoneSize: number;

  /** Tamanho da zona perfeita (%) */
  perfectZoneSize: number;

  /** Intensidade do shake */
  shakeIntensity: number;

  /** Inputs válidos para este passo */
  validInputs: QTEInput[];

  /** Dano base deste passo */
  baseDamage: number;

  /** Multiplicador de combo (se anterior foi hit) */
  comboMultiplier: number;
}

// =============================================================================
// CHAIN QTE CONFIG - A PLAYLIST COMPLETA
// =============================================================================

/**
 * Configuração completa do Chain QTE
 * Enviada pelo servidor para o cliente com todos os passos pré-calculados
 */
export interface ChainQTEConfig {
  /** ID único do Chain QTE */
  chainId: string;

  /** Tipo de Chain QTE */
  chainType: ChainQTEType;

  /** ID da batalha */
  battleId: string;

  /** ID do jogador que executa (atacante) ou defende */
  playerId: string;

  /** ID da unidade que inicia (caster da skill) */
  casterId: string;

  /** Skill ou spell que originou o Chain */
  skillCode?: string;
  spellCode?: string;

  /** Nome da skill/spell para UI */
  actionName: string;

  /** Modo de comportamento ao falhar */
  failMode: ChainFailMode;

  /** Timestamp base do servidor (início do Chain) */
  serverBaseTime: number;

  /** Todos os passos pré-calculados */
  steps: ChainQTEStep[];

  /** Tempo total do Chain QTE em ms */
  totalDuration: number;

  /** Se é um ataque mágico (afeta proteções) */
  isMagicAttack: boolean;

  /** Linha visual conectando alvos (para UI) */
  trajectoryLine?: {
    points: { x: number; y: number }[];
    color: string;
  };
}

// =============================================================================
// CHAIN QTE RESPONSE - RESPOSTA DE UM PASSO
// =============================================================================

/**
 * Resposta do cliente para um passo do Chain QTE
 */
export interface ChainQTEStepResponse {
  /** ID do Chain QTE */
  chainId: string;

  /** Índice do passo sendo respondido */
  stepIndex: number;

  /** ID da batalha */
  battleId: string;

  /** ID do jogador */
  playerId: string;

  /** Input do jogador */
  input: QTEInput;

  /** Posição do indicador quando apertou */
  hitPosition: number;

  /** Timestamp estimado do servidor */
  serverTimestamp: number;
}

/**
 * Resposta agregada de Chain QTE focado (Omnislash)
 * Para QTEs muito rápidos, o cliente acumula e envia no final
 */
export interface ChainQTEBatchResponse {
  /** ID do Chain QTE */
  chainId: string;

  /** ID da batalha */
  battleId: string;

  /** ID do jogador */
  playerId: string;

  /** Resultados por passo */
  stepResults: {
    stepIndex: number;
    input: QTEInput;
    hitPosition: number;
    serverTimestamp: number;
  }[];

  /** Total de hits */
  totalHits: number;

  /** Total de passos */
  totalSteps: number;
}

// =============================================================================
// CHAIN QTE RESULT - RESULTADO DO SERVIDOR
// =============================================================================

/**
 * Resultado de um passo individual
 */
export interface ChainQTEStepResult {
  /** Índice do passo */
  stepIndex: number;

  /** ID do alvo */
  targetId: string;

  /** Grau do resultado */
  grade: QTEResultGrade;

  /** Dano aplicado (já com multiplicadores) */
  damageDealt: number;

  /** Multiplicador de combo atual */
  currentCombo: number;

  /** Se o alvo morreu */
  targetDefeated: boolean;
}

/**
 * Resultado completo do Chain QTE
 */
export interface ChainQTEResult {
  /** ID do Chain QTE */
  chainId: string;

  /** ID da batalha */
  battleId: string;

  /** Resultados de cada passo */
  stepResults: ChainQTEStepResult[];

  /** Total de hits bem-sucedidos */
  totalHits: number;

  /** Total de perfeitos */
  totalPerfects: number;

  /** Total de falhas */
  totalFails: number;

  /** Maior combo alcançado */
  maxCombo: number;

  /** Dano total aplicado */
  totalDamage: number;

  /** Se a corrente foi quebrada (failMode = BREAK) */
  chainBroken: boolean;

  /** Índice onde quebrou (se aplicável) */
  brokenAtStep?: number;

  /** Mensagem de feedback geral */
  feedbackMessage: string;

  /** Cor do feedback */
  feedbackColor: string;
}

// =============================================================================
// EVENTOS COLYSEUS PARA CHAIN QTE
// =============================================================================

/**
 * Evento: Chain QTE iniciado (servidor -> cliente)
 */
export interface ChainQTEStartEvent {
  type: "chain_qte:start";
  config: ChainQTEConfig;
}

/**
 * Evento: Passo do Chain respondido (cliente -> servidor)
 */
export interface ChainQTEStepResponseEvent {
  type: "chain_qte:step_response";
  response: ChainQTEStepResponse;
}

/**
 * Evento: Batch de respostas (cliente -> servidor, para Omnislash)
 */
export interface ChainQTEBatchResponseEvent {
  type: "chain_qte:batch_response";
  response: ChainQTEBatchResponse;
}

/**
 * Evento: Passo resolvido (servidor -> cliente)
 */
export interface ChainQTEStepResolvedEvent {
  type: "chain_qte:step_resolved";
  chainId: string;
  stepResult: ChainQTEStepResult;
}

/**
 * Evento: Chain QTE completo (servidor -> todos)
 */
export interface ChainQTECompleteEvent {
  type: "chain_qte:complete";
  result: ChainQTEResult;
}

/**
 * Evento: Chain quebrado (servidor -> todos)
 */
export interface ChainQTEBrokenEvent {
  type: "chain_qte:broken";
  chainId: string;
  brokenAtStep: number;
  reason: string;
}

// =============================================================================
// ESTADO DO CHAIN QTE NO CLIENTE
// =============================================================================

/**
 * Estado do Chain QTE para gerenciamento no cliente
 */
export interface ChainQTEClientState {
  /** Chain QTE ativo */
  activeChain: ChainQTEConfig | null;

  /** Índice do passo atual */
  currentStepIndex: number;

  /** Se o Chain está ativo visualmente */
  isActive: boolean;

  /** Se a corrente foi quebrada */
  chainBroken: boolean;

  /** Combo atual */
  currentCombo: number;

  /** Resultados dos passos já completados */
  completedSteps: ChainQTEStepResult[];

  /** Se está aguardando próximo passo */
  waitingForNextStep: boolean;

  /** Dano acumulado */
  accumulatedDamage: number;
}

// =============================================================================
// CONFIGURAÇÃO DE DIFICULDADE
// =============================================================================

/**
 * Configuração de zonas por dificuldade
 */
export const CHAIN_DIFFICULTY_CONFIG: Record<
  ChainStepDifficulty,
  { hitZoneSize: number; perfectZoneSize: number; duration: number }
> = {
  EASY: {
    hitZoneSize: 35,
    perfectZoneSize: 12,
    duration: 1200,
  },
  MEDIUM: {
    hitZoneSize: 25,
    perfectZoneSize: 8,
    duration: 1000,
  },
  HARD: {
    hitZoneSize: 15,
    perfectZoneSize: 5,
    duration: 800,
  },
};

/**
 * Multiplicadores de combo
 */
export const CHAIN_COMBO_MULTIPLIERS = {
  /** Multiplicador por hit consecutivo */
  PER_HIT: 0.1,
  /** Multiplicador extra por perfeito */
  PERFECT_BONUS: 0.15,
  /** Máximo multiplicador de combo */
  MAX_COMBO: 2.5,
  /** Reset ao falhar (se failMode = COMBO) */
  FAIL_RESET: 1.0,
};

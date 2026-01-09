// shared/types/arena.types.ts
// Sistema de Arena - Desafios Diretos

// ============================================
// Enums
// ============================================

export type ChallengeStatus =
  | "PENDING" // Aguardando resposta
  | "ACCEPTED" // Aceito, countdown iniciando
  | "DECLINED" // Recusado
  | "EXPIRED" // Expirou sem resposta
  | "CANCELLED" // Cancelado pelo desafiante
  | "BATTLE_STARTED"; // Batalha iniciada

export type ChallengeType =
  | "DIRECT" // Desafio direto a um jogador específico
  | "OPEN"; // Desafio aberto para qualquer um

// ============================================
// Kingdom Info (para exibição)
// ============================================

export interface ChallengeKingdomInfo {
  kingdomId: string;
  kingdomName: string;
  userId: string;
  username: string;
  /** Força total do reino (soma de atributos das unidades) */
  power: number;
  /** Quantidade de unidades */
  unitCount: number;
}

// ============================================
// Challenge (Desafio)
// ============================================

export interface Challenge {
  challengeId: string;
  type: ChallengeType;
  status: ChallengeStatus;

  /** Quem está desafiando */
  challenger: ChallengeKingdomInfo;

  /** Quem foi desafiado (null se OPEN) */
  challenged: ChallengeKingdomInfo | null;

  /** Timestamp de criação */
  createdAt: number;

  /** Timestamp de expiração (30 segundos para DIRECT, 5 min para OPEN) */
  expiresAt: number;

  /** Countdown restante após aceite (5 segundos) */
  countdownSeconds?: number;

  /** ID da batalha (quando iniciada) */
  battleId?: string;
}

// ============================================
// Payloads - Cliente → Servidor
// ============================================

/** Criar desafio direto */
export interface CreateDirectChallengePayload {
  challengerKingdomId: string;
  targetUserId: string;
  targetKingdomId: string;
}

/** Criar desafio aberto */
export interface CreateOpenChallengePayload {
  challengerKingdomId: string;
}

/** Aceitar desafio */
export interface AcceptChallengePayload {
  challengeId: string;
  kingdomId: string;
}

/** Recusar desafio */
export interface DeclineChallengePayload {
  challengeId: string;
}

/** Cancelar desafio (só o desafiante pode) */
export interface CancelChallengePayload {
  challengeId: string;
}

/** Listar desafios abertos */
export interface ListOpenChallengesPayload {
  /** Filtrar por força similar (opcional) */
  powerRange?: {
    min: number;
    max: number;
  };
}

/** Listar oponentes disponíveis para desafio */
export interface ListOpponentsPayload {
  /** ID do reino do jogador (para calcular força similar) */
  kingdomId: string;
}

// ============================================
// Responses - Servidor → Cliente
// ============================================

export interface ChallengeCreatedResponse {
  success: true;
  challenge: Challenge;
}

export interface ChallengeErrorResponse {
  success: false;
  error: string;
}

export type ChallengeResponse =
  | ChallengeCreatedResponse
  | ChallengeErrorResponse;

export interface OpenChallengesListResponse {
  challenges: Challenge[];
}

export interface OpponentsListResponse {
  opponents: ChallengeKingdomInfo[];
}

/** Notificação de novo desafio recebido */
export interface ChallengeReceivedNotification {
  challenge: Challenge;
}

/** Notificação de desafio aceito (ambos recebem) */
export interface ChallengeAcceptedNotification {
  challenge: Challenge;
  /** Countdown em segundos antes da batalha */
  countdown: number;
}

/** Notificação de desafio recusado */
export interface ChallengeDeclinedNotification {
  challengeId: string;
  declinedBy: string;
}

/** Notificação de desafio expirado */
export interface ChallengeExpiredNotification {
  challengeId: string;
}

/** Notificação de batalha iniciando */
export interface BattleStartingNotification {
  challengeId: string;
  battleId: string;
  battleRoomId: string;
  /** Kingdom ID do challenger (para o cliente saber qual usar no join) */
  challengerKingdomId: string;
  /** Kingdom ID do challenged (para o cliente saber qual usar no join) */
  challengedKingdomId: string;
}

// ============================================
// Arena State (para o store)
// ============================================

export interface ArenaState {
  /** Desafios que eu criei (pendentes) */
  myPendingChallenges: Challenge[];

  /** Desafios que recebi (pendentes) */
  incomingChallenges: Challenge[];

  /** Desafios abertos disponíveis */
  openChallenges: Challenge[];

  /** Oponentes online disponíveis */
  availableOpponents: ChallengeKingdomInfo[];

  /** Desafio atual em countdown (após aceite) */
  activeChallenge: Challenge | null;

  /** Countdown atual (segundos) */
  countdown: number | null;

  /** Loading states */
  isLoading: boolean;
  isCreatingChallenge: boolean;

  /** Erro atual */
  error: string | null;
}

// ============================================
// Message Types (para Colyseus)
// ============================================

export const ARENA_MESSAGES = {
  // Cliente → Servidor
  CREATE_DIRECT: "arena:create_direct",
  CREATE_OPEN: "arena:create_open",
  ACCEPT: "arena:accept",
  DECLINE: "arena:decline",
  CANCEL: "arena:cancel",
  LIST_OPEN: "arena:list_open",
  LIST_OPPONENTS: "arena:list_opponents",

  // Servidor → Cliente
  CHALLENGE_CREATED: "arena:challenge_created",
  CHALLENGE_RECEIVED: "arena:challenge_received",
  CHALLENGE_ACCEPTED: "arena:challenge_accepted",
  CHALLENGE_DECLINED: "arena:challenge_declined",
  CHALLENGE_EXPIRED: "arena:challenge_expired",
  CHALLENGE_CANCELLED: "arena:challenge_cancelled",
  OPEN_CHALLENGES_LIST: "arena:open_challenges_list",
  OPPONENTS_LIST: "arena:opponents_list",
  COUNTDOWN_TICK: "arena:countdown_tick",
  BATTLE_STARTING: "arena:battle_starting",
  ERROR: "arena:error",
} as const;

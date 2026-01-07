// shared/types/events.types.ts
// Sistema de Eventos do Jogo - Compartilhado entre Frontend e Backend

// =============================================================================
// ENUMS E TIPOS BASE
// =============================================================================

/**
 * Contexto onde o evento ocorre
 */
export type EventContext = "GLOBAL" | "MATCH" | "BATTLE" | "ARENA" | "ACCOUNT";

/**
 * Escopo de visibilidade do evento
 */
export type EventScope = "GLOBAL" | "INDIVIDUAL";

/**
 * Categoria do evento (para filtragem e estilização)
 */
export type EventCategory =
  | "SYSTEM" // Mensagens do sistema (servidor, manutenção)
  | "COMBAT" // Ações de combate (ataque, dano, morte)
  | "MOVEMENT" // Movimento de unidades
  | "CONDITION" // Aplicação/remoção de condições
  | "TURN" // Início/fim de turno, rodada
  | "SKILL" // Uso de habilidades
  | "ITEM" // Uso de itens
  | "RESOURCE" // Ganho/gasto de recursos
  | "KINGDOM" // Eventos do reino
  | "MATCH" // Eventos da partida
  | "ARENA" // Eventos da arena
  | "ACCOUNT"; // Eventos da conta do usuário

/**
 * Severidade do evento (para estilização visual)
 */
export type EventSeverity =
  | "INFO" // Informativo (azul/cinza)
  | "SUCCESS" // Sucesso (verde)
  | "WARNING" // Aviso (amarelo)
  | "DANGER" // Perigo/erro (vermelho)
  | "NEUTRAL"; // Neutro (branco/padrão)

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Evento do jogo - estrutura base
 */
export interface GameEvent {
  id: string;
  timestamp: Date;

  // Contexto e escopo
  context: EventContext;
  scope: EventScope;
  category: EventCategory;
  severity: EventSeverity;

  // Relacionamentos (apenas um estará preenchido)
  matchId?: string;
  battleId?: string;
  arenaLobbyId?: string;

  // Destinatários
  targetUserIds?: string[]; // Se scope=INDIVIDUAL, lista de usuários que veem
  sourceUserId?: string; // Usuário que originou o evento (se aplicável)

  // Conteúdo
  message: string; // Mensagem principal para exibição
  code: string; // Código identificador do tipo de evento (ex: "ATTACK_DODGED")
  data?: Record<string, any>; // Dados extras (posições, dano, etc)

  // Unidades envolvidas (para eventos de combate)
  actorId?: string; // ID da unidade que executou ação
  actorName?: string; // Nome da unidade (para exibição)
  targetId?: string; // ID da unidade alvo
  targetName?: string; // Nome do alvo (para exibição)
}

/**
 * Evento para criação (sem id e timestamp)
 */
export interface GameEventCreate {
  context: EventContext;
  scope: EventScope;
  category: EventCategory;
  severity: EventSeverity;

  matchId?: string;
  battleId?: string;
  arenaLobbyId?: string;

  targetUserIds?: string[];
  sourceUserId?: string;

  message: string;
  code: string;
  data?: Record<string, any>;

  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
}

/**
 * Filtro para buscar eventos
 */
export interface EventFilter {
  context?: EventContext;
  matchId?: string;
  battleId?: string;
  arenaLobbyId?: string;
  userId?: string;
  category?: EventCategory;
  limit?: number;
  /** Cursor para paginação - ID do último evento carregado */
  cursor?: string;
  /** Buscar eventos antes deste timestamp */
  before?: Date | string;
}

/**
 * Resposta paginada de eventos
 */
export interface EventsPageResponse {
  events: GameEvent[];
  /** Cursor para próxima página (ID do último evento) */
  nextCursor?: string;
  /** Se há mais eventos para carregar */
  hasMore: boolean;
  /** Total de eventos (aproximado, para contexto) */
  totalCount?: number;
}

// =============================================================================
// CÓDIGOS DE EVENTOS PRÉ-DEFINIDOS
// =============================================================================

export const EVENT_CODES = {
  // Sistema
  SERVER_MESSAGE: "SERVER_MESSAGE",
  SERVER_MAINTENANCE: "SERVER_MAINTENANCE",
  SERVER_RESTART: "SERVER_RESTART",

  // Conta
  ACCOUNT_UPDATED: "ACCOUNT_UPDATED",
  MATCH_INVITATION: "MATCH_INVITATION",

  // Partida
  MATCH_STARTED: "MATCH_STARTED",
  MATCH_ENDED: "MATCH_ENDED",
  TURN_STARTED: "TURN_STARTED",
  TURN_ENDED: "TURN_ENDED",

  // Arena
  ARENA_LOBBY_CREATED: "ARENA_LOBBY_CREATED",
  ARENA_PLAYER_JOINED: "ARENA_PLAYER_JOINED",
  ARENA_BATTLE_STARTED: "ARENA_BATTLE_STARTED",
  ARENA_BATTLE_ENDED: "ARENA_BATTLE_ENDED",

  // Batalha - Turno
  BATTLE_STARTED: "BATTLE_STARTED",
  BATTLE_ENDED: "BATTLE_ENDED",
  ROUND_STARTED: "ROUND_STARTED",
  ROUND_ENDED: "ROUND_ENDED",
  UNIT_TURN_STARTED: "UNIT_TURN_STARTED",
  UNIT_TURN_ENDED: "UNIT_TURN_ENDED",

  // Batalha - Movimento
  UNIT_MOVED: "UNIT_MOVED",
  UNIT_DASHED: "UNIT_DASHED",

  // Batalha - Combate
  ATTACK_HIT: "ATTACK_HIT",
  ATTACK_MISSED: "ATTACK_MISSED",
  ATTACK_DODGED: "ATTACK_DODGED",
  ATTACK_BLOCKED: "ATTACK_BLOCKED",
  UNIT_DAMAGED: "UNIT_DAMAGED",
  UNIT_DEFEATED: "UNIT_DEFEATED",
  PROTECTION_BROKEN: "PROTECTION_BROKEN",

  // Batalha - Condições
  CONDITION_APPLIED: "CONDITION_APPLIED",
  CONDITION_REMOVED: "CONDITION_REMOVED",
  CONDITION_EXPIRED: "CONDITION_EXPIRED",

  // Batalha - Ações especiais
  UNIT_GRABBED: "UNIT_GRABBED",
  UNIT_THROWN: "UNIT_THROWN",
  UNIT_KNOCKED_DOWN: "UNIT_KNOCKED_DOWN",
  UNIT_DISARMED: "UNIT_DISARMED",
  UNIT_HELPED: "UNIT_HELPED",
  UNIT_PROTECTED: "UNIT_PROTECTED",
  UNIT_FLED: "UNIT_FLED",

  // Batalha - Skills
  SKILL_USED: "SKILL_USED",
  SKILL_FAILED: "SKILL_FAILED",

  // Batalha - Magias (Spells)
  SPELL_CAST: "SPELL_CAST",
  SPELL_FAILED: "SPELL_FAILED",

  // Recursos
  RESOURCES_GAINED: "RESOURCES_GAINED",
  RESOURCES_SPENT: "RESOURCES_SPENT",
} as const;

export type EventCode = (typeof EVENT_CODES)[keyof typeof EVENT_CODES];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Retorna ícone baseado na categoria
 */
export function getCategoryIcon(category: EventCategory): string {
  const icons: Record<EventCategory, string> = {
    SYSTEM: "⚙️",
    COMBAT: "⚔️",
    MOVEMENT: "🏃",
    CONDITION: "✨",
    TURN: "🔄",
    SKILL: "🎯",
    ITEM: "🎒",
    RESOURCE: "💰",
    KINGDOM: "🏰",
    MATCH: "🎮",
    ARENA: "🏟️",
    ACCOUNT: "👤",
  };
  return icons[category];
}

/**
 * Formata timestamp para exibição
 */
export function formatEventTime(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// =============================================================================
// SOCKET EVENT NAMES
// =============================================================================

export const EVENT_SOCKET_EVENTS = {
  // Server -> Client
  EVENT_NEW: "event:new", // Novo evento recebido
  EVENT_HISTORY: "event:history", // Lista de eventos anteriores

  // Client -> Server
  EVENT_SUBSCRIBE: "event:subscribe", // Inscrever em contexto
  EVENT_UNSUBSCRIBE: "event:unsubscribe", // Cancelar inscrição
  EVENT_FETCH: "event:fetch", // Buscar histórico
} as const;

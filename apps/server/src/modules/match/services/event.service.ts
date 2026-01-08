// server/src/services/event.service.ts
// Serviço para criar, persistir e cachear eventos do jogo
// NOTA: A emissão de eventos é feita pelas Colyseus Rooms diretamente

import { prisma } from "../../../lib/prisma";
import type {
  GameEvent,
  GameEventCreate,
  EventFilter,
  EventContext,
  EventsPageResponse,
} from "../../../../../shared/types/events.types";
import type {
  BattleUnit,
  BattleObstacle,
} from "../../../../../shared/types/battle.types";
import {
  getPlayersWithVisionAt,
  getPlayersWithVisionAtAny,
} from "../../../utils/vision.utils";

// =============================================================================
// ESTADO GLOBAL
// =============================================================================

/**
 * Cache em memória para eventos de batalha (não persistidos no banco)
 * Key: battleId, Value: array de eventos ordenados por timestamp
 */
const battleEventsCache = new Map<string, GameEvent[]>();

/** Limite máximo de eventos por batalha em memória */
const MAX_BATTLE_EVENTS = 500;

// Callback para emissão de eventos (configurado pelas Rooms)
type EventEmitter = (event: GameEvent) => void;
let eventEmitter: EventEmitter | null = null;

/**
 * Configura o callback de emissão de eventos
 * Usado pelas Colyseus Rooms para receber eventos e broadcast
 */
export function setEventEmitter(emitter: EventEmitter): void {
  eventEmitter = emitter;
}

// =============================================================================
// CACHE DE EVENTOS DE BATALHA (EM MEMÓRIA)
// =============================================================================

/**
 * Adiciona evento de batalha ao cache em memória
 */
function addBattleEventToCache(event: GameEvent): void {
  if (!event.battleId) return;

  let events = battleEventsCache.get(event.battleId);
  if (!events) {
    events = [];
    battleEventsCache.set(event.battleId, events);
  }

  events.push(event);

  // Limitar tamanho do cache
  if (events.length > MAX_BATTLE_EVENTS) {
    events.shift(); // Remove o mais antigo
  }
}

/**
 * Obtém eventos de uma batalha do cache
 */
export function getBattleEventsFromCache(battleId: string): GameEvent[] {
  return battleEventsCache.get(battleId) || [];
}

/**
 * Carrega eventos de uma batalha do banco de dados
 * Usado quando o usuário entra/reconecta na batalha
 */
export async function loadBattleEventsFromDB(
  battleId: string
): Promise<GameEvent[]> {
  // Verificar se já temos no cache
  const cached = battleEventsCache.get(battleId);
  if (cached && cached.length > 0) {
    return cached;
  }

  // Carregar do banco
  const dbEvents = await prisma.gameEvent.findMany({
    where: { battleId },
    orderBy: { timestamp: "desc" },
    take: MAX_BATTLE_EVENTS,
  });

  // Converter e adicionar ao cache
  const events: GameEvent[] = dbEvents.map((dbEvent) => ({
    id: dbEvent.id,
    timestamp: dbEvent.timestamp,
    context: dbEvent.context as EventContext,
    scope: dbEvent.scope as "GLOBAL" | "INDIVIDUAL",
    category: dbEvent.category as GameEvent["category"],
    severity: dbEvent.severity as GameEvent["severity"],
    matchId: dbEvent.matchId || undefined,
    battleId: dbEvent.battleId || undefined,
    BattleLobbyId: dbEvent.BattleLobbyId || undefined,
    targetUserIds: JSON.parse(dbEvent.targetUserIds),
    sourceUserId: dbEvent.sourceUserId || undefined,
    message: dbEvent.message,
    code: dbEvent.code,
    data: JSON.parse(dbEvent.data),
    actorId: dbEvent.actorId || undefined,
    actorName: dbEvent.actorName || undefined,
    targetId: dbEvent.targetId || undefined,
    targetName: dbEvent.targetName || undefined,
  }));

  // Salvar no cache (ordem reversa para mais recente primeiro no cache)
  battleEventsCache.set(battleId, [...events].reverse());

  return events;
}

/**
 * Limpa eventos de uma batalha do cache (chamar quando batalha terminar)
 */
export function clearBattleEventsCache(battleId: string): void {
  battleEventsCache.delete(battleId);
  console.log(`[EventService] Cleared battle events cache for ${battleId}`);
}

/**
 * Limpa todas as batalhas do cache (para cleanup geral)
 */
export function clearAllBattleEventsCache(): void {
  battleEventsCache.clear();
}

// =============================================================================
// ROOMS - Gerenciamento de salas para eventos
// =============================================================================

/**
 * Gera nome da sala baseado no contexto
 */
function getEventRoom(context: EventContext, contextId?: string): string {
  if (context === "GLOBAL" || context === "ACCOUNT") {
    return `events:${context.toLowerCase()}`;
  }
  return `events:${context.toLowerCase()}:${contextId}`;
}

// =============================================================================
// CRIAÇÃO E EMISSÃO DE EVENTOS
// =============================================================================

/**
 * Cria um evento, persiste no banco e emite para os destinatários
 * Eventos também ficam em cache de memória para acesso rápido
 */
export async function createAndEmitEvent(
  eventData: GameEventCreate
): Promise<GameEvent> {
  // Persistir no banco para todos os contextos
  const dbEvent = await prisma.gameEvent.create({
    data: {
      context: eventData.context,
      scope: eventData.scope,
      category: eventData.category,
      severity: eventData.severity,
      matchId: eventData.matchId,
      battleId: eventData.battleId,
      BattleLobbyId: eventData.BattleLobbyId,
      targetUserIds: JSON.stringify(eventData.targetUserIds || []),
      sourceUserId: eventData.sourceUserId,
      message: eventData.message,
      code: eventData.code,
      data: JSON.stringify(eventData.data || {}),
      actorId: eventData.actorId,
      actorName: eventData.actorName,
      targetId: eventData.targetId,
      targetName: eventData.targetName,
    },
  });

  // Converter para tipo GameEvent
  const event: GameEvent = {
    id: dbEvent.id,
    timestamp: dbEvent.timestamp,
    context: dbEvent.context as EventContext,
    scope: dbEvent.scope as "GLOBAL" | "INDIVIDUAL",
    category: dbEvent.category as GameEvent["category"],
    severity: dbEvent.severity as GameEvent["severity"],
    matchId: dbEvent.matchId || undefined,
    battleId: dbEvent.battleId || undefined,
    BattleLobbyId: dbEvent.BattleLobbyId || undefined,
    targetUserIds: JSON.parse(dbEvent.targetUserIds),
    sourceUserId: dbEvent.sourceUserId || undefined,
    message: dbEvent.message,
    code: dbEvent.code,
    data: JSON.parse(dbEvent.data),
    actorId: dbEvent.actorId || undefined,
    actorName: dbEvent.actorName || undefined,
    targetId: dbEvent.targetId || undefined,
    targetName: dbEvent.targetName || undefined,
  };

  // Guardar em cache de memória (para eventos de BATTLE)
  if (eventData.context === "BATTLE" && eventData.battleId) {
    addBattleEventToCache(event);
  }

  // Emitir evento via callback (se configurado)
  emitEvent(event);

  return event;
}

/**
 * Emite evento para os destinatários apropriados
 * Usa o callback configurado pelas Colyseus Rooms
 */
function emitEvent(event: GameEvent): void {
  if (!eventEmitter) {
    // Sem emitter configurado, evento só fica no cache/banco
    return;
  }

  // Delegar emissão para o callback configurado
  eventEmitter(event);
}

// =============================================================================
// BUSCA DE EVENTOS (COM PAGINAÇÃO)
// =============================================================================

/** Limite padrão de eventos por página */
const DEFAULT_PAGE_SIZE = 50;

/** Limite máximo de eventos por página */
const MAX_PAGE_SIZE = 100;

/**
 * Busca eventos com filtros e paginação cursor-based
 * Para eventos de BATTLE, busca do cache em memória
 */
export async function getEvents(
  filter: EventFilter
): Promise<EventsPageResponse> {
  const limit = Math.min(filter.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  // Eventos de batalha vêm do cache em memória
  if (filter.context === "BATTLE" && filter.battleId) {
    const cachedEvents = getBattleEventsFromCache(filter.battleId);

    // Ordenar por timestamp decrescente (mais recente primeiro)
    const sortedEvents = [...cachedEvents].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Aplicar paginação simples
    let startIndex = 0;
    if (filter.cursor) {
      const cursorIndex = sortedEvents.findIndex((e) => e.id === filter.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedEvents = sortedEvents.slice(
      startIndex,
      startIndex + limit + 1
    );
    const hasMore = paginatedEvents.length > limit;
    const eventsToReturn = hasMore
      ? paginatedEvents.slice(0, limit)
      : paginatedEvents;

    return {
      events: eventsToReturn,
      nextCursor: hasMore
        ? eventsToReturn[eventsToReturn.length - 1].id
        : undefined,
      hasMore,
    };
  }

  // Outros contextos: buscar do banco
  const where: any = {};

  if (filter.context) where.context = filter.context;
  if (filter.matchId) where.matchId = filter.matchId;
  if (filter.battleId) where.battleId = filter.battleId;
  if (filter.BattleLobbyId) where.BattleLobbyId = filter.BattleLobbyId;
  if (filter.category) where.category = filter.category;

  // Para eventos individuais, filtrar por userId
  if (filter.userId) {
    where.OR = [
      { scope: "GLOBAL" },
      { targetUserIds: { contains: filter.userId } },
    ];
  }

  // Paginação cursor-based (mais eficiente que offset)
  if (filter.cursor) {
    where.id = { lt: filter.cursor };
  }

  // Filtro por timestamp
  if (filter.before) {
    const beforeDate =
      typeof filter.before === "string"
        ? new Date(filter.before)
        : filter.before;
    where.timestamp = { lt: beforeDate };
  }

  // Buscar limit + 1 para saber se há mais
  const dbEvents = await prisma.gameEvent.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: limit + 1,
  });

  // Verificar se há mais eventos
  const hasMore = dbEvents.length > limit;
  const eventsToReturn = hasMore ? dbEvents.slice(0, limit) : dbEvents;

  // Converter para tipo GameEvent
  const events: GameEvent[] = eventsToReturn.map((dbEvent) => ({
    id: dbEvent.id,
    timestamp: dbEvent.timestamp,
    context: dbEvent.context as EventContext,
    scope: dbEvent.scope as "GLOBAL" | "INDIVIDUAL",
    category: dbEvent.category as GameEvent["category"],
    severity: dbEvent.severity as GameEvent["severity"],
    matchId: dbEvent.matchId || undefined,
    battleId: dbEvent.battleId || undefined,
    BattleLobbyId: dbEvent.BattleLobbyId || undefined,
    targetUserIds: JSON.parse(dbEvent.targetUserIds),
    sourceUserId: dbEvent.sourceUserId || undefined,
    message: dbEvent.message,
    code: dbEvent.code,
    data: JSON.parse(dbEvent.data),
    actorId: dbEvent.actorId || undefined,
    actorName: dbEvent.actorName || undefined,
    targetId: dbEvent.targetId || undefined,
    targetName: dbEvent.targetName || undefined,
  }));

  return {
    events,
    nextCursor: hasMore
      ? eventsToReturn[eventsToReturn.length - 1].id
      : undefined,
    hasMore,
  };
}

/**
 * Busca eventos legados (sem paginação) - para compatibilidade
 * @deprecated Use getEvents com paginação
 */
export async function getEventsLegacy(
  filter: EventFilter
): Promise<GameEvent[]> {
  const result = await getEvents({ ...filter, limit: filter.limit || 100 });
  return result.events;
}

// =============================================================================
// HELPERS - Criação rápida de eventos comuns
// =============================================================================

/**
 * Interface de visibilidade para eventos de batalha
 * Quando fornecida, o evento será emitido apenas para jogadores com visão
 */
interface EventVisibilityParams {
  /** Todas as unidades da batalha para cálculo de visão */
  allUnits: BattleUnit[];
  /** Obstáculos da batalha para cálculo de Line of Sight (opcional) */
  obstacles?: BattleObstacle[];
  /** Posição(ões) do evento - se qualquer uma for visível, o jogador recebe o evento */
  positions: Array<{ x: number; y: number }>;
  /** IDs de jogadores que SEMPRE devem receber o evento (ex: dono da unidade morta) */
  alwaysInclude?: string[];
}

/**
 * Cria evento de combate
 * @param params.visibility - Se fornecido, emite apenas para jogadores com visão
 */
export async function createCombatEvent(params: {
  battleId: string;
  code: string;
  message: string;
  severity?: GameEvent["severity"];
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  data?: Record<string, any>;
  visibility?: EventVisibilityParams;
}): Promise<GameEvent> {
  // Calcular destinatários baseado em visibilidade
  let scope: "GLOBAL" | "INDIVIDUAL" = "GLOBAL";
  let targetUserIds: string[] | undefined;

  if (params.visibility) {
    const { allUnits, obstacles, positions, alwaysInclude } = params.visibility;
    const playersWithVision = getPlayersWithVisionAtAny(
      allUnits,
      positions,
      obstacles
    );

    // Adicionar jogadores que sempre devem receber
    if (alwaysInclude) {
      for (const playerId of alwaysInclude) {
        if (!playersWithVision.includes(playerId)) {
          playersWithVision.push(playerId);
        }
      }
    }

    scope = "INDIVIDUAL";
    targetUserIds = playersWithVision;
  }

  return createAndEmitEvent({
    context: "BATTLE",
    scope,
    category: "COMBAT",
    severity: params.severity || "NEUTRAL",
    battleId: params.battleId,
    code: params.code,
    message: params.message,
    actorId: params.actorId,
    actorName: params.actorName,
    targetId: params.targetId,
    targetName: params.targetName,
    data: params.data,
    targetUserIds,
  });
}

/**
 * Cria evento de movimento
 * @param params.visibility - Se fornecido, emite apenas para jogadores com visão
 */
export async function createMovementEvent(params: {
  battleId: string;
  code: string;
  message: string;
  actorId: string;
  actorName: string;
  data?: Record<string, any>;
  visibility?: EventVisibilityParams;
}): Promise<GameEvent> {
  // Calcular destinatários baseado em visibilidade
  let scope: "GLOBAL" | "INDIVIDUAL" = "GLOBAL";
  let targetUserIds: string[] | undefined;

  if (params.visibility) {
    const { allUnits, obstacles, positions, alwaysInclude } = params.visibility;
    const playersWithVision = getPlayersWithVisionAtAny(
      allUnits,
      positions,
      obstacles
    );

    // Adicionar jogadores que sempre devem receber
    if (alwaysInclude) {
      for (const playerId of alwaysInclude) {
        if (!playersWithVision.includes(playerId)) {
          playersWithVision.push(playerId);
        }
      }
    }

    scope = "INDIVIDUAL";
    targetUserIds = playersWithVision;
  }

  return createAndEmitEvent({
    context: "BATTLE",
    scope,
    category: "MOVEMENT",
    severity: "NEUTRAL",
    battleId: params.battleId,
    code: params.code,
    message: params.message,
    actorId: params.actorId,
    actorName: params.actorName,
    data: params.data,
    targetUserIds,
  });
}

/**
 * Cria evento de turno
 */
export async function createTurnEvent(params: {
  battleId: string;
  code: string;
  message: string;
  data?: Record<string, any>;
}): Promise<GameEvent> {
  return createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
    category: "TURN",
    severity: "INFO",
    battleId: params.battleId,
    code: params.code,
    message: params.message,
    data: params.data,
  });
}

/**
 * Cria evento de condição
 * @param params.visibility - Se fornecido, emite apenas para jogadores com visão
 */
export async function createConditionEvent(params: {
  battleId: string;
  code: string;
  message: string;
  severity?: GameEvent["severity"];
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  data?: Record<string, any>;
  visibility?: EventVisibilityParams;
}): Promise<GameEvent> {
  // Calcular destinatários baseado em visibilidade
  let scope: "GLOBAL" | "INDIVIDUAL" = "GLOBAL";
  let targetUserIds: string[] | undefined;

  if (params.visibility) {
    const { allUnits, obstacles, positions, alwaysInclude } = params.visibility;
    const playersWithVision = getPlayersWithVisionAtAny(
      allUnits,
      positions,
      obstacles
    );

    // Adicionar jogadores que sempre devem receber
    if (alwaysInclude) {
      for (const playerId of alwaysInclude) {
        if (!playersWithVision.includes(playerId)) {
          playersWithVision.push(playerId);
        }
      }
    }

    scope = "INDIVIDUAL";
    targetUserIds = playersWithVision;
  }

  return createAndEmitEvent({
    context: "BATTLE",
    scope,
    category: "CONDITION",
    severity: params.severity || "INFO",
    battleId: params.battleId,
    code: params.code,
    message: params.message,
    actorId: params.actorId,
    actorName: params.actorName,
    targetId: params.targetId,
    targetName: params.targetName,
    data: params.data,
    targetUserIds,
  });
}

/**
 * Cria evento de skill
 * @param params.visibility - Se fornecido, emite apenas para jogadores com visão
 */
export async function createSkillEvent(params: {
  battleId: string;
  code: string;
  message: string;
  severity?: GameEvent["severity"];
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  data?: Record<string, any>;
  visibility?: EventVisibilityParams;
}): Promise<GameEvent> {
  // Calcular destinatários baseado em visibilidade
  let scope: "GLOBAL" | "INDIVIDUAL" = "GLOBAL";
  let targetUserIds: string[] | undefined;

  if (params.visibility) {
    const { allUnits, obstacles, positions, alwaysInclude } = params.visibility;
    const playersWithVision = getPlayersWithVisionAtAny(
      allUnits,
      positions,
      obstacles
    );

    // Adicionar jogadores que sempre devem receber
    if (alwaysInclude) {
      for (const playerId of alwaysInclude) {
        if (!playersWithVision.includes(playerId)) {
          playersWithVision.push(playerId);
        }
      }
    }

    scope = "INDIVIDUAL";
    targetUserIds = playersWithVision;
  }

  return createAndEmitEvent({
    context: "BATTLE",
    scope,
    category: "SKILL",
    severity: params.severity || "INFO",
    battleId: params.battleId,
    code: params.code,
    message: params.message,
    actorId: params.actorId,
    actorName: params.actorName,
    targetId: params.targetId,
    targetName: params.targetName,
    data: params.data,
    targetUserIds,
  });
}

/**
 * Cria evento global do sistema
 */
export async function createSystemEvent(params: {
  code: string;
  message: string;
  severity?: GameEvent["severity"];
  targetUserIds?: string[];
}): Promise<GameEvent> {
  return createAndEmitEvent({
    context: "GLOBAL",
    scope: params.targetUserIds?.length ? "INDIVIDUAL" : "GLOBAL",
    category: "SYSTEM",
    severity: params.severity || "INFO",
    code: params.code,
    message: params.message,
    targetUserIds: params.targetUserIds,
  });
}

/**
 * Cria evento de battle lobby
 */
export async function createBattleLobbyEvent(params: {
  BattleLobbyId: string;
  code: string;
  message: string;
  severity?: GameEvent["severity"];
  data?: Record<string, any>;
}): Promise<GameEvent> {
  return createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
    category: "BATTLE",
    severity: params.severity || "INFO",
    BattleLobbyId: params.BattleLobbyId,
    code: params.code,
    message: params.message,
    data: params.data,
  });
}

// =============================================================================
// CLEANUP - Limpeza de eventos antigos
// =============================================================================

/** Dias para manter eventos de batalha (mais recentes) */
const BATTLE_EVENTS_RETENTION_DAYS = 7;

/** Dias para manter eventos globais/sistema */
const GLOBAL_EVENTS_RETENTION_DAYS = 30;

/** Dias para manter eventos de conta */
const ACCOUNT_EVENTS_RETENTION_DAYS = 90;

/**
 * Remove eventos antigos do banco de dados
 * Deve ser chamado periodicamente (ex: cron job diário)
 */
export async function cleanupOldEvents(): Promise<{
  deleted: number;
  duration: number;
}> {
  const startTime = Date.now();

  const now = new Date();

  // Calcular datas de corte
  const battleCutoff = new Date(now);
  battleCutoff.setDate(battleCutoff.getDate() - BATTLE_EVENTS_RETENTION_DAYS);

  const globalCutoff = new Date(now);
  globalCutoff.setDate(globalCutoff.getDate() - GLOBAL_EVENTS_RETENTION_DAYS);

  const accountCutoff = new Date(now);
  accountCutoff.setDate(
    accountCutoff.getDate() - ACCOUNT_EVENTS_RETENTION_DAYS
  );

  try {
    // Deletar eventos de batalha antigos (mais agressivo)
    const battleDeleted = await prisma.gameEvent.deleteMany({
      where: {
        context: "BATTLE",
        timestamp: { lt: battleCutoff },
      },
    });

    // Deletar eventos de battle lobby antigos
    const battleLobbyDeleted = await prisma.gameEvent.deleteMany({
      where: {
        context: "BATTLE",
        timestamp: { lt: battleCutoff },
      },
    });

    // Deletar eventos de match antigos
    const matchDeleted = await prisma.gameEvent.deleteMany({
      where: {
        context: "MATCH",
        timestamp: { lt: globalCutoff },
      },
    });

    // Deletar eventos globais antigos
    const globalDeleted = await prisma.gameEvent.deleteMany({
      where: {
        context: "GLOBAL",
        timestamp: { lt: globalCutoff },
      },
    });

    // Deletar eventos de conta antigos
    const accountDeleted = await prisma.gameEvent.deleteMany({
      where: {
        context: "ACCOUNT",
        timestamp: { lt: accountCutoff },
      },
    });

    const totalDeleted =
      battleDeleted.count +
      battleLobbyDeleted.count +
      matchDeleted.count +
      globalDeleted.count +
      accountDeleted.count;

    const duration = Date.now() - startTime;

    console.log(`[EventService] Cleanup completed:`, {
      battle: battleDeleted.count,
      battleLobby: battleLobbyDeleted.count,
      match: matchDeleted.count,
      global: globalDeleted.count,
      account: accountDeleted.count,
      total: totalDeleted,
      duration: `${duration}ms`,
    });

    return { deleted: totalDeleted, duration };
  } catch (error) {
    console.error("[EventService] Cleanup failed:", error);
    throw error;
  }
}

/**
 * Retorna estatísticas de eventos no banco
 */
export async function getEventStats(): Promise<{
  total: number;
  byContext: Record<string, number>;
  oldestEvent?: Date;
  newestEvent?: Date;
}> {
  const [total, byContext, oldest, newest] = await Promise.all([
    prisma.gameEvent.count(),
    prisma.gameEvent.groupBy({
      by: ["context"],
      _count: { id: true },
    }),
    prisma.gameEvent.findFirst({
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    }),
    prisma.gameEvent.findFirst({
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    }),
  ]);

  const contextCounts: Record<string, number> = {};
  byContext.forEach((item) => {
    contextCounts[item.context] = item._count.id;
  });

  return {
    total,
    byContext: contextCounts,
    oldestEvent: oldest?.timestamp,
    newestEvent: newest?.timestamp,
  };
}

/**
 * Inicia cleanup automático em intervalo
 * @param intervalHours Intervalo entre limpezas (padrão: 24h)
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startAutoCleanup(intervalHours: number = 24): void {
  if (cleanupInterval) {
    console.warn("[EventService] Auto cleanup already running");
    return;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  // Executar imediatamente na primeira vez (após 1 minuto para o servidor estabilizar)
  setTimeout(() => {
    cleanupOldEvents().catch(console.error);
  }, 60 * 1000);

  // Agendar execuções periódicas
  cleanupInterval = setInterval(() => {
    cleanupOldEvents().catch(console.error);
  }, intervalMs);

  console.log(`[EventService] Auto cleanup started (every ${intervalHours}h)`);
}

export function stopAutoCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("[EventService] Auto cleanup stopped");
  }
}

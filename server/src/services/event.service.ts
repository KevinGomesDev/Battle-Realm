// server/src/services/event.service.ts
// Serviço para criar, persistir e emitir eventos do jogo

import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma";
import type {
  GameEvent,
  GameEventCreate,
  EventFilter,
  EventContext,
  EventsPageResponse,
} from "../../../shared/types/events.types";

// =============================================================================
// ESTADO GLOBAL
// =============================================================================

let io: Server | null = null;

/**
 * Cache em memória para eventos de batalha (não persistidos no banco)
 * Key: battleId, Value: array de eventos ordenados por timestamp
 */
const battleEventsCache = new Map<string, GameEvent[]>();

/** Limite máximo de eventos por batalha em memória */
const MAX_BATTLE_EVENTS = 500;

/**
 * Inicializa o serviço com a instância do Socket.IO
 */
export function initEventService(socketServer: Server): void {
  io = socketServer;
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

/**
 * Inscreve socket em sala de eventos
 */
export function subscribeToEvents(
  socket: Socket,
  context: EventContext,
  contextId?: string
): void {
  const room = getEventRoom(context, contextId);
  socket.join(room);
  console.log(`[EventService] Socket ${socket.id} joined room ${room}`);
}

/**
 * Remove socket de sala de eventos
 */
export function unsubscribeFromEvents(
  socket: Socket,
  context: EventContext,
  contextId?: string
): void {
  const room = getEventRoom(context, contextId);
  socket.leave(room);
  console.log(`[EventService] Socket ${socket.id} left room ${room}`);
}

// =============================================================================
// CRIAÇÃO E EMISSÃO DE EVENTOS
// =============================================================================

/**
 * Cria um evento, persiste no banco (exceto BATTLE) e emite para os destinatários
 * Eventos de BATTLE ficam apenas em memória para performance
 */
export async function createAndEmitEvent(
  eventData: GameEventCreate
): Promise<GameEvent> {
  // Eventos de BATTLE não vão para o banco - ficam só em memória
  if (eventData.context === "BATTLE" && eventData.battleId) {
    const event: GameEvent = {
      id: `battle-${eventData.battleId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      timestamp: new Date(),
      context: eventData.context,
      scope: eventData.scope,
      category: eventData.category,
      severity: eventData.severity,
      matchId: eventData.matchId,
      battleId: eventData.battleId,
      arenaLobbyId: eventData.arenaLobbyId,
      targetUserIds: eventData.targetUserIds || [],
      sourceUserId: eventData.sourceUserId,
      message: eventData.message,
      code: eventData.code,
      data: eventData.data || {},
      actorId: eventData.actorId,
      actorName: eventData.actorName,
      targetId: eventData.targetId,
      targetName: eventData.targetName,
    };

    // Guardar em memória
    addBattleEventToCache(event);

    // Emitir via Socket.IO
    emitEvent(event);

    return event;
  }

  // Outros contextos: persistir no banco
  const dbEvent = await prisma.gameEvent.create({
    data: {
      context: eventData.context,
      scope: eventData.scope,
      category: eventData.category,
      severity: eventData.severity,
      matchId: eventData.matchId,
      battleId: eventData.battleId,
      arenaLobbyId: eventData.arenaLobbyId,
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
    arenaLobbyId: dbEvent.arenaLobbyId || undefined,
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

  // Emitir evento via Socket.IO
  emitEvent(event);

  return event;
}

/**
 * Emite evento para os destinatários apropriados
 */
function emitEvent(event: GameEvent): void {
  if (!io) {
    console.warn("[EventService] Socket.IO not initialized");
    return;
  }

  // Determinar sala de destino
  let contextId: string | undefined;
  if (event.context === "MATCH" && event.matchId) {
    contextId = event.matchId;
  } else if (event.context === "BATTLE" && event.battleId) {
    contextId = event.battleId;
  } else if (event.context === "ARENA" && event.arenaLobbyId) {
    contextId = event.arenaLobbyId;
  }

  const room = getEventRoom(event.context, contextId);

  if (event.scope === "GLOBAL") {
    // Emitir para toda a sala
    io.to(room).emit("event:new", event);
  } else if (event.scope === "INDIVIDUAL" && event.targetUserIds?.length) {
    // Emitir apenas para usuários específicos na sala
    // Precisamos encontrar os sockets desses usuários
    for (const userId of event.targetUserIds) {
      io.to(`user:${userId}`).emit("event:new", event);
    }
  }
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
  if (filter.arenaLobbyId) where.arenaLobbyId = filter.arenaLobbyId;
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
    arenaLobbyId: dbEvent.arenaLobbyId || undefined,
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
 * Cria evento de combate
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
}): Promise<GameEvent> {
  return createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
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
  });
}

/**
 * Cria evento de movimento
 */
export async function createMovementEvent(params: {
  battleId: string;
  code: string;
  message: string;
  actorId: string;
  actorName: string;
  data?: Record<string, any>;
}): Promise<GameEvent> {
  return createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
    category: "MOVEMENT",
    severity: "NEUTRAL",
    battleId: params.battleId,
    code: params.code,
    message: params.message,
    actorId: params.actorId,
    actorName: params.actorName,
    data: params.data,
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
}): Promise<GameEvent> {
  return createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
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
 * Cria evento de arena
 */
export async function createArenaEvent(params: {
  arenaLobbyId: string;
  code: string;
  message: string;
  severity?: GameEvent["severity"];
  data?: Record<string, any>;
}): Promise<GameEvent> {
  return createAndEmitEvent({
    context: "ARENA",
    scope: "GLOBAL",
    category: "ARENA",
    severity: params.severity || "INFO",
    arenaLobbyId: params.arenaLobbyId,
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

    // Deletar eventos de arena antigos
    const arenaDeleted = await prisma.gameEvent.deleteMany({
      where: {
        context: "ARENA",
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
      arenaDeleted.count +
      matchDeleted.count +
      globalDeleted.count +
      accountDeleted.count;

    const duration = Date.now() - startTime;

    console.log(`[EventService] Cleanup completed:`, {
      battle: battleDeleted.count,
      arena: arenaDeleted.count,
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

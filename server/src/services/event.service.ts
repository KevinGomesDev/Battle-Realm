// server/src/services/event.service.ts
// Serviço para criar, persistir e emitir eventos do jogo

import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma";
import type {
  GameEvent,
  GameEventCreate,
  EventFilter,
  EventContext,
  EVENT_SOCKET_EVENTS,
} from "../../../shared/types/events.types";

// =============================================================================
// ESTADO GLOBAL
// =============================================================================

let io: Server | null = null;

/**
 * Inicializa o serviço com a instância do Socket.IO
 */
export function initEventService(socketServer: Server): void {
  io = socketServer;
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
 * Cria um evento, persiste no banco e emite para os destinatários
 */
export async function createAndEmitEvent(
  eventData: GameEventCreate
): Promise<GameEvent> {
  // Persistir no banco
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
// BUSCA DE EVENTOS
// =============================================================================

/**
 * Busca eventos com filtros
 */
export async function getEvents(filter: EventFilter): Promise<GameEvent[]> {
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

  const dbEvents = await prisma.gameEvent.findMany({
    where,
    orderBy: { timestamp: "asc" },
    take: filter.limit || 100,
  });

  return dbEvents.map((dbEvent) => ({
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

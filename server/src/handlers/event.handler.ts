// server/src/handlers/event.handler.ts
// Handler de socket para eventos do jogo

import { Server, Socket } from "socket.io";
import {
  subscribeToEvents,
  unsubscribeFromEvents,
  getEvents,
  getEventStats,
  cleanupOldEvents,
} from "../services/event.service";
import type {
  EventContext,
  EventFilter,
} from "../../../shared/types/events.types";

interface SubscribeData {
  context: EventContext;
  contextId?: string;
}

interface FetchData {
  filter: EventFilter;
}

/**
 * Registra handlers de eventos no socket
 */
export function registerEventHandlers(io: Server, socket: Socket): void {
  // Inscrever em sala de eventos
  socket.on("event:subscribe", (data: SubscribeData) => {
    try {
      subscribeToEvents(socket, data.context, data.contextId);
      socket.emit("event:subscribed", {
        success: true,
        context: data.context,
        contextId: data.contextId,
      });
    } catch (error) {
      console.error("[EventHandler] Subscribe error:", error);
      socket.emit("event:subscribed", {
        success: false,
        error: "Failed to subscribe to events",
      });
    }
  });

  // Cancelar inscrição
  socket.on("event:unsubscribe", (data: SubscribeData) => {
    try {
      unsubscribeFromEvents(socket, data.context, data.contextId);
      socket.emit("event:unsubscribed", {
        success: true,
        context: data.context,
        contextId: data.contextId,
      });
    } catch (error) {
      console.error("[EventHandler] Unsubscribe error:", error);
    }
  });

  // Buscar histórico de eventos (COM PAGINAÇÃO)
  socket.on("event:fetch", async (data: FetchData, callback) => {
    try {
      const result = await getEvents(data.filter);
      const response = {
        success: true,
        events: result.events,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      };

      if (callback) {
        callback(response);
      } else {
        socket.emit("event:history", response);
      }
    } catch (error) {
      console.error("[EventHandler] Fetch error:", error);
      if (callback) {
        callback({ success: false, error: "Failed to fetch events" });
      }
    }
  });

  // Estatísticas de eventos (admin)
  socket.on("event:stats", async (_, callback) => {
    try {
      const stats = await getEventStats();
      if (callback) {
        callback({ success: true, stats });
      }
    } catch (error) {
      console.error("[EventHandler] Stats error:", error);
      if (callback) {
        callback({ success: false, error: "Failed to get stats" });
      }
    }
  });

  // Cleanup manual (admin)
  socket.on("event:cleanup", async (_, callback) => {
    try {
      const result = await cleanupOldEvents();
      if (callback) {
        callback({ success: true, ...result });
      }
    } catch (error) {
      console.error("[EventHandler] Cleanup error:", error);
      if (callback) {
        callback({ success: false, error: "Failed to cleanup events" });
      }
    }
  });

  // Quando usuário se autentica, inscrever automaticamente em sala do usuário
  socket.on("auth:authenticated", (data: { userId: string }) => {
    if (data.userId) {
      socket.join(`user:${data.userId}`);
      // Inscrever automaticamente em eventos globais
      subscribeToEvents(socket, "GLOBAL");
      subscribeToEvents(socket, "ACCOUNT");
    }
  });
}

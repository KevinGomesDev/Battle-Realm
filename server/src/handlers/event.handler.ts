// server/src/handlers/event.handler.ts
// Handler de socket para eventos do jogo

import { Server, Socket } from "socket.io";
import {
  subscribeToEvents,
  unsubscribeFromEvents,
  getEvents,
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

  // Buscar histórico de eventos
  socket.on("event:fetch", async (data: FetchData, callback) => {
    try {
      const events = await getEvents(data.filter);
      if (callback) {
        callback({ success: true, events });
      } else {
        socket.emit("event:history", { success: true, events });
      }
    } catch (error) {
      console.error("[EventHandler] Fetch error:", error);
      if (callback) {
        callback({ success: false, error: "Failed to fetch events" });
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

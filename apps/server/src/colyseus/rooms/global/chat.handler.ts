// server/src/colyseus/rooms/global/chat.handler.ts
// Handlers de Chat: mensagens e histórico

import { Client, Room } from "@colyseus/core";
import { GlobalRoomState } from "../../schemas";
import { getUserData, isAuthenticated, sendAuthError } from "./types";

/**
 * Processa e broadcast de mensagem de chat
 */
export function handleChatMessage(
  client: Client,
  message: string,
  room: Room<GlobalRoomState>
): void {
  if (!isAuthenticated(client)) {
    sendAuthError(client);
    return;
  }

  const userData = getUserData(client)!;

  // Broadcast para todos os clientes
  room.broadcast("chat:message", {
    message: {
      id: `msg_${Date.now()}`,
      context: "GLOBAL",
      contextId: undefined,
      senderId: userData.userId,
      senderName: userData.username,
      message,
      timestamp: new Date(),
      unitId: undefined,
    },
  });
}

/**
 * Carrega histórico de mensagens
 */
export async function handleLoadChatHistory(
  client: Client,
  context: string,
  contextId?: string
): Promise<void> {
  if (!isAuthenticated(client)) {
    sendAuthError(client);
    return;
  }

  // Por enquanto, retorna histórico vazio
  // TODO: Implementar persistência de mensagens no banco
  client.send("chat:load_history:response", {
    success: true,
    messages: [],
  });
}

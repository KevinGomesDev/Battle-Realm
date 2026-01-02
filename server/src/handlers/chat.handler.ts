// server/src/handlers/chat.handler.ts
// Handler para sistema de chat (batalha, partida, global)

import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import type {
  ChatMessage,
  SendChatPayload,
  ChatContext,
} from "../../../shared/types/chat.types";
import { CHAT_CONFIG } from "../../../shared/types/chat.types";

// Armazenamento em memória para mensagens recentes (para persistência, usar Redis/DB)
const globalMessages: ChatMessage[] = [];
const battleMessages = new Map<string, ChatMessage[]>();
const matchMessages = new Map<string, ChatMessage[]>();

// Cooldown por usuário
const userCooldowns = new Map<string, number>();

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function canSendMessage(userId: string): boolean {
  const lastSent = userCooldowns.get(userId) || 0;
  return Date.now() - lastSent >= CHAT_CONFIG.cooldown;
}

function addMessage(
  context: ChatContext,
  contextId: string | undefined,
  message: ChatMessage
): void {
  let messageList: ChatMessage[];

  switch (context) {
    case "GLOBAL":
      messageList = globalMessages;
      break;
    case "BATTLE":
      if (!contextId) return;
      if (!battleMessages.has(contextId)) {
        battleMessages.set(contextId, []);
      }
      messageList = battleMessages.get(contextId)!;
      break;
    case "MATCH":
      if (!contextId) return;
      if (!matchMessages.has(contextId)) {
        matchMessages.set(contextId, []);
      }
      messageList = matchMessages.get(contextId)!;
      break;
    default:
      return;
  }

  messageList.push(message);

  // Limitar tamanho do histórico
  while (messageList.length > CHAT_CONFIG.maxMessages) {
    messageList.shift();
  }
}

function getMessages(context: ChatContext, contextId?: string): ChatMessage[] {
  switch (context) {
    case "GLOBAL":
      return globalMessages;
    case "BATTLE":
      return contextId ? battleMessages.get(contextId) || [] : [];
    case "MATCH":
      return contextId ? matchMessages.get(contextId) || [] : [];
    default:
      return [];
  }
}

export const registerChatHandlers = (io: Server, socket: Socket) => {
  // Enviar mensagem de chat
  socket.on(
    "chat:send",
    async (data: SendChatPayload, callback?: (response: any) => void) => {
      try {
        // Usar socket.data.userId (definido no auth handler)
        const userId = socket.data.userId as string | undefined;
        if (!userId) {
          return callback?.({ success: false, error: "Não autenticado" });
        }

        // Verificar cooldown
        if (!canSendMessage(userId)) {
          return callback?.({
            success: false,
            error: "Aguarde antes de enviar outra mensagem",
          });
        }

        // Validar mensagem
        const trimmedMessage = data.message?.trim();
        if (!trimmedMessage || trimmedMessage.length === 0) {
          return callback?.({ success: false, error: "Mensagem vazia" });
        }

        if (trimmedMessage.length > CHAT_CONFIG.maxLength) {
          return callback?.({
            success: false,
            error: `Mensagem muito longa (máx ${CHAT_CONFIG.maxLength} caracteres)`,
          });
        }

        // Buscar informações do usuário
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { kingdoms: { take: 1 } },
        });

        if (!user) {
          return callback?.({
            success: false,
            error: "Usuário não encontrado",
          });
        }

        // Criar mensagem
        const chatMessage: ChatMessage = {
          id: generateMessageId(),
          context: data.context,
          contextId: data.contextId,
          senderId: userId,
          senderName: user.username,
          senderKingdomName: user.kingdoms[0]?.name,
          message: trimmedMessage,
          timestamp: new Date(),
          unitId: data.unitId,
        };

        // Armazenar mensagem
        addMessage(data.context, data.contextId, chatMessage);

        // Atualizar cooldown
        userCooldowns.set(userId, Date.now());

        // Emitir para os destinatários corretos
        switch (data.context) {
          case "GLOBAL":
            // Broadcast para todos
            io.emit("chat:message", { message: chatMessage });
            break;
          case "BATTLE":
            // Apenas para quem está na sala da batalha
            if (data.contextId) {
              io.to(data.contextId).emit("chat:message", {
                message: chatMessage,
              });
            }
            break;
          case "MATCH":
            // Apenas para quem está na sala da partida
            if (data.contextId) {
              io.to(data.contextId).emit("chat:message", {
                message: chatMessage,
              });
            }
            break;
        }

        callback?.({ success: true, message: chatMessage });
        console.log(
          `[CHAT] ${data.context}${
            data.contextId ? `:${data.contextId.substring(0, 8)}` : ""
          } - ${user.username}: ${trimmedMessage.substring(0, 50)}${
            trimmedMessage.length > 50 ? "..." : ""
          }`
        );
      } catch (error) {
        console.error("[CHAT] Erro ao enviar mensagem:", error);
        callback?.({ success: false, error: "Erro ao enviar mensagem" });
      }
    }
  );

  // Carregar histórico de mensagens
  socket.on(
    "chat:load_history",
    async (
      data: { context: ChatContext; contextId?: string },
      callback?: (response: any) => void
    ) => {
      try {
        const messages = getMessages(data.context, data.contextId);
        callback?.({ success: true, messages });
      } catch (error) {
        console.error("[CHAT] Erro ao carregar histórico:", error);
        callback?.({ success: false, error: "Erro ao carregar histórico" });
      }
    }
  );
};

// Limpar mensagens de batalha quando ela terminar
export function clearBattleMessages(battleId: string): void {
  battleMessages.delete(battleId);
}

// Limpar mensagens de partida quando ela terminar
export function clearMatchMessages(matchId: string): void {
  matchMessages.delete(matchId);
}

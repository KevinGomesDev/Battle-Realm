// shared/types/chat.types.ts
// Tipos compartilhados para o sistema de chat

// =============================================================================
// TIPOS DE CHAT
// =============================================================================

export type ChatContext = "BATTLE" | "MATCH" | "GLOBAL";

export interface ChatMessage {
  id: string;
  context: ChatContext;
  contextId?: string; // battleId, matchId ou undefined para global
  senderId: string;
  senderName: string;
  senderKingdomName?: string;
  message: string;
  timestamp: Date;
  // Para chat de batalha - qual unidade exibir o balão
  unitId?: string;
}

// =============================================================================
// SOCKET PAYLOADS
// =============================================================================

export interface SendChatPayload {
  context: ChatContext;
  contextId?: string; // battleId ou matchId
  message: string;
  // Para batalha: ID da unidade que "fala"
  unitId?: string;
}

export interface ChatMessageResponse {
  message: ChatMessage;
}

// =============================================================================
// CONFIGURAÇÃO DE CHAT
// =============================================================================

export const CHAT_CONFIG = {
  /** Tempo que o balão de fala fica visível (ms) */
  bubbleDuration: 5000,
  /** Máximo de mensagens mantidas no histórico */
  maxMessages: 50,
  /** Máximo de caracteres por mensagem */
  maxLength: 200,
  /** Cooldown entre mensagens (ms) */
  cooldown: 1000,
} as const;

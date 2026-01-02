// client/src/features/chat/components/ChatBox.tsx
// Componente de chat reutilizável

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../../auth";
import { CHAT_CONFIG } from "../../../../../shared/types/chat.types";

interface ChatBoxProps {
  /** ID da unidade atual (para batalha) */
  currentUnitId?: string;
  /** Variante de estilo */
  variant?: "compact" | "full";
  /** Placeholder do input */
  placeholder?: string;
  /** Altura máxima do container de mensagens */
  maxHeight?: string;
  /** Callback quando o chat é fechado */
  onClose?: () => void;
  /** Mostrar header */
  showHeader?: boolean;
  /** Título do header */
  title?: string;
}

export const ChatBox: React.FC<ChatBoxProps> = ({
  currentUnitId,
  variant = "full",
  placeholder = "Digite uma mensagem...",
  maxHeight = "200px",
  onClose,
  showHeader = true,
  title = "Chat",
}) => {
  const { state, sendMessage, closeChat } = useChat();
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // Focar no input quando abrir
  useEffect(() => {
    if (state.isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state.isOpen]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      const trimmed = inputValue.trim();
      if (!trimmed || state.isLoading) return;

      try {
        await sendMessage(trimmed, currentUnitId);
        setInputValue("");
      } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
      }
    },
    [inputValue, currentUnitId, sendMessage, state.isLoading]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        closeChat();
        onClose?.();
      }
    },
    [handleSubmit, closeChat, onClose]
  );

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isCompact = variant === "compact";

  return (
    <div
      className={`
        flex flex-col
        bg-citadel-obsidian/95 backdrop-blur-sm
        border border-metal-iron/50 rounded-lg
        shadow-lg
        ${isCompact ? "text-xs" : "text-sm"}
      `}
    >
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-metal-iron/30">
          <span className="text-parchment-light font-medieval text-sm">
            💬 {title}
          </span>
          <button
            onClick={() => {
              closeChat();
              onClose?.();
            }}
            className="text-parchment-dark hover:text-parchment-light transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-2 space-y-1"
        style={{ maxHeight }}
      >
        {state.messages.length === 0 ? (
          <div className="text-parchment-dark/50 text-center py-4 italic">
            Nenhuma mensagem ainda...
          </div>
        ) : (
          state.messages.map((msg) => {
            const isOwn = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`
                  flex flex-col
                  ${isOwn ? "items-end" : "items-start"}
                `}
              >
                {/* Sender info */}
                <div className="flex items-center gap-1 mb-0.5">
                  <span
                    className={`
                      text-[10px] font-semibold
                      ${isOwn ? "text-metal-gold" : "text-metal-bronze"}
                    `}
                  >
                    {isOwn ? "Você" : msg.senderName}
                  </span>
                  <span className="text-parchment-dark/40 text-[9px]">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                {/* Message bubble */}
                <div
                  className={`
                    max-w-[85%] px-2 py-1 rounded-lg
                    ${
                      isOwn
                        ? "bg-metal-bronze/30 border border-metal-bronze/40"
                        : "bg-citadel-slate/50 border border-metal-iron/30"
                    }
                  `}
                >
                  <p className="text-parchment-light break-words">
                    {msg.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-2 border-t border-metal-iron/30"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) =>
            setInputValue(e.target.value.slice(0, CHAT_CONFIG.maxLength))
          }
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={state.isLoading}
          className={`
            flex-1 px-2 py-1.5 rounded
            bg-citadel-slate/50 border border-metal-iron/30
            text-parchment-light placeholder-parchment-dark/50
            focus:outline-none focus:border-metal-bronze/50
            disabled:opacity-50
            ${isCompact ? "text-xs" : "text-sm"}
          `}
        />
        <button
          type="submit"
          disabled={state.isLoading || !inputValue.trim()}
          className={`
            px-3 py-1.5 rounded
            bg-metal-bronze/30 border border-metal-bronze/50
            text-parchment-light
            hover:bg-metal-bronze/50
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            ${isCompact ? "text-xs" : "text-sm"}
          `}
        >
          {state.isLoading ? "..." : "➤"}
        </button>
      </form>

      {/* Error */}
      {state.error && (
        <div className="px-2 py-1 text-war-ember text-xs text-center">
          {state.error}
        </div>
      )}
    </div>
  );
};

// client/src/features/chat/components/ChatBox.tsx
// Componente de chat reutilizável

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "../hooks/useChat";
import { useAuth } from "../../auth";
import { CHAT_CONFIG } from "@boundless/shared/types/chat.types";
import { Button } from "@/components/Button";
import { useCommands, isCommand } from "../../commands";

interface ChatBoxProps {
  /** ID da unidade atual (para batalha) */
  currentUnitId?: string;
  /** ID da unidade selecionada (para comandos) */
  selectedUnitId?: string;
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
  /** Se comandos estão habilitados (apenas em batalha) */
  enableCommands?: boolean;
}

export const ChatBox: React.FC<ChatBoxProps> = ({
  currentUnitId,
  selectedUnitId,
  variant = "full",
  placeholder = "Digite uma mensagem...",
  maxHeight = "200px",
  onClose,
  showHeader = true,
  title = "Chat",
  enableCommands = false,
}) => {
  const { state, sendMessage, closeChat } = useChat();
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hook de comandos
  const { executeCommand, isLoading: commandLoading } = useCommands({
    selectedUnitId,
    onSuccess: (result) => {
      setCommandFeedback(result.message);
      setTimeout(() => setCommandFeedback(null), 5000);
    },
    onError: (error) => {
      setCommandFeedback(`❌ ${error}`);
      setTimeout(() => setCommandFeedback(null), 5000);
    },
  });

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
      if (!trimmed || state.isLoading || commandLoading) return;

      // Verificar se é um comando
      if (enableCommands && isCommand(trimmed)) {
        const wasCommand = await executeCommand(trimmed);
        if (wasCommand) {
          setInputValue("");
          return;
        }
      }

      // Caso contrário, envia como mensagem normal
      try {
        await sendMessage(trimmed, currentUnitId);
        setInputValue("");
      } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
      }
    },
    [
      inputValue,
      currentUnitId,
      sendMessage,
      state.isLoading,
      commandLoading,
      enableCommands,
      executeCommand,
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) {
          // Se não há mensagem, fecha o chat
          closeChat();
          onClose?.();
        } else {
          // Se há mensagem, envia
          handleSubmit();
        }
      } else if (e.key === "Escape") {
        closeChat();
        onClose?.();
      }
    },
    [inputValue, handleSubmit, closeChat, onClose]
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
        bg-surface-900/95 backdrop-blur-sm
        border border-surface-500/50 rounded-lg
        shadow-lg
        ${isCompact ? "text-xs" : "text-sm"}
      `}
    >
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-surface-500/30">
          <span className="text-astral-chrome font-medieval text-sm">
            💬 {title}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              closeChat();
              onClose?.();
            }}
          >
            ✕
          </Button>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-2 space-y-1"
        style={{ maxHeight }}
      >
        {state.messages.length === 0 ? (
          <div className="text-astral-steel/50 text-center py-4 italic">
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
                      ${isOwn ? "text-stellar-gold" : "text-stellar-amber"}
                    `}
                  >
                    {isOwn ? "Você" : msg.senderName}
                  </span>
                  <span className="text-astral-steel/40 text-[9px]">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                {/* Message bubble */}
                <div
                  className={`
                    max-w-[85%] px-2 py-1 rounded-lg
                    ${
                      isOwn
                        ? "bg-stellar-amber/30 border border-stellar-amber/40"
                        : "bg-surface-800/50 border border-surface-500/30"
                    }
                  `}
                >
                  <p className="text-astral-chrome break-words">
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
        className="flex items-center gap-2 p-2 border-t border-surface-500/30"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) =>
            setInputValue(e.target.value.slice(0, CHAT_CONFIG.maxLength))
          }
          onKeyDown={handleKeyDown}
          placeholder={enableCommands ? "Mensagem ou /comando..." : placeholder}
          disabled={state.isLoading || commandLoading}
          className={`
            flex-1 px-2 py-1.5 rounded
            bg-surface-800/50 border border-surface-500/30
            text-astral-chrome placeholder-astral-steel/50
            focus:outline-none focus:border-stellar-amber/50
            disabled:opacity-50
            ${isCompact ? "text-xs" : "text-sm"}
            ${inputValue.startsWith("/") ? "border-stellar-gold/50" : ""}
          `}
        />
        <Button
          type="submit"
          variant="primary"
          size="xs"
          disabled={state.isLoading || commandLoading || !inputValue.trim()}
          isLoading={state.isLoading || commandLoading}
        >
          ➤
        </Button>
      </form>

      {/* Command Feedback */}
      {commandFeedback && (
        <div className="px-2 py-1 text-stellar-gold text-xs text-center bg-stellar-gold/10 border-t border-stellar-gold/20">
          {commandFeedback}
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div className="px-2 py-1 text-red-400 text-xs text-center">
          {state.error}
        </div>
      )}
    </div>
  );
};

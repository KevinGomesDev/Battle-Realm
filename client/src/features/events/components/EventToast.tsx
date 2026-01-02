// client/src/features/events/components/EventToast.tsx
// Componente de toast para eventos - sobe da tela e desaparece

import { useEffect, useState } from "react";
import type { GameEvent } from "../../../../../shared/types/events.types";
import {
  getSeverityColor,
  getCategoryIcon,
} from "../../../../../shared/types/events.types";

// =============================================================================
// TYPES
// =============================================================================

export interface EventToastData {
  id: string;
  event: GameEvent;
  createdAt: number;
}

interface EventToastItemProps {
  toast: EventToastData;
  onDismiss: (id: string) => void;
  duration?: number;
}

// =============================================================================
// SINGLE TOAST ITEM
// =============================================================================

function EventToastItem({
  toast,
  onDismiss,
  duration = 3000,
}: EventToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Animar a barra de progresso
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 50);

    // Timer para iniciar animação de saída
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 300);

    // Timer para remover
    const removeTimer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, duration, onDismiss]);

  const severityColor = getSeverityColor(toast.event.severity);
  const icon = getCategoryIcon(toast.event.category);

  // Cores de fundo baseadas na severidade
  const bgColorMap: Record<string, string> = {
    INFO: "bg-blue-900/90 border-blue-500/50",
    SUCCESS: "bg-green-900/90 border-green-500/50",
    WARNING: "bg-amber-900/90 border-amber-500/50",
    DANGER: "bg-red-900/90 border-red-500/50",
    NEUTRAL: "bg-gray-900/90 border-gray-500/50",
  };

  const progressColorMap: Record<string, string> = {
    INFO: "bg-blue-500",
    SUCCESS: "bg-green-500",
    WARNING: "bg-amber-500",
    DANGER: "bg-red-500",
    NEUTRAL: "bg-gray-500",
  };

  const bgColor = bgColorMap[toast.event.severity] || bgColorMap.INFO;
  const progressColor =
    progressColorMap[toast.event.severity] || progressColorMap.INFO;

  return (
    <div
      className={`
        relative overflow-hidden
        min-w-[280px] max-w-[400px]
        ${bgColor}
        border rounded-lg shadow-xl backdrop-blur-sm
        transform transition-all duration-300 ease-out
        ${
          isExiting
            ? "opacity-0 translate-y-[-20px] scale-95"
            : "opacity-100 translate-y-0 scale-100"
        }
      `}
    >
      {/* Conteúdo */}
      <div className="flex items-start gap-3 p-3">
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${severityColor}`}>
            {toast.event.message}
          </p>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
        <div
          className={`h-full ${progressColor} transition-all duration-100 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// TOAST CONTAINER
// =============================================================================

interface EventToastContainerProps {
  toasts: EventToastData[];
  onDismiss: (id: string) => void;
  duration?: number;
  position?: "top-center" | "top-right" | "bottom-center" | "bottom-right";
}

export function EventToastContainer({
  toasts,
  onDismiss,
  duration = 3000,
  position = "top-center",
}: EventToastContainerProps) {
  if (toasts.length === 0) return null;

  const positionClasses: Record<string, string> = {
    "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
    "top-right": "top-4 right-4 items-end",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
    "bottom-right": "bottom-4 right-4 items-end",
  };

  return (
    <div
      className={`fixed z-[9999] flex flex-col gap-2 pointer-events-none ${positionClasses[position]}`}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <EventToastItem
            toast={toast}
            onDismiss={onDismiss}
            duration={duration}
          />
        </div>
      ))}
    </div>
  );
}

// client/src/components/ToastRenderer.tsx
// Componente para renderizar toasts do Zustand store

import { useEventStore } from "../stores/eventStore";
import { EventToastContainer } from "../features/events/components/EventToast";

/**
 * ToastRenderer - Renderiza toasts de eventos do Zustand store
 */
export function ToastRenderer() {
  const toasts = useEventStore((s) => s.toasts);
  const dismissToast = useEventStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <EventToastContainer
      toasts={toasts}
      onDismiss={dismissToast}
      duration={3000}
      position="top-center"
    />
  );
}

// client/src/features/events/index.ts
// Barrel export para feature de eventos
// Migrado para Zustand - Context removido

export { useEvents, useEventsState, useToasts } from "./hooks/useEvents";
export { EventLog, CompactEventLog } from "./components/EventLog";
export {
  EventToastContainer,
  type EventToastData,
} from "./components/EventToast";
export { EventHistory, EventHistoryButton } from "./components/EventHistory";

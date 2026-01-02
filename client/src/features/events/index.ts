// client/src/features/events/index.ts
// Barrel export para feature de eventos

export { EventProvider, useEvents } from "./context/EventContext";
export { EventLog, CompactEventLog } from "./components/EventLog";
export {
  EventToastContainer,
  type EventToastData,
} from "./components/EventToast";
export { EventHistory, EventHistoryButton } from "./components/EventHistory";

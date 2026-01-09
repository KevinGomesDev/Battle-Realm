// client/src/features/chat/index.ts
// Barrel export para feature de chat
// Migrado para Zustand - Context removido

// Hooks
export {
  useChat,
  useChatMessages,
  useChatBubbles,
  useSendMessage,
} from "./hooks/useChat";

// Hook separado para HMR compatibility
export { useBattleChat } from "./hooks/useBattleChat";

// Componentes
export { ChatBox } from "./components/ChatBox";
export { BattleChat } from "./components/BattleChat";
export { GlobalChat } from "./components/GlobalChat";
export { MatchChat } from "./components/MatchChat";
export { SpeechBubble } from "./components/SpeechBubble";
export { BattleBubbles } from "./components/BattleBubbles";

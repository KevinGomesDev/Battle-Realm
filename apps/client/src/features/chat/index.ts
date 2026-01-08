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

// Componentes
export { ChatBox } from "./components/ChatBox";
export { BattleChat, useBattleChat } from "./components/BattleChat";
export { GlobalChat } from "./components/GlobalChat";
export { MatchChat } from "./components/MatchChat";
export { SpeechBubble } from "./components/SpeechBubble";
export { BattleBubbles } from "./components/BattleBubbles";

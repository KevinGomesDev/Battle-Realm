// client/src/features/qte/index.ts
// Barrel exports para o sistema QTE no cliente

// Hooks
export { useQTE, useActiveQTE, default as useQTEDefault } from "./hooks/useQTE";
export {
  useChainQTE,
  default as useChainQTEDefault,
} from "./hooks/useChainQTE";

// Componentes
export {
  QTEOverlay,
  default as QTEOverlayDefault,
} from "./components/QTEOverlay";
export {
  ChainQTEOverlay,
  default as ChainQTEOverlayDefault,
} from "./components/ChainQTEOverlay";
export {
  CombatTraining,
  generateRandomQTEConfig,
  default as CombatTrainingDefault,
} from "./components/CombatTraining";

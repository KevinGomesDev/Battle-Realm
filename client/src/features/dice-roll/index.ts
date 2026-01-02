// client/src/features/dice-roll/index.ts
// Barrel export para feature de dice-roll

// Context
export { DiceRollProvider, useDiceRoll } from "./context/DiceRollContext";

// Componentes
export { DiceRollModal } from "./components/DiceRollModal";
export { DiceRollPanel } from "./components/DiceRollPanel";
export { CombatantPanel } from "./components/CombatantPanel";
export { DiceZone } from "./components/DiceZone";
export { SuccessVisualizer } from "./components/SuccessVisualizer";
export { Die } from "./components/Die";

// Tipos e helpers
export type {
  DiceRollPanelData,
  RollPanelCombatant,
  RollModifier,
  RollOutcome,
  RollPhase,
  OpenRollPanelOptions,
  VisualDie,
  VisualRollResult,
  DiceRollResult,
} from "./types/dice-roll.types";
export {
  toVisualRollResult,
  getThresholdColors,
} from "./types/dice-roll.types";

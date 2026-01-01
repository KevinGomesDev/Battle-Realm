// client/src/features/dice-roll/types/dice-roll.types.ts
// Re-export de tipos do shared para o client
// Isso evita problemas de import path e centraliza os tipos

// Re-exporta tudo do dice-visual.types
export {
  type DieVisualState,
  type VisualDie,
  type VisualRollResult,
  type RollModifier,
  type RollPanelCombatant,
  type RollOutcome,
  type RollPhase,
  type DiceRollPanelData,
  type OnRollCompleteCallback,
  type OpenRollPanelOptions,
  toVisualRollResult,
  getThresholdColors,
} from "../../../../../shared/types/dice-visual.types";

// Re-exporta tipos base de dice
export {
  type AdvantageMod,
  type DiceRollResult,
  type DieResult,
} from "../../../../../shared/types/dice.types";

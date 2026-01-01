// shared/types/dice-visual.types.ts
// Tipos para o painel visual de rolagem de dados

import type { AdvantageMod, DiceRollResult, DieResult } from "./dice.types";

// ----- Tipos de Dados Visuais -----

/** Estado visual de um dado individual */
export type DieVisualState =
  | "hidden"
  | "rolling"
  | "settling"
  | "exploding"
  | "spawning"
  | "final";

/** Dado visual para animação */
export interface VisualDie {
  id: string;
  value: number;
  isSuccess: boolean;
  isExploded: boolean;
  parentId?: string; // Se foi gerado por explosão
  animationDelay: number; // ms
  state: DieVisualState;
}

/** Resultado de rolagem com dados visuais */
export interface VisualRollResult {
  dice: VisualDie[];
  totalDice: number;
  successes: number;
  explosions: number;
  threshold: number;
}

// ----- Modificadores de Rolagem -----

/** Modificador de rolagem para exibição */
export interface RollModifier {
  name: string;
  value: number | string;
  type: "buff" | "debuff" | "neutral";
  icon?: string;
}

// ----- Combatentes -----

/** Dados do combatente para exibição no painel */
export interface RollPanelCombatant {
  id: string;
  name: string;
  icon?: string;
  portraitUrl?: string;
  level?: number;
  className?: string;

  // Stats relevantes
  combat: number;
  diceCount: number;
  advantageMod: AdvantageMod;

  // Modificadores ativos
  modifiers: RollModifier[];
}

// ----- Resultado da Rolagem -----

/** Resultado final comparado */
export interface RollOutcome {
  attackerSuccesses: number;
  defenderSuccesses: number;
  netSuccesses: number;
  damageDealt: number;
  damageBlocked: number;
  finalDamage: number;
  isCritical: boolean;
  isHit: boolean;
  isDodge: boolean;
  isPartialBlock: boolean;
}

// ----- Fases de Animação -----

/** Fases da animação de rolagem */
export type RollPhase =
  | "intro" // Apresentação dos combatentes
  | "attacker-rolling" // Atacante rolando dados
  | "attacker-result" // Resultado do atacante
  | "defender-rolling" // Defensor rolando dados
  | "defender-result" // Resultado do defensor
  | "comparison" // Comparação visual
  | "outcome" // Resultado final
  | "complete"; // Animação completa

// ----- Dados do Painel -----

/** Dados completos para o painel de rolagem */
export interface DiceRollPanelData {
  // Identificadores
  battleId: string;
  actionId: string;
  actionType: "attack" | "skill" | "ability";
  skillName?: string;

  // Combatentes
  attacker: RollPanelCombatant;
  defender: RollPanelCombatant;

  // Resultados de rolagem (vindos do server)
  attackRoll: DiceRollResult;
  defenseRoll: DiceRollResult;

  // Resultado final
  outcome: RollOutcome;

  // Contexto extra
  damageType?: "FISICO" | "MAGICO" | "VERDADEIRO";
  protectionBroken?: "physical" | "magical" | "both" | null;
}

// ----- Opções de Abertura do Painel -----

/** Callback quando rolagem completa */
export type OnRollCompleteCallback = (outcome: RollOutcome) => void;

/** Opções para abrir o painel de rolagem */
export interface OpenRollPanelOptions {
  data: DiceRollPanelData;
  autoPlay?: boolean; // Se inicia automaticamente
  speedMultiplier?: number; // 1 = normal, 2 = 2x rápido
  onComplete?: OnRollCompleteCallback;
  skipable?: boolean; // Se pode pular animação
}

// ----- Helpers -----

/** Converte DiceRollResult para VisualRollResult */
export function toVisualRollResult(
  result: DiceRollResult,
  threshold: number = 4
): VisualRollResult {
  const dice: VisualDie[] = [];

  result.diceResults.forEach((roll: DieResult, index: number) => {
    // Dado principal
    const mainDie: VisualDie = {
      id: `die-${index}`,
      value: roll.value,
      isSuccess: roll.isSuccess,
      isExploded: roll.isExplosion,
      animationDelay: index * 100,
      state: "hidden",
    };
    dice.push(mainDie);

    // Dados de explosão
    if (roll.isExplosion && roll.explosionResults) {
      roll.explosionResults.forEach((expDie: DieResult, expIndex: number) => {
        const explosionDie: VisualDie = {
          id: `die-${index}-exp-${expIndex}`,
          value: expDie.value,
          isSuccess: expDie.isSuccess,
          isExploded: expDie.isExplosion,
          parentId: mainDie.id,
          animationDelay: index * 100 + 500 + expIndex * 150,
          state: "hidden",
        };
        dice.push(explosionDie);
      });
    }
  });

  return {
    dice,
    totalDice: result.diceCount,
    successes: result.totalSuccesses,
    explosions: result.explosionCount,
    threshold,
  };
}

/** Gera descrição de cores para threshold */
export function getThresholdColors(threshold: number): {
  successFaces: number[];
  failFaces: number[];
} {
  const successFaces = [];
  const failFaces = [];

  for (let i = 1; i <= 6; i++) {
    if (i >= threshold) {
      successFaces.push(i);
    } else {
      failFaces.push(i);
    }
  }

  return { successFaces, failFaces };
}

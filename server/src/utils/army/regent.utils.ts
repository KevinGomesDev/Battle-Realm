// src/utils/army/regent.utils.ts
// Utilitários ESPECÍFICOS para Regentes
// Level up e features genéricos agora estão em unit.utils.ts

// Re-export funções genéricas para compatibilidade
export {
  canPurchaseLevelUp,
  purchaseLevelUp,
  calculateLevelUpCost,
} from "./unit.utils";

// Aliases para compatibilidade (DEPRECATED - usar funções genéricas)
import { canPurchaseLevelUp, purchaseLevelUp } from "./unit.utils";
export const canRegentLevelUp = canPurchaseLevelUp;
export const levelUpRegent = purchaseLevelUp;

// Função mantida pois é específica de progressão de Regente
import { calculateLevelUpCost as genericCalc } from "./unit.utils";
export const calculateRegentLevelUpCost = (level: number) =>
  genericCalc("REGENT", level);

/**
 * Verifica se um regente pode escolher característica de classe
 * Regente escolhe nos níveis 1, 3, 6, 9...
 */
export function canRegentChooseFeature(level: number): boolean {
  return level === 1 || level % 3 === 0;
}

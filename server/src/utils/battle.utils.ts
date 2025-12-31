import { SkillDefinition, COST_VALUES } from "../types";

export function calculateSkillCost(
  skill: SkillDefinition,
  timesUsedInBattle: number
): number {
  if (skill.category === "PASSIVE" || !skill.costTier) {
    return 0;
  }

  const baseCost = COST_VALUES[skill.costTier];

  return baseCost * Math.pow(2, timesUsedInBattle);
}

// Ordena BattleUnits por iniciativa (decrescente)
export function rollInitiative<T extends { id: string; initiative: number }>(
  battleUnits: T[]
): T[] {
  return [...battleUnits].sort((a, b) => b.initiative - a.initiative);
}

// Valida movimento no grid 20x20 com distância Manhattan e custo em movesLeft
export function validateGridMove(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  gridW: number,
  gridH: number,
  movesLeft: number
): { valid: boolean; reason?: string; cost: number } {
  if (toX < 0 || toX >= gridW || toY < 0 || toY >= gridH) {
    return { valid: false, reason: "Destino fora do grid", cost: 0 };
  }
  const dist = Math.abs(toX - fromX) + Math.abs(toY - fromY);
  if (dist <= 0) {
    return { valid: false, reason: "Destino inválido", cost: 0 };
  }
  if (dist > movesLeft) {
    return {
      valid: false,
      reason: "Movimento excede pontos disponíveis",
      cost: dist,
    };
  }
  return { valid: true, cost: dist };
}

// Retorna marcas máximas por categoria
export function getMaxMarksByCategory(category: string): number {
  switch (category) {
    case "TROOP":
      return 1;
    case "HERO":
      return 2;
    case "REGENT":
      return 3;
    default:
      return 1;
  }
}

// Calcula acuidade efetiva dada lista de condições
export function getEffectiveAcuityWithConditions(
  baseAcuity: number,
  conditions: string[]
): number {
  let acuity = baseAcuity;
  if (conditions.includes("ELETRIFICADA")) acuity *= 2;
  if (conditions.includes("CONGELADA")) acuity = Math.min(1, acuity);
  if (conditions.includes("DERRUBADA")) acuity = 0;
  return acuity;
}

// Aplica efeito de queimando ao usar uma ação
export function applyBurningOnAction(
  currentHp: number,
  conditions: string[]
): number {
  if (conditions.includes("QUEIMANDO")) {
    return Math.max(0, currentHp - 2);
  }
  return currentHp;
}

// Aplica dano com proteção e tipos (VERDADEIRO ignora proteção)
export function applyProtectionDamage(
  protection: number,
  protectionBroken: boolean,
  currentHp: number,
  damage: number,
  damageType: string
): {
  newProtection: number;
  newProtectionBroken: boolean;
  newHp: number;
} {
  let newProtection = protection;
  let newProtectionBroken = protectionBroken;
  let newHp = currentHp;

  if (damageType !== "VERDADEIRO" && !protectionBroken && protection > 0) {
    // Dano vai na proteção primeiro. Se proteção zerar, excedente é perdido.
    if (damage >= protection) {
      newProtection = 0;
      newProtectionBroken = true; // Não é mais recuperável nesta batalha
      // Excedente perdido, não aplica na vitalidade
    } else {
      newProtection = protection - damage;
    }
  } else {
    newHp = Math.max(0, currentHp - damage);
  }

  return { newProtection, newProtectionBroken, newHp };
}

// ---------- Dice Helpers ----------
export function rollD6(times: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < Math.max(0, times); i++) {
    results.push(Math.floor(Math.random() * 6) + 1);
  }
  return results;
}

export function countSuccesses(dice: number[], threshold = 4): number {
  return dice.filter((d) => d >= threshold).length;
}

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
// damageType: "FISICO" usa physicalProtection, "MAGICO" usa magicalProtection, "VERDADEIRO" ignora ambos
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

/**
 * Aplica dano com sistema de proteção física e mágica
 * @param physicalProtection Proteção física atual
 * @param magicalProtection Proteção mágica atual
 * @param physicalProtectionBroken Se proteção física foi quebrada
 * @param magicalProtectionBroken Se proteção mágica foi quebrada
 * @param currentHp HP atual
 * @param damage Dano a aplicar
 * @param damageType "FISICO" | "MAGICO" | "VERDADEIRO"
 */
export function applyDualProtectionDamage(
  physicalProtection: number,
  magicalProtection: number,
  physicalProtectionBroken: boolean,
  magicalProtectionBroken: boolean,
  currentHp: number,
  damage: number,
  damageType: string
): {
  newPhysicalProtection: number;
  newMagicalProtection: number;
  newPhysicalProtectionBroken: boolean;
  newMagicalProtectionBroken: boolean;
  newHp: number;
  damageAbsorbed: number;
  damageToHp: number;
} {
  let newPhysicalProtection = physicalProtection;
  let newMagicalProtection = magicalProtection;
  let newPhysicalProtectionBroken = physicalProtectionBroken;
  let newMagicalProtectionBroken = magicalProtectionBroken;
  let newHp = currentHp;
  let damageAbsorbed = 0;
  let damageToHp = 0;

  if (damageType === "VERDADEIRO") {
    // Dano verdadeiro ignora toda proteção
    damageToHp = damage;
    newHp = Math.max(0, currentHp - damage);
  } else if (damageType === "FISICO") {
    // Dano físico usa proteção física
    if (!physicalProtectionBroken && physicalProtection > 0) {
      if (damage >= physicalProtection) {
        damageAbsorbed = physicalProtection;
        newPhysicalProtection = 0;
        newPhysicalProtectionBroken = true;
        // Excedente perdido
      } else {
        damageAbsorbed = damage;
        newPhysicalProtection = physicalProtection - damage;
      }
    } else {
      damageToHp = damage;
      newHp = Math.max(0, currentHp - damage);
    }
  } else if (damageType === "MAGICO") {
    // Dano mágico usa proteção mágica
    if (!magicalProtectionBroken && magicalProtection > 0) {
      if (damage >= magicalProtection) {
        damageAbsorbed = magicalProtection;
        newMagicalProtection = 0;
        newMagicalProtectionBroken = true;
        // Excedente perdido
      } else {
        damageAbsorbed = damage;
        newMagicalProtection = magicalProtection - damage;
      }
    } else {
      damageToHp = damage;
      newHp = Math.max(0, currentHp - damage);
    }
  }

  return {
    newPhysicalProtection,
    newMagicalProtection,
    newPhysicalProtectionBroken,
    newMagicalProtectionBroken,
    newHp,
    damageAbsorbed,
    damageToHp,
  };
}

// ---------- Dice Helpers ----------
// MIGRADO para server/src/logic/dice-system.ts
// Use rollD6Test, rollContestedTest, etc.

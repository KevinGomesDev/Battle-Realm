// src/utils/army/unit.utils.ts
// Utilitários genéricos para TODAS as unidades (TROOP, HERO, REGENT)
// XP, Level Up, Skills e Spells

import { prisma } from "../../../lib/prisma";
import { getClassByCode } from "@boundless/shared/data/abilities.data";
import {
  XP_THRESHOLDS,
  XP_REWARDS,
  ATTRIBUTE_POINTS_PER_LEVEL,
  calculateLevelFromXP,
  getXPToNextLevel,
} from "@boundless/shared/data/heroes.data";
import {
  MAX_HERO_LEVEL,
  calculateLevelUpCost,
} from "@boundless/shared/data/units.data";
import { spendResources } from "../../match/turn.utils";
import { getResourceName, HP_CONFIG } from "@boundless/shared/config";

// =============================================================================
// SISTEMA DE XP
// =============================================================================

/**
 * Adiciona XP a uma unidade (TROOP, HERO, REGENT)
 * SUMMON não ganha XP - o XP é redirecionado para o invocador
 */
export async function addExperience(
  unitId: string,
  xpAmount: number
): Promise<{
  success: boolean;
  leveledUp: boolean;
  newLevel?: number;
  message: string;
  redirectedTo?: string;
}> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return {
      success: false,
      leveledUp: false,
      message: "Unit not found",
    };
  }

  // SUMMON não ganha XP - redireciona para o invocador
  if (unit.category === "SUMMON") {
    if (unit.summonerId) {
      const result = await addExperience(unit.summonerId, xpAmount);
      return {
        ...result,
        redirectedTo: unit.summonerId,
        message: `XP redirected to summoner: ${result.message}`,
      };
    }
    return {
      success: false,
      leveledUp: false,
      message: "Summon without summoner - XP lost",
    };
  }

  const newExperience = (unit.experience || 0) + xpAmount;
  const currentLevel = unit.level;
  const newLevel = calculateLevelFromXP(newExperience);
  const leveledUp = newLevel > currentLevel && currentLevel < MAX_HERO_LEVEL;

  await prisma.unit.update({
    where: { id: unitId },
    data: { experience: newExperience },
  });

  if (leveledUp) {
    return {
      success: true,
      leveledUp: true,
      newLevel,
      message: `+${xpAmount} XP! Leveled up to ${newLevel}!`,
    };
  }

  const xpToNext = getXPToNextLevel(newExperience);
  return {
    success: true,
    leveledUp: false,
    message: `+${xpAmount} XP (${xpToNext} to next level)`,
  };
}

/**
 * Verifica se uma unidade pode subir de nível
 * SUMMON não pode subir de nível (XP vai para o invocador)
 */
export async function canLevelUp(
  unitId: string
): Promise<{ canLevel: boolean; reason?: string; pendingLevels?: number }> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { canLevel: false, reason: "Unit not found" };
  }

  // SUMMON cannot level up
  if (unit.category === "SUMMON") {
    return {
      canLevel: false,
      reason: "Summons cannot level up",
    };
  }

  if (unit.level >= MAX_HERO_LEVEL) {
    return {
      canLevel: false,
      reason: `Maximum level (${MAX_HERO_LEVEL}) reached`,
    };
  }

  const expectedLevel = calculateLevelFromXP(unit.experience || 0);
  const pendingLevels = expectedLevel - unit.level;

  if (pendingLevels <= 0) {
    return { canLevel: false, reason: "Insufficient XP to level up" };
  }

  return { canLevel: true, pendingLevels };
}

/**
 * Processa level up de uma unidade (distribuição de atributos)
 * Funciona para TROOP, HERO e REGENT
 */
export async function processLevelUp(
  unitId: string,
  attributeDistribution: {
    combat: number;
    speed: number;
    focus: number;
    resistance: number;
    will: number;
    vitality: number;
  }
): Promise<{ success: boolean; message: string; unit?: any }> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { success: false, message: "Unit not found" };
  }

  // Check if should level up based on XP
  const expectedLevel = calculateLevelFromXP(unit.experience || 0);
  if (expectedLevel <= unit.level) {
    return { success: false, message: "Insufficient XP to level up" };
  }

  if (unit.level >= MAX_HERO_LEVEL) {
    return {
      success: false,
      message: `Maximum level (${MAX_HERO_LEVEL}) reached`,
    };
  }

  // Determina pontos por nível baseado na categoria
  const pointsPerLevel = ATTRIBUTE_POINTS_PER_LEVEL[unit.category] || 2;

  // Valida distribuição
  const totalDistributed =
    attributeDistribution.combat +
    attributeDistribution.speed +
    attributeDistribution.focus +
    attributeDistribution.resistance +
    attributeDistribution.will +
    attributeDistribution.vitality;

  if (totalDistributed !== pointsPerLevel) {
    return {
      success: false,
      message: `Distribute exactly ${pointsPerLevel} points (${unit.category})`,
    };
  }

  // Validate no negative values
  if (Object.values(attributeDistribution).some((v) => v < 0)) {
    return {
      success: false,
      message: "Attribute values cannot be negative",
    };
  }

  const newLevel = unit.level + 1;
  const updatedUnit = await prisma.unit.update({
    where: { id: unitId },
    data: {
      level: newLevel,
      combat: unit.combat + attributeDistribution.combat,
      speed: unit.speed + attributeDistribution.speed,
      focus: unit.focus + attributeDistribution.focus,
      resistance: unit.resistance + attributeDistribution.resistance,
      will: unit.will + attributeDistribution.will,
      vitality: unit.vitality + attributeDistribution.vitality,
      maxHp: unit.maxHp + attributeDistribution.vitality * HP_CONFIG.multiplier,
      currentHp:
        unit.currentHp + attributeDistribution.vitality * HP_CONFIG.multiplier,
    },
  });

  return {
    success: true,
    message: `${unit.name} subiu para nível ${newLevel}!`,
    unit: updatedUnit,
  };
}

/**
 * Concede XP por ação específica
 */
export function getXPForAction(action: keyof typeof XP_REWARDS): number {
  return XP_REWARDS[action] || 0;
}

/**
 * Concede XP de batalha para todas as unidades participantes
 */
export async function grantBattleXP(
  battleId: string,
  winnerId: string
): Promise<{
  results: Array<{ unitId: string; xp: number; leveledUp: boolean }>;
}> {
  const battleUnits = await prisma.battleUnit.findMany({
    where: { battleId },
  });

  const results: Array<{ unitId: string; xp: number; leveledUp: boolean }> = [];

  for (const bu of battleUnits) {
    if (!bu.unitId) continue; // Pula unidades temporárias (Batalha)

    let xp = 0;

    // XP por sobreviver
    if (bu.isAlive) {
      xp += XP_REWARDS.SURVIVE_BATTLE;
    }

    // XP por vencer
    if (bu.userId === winnerId && bu.isAlive) {
      xp += XP_REWARDS.WIN_BATTLE;
    }

    if (xp > 0) {
      const result = await addExperience(bu.unitId, xp);
      results.push({
        unitId: bu.unitId,
        xp,
        leveledUp: result.leveledUp,
      });
    }
  }

  return { results };
}

/**
 * Concede XP por matar uma unidade
 */
export async function grantKillXP(
  killerUnitId: string | null,
  killedCategory: "TROOP" | "HERO" | "REGENT"
): Promise<{ success: boolean; xp: number; leveledUp: boolean }> {
  if (!killerUnitId) {
    return { success: false, xp: 0, leveledUp: false };
  }

  let xp = 0;
  switch (killedCategory) {
    case "TROOP":
      xp = XP_REWARDS.KILL_TROOP;
      break;
    case "HERO":
      xp = XP_REWARDS.KILL_HERO;
      break;
    case "REGENT":
      xp = XP_REWARDS.KILL_REGENT;
      break;
  }

  const result = await addExperience(killerUnitId, xp);
  return { success: result.success, xp, leveledUp: result.leveledUp };
}

// =============================================================================
// ADICIONAR/REMOVER SKILLS E SPELLS
// =============================================================================

type FeatureTarget = "features" | "spells";

/**
 * Adiciona uma skill, spell ou feature a qualquer unidade
 * @param unitId - ID da unidade
 * @param featureCode - Código da skill/spell/feature
 * @param target - Onde adicionar: "features" (skills) ou "spells"
 * @param validateClass - Se true, valida se pertence à classe da unidade
 */
export async function addUnitFeature(
  unitId: string,
  featureCode: string,
  target: FeatureTarget = "features",
  validateClass: boolean = false
): Promise<{ success: boolean; message: string }> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { success: false, message: "Unit not found" };
  }

  // Optional class validation (only for skills, not spells)
  if (validateClass && unit.classCode && target === "features") {
    const unitClass = getClassByCode(unit.classCode);
    if (unitClass) {
      const isValidSkill = unitClass.abilities.some(
        (s: { code: string }) => s.code === featureCode
      );

      if (!isValidSkill) {
        return {
          success: false,
          message: "This skill is not available for this class",
        };
      }
    }
  }

  const currentList = JSON.parse(
    (target === "spells" ? unit.spells : unit.features) || "[]"
  ) as string[];

  if (currentList.includes(featureCode)) {
    return { success: false, message: "Ability already added" };
  }

  currentList.push(featureCode);

  await prisma.unit.update({
    where: { id: unitId },
    data: { [target]: JSON.stringify(currentList) },
  });

  const typeName = target === "spells" ? "Spell" : "Skill";
  return { success: true, message: `${typeName} ${featureCode} added!` };
}

/**
 * Remove uma skill, spell ou feature de qualquer unidade
 */
export async function removeUnitFeature(
  unitId: string,
  featureCode: string,
  target: FeatureTarget = "features"
): Promise<{ success: boolean; message: string }> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { success: false, message: "Unit not found" };
  }

  const currentList = JSON.parse(
    (target === "spells" ? unit.spells : unit.features) || "[]"
  ) as string[];

  const index = currentList.indexOf(featureCode);
  if (index === -1) {
    return { success: false, message: "Ability not found" };
  }

  currentList.splice(index, 1);

  await prisma.unit.update({
    where: { id: unitId },
    data: { [target]: JSON.stringify(currentList) },
  });

  const typeName = target === "spells" ? "Spell" : "Skill";
  return { success: true, message: `${typeName} ${featureCode} removed!` };
}

// =============================================================================
// COMPRAR LEVEL UP (RECURSO → XP)
// =============================================================================

/**
 * Verifica se uma unidade pode comprar level up com recursos
 * Requer estar em território com Produtor de Experiência ou Capital
 */
export async function canPurchaseLevelUp(
  unitId: string,
  playerId: string
): Promise<{ canLevel: boolean; reason?: string; cost?: number }> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { canLevel: false, reason: "Unit not found" };
  }

  // SUMMON cannot level up
  if (unit.category === "SUMMON") {
    return {
      canLevel: false,
      reason: "Summons cannot level up",
    };
  }

  if (unit.ownerId !== playerId) {
    return { canLevel: false, reason: "You do not own this unit" };
  }

  if (unit.level >= MAX_HERO_LEVEL) {
    return {
      canLevel: false,
      reason: `Maximum level (${MAX_HERO_LEVEL}) reached`,
    };
  }

  // Check if in appropriate territory (with Battle or Capital)
  if (!unit.matchId || unit.locationIndex === null) {
    return {
      canLevel: false,
      reason: "Unit must be in a match and in a territory",
    };
  }

  const territory = await prisma.territory.findFirst({
    where: {
      matchId: unit.matchId,
      mapIndex: unit.locationIndex,
    },
  });

  if (!territory) {
    return { canLevel: false, reason: "Territory not found" };
  }

  const isInCapital = territory.isCapital && territory.ownerId === playerId;

  const hasXpProducer = await prisma.structure.findFirst({
    where: {
      matchId: unit.matchId,
      locationIndex: unit.locationIndex,
      resourceType: "EXPERIENCE",
      ownerId: playerId,
    },
  });

  if (!isInCapital && !hasXpProducer) {
    return {
      canLevel: false,
      reason: `Unit must be in the Capital or in a territory with ${getResourceName(
        "experience"
      )} Producer (Battle)`,
    };
  }

  const cost = calculateLevelUpCost(unit.category, unit.level);

  return { canLevel: true, cost };
}

/**
 * Compra level up de uma unidade com recursos (experience)
 * Qualquer unidade pode usar este sistema
 */
export async function purchaseLevelUp(
  unitId: string,
  playerId: string,
  attributeDistribution: {
    combat: number;
    speed: number;
    focus: number;
    resistance: number;
    will: number;
    vitality: number;
  }
): Promise<{ success: boolean; message: string; unit?: any }> {
  const validation = await canPurchaseLevelUp(unitId, playerId);

  if (!validation.canLevel) {
    return {
      success: false,
      message: validation.reason || "Cannot level up",
    };
  }

  const cost = validation.cost || 0;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { success: false, message: "Unit not found" };
  }

  // Determine points per level based on category
  const pointsPerLevel = ATTRIBUTE_POINTS_PER_LEVEL[unit.category] || 2;

  // Validate point distribution
  const totalDistributed =
    attributeDistribution.combat +
    attributeDistribution.speed +
    attributeDistribution.focus +
    attributeDistribution.resistance +
    attributeDistribution.will +
    attributeDistribution.vitality;

  if (totalDistributed !== pointsPerLevel) {
    return {
      success: false,
      message: `Distribute exactly ${pointsPerLevel} points (${unit.category})`,
    };
  }

  // Validate no negative values
  if (Object.values(attributeDistribution).some((v) => v < 0)) {
    return {
      success: false,
      message: "Attribute values cannot be negative",
    };
  }

  // Spend experience
  try {
    await spendResources(playerId, { experience: cost } as any);
  } catch (error) {
    return {
      success: false,
      message: `Insufficient ${getResourceName("experience")}. Cost: ${cost}`,
    };
  }

  const newLevel = unit.level + 1;
  const updatedUnit = await prisma.unit.update({
    where: { id: unitId },
    data: {
      level: newLevel,
      combat: unit.combat + attributeDistribution.combat,
      speed: unit.speed + attributeDistribution.speed,
      focus: unit.focus + attributeDistribution.focus,
      resistance: unit.resistance + attributeDistribution.resistance,
      will: unit.will + attributeDistribution.will,
      vitality: unit.vitality + attributeDistribution.vitality,
      currentHp: unit.currentHp + attributeDistribution.vitality,
    },
  });

  return {
    success: true,
    message: `${
      unit.name || unit.category
    } leveled up to ${newLevel}! Cost: ${cost} ${getResourceName(
      "experience"
    )}`,
    unit: updatedUnit,
  };
}

// =============================================================================
// RE-EXPORTS de constantes do shared
// =============================================================================

export {
  XP_THRESHOLDS,
  XP_REWARDS,
  ATTRIBUTE_POINTS_PER_LEVEL,
  calculateLevelFromXP,
  getXPToNextLevel,
  calculateLevelUpCost,
};

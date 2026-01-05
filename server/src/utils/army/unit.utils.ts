// src/utils/army/unit.utils.ts
// Utilitários genéricos para TODAS as unidades (TROOP, HERO, REGENT)
// XP, Level Up, Skills e Spells

import { prisma } from "../../lib/prisma";
import { getClassByCode } from "../../../../shared/data/classes.data";
import {
  XP_THRESHOLDS,
  XP_REWARDS,
  ATTRIBUTE_POINTS_PER_LEVEL,
  calculateLevelFromXP,
  getXPToNextLevel,
} from "../../../../shared/data/heroes.data";
import {
  MAX_HERO_LEVEL,
  calculateLevelUpCost,
} from "../../../../shared/data/units";
import { spendResources } from "../turn.utils";
import { getResourceName } from "../../../../shared/config/global.config";

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
      message: "Unidade não encontrada",
    };
  }

  // SUMMON não ganha XP - redireciona para o invocador
  if (unit.category === "SUMMON") {
    if (unit.summonerId) {
      const result = await addExperience(unit.summonerId, xpAmount);
      return {
        ...result,
        redirectedTo: unit.summonerId,
        message: `XP redirecionado para invocador: ${result.message}`,
      };
    }
    return {
      success: false,
      leveledUp: false,
      message: "Invocação sem invocador - XP perdido",
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
      message: `+${xpAmount} XP! Subiu para nível ${newLevel}!`,
    };
  }

  const xpToNext = getXPToNextLevel(newExperience);
  return {
    success: true,
    leveledUp: false,
    message: `+${xpAmount} XP (${xpToNext} para próximo nível)`,
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
    return { canLevel: false, reason: "Unidade não encontrada" };
  }

  // SUMMON não pode fazer level up
  if (unit.category === "SUMMON") {
    return {
      canLevel: false,
      reason: "Invocações não podem subir de nível",
    };
  }

  if (unit.level >= MAX_HERO_LEVEL) {
    return {
      canLevel: false,
      reason: `Nível máximo (${MAX_HERO_LEVEL}) atingido`,
    };
  }

  const expectedLevel = calculateLevelFromXP(unit.experience || 0);
  const pendingLevels = expectedLevel - unit.level;

  if (pendingLevels <= 0) {
    return { canLevel: false, reason: "XP insuficiente para subir de nível" };
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
    armor: number;
    vitality: number;
  }
): Promise<{ success: boolean; message: string; unit?: any }> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { success: false, message: "Unidade não encontrada" };
  }

  // Verifica se deve subir de nível baseado no XP
  const expectedLevel = calculateLevelFromXP(unit.experience || 0);
  if (expectedLevel <= unit.level) {
    return { success: false, message: "XP insuficiente para subir de nível" };
  }

  if (unit.level >= MAX_HERO_LEVEL) {
    return {
      success: false,
      message: `Nível máximo (${MAX_HERO_LEVEL}) atingido`,
    };
  }

  // Determina pontos por nível baseado na categoria
  const pointsPerLevel = ATTRIBUTE_POINTS_PER_LEVEL[unit.category] || 2;

  // Valida distribuição
  const totalDistributed =
    attributeDistribution.combat +
    attributeDistribution.speed +
    attributeDistribution.focus +
    attributeDistribution.armor +
    attributeDistribution.vitality;

  if (totalDistributed !== pointsPerLevel) {
    return {
      success: false,
      message: `Distribua exatamente ${pointsPerLevel} pontos (${unit.category})`,
    };
  }

  // Valida que não há valores negativos
  if (Object.values(attributeDistribution).some((v) => v < 0)) {
    return {
      success: false,
      message: "Valores de atributo não podem ser negativos",
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
      armor: unit.armor + attributeDistribution.armor,
      vitality: unit.vitality + attributeDistribution.vitality,
      currentHp: unit.currentHp + attributeDistribution.vitality * 2,
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
    if (!bu.unitId) continue; // Pula unidades temporárias (Arena)

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
    return { success: false, message: "Unidade não encontrada" };
  }

  // Validação opcional de classe (só para skills, não spells)
  if (validateClass && unit.classCode && target === "features") {
    const unitClass = getClassByCode(unit.classCode);
    if (unitClass) {
      const isValidSkill = unitClass.skills.some((s) => s.code === featureCode);

      if (!isValidSkill) {
        return {
          success: false,
          message: "Esta skill não está disponível para esta classe",
        };
      }
    }
  }

  const currentList = JSON.parse(
    (target === "spells" ? unit.spells : unit.features) || "[]"
  ) as string[];

  if (currentList.includes(featureCode)) {
    return { success: false, message: "Habilidade já adicionada" };
  }

  currentList.push(featureCode);

  await prisma.unit.update({
    where: { id: unitId },
    data: { [target]: JSON.stringify(currentList) },
  });

  const typeName = target === "spells" ? "Magia" : "Skill";
  return { success: true, message: `${typeName} ${featureCode} adicionada!` };
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
    return { success: false, message: "Unidade não encontrada" };
  }

  const currentList = JSON.parse(
    (target === "spells" ? unit.spells : unit.features) || "[]"
  ) as string[];

  const index = currentList.indexOf(featureCode);
  if (index === -1) {
    return { success: false, message: "Habilidade não encontrada" };
  }

  currentList.splice(index, 1);

  await prisma.unit.update({
    where: { id: unitId },
    data: { [target]: JSON.stringify(currentList) },
  });

  const typeName = target === "spells" ? "Magia" : "Skill";
  return { success: true, message: `${typeName} ${featureCode} removida!` };
}

// =============================================================================
// COMPRAR LEVEL UP (RECURSO → XP)
// =============================================================================

/**
 * Verifica se uma unidade pode comprar level up com recursos
 * Requer estar em território com Arena (produtora de experiência) ou Capital
 */
export async function canPurchaseLevelUp(
  unitId: string,
  playerId: string
): Promise<{ canLevel: boolean; reason?: string; cost?: number }> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { canLevel: false, reason: "Unidade não encontrada" };
  }

  // SUMMON não pode fazer level up
  if (unit.category === "SUMMON") {
    return {
      canLevel: false,
      reason: "Invocações não podem subir de nível",
    };
  }

  if (unit.ownerId !== playerId) {
    return { canLevel: false, reason: "Você não é dono desta unidade" };
  }

  if (unit.level >= MAX_HERO_LEVEL) {
    return {
      canLevel: false,
      reason: `Nível máximo (${MAX_HERO_LEVEL}) atingido`,
    };
  }

  // Verifica se está em território adequado (com Arena ou Capital)
  if (!unit.matchId || unit.locationIndex === null) {
    return {
      canLevel: false,
      reason: "Unidade deve estar em uma partida e em um território",
    };
  }

  const territory = await prisma.territory.findFirst({
    where: {
      matchId: unit.matchId,
      mapIndex: unit.locationIndex,
    },
  });

  if (!territory) {
    return { canLevel: false, reason: "Território não encontrado" };
  }

  const isInCapital = territory.isCapital && territory.ownerId === playerId;

  const hasArena = await prisma.structure.findFirst({
    where: {
      matchId: unit.matchId,
      locationIndex: unit.locationIndex,
      resourceType: "EXPERIENCE",
      ownerId: playerId,
    },
  });

  if (!isInCapital && !hasArena) {
    return {
      canLevel: false,
      reason: `Unidade precisa estar na Capital ou em território com Produtor de ${getResourceName(
        "experience"
      )} (Arena)`,
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
    armor: number;
    vitality: number;
  }
): Promise<{ success: boolean; message: string; unit?: any }> {
  const validation = await canPurchaseLevelUp(unitId, playerId);

  if (!validation.canLevel) {
    return {
      success: false,
      message: validation.reason || "Não pode fazer level up",
    };
  }

  const cost = validation.cost || 0;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { success: false, message: "Unidade não encontrada" };
  }

  // Determina pontos por nível baseado na categoria
  const pointsPerLevel = ATTRIBUTE_POINTS_PER_LEVEL[unit.category] || 2;

  // Valida distribuição de pontos
  const totalDistributed =
    attributeDistribution.combat +
    attributeDistribution.speed +
    attributeDistribution.focus +
    attributeDistribution.armor +
    attributeDistribution.vitality;

  if (totalDistributed !== pointsPerLevel) {
    return {
      success: false,
      message: `Distribua exatamente ${pointsPerLevel} pontos (${unit.category})`,
    };
  }

  // Valida que não há valores negativos
  if (Object.values(attributeDistribution).some((v) => v < 0)) {
    return {
      success: false,
      message: "Valores de atributo não podem ser negativos",
    };
  }

  // Gasta experiência
  try {
    await spendResources(playerId, { experience: cost } as any);
  } catch (error) {
    return {
      success: false,
      message: `${getResourceName("experience")} insuficiente. Custo: ${cost}`,
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
      armor: unit.armor + attributeDistribution.armor,
      vitality: unit.vitality + attributeDistribution.vitality,
      currentHp: unit.currentHp + attributeDistribution.vitality,
    },
  });

  return {
    success: true,
    message: `${
      unit.name || unit.category
    } subiu para nível ${newLevel}! Custo: ${cost} ${getResourceName(
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

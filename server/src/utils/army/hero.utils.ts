// src/utils/army/hero.utils.ts
// Utilitários ESPECÍFICOS para heróis
// Heróis são templates pré-definidos, ÚNICOS por partida

import { prisma } from "../../lib/prisma";
import { getResourceName } from "../../../../shared/config/global.config";
import {
  HERO_TEMPLATES,
  getHeroTemplate,
  HeroTemplate,
} from "../../../../shared/data/heroes.data";
import { MAX_HEROES_PER_KINGDOM } from "../../../../shared/data/units";

// Re-export funções genéricas de unit.utils.ts para compatibilidade
export {
  addExperience,
  canLevelUp,
  processLevelUp,
  getXPForAction,
  grantBattleXP,
  grantKillXP,
  addUnitFeature,
  removeUnitFeature,
  XP_THRESHOLDS,
  XP_REWARDS,
  ATTRIBUTE_POINTS_PER_LEVEL,
  calculateLevelFromXP,
  getXPToNextLevel,
} from "./unit.utils";

// Aliases para compatibilidade (DEPRECATED - usar addUnitFeature)
import { addUnitFeature } from "./unit.utils";
export const addHeroSkill = (unitId: string, skillCode: string) =>
  addUnitFeature(unitId, skillCode, "classFeatures", true);
export const addHeroClassFeature = (unitId: string, featureCode: string) =>
  addUnitFeature(unitId, featureCode, "classFeatures", false);

// =============================================================================
// CONSTANTES DE RECRUTAMENTO
// =============================================================================

/** Custo base em recursos para revelar heróis */
export const HERO_REVEAL_COST = 10;

/** Número de heróis revelados por pagamento */
export const HEROES_PER_REVEAL = 1;

// =============================================================================
// HERÓIS DISPONÍVEIS NA PARTIDA (Verificação de unicidade)
// =============================================================================

/**
 * Obtém heróis já recrutados na partida
 */
export async function getRecruitedHeroesInMatch(
  matchId: string
): Promise<string[]> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { recruitedHeroes: true },
  });

  if (!match) return [];
  return JSON.parse(match.recruitedHeroes || "[]");
}

/**
 * Marca um herói como recrutado na partida
 */
export async function markHeroAsRecruited(
  matchId: string,
  heroCode: string
): Promise<void> {
  const recruited = await getRecruitedHeroesInMatch(matchId);

  if (!recruited.includes(heroCode)) {
    recruited.push(heroCode);
    await prisma.match.update({
      where: { id: matchId },
      data: { recruitedHeroes: JSON.stringify(recruited) },
    });
  }
}

/**
 * Lista heróis disponíveis para recrutamento (não recrutados por ninguém na partida)
 */
export async function getAvailableHeroesInMatch(
  matchId: string
): Promise<HeroTemplate[]> {
  const recruited = await getRecruitedHeroesInMatch(matchId);
  return HERO_TEMPLATES.filter((h) => !recruited.includes(h.code));
}

/**
 * Revela heróis aleatórios para o jogador baseado em quanto recurso pagou
 * @param matchId ID da partida
 * @param resourceAmount Quantidade de recurso pago
 * @returns Lista de heróis revelados (únicos, ainda não recrutados)
 */
export async function revealHeroesForRecruitment(
  matchId: string,
  resourceAmount: number
): Promise<{ heroes: HeroTemplate[]; count: number }> {
  // Calcula quantos heróis revelar (1 por cada 10 recursos)
  const heroCount = Math.floor(resourceAmount / HERO_REVEAL_COST);

  if (heroCount <= 0) {
    return { heroes: [], count: 0 };
  }

  // Pega heróis disponíveis (não recrutados)
  const available = await getAvailableHeroesInMatch(matchId);

  if (available.length === 0) {
    return { heroes: [], count: 0 };
  }

  // Embaralha e pega os primeiros N
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const revealed = shuffled.slice(0, Math.min(heroCount, available.length));

  return { heroes: revealed, count: revealed.length };
}

// =============================================================================
// RECRUTAMENTO DE HERÓIS
// =============================================================================

/**
 * Verifica se um jogador pode recrutar um herói específico
 */
export async function canRecruitHero(
  matchId: string,
  playerId: string,
  heroCode: string
): Promise<{ canRecruit: boolean; reason?: string }> {
  // Verifica se o template existe
  const template = getHeroTemplate(heroCode);
  if (!template) {
    return { canRecruit: false, reason: "Herói não encontrado" };
  }

  // Verifica se já foi recrutado na partida
  const recruited = await getRecruitedHeroesInMatch(matchId);
  if (recruited.includes(heroCode)) {
    return {
      canRecruit: false,
      reason: `${template.name} já foi recrutado por outro jogador`,
    };
  }

  // Obtém o MatchKingdom
  const matchKingdom = await prisma.matchKingdom.findUnique({
    where: { id: playerId },
  });

  if (!matchKingdom) {
    return { canRecruit: false, reason: "Jogador não encontrado" };
  }

  // Conta heróis atuais do MatchKingdom na partida
  const heroCount = await prisma.unit.count({
    where: {
      ownerId: playerId,
      category: "HERO",
    },
  });

  if (heroCount >= MAX_HEROES_PER_KINGDOM) {
    return {
      canRecruit: false,
      reason: `Limite de ${MAX_HEROES_PER_KINGDOM} heróis atingido`,
    };
  }

  // Verifica se já tem esse herói na partida
  const existingHero = await prisma.unit.findFirst({
    where: {
      ownerId: playerId,
      category: "HERO",
      name: template.name,
    },
  });

  if (existingHero) {
    return {
      canRecruit: false,
      reason: `Você já possui ${template.name} no seu reino`,
    };
  }

  return { canRecruit: true };
}

/**
 * Recruta um herói de template durante uma partida
 * O herói é marcado como recrutado na partida (único)
 */
export async function recruitHeroFromTemplate(
  matchId: string,
  playerId: string,
  heroCode: string
): Promise<{ success: boolean; message: string; hero?: any }> {
  // Verifica se pode recrutar
  const validation = await canRecruitHero(matchId, playerId, heroCode);
  if (!validation.canRecruit) {
    return {
      success: false,
      message: validation.reason || "Não pode recrutar",
    };
  }

  const template = getHeroTemplate(heroCode)!;

  // Obtém o MatchKingdom
  const matchKingdom = await prisma.matchKingdom.findUnique({
    where: { id: playerId },
  });

  if (!matchKingdom) {
    return { success: false, message: "Reino não encontrado" };
  }

  // Verifica recursos
  const resources = JSON.parse(matchKingdom.resources || "{}");
  const cost = template.recruitCost;

  if (cost.ore && (resources.minerio || 0) < cost.ore) {
    return {
      success: false,
      message: `${getResourceName("ore")} insuficiente. Precisa: ${cost.ore}`,
    };
  }
  if (cost.supplies && (resources.suprimentos || 0) < cost.supplies) {
    return {
      success: false,
      message: `${getResourceName("supplies")} insuficiente. Precisa: ${
        cost.supplies
      }`,
    };
  }
  if (cost.arcane && (resources.arcana || 0) < cost.arcane) {
    return {
      success: false,
      message: `${getResourceName("arcane")} insuficiente. Precisa: ${
        cost.arcane
      }`,
    };
  }
  if (cost.devotion && (resources.devocao || 0) < cost.devotion) {
    return {
      success: false,
      message: `${getResourceName("devotion")} insuficiente. Precisa: ${
        cost.devotion
      }`,
    };
  }

  // Busca a capital do jogador
  if (!matchKingdom.capitalTerritoryId) {
    return { success: false, message: "Capital não encontrada" };
  }

  const capital = await prisma.territory.findUnique({
    where: { id: matchKingdom.capitalTerritoryId },
  });

  if (!capital) {
    return { success: false, message: "Território da capital não encontrado" };
  }

  // Gasta recursos
  const newResources = { ...resources };
  if (cost.ore) newResources.minerio = (newResources.minerio || 0) - cost.ore;
  if (cost.supplies)
    newResources.suprimentos = (newResources.suprimentos || 0) - cost.supplies;
  if (cost.arcane)
    newResources.arcana = (newResources.arcana || 0) - cost.arcane;
  if (cost.devotion)
    newResources.devocao = (newResources.devocao || 0) - cost.devotion;

  await prisma.matchKingdom.update({
    where: { id: playerId },
    data: { resources: JSON.stringify(newResources) },
  });

  // Marca o herói como recrutado na partida (unicidade)
  await markHeroAsRecruited(matchId, heroCode);

  // Cria o herói baseado no template
  const hero = await prisma.unit.create({
    data: {
      matchId,
      ownerId: playerId,
      category: "HERO",
      name: template.name,
      description: template.description,
      avatar: template.avatar,
      level: template.level,
      experience: 0,
      classCode: template.classCode,
      classFeatures: JSON.stringify(template.initialSkills),
      spells: JSON.stringify(template.initialSpells),
      combat: template.combat,
      speed: template.speed,
      focus: template.focus,
      armor: template.armor,
      vitality: template.vitality,
      currentHp: template.vitality * 2,
      movesLeft: 0,
      actionsLeft: 0,
      locationIndex: capital.mapIndex,
    },
  });

  return {
    success: true,
    message: `${template.icon} ${template.name} recrutado com sucesso!`,
    hero,
  };
}

// =============================================================================
// SKILLS DE HERÓI (Específico)
// =============================================================================

/**
 * Verifica se um herói pode escolher característica de classe
 * Herói escolhe nos níveis 1, 4 e 8
 */
export function canHeroChooseFeature(level: number): boolean {
  return level === 1 || level === 4 || level === 8;
}

// =============================================================================
// RE-EXPORTS de dados de heróis
// =============================================================================

export { HERO_TEMPLATES, getHeroTemplate };

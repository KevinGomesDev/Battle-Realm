// src/utils/army/hero.utils.ts
import { prisma } from "../../lib/prisma";
import {
  HERO_LEVELUP_BASE_COST,
  HERO_LEVELUP_INCREMENT,
  HERO_RECRUITMENT_COSTS,
  MAX_HEROES_PER_PLAYER,
  MAX_HERO_LEVEL,
  HERO_ATTRIBUTE_POINTS_PER_LEVEL,
} from "../../types";
import { spendResources } from "../turn.utils";
import { getClassByCode } from "../../data/classes.data";
import { getResourceName } from "../../../../shared/config/global.config";

// ... (calculateHeroLevelUpCost, calculateHeroRecruitmentCost, canHeroLevelUp e levelUpHero permanecem iguais) ...

/**
 * Calcula o custo de experiência para herói subir de nível
 * Fórmula: 4 + (nível_atual × 2)
 */
export function calculateHeroLevelUpCost(currentLevel: number): number {
  return HERO_LEVELUP_BASE_COST + currentLevel * HERO_LEVELUP_INCREMENT;
}

/**
 * Calcula o custo de recrutamento de um herói
 */
export async function calculateHeroRecruitmentCost(
  playerId: string
): Promise<number> {
  const heroCount = await prisma.unit.count({
    where: {
      ownerId: playerId,
      category: "HERO",
    },
  });

  return HERO_RECRUITMENT_COSTS[heroCount] || 0;
}

/**
 * Verifica se um herói pode fazer level up
 */
export async function canHeroLevelUp(
  unitId: string,
  playerId: string
): Promise<{ canLevel: boolean; reason?: string; cost?: number }> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { canLevel: false, reason: "Unidade não encontrada" };
  }

  if (unit.ownerId !== playerId) {
    return { canLevel: false, reason: "Você não é dono desta unidade" };
  }

  if (unit.category !== "HERO") {
    return { canLevel: false, reason: "Esta não é uma unidade Herói" };
  }

  if (unit.level >= MAX_HERO_LEVEL) {
    return {
      canLevel: false,
      reason: `Heróis não podem passar do nível ${MAX_HERO_LEVEL}`,
    };
  }

  // Verifica se está em território adequado
  if (!unit.matchId || !unit.locationIndex) {
    return {
      canLevel: false,
      reason: "Herói deve estar em uma partida e em um território",
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
      reason: `Herói precisa estar na Capital ou em território com Produtor de ${getResourceName(
        "experience"
      )} (Arena)`,
    };
  }

  const cost = calculateHeroLevelUpCost(unit.level);

  return { canLevel: true, cost };
}

/**
 * Realiza o level up de um herói
 */
export async function levelUpHero(
  unitId: string,
  playerId: string,
  attributeDistribution: {
    combat: number;
    acuity: number;
    focus: number;
    armor: number;
    vitality: number;
  }
): Promise<{ success: boolean; message: string; unit?: any }> {
  const validation = await canHeroLevelUp(unitId, playerId);

  if (!validation.canLevel) {
    return {
      success: false,
      message: validation.reason || "Não pode fazer level up",
    };
  }

  const cost = validation.cost || 0;

  // Gasta experiência
  try {
    await spendResources(playerId, { experience: cost } as any);
  } catch (error) {
    return {
      success: false,
      message: `${getResourceName("experience")} insuficiente. Custo: ${cost}`,
    };
  }

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { success: false, message: "Unidade não encontrada" };
  }

  // Valida distribuição de pontos (4 para Herói)
  const totalDistributed =
    attributeDistribution.combat +
    attributeDistribution.acuity +
    attributeDistribution.focus +
    attributeDistribution.armor +
    attributeDistribution.vitality;

  if (totalDistributed !== HERO_ATTRIBUTE_POINTS_PER_LEVEL) {
    return {
      success: false,
      message: `Você deve distribuir exatamente ${HERO_ATTRIBUTE_POINTS_PER_LEVEL} pontos`,
    };
  }

  const newLevel = unit.level + 1;
  const updatedUnit = await prisma.unit.update({
    where: { id: unitId },
    data: {
      level: newLevel,
      combat: unit.combat + attributeDistribution.combat,
      acuity: unit.acuity + attributeDistribution.acuity,
      focus: unit.focus + attributeDistribution.focus,
      armor: unit.armor + attributeDistribution.armor,
      vitality: unit.vitality + attributeDistribution.vitality,
      currentHp: unit.currentHp + attributeDistribution.vitality,
    },
  });

  return {
    success: true,
    message: `Herói subiu para nível ${newLevel}! Custo: ${cost} ${getResourceName(
      "experience"
    )}`,
    unit: updatedUnit,
  };
}

/**
 * Recruta um novo herói
 */
export async function recruitHero(
  matchId: string,
  playerId: string,
  heroData: {
    name?: string;
    heroClass: string; // Código da classe (ex: "CLERIC", "WIZARD")
    attributeDistribution: {
      combat: number;
      acuity: number;
      focus: number;
      armor: number;
      vitality: number;
    };
  }
): Promise<{ success: boolean; message: string; hero?: any }> {
  // Obtém o Kingdom através do MatchPlayer
  const matchPlayer = await prisma.matchPlayer.findUnique({
    where: { id: playerId },
  });

  if (!matchPlayer) {
    return {
      success: false,
      message: "MatchPlayer não encontrado",
    };
  }

  const kingdomId = matchPlayer.kingdomId;

  // Verifica quantidade de heróis
  const heroCount = await prisma.unit.count({
    where: {
      kingdomId,
      category: "HERO",
    },
  });

  if (heroCount >= MAX_HEROES_PER_PLAYER) {
    return {
      success: false,
      message: `Você já possui o máximo de ${MAX_HEROES_PER_PLAYER} heróis`,
    };
  }

  const cost = HERO_RECRUITMENT_COSTS[heroCount] || 0;

  // Tenta gastar minério
  try {
    await spendResources(playerId, { minerio: cost } as any);
  } catch (error) {
    return {
      success: false,
      message: `${getResourceName("ore")} insuficiente. Custo: ${cost}`,
    };
  }

  // Valida distribuição de pontos (15 pontos iniciais)
  const { combat, acuity, focus, armor, vitality } =
    heroData.attributeDistribution;
  const totalPoints = combat + acuity + focus + armor + vitality;

  if (totalPoints !== 15) {
    return {
      success: false,
      message: "Heróis devem ter exatamente 15 pontos de atributo iniciais",
    };
  }

  // Busca a capital do jogador
  const player = await prisma.matchPlayer.findUnique({
    where: { id: playerId },
  });

  if (!player || !player.capitalTerritoryId) {
    return { success: false, message: "Capital não encontrada" };
  }

  const capital = await prisma.territory.findUnique({
    where: { id: player.capitalTerritoryId },
  });

  if (!capital) {
    return { success: false, message: "Território da capital não encontrado" };
  }

  // Busca a classe nos dados estáticos pelo código
  const heroClass = getClassByCode(heroData.heroClass);

  if (!heroClass) {
    return {
      success: false,
      message: `Classe ${heroData.heroClass} não encontrada`,
    };
  }

  // Cria o herói
  const hero = await prisma.unit.create({
    data: {
      kingdomId, // Vinculado ao Reino (proprietário permanente)
      matchId,
      ownerId: playerId,
      category: "HERO",
      name: heroData.name || heroClass.name, // Usa o nome ou o nome da classe como fallback
      level: 1,
      classCode: heroClass.code, // Código da classe (dados em data/classes.data.ts)
      classFeatures: "[]",
      combat,
      acuity,
      focus,
      armor,
      vitality,
      currentHp: vitality,
      movesLeft: 0,
      actionsLeft: 0,
      locationIndex: capital.mapIndex,
    },
  });

  return {
    success: true,
    message: `Herói ${hero.name} recrutado com sucesso! Custo: ${cost} Minério`,
    hero,
  };
}

/**
 * Verifica se um herói pode escolher característica de classe
 * Herói escolhe nos níveis 1, 4 e 8
 */
export function canHeroChooseFeature(level: number): boolean {
  return level === 1 || level === 4 || level === 8;
}

/**
 * Adiciona uma característica de classe a um herói
 */
export async function addHeroClassFeature(
  unitId: string,
  featureId: string
): Promise<{ success: boolean; message: string }> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { success: false, message: "Unidade não encontrada" };
  }

  if (unit.category !== "HERO") {
    return { success: false, message: "Esta não é uma unidade Herói" };
  }

  const currentFeatures = JSON.parse(unit.classFeatures) as string[];

  if (currentFeatures.includes(featureId)) {
    return { success: false, message: "Esta característica já foi adquirida" };
  }

  currentFeatures.push(featureId);

  await prisma.unit.update({
    where: { id: unitId },
    data: {
      classFeatures: JSON.stringify(currentFeatures),
    },
  });

  return {
    success: true,
    message: `Característica adicionada com sucesso`,
  };
}

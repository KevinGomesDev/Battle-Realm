// server/src/modules/nemesis/nemesis.generator.ts
// Gerador de identidade para Nemesis (nomes, títulos, traços)

import type {
  PersonalityTrait,
  NemesisFear,
  NemesisStrength,
  ScarType,
  NemesisRank,
  NemesisEventType,
  NemesisTaunt,
  TauntContext,
} from "@boundless/shared/types/nemesis.types";

import {
  BASE_NAMES,
  NAME_PREFIXES_BY_TRAIT,
  NAME_SUFFIXES_BY_SCAR,
  TITLES_BY_ACHIEVEMENT,
  NEMESIS_RANKS,
  INITIAL_TRAIT_WEIGHTS,
  NEMESIS_TAUNTS,
  FEAR_FROM_DAMAGE,
  STRENGTH_FROM_SURVIVAL,
  SCAR_FROM_DAMAGE,
} from "./nemesis.config";

// =============================================================================
// UTILITÁRIOS
// =============================================================================

/** Seleciona item aleatório de um array */
function randomFrom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/** Seleciona item baseado em pesos */
function weightedRandom<T extends string>(
  weights: Partial<Record<T, number>>
): T | null {
  const entries = Object.entries(weights) as [T, number][];
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  if (totalWeight === 0) return null;

  let random = Math.random() * totalWeight;

  for (const [item, weight] of entries) {
    random -= weight;
    if (random <= 0) return item;
  }

  return entries[0]?.[0] ?? null;
}

/** Gera ID único */
function generateId(): string {
  return `nemesis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// =============================================================================
// GERAÇÃO DE NOME
// =============================================================================

export interface GeneratedName {
  baseName: string;
  prefix?: string;
  suffix?: string;
  fullName: string;
}

/** Gera um nome base aleatório */
export function generateBaseName(): string {
  return randomFrom(BASE_NAMES);
}

/** Gera prefixo baseado no traço principal */
export function generatePrefix(trait?: PersonalityTrait): string | undefined {
  if (!trait) return undefined;

  const prefixes = NAME_PREFIXES_BY_TRAIT[trait];
  if (!prefixes || prefixes.length === 0) return undefined;

  return randomFrom(prefixes);
}

/** Gera sufixo baseado em cicatrizes */
export function generateSuffix(scars: ScarType[]): string | undefined {
  if (scars.length === 0) return undefined;

  // Prioriza a cicatriz mais "dramática"
  const prioritizedScar = scars[0];
  const suffixes = NAME_SUFFIXES_BY_SCAR[prioritizedScar];

  if (!suffixes || suffixes.length === 0) return undefined;

  return randomFrom(suffixes);
}

/** Gera nome completo do Nemesis */
export function generateNemesisName(
  primaryTrait?: PersonalityTrait,
  scars: ScarType[] = []
): GeneratedName {
  const baseName = generateBaseName();
  const prefix = generatePrefix(primaryTrait);
  const suffix = generateSuffix(scars);

  let fullName = baseName;

  if (suffix) {
    fullName = `${baseName}, ${suffix}`;
  }

  if (prefix) {
    fullName = `${prefix} ${fullName}`;
  }

  return {
    baseName,
    prefix,
    suffix,
    fullName,
  };
}

// =============================================================================
// GERAÇÃO DE TÍTULO
// =============================================================================

export interface TitleGeneratorInput {
  heroKills: number;
  regentKills: number;
  totalKills: number;
  survivalCount: number;
  escapeCount: number;
  ambushCount: number;
}

/** Gera título baseado em conquistas */
export function generateTitle(input: TitleGeneratorInput): string {
  const {
    heroKills,
    regentKills,
    totalKills,
    survivalCount,
    escapeCount,
    ambushCount,
  } = input;

  // Prioridade: feitos mais raros primeiro
  if (regentKills > 0) {
    return randomFrom(TITLES_BY_ACHIEVEMENT.KILL_REGENT);
  }

  if (heroKills >= 2) {
    return randomFrom(TITLES_BY_ACHIEVEMENT.KILL_HERO);
  }

  if (survivalCount >= 3) {
    return randomFrom(TITLES_BY_ACHIEVEMENT.SURVIVED_MANY);
  }

  if (totalKills >= 5) {
    return randomFrom(TITLES_BY_ACHIEVEMENT.MANY_KILLS);
  }

  if (ambushCount >= 2) {
    return randomFrom(TITLES_BY_ACHIEVEMENT.AMBUSH_MASTER);
  }

  if (escapeCount >= 3) {
    return randomFrom(TITLES_BY_ACHIEVEMENT.ESCAPED_MANY);
  }

  // Título padrão baseado no rank
  return "";
}

// =============================================================================
// GERAÇÃO DE TRAÇOS
// =============================================================================

/** Gera traços iniciais baseado no evento de origem */
export function generateInitialTraits(
  originEvent: NemesisEventType,
  count: number = 2
): PersonalityTrait[] {
  const weights = INITIAL_TRAIT_WEIGHTS[originEvent] ?? {};
  const traits: PersonalityTrait[] = [];

  const availableWeights = { ...weights };

  for (let i = 0; i < count; i++) {
    const trait = weightedRandom(availableWeights);
    if (trait) {
      traits.push(trait);
      // Remove o traço selecionado para não repetir
      delete availableWeights[trait];
    }
  }

  return traits;
}

/** Verifica compatibilidade entre traços */
export function areTraitsCompatible(
  trait1: PersonalityTrait,
  trait2: PersonalityTrait
): boolean {
  const incompatibilities: Partial<
    Record<PersonalityTrait, PersonalityTrait[]>
  > = {
    COWARD: ["BERSERKER", "FANATIC", "HONORABLE"],
    BERSERKER: ["COWARD", "CUNNING"],
    HONORABLE: ["TREACHEROUS", "COWARD", "SADISTIC"],
    TREACHEROUS: ["HONORABLE", "FANATIC"],
  };

  const incompatible1 = incompatibilities[trait1] ?? [];
  const incompatible2 = incompatibilities[trait2] ?? [];

  return !incompatible1.includes(trait2) && !incompatible2.includes(trait1);
}

/** Filtra traços incompatíveis */
export function filterCompatibleTraits(
  existingTraits: PersonalityTrait[],
  newTrait: PersonalityTrait
): boolean {
  return existingTraits.every((trait) => areTraitsCompatible(trait, newTrait));
}

// =============================================================================
// GERAÇÃO DE MEDOS, FORÇAS E CICATRIZES
// =============================================================================

/** Determina medo baseado no tipo de dano recebido */
export function determineFearFromDamage(
  damageType: string,
  wasOutnumbered?: boolean
): NemesisFear | null {
  if (wasOutnumbered) {
    return "OUTNUMBERED";
  }

  return (FEAR_FROM_DAMAGE[damageType] as NemesisFear) ?? null;
}

/** Determina força baseado em sobrevivência */
export function determineStrengthFromSurvival(
  damageType?: string,
  survivalCount?: number
): NemesisStrength | null {
  // Mais sobrevivências = mais chance de desenvolver força
  if (survivalCount && survivalCount >= 2) {
    if (damageType && STRENGTH_FROM_SURVIVAL[damageType]) {
      return STRENGTH_FROM_SURVIVAL[damageType] as NemesisStrength;
    }
    // Força genérica após muitas sobrevivências
    return "DETERMINED";
  }

  return null;
}

/** Determina cicatriz baseado no tipo de dano */
export function determineScarFromDamage(damageType: string): ScarType | null {
  const scars = SCAR_FROM_DAMAGE[damageType];
  if (!scars || scars.length === 0) return null;

  return randomFrom(scars);
}

// =============================================================================
// GERAÇÃO DE RANK
// =============================================================================

/** Determina rank baseado no power level */
export function determineRank(powerLevel: number): NemesisRank {
  for (const [rank, config] of Object.entries(NEMESIS_RANKS) as [
    NemesisRank,
    (typeof NEMESIS_RANKS)[NemesisRank]
  ][]) {
    if (
      powerLevel >= config.minPowerLevel &&
      powerLevel <= config.maxPowerLevel
    ) {
      return rank;
    }
  }
  return "OVERLORD"; // Power level muito alto
}

/** Calcula power level inicial baseado no evento */
export function calculateInitialPowerLevel(
  originEvent: NemesisEventType
): number {
  const basePower: Record<NemesisEventType, number> = {
    KILLED_PLAYER_UNIT: 5,
    KILLED_PLAYER_HERO: 15,
    KILLED_PLAYER_REGENT: 30,
    ROUTED_PLAYER: 10,
    AMBUSHED_PLAYER: 8,
    WOUNDED_BY_PLAYER: 3,
    DEFEATED_BY_PLAYER: 2,
    HUMILIATED: 1,
    SCARED_OFF: 1,
    ESCAPED_BATTLE: 2,
    PROMOTED: 5,
    BETRAYED_ALLY: 5,
    RECRUITED_FOLLOWERS: 5,
  };

  const base = basePower[originEvent] ?? 5;
  // Adiciona variação aleatória
  const variation = Math.floor(Math.random() * 5) - 2; // -2 a +2

  return Math.max(1, base + variation);
}

/** Calcula aumento de power level por evento */
export function calculatePowerGain(eventType: NemesisEventType): number {
  const gains: Record<NemesisEventType, number> = {
    KILLED_PLAYER_UNIT: 3,
    KILLED_PLAYER_HERO: 8,
    KILLED_PLAYER_REGENT: 15,
    ROUTED_PLAYER: 5,
    AMBUSHED_PLAYER: 4,
    WOUNDED_BY_PLAYER: 0, // Não ganha power ao ser ferido
    DEFEATED_BY_PLAYER: -2, // Perde poder ao ser derrotado
    HUMILIATED: -5, // Perde muito poder
    SCARED_OFF: -3, // Perde poder ao fugir de medo
    ESCAPED_BATTLE: 1, // Pequeno ganho por sobreviver
    PROMOTED: 5,
    BETRAYED_ALLY: 3,
    RECRUITED_FOLLOWERS: 2,
  };

  return gains[eventType] ?? 0;
}

// =============================================================================
// SELEÇÃO DE TAUNTS
// =============================================================================

export interface TauntSelectionContext {
  context: TauntContext;
  traits: PersonalityTrait[];
  scars: ScarType[];
  killCount: number;
  nemesisName: string;
  playerName: string;
}

/** Seleciona taunt apropriado para o contexto */
export function selectTaunt(input: TauntSelectionContext): NemesisTaunt | null {
  const { context, traits } = input;

  // Filtra taunts pelo contexto
  const contextTaunts = NEMESIS_TAUNTS.filter((t) => t.context === context);

  if (contextTaunts.length === 0) return null;

  // Filtra por traços requeridos/excluídos
  const validTaunts = contextTaunts.filter((taunt) => {
    // Verifica traços requeridos
    if (taunt.requiredTraits && taunt.requiredTraits.length > 0) {
      const hasRequired = taunt.requiredTraits.some((rt) =>
        traits.includes(rt)
      );
      if (!hasRequired) return false;
    }

    // Verifica traços excluídos
    if (taunt.excludedTraits && taunt.excludedTraits.length > 0) {
      const hasExcluded = taunt.excludedTraits.some((et) =>
        traits.includes(et)
      );
      if (hasExcluded) return false;
    }

    return true;
  });

  if (validTaunts.length === 0) return null;

  // Ordena por prioridade e seleciona com peso
  validTaunts.sort((a, b) => b.priority - a.priority);

  // Pondera seleção pela prioridade
  const totalPriority = validTaunts.reduce((sum, t) => sum + t.priority, 0);
  let random = Math.random() * totalPriority;

  for (const taunt of validTaunts) {
    random -= taunt.priority;
    if (random <= 0) return taunt;
  }

  return validTaunts[0];
}

/** Formata taunt com placeholders */
export function formatTaunt(
  taunt: NemesisTaunt,
  context: TauntSelectionContext
): string {
  let text = taunt.template;

  text = text.replace("{playerName}", context.playerName);
  text = text.replace("{nemesisName}", context.nemesisName);
  text = text.replace("{killCount}", String(context.killCount));

  if (context.scars.length > 0) {
    const scarDescriptions: Record<ScarType, string> = {
      BURN_FACE: "rosto queimado",
      BURN_BODY: "corpo queimado",
      MISSING_EYE: "olho faltando",
      SLASH_FACE: "cicatriz no rosto",
      BROKEN_HORN: "chifre quebrado",
      METAL_PLATE: "placa de metal",
      STITCHES: "pontos",
      LIMP: "perna machucada",
    };
    text = text.replace("{scarType}", scarDescriptions[context.scars[0]]);
  }

  return text;
}

// =============================================================================
// IDs
// =============================================================================

export { generateId };

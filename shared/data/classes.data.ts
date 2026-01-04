// shared/data/classes.data.ts
// Definições estáticas de todas as classes do jogo
// FONTE DE VERDADE para classes de heróis/regentes

import type { HeroClassDefinition } from "../types/skills.types";
import {
  WARRIOR_SKILLS,
  CLERIC_SKILLS,
  WIZARD_SKILLS,
  SUMMONER_SKILLS,
} from "./skills.data";

// =============================================================================
// CLASSES
// =============================================================================

export const HERO_CLASSES: HeroClassDefinition[] = [
  // =============================================================================
  // GUERREIRO - FÍSICO (FOOD)
  // =============================================================================
  {
    code: "WARRIOR",
    name: "Guerreiro",
    description:
      "Soldado disciplinado e experiente. Mestre em ataques múltiplos e em recuperação tática.",
    archetype: "PHYSICAL",
    resourceUsed: "FOOD",
    skills: WARRIOR_SKILLS,
  },

  // =============================================================================
  // CLÉRIGO - ESPIRITUAL (DEVOTION)
  // =============================================================================
  {
    code: "CLERIC",
    name: "Clérigo",
    description:
      "Escolhido divino com poderes sagrados. Protege aliados e expele maldições.",
    archetype: "SPIRITUAL",
    resourceUsed: "DEVOTION",
    skills: CLERIC_SKILLS,
  },

  // =============================================================================
  // MAGO - ARCANO (ARCANA)
  // =============================================================================
  {
    code: "WIZARD",
    name: "Mago",
    description:
      "Estudioso das artes arcanas que manipula a realidade através de feitiços poderosos.",
    archetype: "ARCANE",
    resourceUsed: "ARCANA",
    skills: WIZARD_SKILLS,
  },

  // =============================================================================
  // INVOCADOR - ESPIRITUAL (DEVOTION)
  // =============================================================================
  {
    code: "SUMMONER",
    name: "Invocador",
    description:
      "Mestre espiritual que canaliza seu poder através de um Eidolon - uma manifestação espiritual que cresce ao consumir as almas de seus inimigos.",
    archetype: "SPIRITUAL",
    resourceUsed: "DEVOTION",
    skills: SUMMONER_SKILLS,
  },
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Busca uma classe pelo código
 */
export function getClassByCode(code: string): HeroClassDefinition | undefined {
  return HERO_CLASSES.find((c) => c.code === code);
}

/**
 * Busca uma skill pelo código (em qualquer classe)
 */
export function getSkillByCode(
  code: string
): { skill: HeroClassDefinition["skills"][0]; classCode: string } | undefined {
  for (const heroClass of HERO_CLASSES) {
    const skill = heroClass.skills.find((s) => s.code === code);
    if (skill) {
      return { skill, classCode: heroClass.code };
    }
  }
  return undefined;
}

/**
 * Lista todas as skills de uma classe
 */
export function getSkillsForClass(
  classCode: string
): HeroClassDefinition["skills"] {
  const heroClass = getClassByCode(classCode);
  return heroClass?.skills || [];
}

/**
 * Retorna resumo de todas as classes para listagem
 */
export function getAllClassesSummary(): Array<{
  code: string;
  name: string;
  description: string;
  archetype: string;
  resourceUsed: string;
  skillCount: number;
}> {
  return HERO_CLASSES.map((c) => ({
    code: c.code,
    name: c.name,
    description: c.description,
    archetype: c.archetype,
    resourceUsed: c.resourceUsed,
    skillCount: c.skills.length,
  }));
}

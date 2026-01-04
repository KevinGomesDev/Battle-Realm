// shared/data/heroes.data.ts
// Definições de Heróis pré-criados (recrutáveis durante partidas)
// Heróis NÃO são criados pelo jogador - são templates fixos como reinos

// =============================================================================
// TIPOS
// =============================================================================

export interface HeroTemplate {
  /** Código único do herói (usado como ID) */
  code: string;
  /** Nome do herói */
  name: string;
  /** Descrição/história do herói */
  description: string;
  /** Classe do herói (deve existir em classes.data.ts) */
  classCode: string;
  /** Avatar (sprite ID) */
  avatar: string;
  /** Nível inicial */
  level: number;
  /** Atributos base */
  combat: number;
  speed: number;
  focus: number;
  armor: number;
  vitality: number;
  /** Skills iniciais (códigos de skills da classe) */
  initialSkills: string[];
  /** Spells iniciais (códigos de spells) */
  initialSpells: string[];
  /** Custo para recrutar (em recursos do reino) */
  recruitCost: {
    ore?: number;
    supplies?: number;
    arcane?: number;
    devotion?: number;
  };
  /** Ícone/emoji para exibição */
  icon: string;
  /** Cor temática (para UI) */
  themeColor: string;
}

// =============================================================================
// HERÓIS PRÉ-DEFINIDOS
// =============================================================================

export const HERO_TEMPLATES: HeroTemplate[] = [
  // =============================================================================
  // ALDRIC - GUERREIRO
  // =============================================================================
  {
    code: "ALDRIC_IRONFORGE",
    name: "Aldric Ironforge",
    description:
      "Veterano de mil batalhas, Aldric forjou sua reputação nas guerras do norte. Sua espada Quebra-Destino já atravessou armaduras que pareciam impenetráveis. Leal até a morte, ele protege aqueles que considera dignos de seu aço.",
    classCode: "WARRIOR",
    avatar: "warrior_aldric",
    level: 1,
    combat: 6,
    speed: 3,
    focus: 1,
    armor: 4,
    vitality: 6,
    initialSkills: ["EXTRA_ATTACK"],
    initialSpells: [],
    recruitCost: {
      ore: 8,
      supplies: 4,
    },
    icon: "⚔️",
    themeColor: "#dc2626", // red-600
  },

  // =============================================================================
  // ELARA - CLÉRIGA
  // =============================================================================
  {
    code: "ELARA_DAWNBRINGER",
    name: "Elara Dawnbringer",
    description:
      "Escolhida da Deusa da Aurora, Elara abandonou uma vida de nobreza para seguir o chamado divino. Sua fé é tão inabalável quanto sua habilidade de curar feridas mortais. Onde ela pisa, as sombras recuam.",
    classCode: "CLERIC",
    avatar: "cleric_elara",
    level: 1,
    combat: 2,
    speed: 3,
    focus: 5,
    armor: 3,
    vitality: 5,
    initialSkills: ["HEALING_WORD"],
    initialSpells: ["HEAL"],
    recruitCost: {
      devotion: 10,
      supplies: 2,
    },
    icon: "✝️",
    themeColor: "#eab308", // yellow-500
  },

  // =============================================================================
  // VAREN - MAGO
  // =============================================================================
  {
    code: "VAREN_STORMWEAVER",
    name: "Varen Stormweaver",
    description:
      "Expulso da Academia Arcana por experimentos proibidos, Varen dominou magias que outros temem pronunciar. Trovões obedecem seu comando e relâmpagos dançam entre seus dedos. Seu conhecimento é vasto, mas seu temperamento, imprevisível.",
    classCode: "WIZARD",
    avatar: "wizard_varen",
    level: 1,
    combat: 1,
    speed: 3,
    focus: 7,
    armor: 1,
    vitality: 4,
    initialSkills: ["ARCANE_BOLT"],
    initialSpells: ["FIREBALL", "MAGIC_MISSILE"],
    recruitCost: {
      arcane: 12,
    },
    icon: "🔮",
    themeColor: "#7c3aed", // violet-600
  },
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Busca um herói pelo código
 */
export function getHeroTemplate(code: string): HeroTemplate | undefined {
  return HERO_TEMPLATES.find((h) => h.code === code);
}

/**
 * Lista heróis por classe
 */
export function getHeroesByClass(classCode: string): HeroTemplate[] {
  return HERO_TEMPLATES.filter((h) => h.classCode === classCode);
}

/**
 * Calcula o custo total de recrutamento de um herói
 */
export function getHeroTotalCost(hero: HeroTemplate): number {
  const cost = hero.recruitCost;
  return (
    (cost.ore || 0) +
    (cost.supplies || 0) +
    (cost.arcane || 0) +
    (cost.devotion || 0)
  );
}

/**
 * Retorna os atributos totais do herói (soma)
 */
export function getHeroTotalAttributes(hero: HeroTemplate): number {
  return hero.combat + hero.speed + hero.focus + hero.armor + hero.vitality;
}

// =============================================================================
// CONFIGURAÇÕES DE XP E LEVEL UP
// =============================================================================

/**
 * Thresholds de XP para cada nível (XP necessário para ATINGIR o nível)
 * Nível 1 = 0 XP (inicial)
 * Nível 2 = 100 XP
 * etc.
 */
export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 450,
  5: 700,
  6: 1000,
  7: 1400,
  8: 1900,
  9: 2500,
  10: 3200,
};

/**
 * XP ganho por tipo de ação em batalha
 */
export const XP_REWARDS = {
  KILL_TROOP: 25, // Matar uma tropa inimiga
  KILL_HERO: 50, // Matar um herói inimigo
  KILL_REGENT: 100, // Matar o regente inimigo
  SURVIVE_BATTLE: 10, // Sobreviver à batalha
  WIN_BATTLE: 30, // Bônus por vencer a batalha
  DEAL_DAMAGE: 1, // Por ponto de dano causado
  HEAL_ALLY: 2, // Por ponto de cura em aliado
};

/**
 * Pontos de atributo ganhos por level up (por categoria de unidade)
 */
export const ATTRIBUTE_POINTS_PER_LEVEL: Record<string, number> = {
  TROOP: 2,
  HERO: 4,
  REGENT: 6,
};

/**
 * Calcula o nível baseado no XP atual
 */
export function calculateLevelFromXP(experience: number): number {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(XP_THRESHOLDS)) {
    if (experience >= threshold) {
      level = parseInt(lvl);
    } else {
      break;
    }
  }
  return Math.min(level, 10); // Cap no nível 10
}

/**
 * Calcula XP restante para o próximo nível
 */
export function getXPToNextLevel(experience: number): number {
  const currentLevel = calculateLevelFromXP(experience);
  if (currentLevel >= 10) return 0; // Já no máximo

  const nextThreshold = XP_THRESHOLDS[currentLevel + 1] || 0;
  return Math.max(0, nextThreshold - experience);
}

/**
 * Verifica se uma unidade deve subir de nível
 */
export function shouldLevelUp(
  currentLevel: number,
  experience: number
): boolean {
  const calculatedLevel = calculateLevelFromXP(experience);
  return calculatedLevel > currentLevel;
}

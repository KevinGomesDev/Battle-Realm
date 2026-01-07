// shared/data/Templates/HeroesTemplates.ts
// Templates raw de todos os heróis pré-criados (recrutáveis durante partidas)

import type { HeroTemplate } from "../../types/units.types";

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
    resistance: 4,
    will: 2,
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
    resistance: 3,
    will: 2,
    vitality: 7,
    initialSkills: ["HEAL"],
    initialSpells: [],
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
    focus: 8,
    resistance: 1,
    will: 2,
    vitality: 7,
    initialSkills: ["GRIMOIRE"],
    initialSpells: ["FIRE"],
    recruitCost: {
      arcane: 12,
    },
    icon: "🔮",
    themeColor: "#7c3aed", // violet-600
  },
];

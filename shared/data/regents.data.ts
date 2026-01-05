// shared/data/regents.data.ts
// Templates de Regentes pré-definidos (vinculados aos Templates de Reinos)
// Regentes são unidades especiais que lideram o Reino

import type { Alignment, Race } from "../types/kingdom.types";

// =============================================================================
// TIPOS
// =============================================================================

export interface RegentTemplate {
  /** Código único do regente (usado como ID e referência) */
  code: string;
  /** Nome do regente */
  name: string;
  /** Descrição/história do regente */
  description: string;
  /** Avatar (sprite ID) */
  avatar: string;
  /** Skill inicial (código da skill) - Regentes podem escolher de qualquer classe */
  initialSkillCode?: string;
  /** Spells iniciais (códigos de spells) */
  initialSpells?: string[];
  /** Atributos base (soma = 30 para regentes) */
  combat: number;
  speed: number;
  focus: number;
  armor: number;
  vitality: number;
  /** Ícone/emoji para exibição */
  icon: string;
  /** Cor temática (para UI) */
  themeColor: string;
  /** Alinhamento do regente */
  alignment: Alignment;
  /** Raça do regente */
  race: Race;
}

// =============================================================================
// REGENTES PRÉ-DEFINIDOS
// =============================================================================

/**
 * Imperatriz Seraphina III - Regente de Valdoria
 * Reino humano focado em cavalaria e fé
 */
export const SERAPHINA: RegentTemplate = {
  code: "REGENT_SERAPHINA",
  name: "Imperatriz Seraphina III",
  description: `Terceira de seu nome, Seraphina ascendeu ao trono aos 19 anos após a morte misteriosa de seu pai durante a Batalha do Eclipse. Agora com 32 anos, ela é conhecida tanto por sua compaixão quanto por sua fúria em batalha.

Dizem que ela foi tocada pelo próprio Sol Eterno quando criança, e que seu olho esquerdo brilha com luz dourada quando usa seus poderes divinos. Empunha a lendária Lança do Amanhecer, forjada com fragmentos de uma estrela caída.

Seraphina jurou erradicar a corrupção que se espalha pelas terras selvagens, mesmo que isso custe sua própria vida.`,
  avatar: "1",
  initialSkillCode: "HEAL", // Skill de Cleric - curar aliados
  initialSpells: [],
  combat: 6,
  speed: 4,
  focus: 6,
  armor: 5,
  vitality: 9, // Total: 30
  icon: "👑",
  themeColor: "#eab308", // yellow-500
  alignment: "BOM",
  race: "HUMANOIDE",
};

/**
 * Archlich Malachar - Regente de Nyxrath
 * Nação de assassinos e necromantes
 */
export const MALACHAR: RegentTemplate = {
  code: "REGENT_MALACHAR",
  name: "Archlich Malachar, O Eterno",
  description: `Malachar foi um arquimago élfico há 2.000 anos, obcecado em desvendar os segredos da imortalidade. Após sacrificar sua própria família em um ritual proibido, ele ascendeu como o primeiro Lich de Nyxrath.

Seu corpo é uma carcaça ressecada envolta em mantos de escuridão pura. Onde seus olhos deveriam estar, apenas chamas verdes e frias queimam com conhecimento acumulado de eras. Ele carrega o Grimório Vazio, um livro que consome as almas de seus inimigos.

Malachar não busca poder — ele já o tem. O que ele deseja é conhecimento absoluto, e está disposto a destruir mundos para obtê-lo.`,
  avatar: "9",
  initialSkillCode: "GRIMOIRE", // Skill de Wizard
  initialSpells: ["FIRE"],
  combat: 2,
  speed: 5,
  focus: 11,
  armor: 3,
  vitality: 9, // Total: 30
  icon: "💀",
  themeColor: "#7c3aed", // violet-600
  alignment: "MAL",
  race: "MORTO_VIVO",
};

/**
 * Ignatharax - Regente de Ashenvale
 * Confederação Dracônica
 */
export const IGNATHARAX: RegentTemplate = {
  code: "REGENT_IGNATHARAX",
  name: "Ignatharax, O Primordial",
  description: `Ignatharax é um dos Cinco Anciões, um dragão vermelho de proporções titânicas que dormiu por 500 anos antes de despertar na última década. Ele é o guardião do Fogo Eterno, a chama primordial que arde no coração do mundo.

Com escamas que brilham como metal derretido e olhos que são brasas de pura energia, Ignatharax é tanto uma força da natureza quanto um ser senciente. Sua voz é o rugido de vulcões, e seu sopro pode derreter montanhas.

Diferente de muitos dragões vermelhos, Ignatharax não é movido por ganância ou raiva. Ele vê o mundo com a perspectiva de eras, e protege Ashenvale porque sabe que o equilíbrio é a única coisa que impede a extinção de todas as coisas.`,
  avatar: "7",
  initialSkillCode: "RECKLESS_ATTACK", // Skill de Barbarian
  initialSpells: [],
  combat: 8,
  speed: 4,
  focus: 5,
  armor: 6,
  vitality: 7, // Total: 30
  icon: "🐉",
  themeColor: "#dc2626", // red-600
  alignment: "NEUTRO",
  race: "DRAGAO",
};

// =============================================================================
// LISTA DE TODOS OS REGENTES
// =============================================================================

export const REGENT_TEMPLATES: RegentTemplate[] = [
  SERAPHINA,
  MALACHAR,
  IGNATHARAX,
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Busca um regente pelo código
 */
export function getRegentTemplate(code: string): RegentTemplate | undefined {
  return REGENT_TEMPLATES.find((r) => r.code === code);
}

/**
 * Lista regentes por alinhamento
 */
export function getRegentsByAlignment(alignment: Alignment): RegentTemplate[] {
  return REGENT_TEMPLATES.filter((r) => r.alignment === alignment);
}

/**
 * Retorna os atributos totais do regente (soma)
 * Regentes devem ter soma = 30
 */
export function getRegentTotalAttributes(regent: RegentTemplate): number {
  return (
    regent.combat + regent.speed + regent.focus + regent.armor + regent.vitality
  );
}

/**
 * Valida se os atributos do regente estão corretos
 */
export function validateRegentAttributes(regent: RegentTemplate): {
  valid: boolean;
  total: number;
  expected: number;
} {
  const total = getRegentTotalAttributes(regent);
  const expected = 30; // Regentes têm 30 pontos de atributo
  return { valid: total === expected, total, expected };
}

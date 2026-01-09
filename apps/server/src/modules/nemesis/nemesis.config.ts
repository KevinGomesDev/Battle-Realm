// server/src/modules/nemesis/nemesis.config.ts
// Configurações e dados estáticos do sistema Nemesis

import type {
  NemesisRank,
  NemesisRankConfig,
  NemesisSystemConfig,
  PersonalityTrait,
  NemesisTaunt,
  TauntContext,
  NemesisEventType,
  NemesisFear,
  NemesisStrength,
  ScarType,
} from "@boundless/shared/types/nemesis.types";

// =============================================================================
// CONFIGURAÇÃO DO SISTEMA
// =============================================================================

export const NEMESIS_CONFIG: NemesisSystemConfig = {
  promotionChanceOnKill: 0.6, // 60% de chance ao matar unidade do jogador
  survivalChanceOnDefeat: 0.4, // 40% de chance de sobreviver à derrota
  maxActiveNemesesPerPlayer: 8, // Máximo de Nemesis ativos
  minTimeBetweenEncounters: 1000 * 60 * 5, // 5 minutos entre encontros
  nemesisXpMultiplier: 2.5, // 2.5x XP ao derrotar
  specialLootChance: 0.3, // 30% de loot especial
};

// =============================================================================
// CONFIGURAÇÃO DE RANKS
// =============================================================================

export const NEMESIS_RANKS: Record<NemesisRank, NemesisRankConfig> = {
  GRUNT: {
    rank: "GRUNT",
    minPowerLevel: 1,
    maxPowerLevel: 10,
    statMultiplier: 1.0,
    followerCount: 0,
    titlePrefix: ["", "Aspirante", "Novato"],
  },
  CAPTAIN: {
    rank: "CAPTAIN",
    minPowerLevel: 11,
    maxPowerLevel: 25,
    statMultiplier: 1.25,
    followerCount: 3,
    titlePrefix: ["Capitão", "Líder", "Comandante"],
  },
  ELITE: {
    rank: "ELITE",
    minPowerLevel: 26,
    maxPowerLevel: 45,
    statMultiplier: 1.5,
    followerCount: 5,
    titlePrefix: ["Elite", "Campeão", "Veterano"],
  },
  WARLORD: {
    rank: "WARLORD",
    minPowerLevel: 46,
    maxPowerLevel: 70,
    statMultiplier: 1.8,
    followerCount: 8,
    titlePrefix: ["Senhor da Guerra", "Terror", "Flagelo"],
  },
  OVERLORD: {
    rank: "OVERLORD",
    minPowerLevel: 71,
    maxPowerLevel: 100,
    statMultiplier: 2.2,
    followerCount: 12,
    titlePrefix: ["Overlord", "Destruidor", "Soberano"],
  },
};

// =============================================================================
// NOMES E TÍTULOS
// =============================================================================

/** Prefixos de nome baseados em traços */
export const NAME_PREFIXES_BY_TRAIT: Partial<
  Record<PersonalityTrait, string[]>
> = {
  BERSERKER: ["Fúria", "Sangue", "Raiva"],
  CUNNING: ["Sombra", "Astuto", "Ardil"],
  PRIDEFUL: ["Grande", "Glorioso", "Magno"],
  SADISTIC: ["Cruel", "Tortura", "Dor"],
  VENGEFUL: ["Vingança", "Rancor", "Ódio"],
  COWARD: ["Rato", "Fugaz", "Sombrio"],
  HONORABLE: ["Leal", "Nobre", "Justo"],
  TREACHEROUS: ["Traidor", "Víbora", "Punhal"],
  FANATIC: ["Fanático", "Devoto", "Zelote"],
  SURVIVOR: ["Persistente", "Teimoso", "Imortal"],
};

/** Sufixos de nome baseados em scars */
export const NAME_SUFFIXES_BY_SCAR: Partial<Record<ScarType, string[]>> = {
  BURN_FACE: ["Queimado", "Cara-de-Cinzas", "Chamuscado"],
  BURN_BODY: ["o Queimado", "das Cinzas", "do Fogo"],
  MISSING_EYE: ["Zarolho", "Um-Olho", "Ciclope"],
  SLASH_FACE: ["Cicatriz", "Cortado", "Retalho"],
  BROKEN_HORN: ["Chifre-Quebrado", "Sem-Chifre", "o Mutilado"],
  METAL_PLATE: ["Cara-de-Ferro", "Placa", "o Remendado"],
  STITCHES: ["Costurado", "Remendado", "Frankenstein"],
  LIMP: ["Manco", "Pé-Torto", "o Claudicante"],
};

/** Nomes base genéricos */
export const BASE_NAMES: string[] = [
  // Nomes Brutais
  "Grishnak",
  "Muzgash",
  "Krimpul",
  "Thakûrz",
  "Boldog",
  "Azog",
  "Lurtz",
  "Uglúk",
  "Gorbag",
  "Shagrat",
  // Nomes Sombrios
  "Mordak",
  "Vorkul",
  "Dreth",
  "Skarn",
  "Krazak",
  "Thulok",
  "Grimak",
  "Brakka",
  "Zorgul",
  "Ghashnak",
  // Nomes Selvagens
  "Ragnar",
  "Wulfgar",
  "Throk",
  "Skarr",
  "Grukk",
  "Borgul",
  "Snaga",
  "Maugar",
  "Krosh",
  "Durnak",
];

/** Títulos conquistados por feitos */
export const TITLES_BY_ACHIEVEMENT: Record<string, string[]> = {
  KILL_HERO: ["Matador de Heróis", "Terror dos Campeões", "Carrasco"],
  KILL_REGENT: ["Regicida", "Destruidor de Reinos", "O Usurpador"],
  MANY_KILLS: ["Açougueiro", "Colecionador de Crânios", "Ceifador"],
  SURVIVED_MANY: ["O Imortal", "Que Não Morre", "O Persistente"],
  ESCAPED_MANY: ["O Elusivo", "Sombra", "Fantasma"],
  AMBUSH_MASTER: ["Emboscador", "Caçador", "Predador"],
};

// =============================================================================
// MAPEAMENTO DE CONSEQUÊNCIAS
// =============================================================================

/** Medos ganhos baseado no tipo de dano recebido */
export const FEAR_FROM_DAMAGE: Record<string, NemesisFear> = {
  FIRE: "FIRE",
  MAGICAL: "MAGIC",
  PHYSICAL: "MELEE",
};

/** Forças desenvolvidas após sobreviver a algo */
export const STRENGTH_FROM_SURVIVAL: Record<string, NemesisStrength> = {
  FIRE: "FIRE_PROOF",
  MAGICAL: "MAGIC_RESISTANT",
  PHYSICAL: "THICK_SKIN",
};

/** Cicatrizes por tipo de dano */
export const SCAR_FROM_DAMAGE: Record<string, ScarType[]> = {
  FIRE: ["BURN_FACE", "BURN_BODY"],
  PHYSICAL: ["SLASH_FACE", "MISSING_EYE", "STITCHES"],
  MAGICAL: ["METAL_PLATE", "MISSING_EYE"],
};

// =============================================================================
// PROVOCAÇÕES (TAUNTS)
// =============================================================================

export const NEMESIS_TAUNTS: NemesisTaunt[] = [
  // === PRIMEIRO ENCONTRO ===
  {
    id: "first_prideful_1",
    context: "FIRST_ENCOUNTER",
    requiredTraits: ["PRIDEFUL"],
    template: "Então você é {playerName}? Esperava mais...",
    priority: 10,
  },
  {
    id: "first_berserker_1",
    context: "FIRST_ENCOUNTER",
    requiredTraits: ["BERSERKER"],
    template: "SANGUE! Preciso do seu SANGUE!",
    priority: 10,
  },
  {
    id: "first_cunning_1",
    context: "FIRST_ENCOUNTER",
    requiredTraits: ["CUNNING"],
    template: "Finalmente nos encontramos... Preparei algo especial para você.",
    priority: 10,
  },
  {
    id: "first_generic_1",
    context: "FIRST_ENCOUNTER",
    template: "Você vai se lembrar do meu nome: {nemesisName}!",
    priority: 5,
  },

  // === VINGANÇA (voltando após derrota) ===
  {
    id: "revenge_scar_1",
    context: "REVENGE_ENCOUNTER",
    template: "Lembra disso? *aponta para {scarType}* EU LEMBRO!",
    priority: 15,
  },
  {
    id: "revenge_vengeful_1",
    context: "REVENGE_ENCOUNTER",
    requiredTraits: ["VENGEFUL"],
    template: "Noites sem dormir pensando neste momento... É HORA DA VINGANÇA!",
    priority: 12,
  },
  {
    id: "revenge_survivor_1",
    context: "REVENGE_ENCOUNTER",
    requiredTraits: ["SURVIVOR"],
    template:
      "Achou que estava morto? Vou precisar de mais que isso para morrer!",
    priority: 10,
  },
  {
    id: "revenge_generic_1",
    context: "REVENGE_ENCOUNTER",
    template: "Voltei, {playerName}. E desta vez, só um de nós sai vivo.",
    priority: 5,
  },

  // === AO MATAR UNIDADE DO JOGADOR ===
  {
    id: "kill_sadistic_1",
    context: "KILLING_BLOW",
    requiredTraits: ["SADISTIC"],
    template: "Ahhh... O som dos ossos quebrando... Música para meus ouvidos!",
    priority: 10,
  },
  {
    id: "kill_prideful_1",
    context: "KILLING_BLOW",
    requiredTraits: ["PRIDEFUL"],
    template: "Muito fácil! Mande alguém à altura da próxima vez!",
    priority: 10,
  },
  {
    id: "kill_count_1",
    context: "KILLING_BLOW",
    template: "Esse faz {killCount}. Quem será o próximo?",
    priority: 5,
  },

  // === AO SER FERIDO ===
  {
    id: "wound_berserker_1",
    context: "BEING_WOUNDED",
    requiredTraits: ["BERSERKER"],
    template: "HAHAHA! ISSO! ME FAZ MAIS FORTE!",
    priority: 10,
  },
  {
    id: "wound_coward_1",
    context: "BEING_WOUNDED",
    requiredTraits: ["COWARD"],
    template: "Isso... isso dói! Você vai pagar por isso!",
    priority: 10,
  },
  {
    id: "wound_honorable_1",
    context: "BEING_WOUNDED",
    requiredTraits: ["HONORABLE"],
    template: "Bom golpe. Você luta bem.",
    priority: 10,
  },

  // === HP BAIXO ===
  {
    id: "low_coward_1",
    context: "LOW_HEALTH",
    requiredTraits: ["COWARD"],
    template: "Não vale a pena morrer aqui... NOS VEREMOS DE NOVO!",
    priority: 10,
  },
  {
    id: "low_fanatic_1",
    context: "LOW_HEALTH",
    requiredTraits: ["FANATIC"],
    template: "A morte não significa nada! Minha causa é ETERNA!",
    priority: 10,
  },
  {
    id: "low_survivor_1",
    context: "LOW_HEALTH",
    requiredTraits: ["SURVIVOR"],
    template: "Já estive pior... Não é assim que eu morro!",
    priority: 10,
  },

  // === FUGINDO ===
  {
    id: "flee_coward_1",
    context: "FLEEING",
    requiredTraits: ["COWARD"],
    template: "Voltarei com reforços! MUITOS REFORÇOS!",
    priority: 10,
  },
  {
    id: "flee_cunning_1",
    context: "FLEEING",
    requiredTraits: ["CUNNING"],
    template: "Isso não acabou... Apenas começou.",
    priority: 10,
  },
  {
    id: "flee_generic_1",
    context: "FLEEING",
    template: "Nos veremos novamente, {playerName}!",
    priority: 5,
  },

  // === JOGADOR FUGINDO ===
  {
    id: "player_flee_prideful_1",
    context: "PLAYER_FLEEING",
    requiredTraits: ["PRIDEFUL"],
    template: "CORRA! Corra e conte a todos sobre {nemesisName}!",
    priority: 10,
  },
  {
    id: "player_flee_sadistic_1",
    context: "PLAYER_FLEEING",
    requiredTraits: ["SADISTIC"],
    template: "O medo nos seus olhos... Delicioso!",
    priority: 10,
  },

  // === EMBOSCADA ===
  {
    id: "ambush_cunning_1",
    context: "AMBUSH",
    requiredTraits: ["CUNNING"],
    template: "Surpresa! Você realmente não me viu chegando?",
    priority: 10,
  },
  {
    id: "ambush_treacherous_1",
    context: "AMBUSH",
    requiredTraits: ["TREACHEROUS"],
    template: "Nunca confie nas sombras, {playerName}...",
    priority: 10,
  },

  // === MOSTRANDO CICATRIZ ===
  {
    id: "scar_vengeful_1",
    context: "SHOWING_SCAR",
    requiredTraits: ["VENGEFUL"],
    template:
      "*toca a cicatriz* Cada dia eu olho para isso. Cada dia eu penso em você.",
    priority: 10,
  },
  {
    id: "scar_survivor_1",
    context: "SHOWING_SCAR",
    requiredTraits: ["SURVIVOR"],
    template: "Vê isso? Me faz lembrar que sou mais forte que a morte.",
    priority: 10,
  },
];

// =============================================================================
// PROBABILIDADES
// =============================================================================

/** Pesos para traços iniciais baseado no evento de origem */
export const INITIAL_TRAIT_WEIGHTS: Record<
  NemesisEventType,
  Partial<Record<PersonalityTrait, number>>
> = {
  KILLED_PLAYER_UNIT: {
    PRIDEFUL: 3,
    SADISTIC: 2,
    BERSERKER: 2,
    CUNNING: 1,
  },
  KILLED_PLAYER_HERO: {
    PRIDEFUL: 5,
    BERSERKER: 3,
    SADISTIC: 3,
    VENGEFUL: 1,
  },
  KILLED_PLAYER_REGENT: {
    PRIDEFUL: 5,
    FANATIC: 3,
    BERSERKER: 3,
    SADISTIC: 2,
  },
  ROUTED_PLAYER: {
    PRIDEFUL: 4,
    CUNNING: 3,
    SADISTIC: 2,
  },
  AMBUSHED_PLAYER: {
    CUNNING: 5,
    TREACHEROUS: 4,
    SADISTIC: 2,
  },
  WOUNDED_BY_PLAYER: {
    VENGEFUL: 5,
    BERSERKER: 3,
    COWARD: 2,
    SURVIVOR: 2,
  },
  DEFEATED_BY_PLAYER: {
    VENGEFUL: 4,
    COWARD: 3,
    SURVIVOR: 3,
    CUNNING: 2,
  },
  HUMILIATED: {
    VENGEFUL: 5,
    BERSERKER: 3,
    COWARD: 2,
  },
  SCARED_OFF: {
    COWARD: 5,
    CUNNING: 3,
    VENGEFUL: 2,
    SURVIVOR: 2,
  },
  ESCAPED_BATTLE: {
    SURVIVOR: 4,
    COWARD: 3,
    CUNNING: 2,
  },
  PROMOTED: {
    PRIDEFUL: 3,
    CUNNING: 2,
    HONORABLE: 2,
  },
  BETRAYED_ALLY: {
    TREACHEROUS: 5,
    CUNNING: 3,
    COWARD: 2,
  },
  RECRUITED_FOLLOWERS: {
    CUNNING: 3,
    PRIDEFUL: 3,
    HONORABLE: 2,
  },
};

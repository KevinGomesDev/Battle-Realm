// shared/config/global.config.ts
// Configuração global centralizada do jogo
// Altere valores aqui para ajustar o balanceamento globalmente

// =============================================================================
// NOMES DOS ATRIBUTOS
// =============================================================================
// Altere aqui para mudar o nome dos atributos em toda a aplicação

export type AttributeKey = "combat" | "acuity" | "focus" | "armor" | "vitality";

export interface AttributeDefinition {
  key: AttributeKey;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  color: string;
}

export const ATTRIBUTE_NAMES: Record<AttributeKey, AttributeDefinition> = {
  combat: {
    key: "combat",
    name: "Combate",
    shortName: "COM",
    icon: "⚔️",
    description: "Determina dados de ataque e dano. Dano = Sucessos × Combate.",
    color: "text-red-400",
  },
  acuity: {
    key: "acuity",
    name: "Acuidade",
    shortName: "ACU",
    icon: "👁️",
    description:
      "Dados de defesa e movimento. Defesa = Sucessos × (Acuidade ÷ 2).",
    color: "text-blue-400",
  },
  focus: {
    key: "focus",
    name: "Foco",
    shortName: "FOC",
    icon: "🎯",
    description: "Poder mágico. Proteção Mágica = Foco × 4. Usado para magias.",
    color: "text-purple-400",
  },
  armor: {
    key: "armor",
    name: "Armadura",
    shortName: "ARM",
    icon: "🛡️",
    description:
      "Redução de dano físico. Proteção Física = Armadura × 4. Absorve dano antes do HP.",
    color: "text-amber-400",
  },
  vitality: {
    key: "vitality",
    name: "Vitalidade",
    shortName: "VIT",
    icon: "❤️",
    description: "Pontos de vida. HP Máximo = Vitalidade × 2.",
    color: "text-green-400",
  },
};

/** Helper para obter o nome de um atributo */
export function getAttributeName(key: AttributeKey): string {
  return ATTRIBUTE_NAMES[key].name;
}

/** Helper para obter definição completa de um atributo */
export function getAttributeDefinition(key: AttributeKey): AttributeDefinition {
  return ATTRIBUTE_NAMES[key];
}

/** Lista de todas as chaves de atributos */
export const ALL_ATTRIBUTE_KEYS: AttributeKey[] = [
  "combat",
  "acuity",
  "focus",
  "armor",
  "vitality",
];

// =============================================================================
// NOMES DOS RECURSOS
// =============================================================================
// Altere aqui para mudar o nome dos recursos em toda a aplicação

export type ResourceKey =
  | "ore"
  | "supplies"
  | "arcane"
  | "experience"
  | "devotion";

export interface ResourceDefinition {
  key: ResourceKey;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  color: string;
}

export const RESOURCE_NAMES: Record<ResourceKey, ResourceDefinition> = {
  ore: {
    key: "ore",
    name: "Minério",
    shortName: "MIN",
    icon: "⛏️",
    description: "Recurso básico para construção e equipamentos.",
    color: "text-amber-400",
  },
  supplies: {
    key: "supplies",
    name: "Suprimentos",
    shortName: "SUP",
    icon: "📦",
    description: "Mantimentos e provisões para as tropas.",
    color: "text-green-400",
  },
  arcane: {
    key: "arcane",
    name: "Arcano",
    shortName: "ARC",
    icon: "✨",
    description: "Energia mágica para habilidades e feitiços.",
    color: "text-purple-400",
  },
  experience: {
    key: "experience",
    name: "Experiência",
    shortName: "EXP",
    icon: "⭐",
    description: "Pontos de experiência para evolução.",
    color: "text-blue-400",
  },
  devotion: {
    key: "devotion",
    name: "Devoção",
    shortName: "DEV",
    icon: "🙏",
    description: "Fé e poder divino para habilidades sagradas.",
    color: "text-yellow-400",
  },
};

/** Helper para obter o nome de um recurso */
export function getResourceName(key: ResourceKey): string {
  return RESOURCE_NAMES[key].name;
}

/** Helper para obter definição completa de um recurso */
export function getResourceDefinition(key: ResourceKey): ResourceDefinition {
  return RESOURCE_NAMES[key];
}

/** Lista de todas as chaves de recursos */
export const ALL_RESOURCE_KEYS: ResourceKey[] = [
  "ore",
  "supplies",
  "arcane",
  "experience",
  "devotion",
];

// =============================================================================
// TIPOS BÁSICOS
// =============================================================================

// Tipos básicos definidos localmente para evitar dependência circular
export type TerritorySize = "SMALL" | "MEDIUM" | "LARGE";
export type WeatherType =
  | "SUNNY"
  | "RAIN"
  | "STORM"
  | "SNOW"
  | "BLIZZARD"
  | "FALLING_LEAVES";
export type BattleTerrainType =
  | "FOREST"
  | "PLAINS"
  | "MOUNTAIN"
  | "DESERT"
  | "ICE"
  | "WASTELAND"
  | "SWAMP"
  | "RUINS";

// =============================================================================
// CONFIGURAÇÃO DE CLIMA (WEATHER)
// =============================================================================

export interface WeatherDefinition {
  code: WeatherType;
  name: string;
  description: string;
  emoji: string;
  effect: string;
  cssFilter: string;
}

export const WEATHER_CONFIG = {
  definitions: {
    SUNNY: {
      code: "SUNNY" as WeatherType,
      name: "Ensolarado",
      description: "Um dia claro e agradável.",
      emoji: "☀️",
      effect: "Nenhum efeito.",
      cssFilter: "",
    },
    RAIN: {
      code: "RAIN" as WeatherType,
      name: "Chuva",
      description: "O chão fica escorregadio.",
      emoji: "🌧️",
      effect: "Ao falhar uma ação, a unidade fica Derrubada.",
      cssFilter: "brightness(0.85) saturate(0.9) hue-rotate(200deg)",
    },
    STORM: {
      code: "STORM" as WeatherType,
      name: "Tempestade",
      description: "Ventos poderosos e chão escorregadio.",
      emoji: "⛈️",
      effect:
        "Ao falhar uma ação, a unidade fica Derrubada e precisa gastar uma ação para se levantar.",
      cssFilter: "brightness(0.7) saturate(0.8) contrast(1.1)",
    },
    SNOW: {
      code: "SNOW" as WeatherType,
      name: "Neve",
      description: "A neve traz um frio ancestral.",
      emoji: "🌨️",
      effect: "Ao falhar uma ação, a unidade recebe 2 de Dano Verdadeiro.",
      cssFilter: "brightness(1.1) saturate(0.7) hue-rotate(180deg)",
    },
    BLIZZARD: {
      code: "BLIZZARD" as WeatherType,
      name: "Nevasca",
      description:
        "A nevasca é tão poderosa quanto o mais temido dos Generais.",
      emoji: "❄️",
      effect: "Ao falhar uma ação, a unidade recebe 4 de Dano Verdadeiro.",
      cssFilter: "brightness(1.2) saturate(0.5) contrast(0.9)",
    },
    FALLING_LEAVES: {
      code: "FALLING_LEAVES" as WeatherType,
      name: "Folhas Caindo",
      description: "Uma misteriosa força está afetando a batalha.",
      emoji: "🍂",
      effect:
        "Ao falhar uma ação, a unidade é movida para um lugar aleatório do campo de batalha.",
      cssFilter: "sepia(0.3) brightness(0.95)",
    },
  } as Record<WeatherType, WeatherDefinition>,
} as const;

// Aliases para compatibilidade
export const WEATHER_DEFINITIONS = WEATHER_CONFIG.definitions;
export const ALL_WEATHER_TYPES: WeatherType[] = Object.keys(
  WEATHER_CONFIG.definitions
) as WeatherType[];

export function getWeatherDefinition(weather: WeatherType): WeatherDefinition {
  return WEATHER_CONFIG.definitions[weather];
}

export function getRandomWeather(): WeatherType {
  const index = Math.floor(Math.random() * ALL_WEATHER_TYPES.length);
  return ALL_WEATHER_TYPES[index];
}

// =============================================================================
// CONFIGURAÇÃO DE TERRENO (TERRAIN)
// =============================================================================

export interface BattleTerrainDefinition {
  code: BattleTerrainType;
  name: string;
  obstacleEmoji: string;
  obstacleAlt: string;
}

export const TERRAIN_CONFIG = {
  definitions: {
    FOREST: {
      code: "FOREST" as BattleTerrainType,
      name: "Floresta",
      obstacleEmoji: "🌲",
      obstacleAlt: "🌳",
    },
    PLAINS: {
      code: "PLAINS" as BattleTerrainType,
      name: "Planície",
      obstacleEmoji: "🪨",
      obstacleAlt: "🌾",
    },
    MOUNTAIN: {
      code: "MOUNTAIN" as BattleTerrainType,
      name: "Montanha",
      obstacleEmoji: "🗻",
      obstacleAlt: "⛰️",
    },
    DESERT: {
      code: "DESERT" as BattleTerrainType,
      name: "Deserto",
      obstacleEmoji: "🌵",
      obstacleAlt: "🏜️",
    },
    ICE: {
      code: "ICE" as BattleTerrainType,
      name: "Gelo",
      obstacleEmoji: "🧊",
      obstacleAlt: "❄️",
    },
    WASTELAND: {
      code: "WASTELAND" as BattleTerrainType,
      name: "Terra Devastada",
      obstacleEmoji: "💀",
      obstacleAlt: "🦴",
    },
    SWAMP: {
      code: "SWAMP" as BattleTerrainType,
      name: "Pântano",
      obstacleEmoji: "🐸",
      obstacleAlt: "🌿",
    },
    RUINS: {
      code: "RUINS" as BattleTerrainType,
      name: "Ruínas",
      obstacleEmoji: "🏚️",
      obstacleAlt: "🪦",
    },
  } as Record<BattleTerrainType, BattleTerrainDefinition>,
} as const;

// Aliases para compatibilidade
export const BATTLE_TERRAIN_DEFINITIONS = TERRAIN_CONFIG.definitions;
export const ALL_TERRAIN_TYPES: BattleTerrainType[] = Object.keys(
  TERRAIN_CONFIG.definitions
) as BattleTerrainType[];

export function getTerrainDefinition(
  terrain: BattleTerrainType
): BattleTerrainDefinition {
  return TERRAIN_CONFIG.definitions[terrain];
}

export function getRandomTerrain(): BattleTerrainType {
  const index = Math.floor(Math.random() * ALL_TERRAIN_TYPES.length);
  return ALL_TERRAIN_TYPES[index];
}

// =============================================================================
// CONFIGURAÇÃO DE TAMANHO DE TERRITÓRIO
// =============================================================================

export const TERRITORY_SIZE_CONFIG = {
  /** Lista de todos os tamanhos disponíveis */
  allSizes: ["SMALL", "MEDIUM", "LARGE"] as TerritorySize[],
} as const;

// Alias para compatibilidade
export const ALL_TERRITORY_SIZES = TERRITORY_SIZE_CONFIG.allSizes;

export function getRandomTerritorySize(): TerritorySize {
  const index = Math.floor(Math.random() * ALL_TERRITORY_SIZES.length);
  return ALL_TERRITORY_SIZES[index];
}

// =============================================================================
// CONFIGURAÇÃO DE ATAQUE
// =============================================================================

export const ATTACK_CONFIG = {
  /**
   * Atributo usado para determinar quantidade de dados no ataque
   * Valores possíveis: "combat" | "acuity" | "focus"
   */
  attribute: "combat" as const,

  /**
   * Multiplicador de dano por sucesso
   * Fórmula: Sucessos * (Atributo * multiplier)
   * Ex: multiplier = 1 significa Sucessos * Combat
   */
  damageMultiplier: 1,

  /**
   * Mínimo de dados para rolar (mesmo com atributo 0)
   */
  minDice: 1,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE DEFESA
// =============================================================================

export const DEFENSE_CONFIG = {
  /**
   * Atributo usado para determinar quantidade de dados na defesa
   * Valores possíveis: "combat" | "acuity" | "focus"
   */
  attribute: "acuity" as const,

  /**
   * Divisor para calcular redução de dano
   * Fórmula: Sucessos * (Atributo / divisor)
   * Ex: divisor = 2 significa Sucessos * (Acuity / 2)
   */
  reductionDivisor: 2,

  /**
   * Mínimo de multiplicador de redução (floor)
   * Evita que atributo muito baixo dê 0 de redução por sucesso
   */
  minReductionMultiplier: 0.5,

  /**
   * Mínimo de dados para rolar (mesmo com atributo 0)
   */
  minDice: 1,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE PROTEÇÃO FÍSICA
// =============================================================================

export const PHYSICAL_PROTECTION_CONFIG = {
  /**
   * Atributo base para calcular proteção física
   */
  attribute: "armor" as const,

  /**
   * Multiplicador do atributo
   * Fórmula: Atributo * multiplier
   * Ex: Armor * 4
   */
  multiplier: 2,

  /**
   * Tipos de dano que usam proteção física primeiro
   */
  absorbsDamageTypes: ["FISICO"] as const,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE PROTEÇÃO MÁGICA
// =============================================================================

export const MAGICAL_PROTECTION_CONFIG = {
  /**
   * Atributo base para calcular proteção mágica
   */
  attribute: "focus" as const,

  /**
   * Multiplicador do atributo
   * Fórmula: Atributo * multiplier
   * Ex: Focus * 4
   */
  multiplier: 2,

  /**
   * Tipos de dano que usam proteção mágica primeiro
   */
  absorbsDamageTypes: ["MAGICO"] as const,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE HP
// =============================================================================

export const HP_CONFIG = {
  /**
   * Atributo base para calcular HP máximo
   */
  attribute: "vitality" as const,

  /**
   * Multiplicador do atributo
   * Fórmula: Atributo * multiplier
   * Ex: Vitality * 2
   */
  multiplier: 1,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE TURNO
// =============================================================================

export const TURN_CONFIG = {
  /**
   * Tempo máximo de um turno em segundos
   * Quando o timer chega a 0, o turno avança automaticamente
   */
  timerSeconds: 30,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE OBSTÁCULOS
// =============================================================================

export const OBSTACLE_CONFIG = {
  /**
   * HP padrão de obstáculos (rochas, árvores, etc)
   */
  defaultHp: 5,

  /**
   * HP de cadáveres (corpos de unidades mortas)
   * Se undefined, cadáveres não são considerados obstáculos
   */
  corpseHp: 5,

  /**
   * Se true, cadáveres bloqueiam movimento como obstáculos
   */
  corpseBlocksMovement: true,

  /**
   * Range de quantidade de obstáculos por tamanho de território
   */
  ranges: {
    SMALL: { min: 1, max: 6 },
    MEDIUM: { min: 1, max: 12 },
    LARGE: { min: 1, max: 18 },
  } as Record<TerritorySize, { min: number; max: number }>,
} as const;

/**
 * Gera quantidade aleatória de obstáculos baseado no tamanho
 */
export function getObstacleCount(size: TerritorySize): number {
  const range = OBSTACLE_CONFIG.ranges[size];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// =============================================================================
// CONFIGURAÇÃO DO GRID DE BATALHA
// =============================================================================

export const GRID_CONFIG = {
  /**
   * Tamanhos de grid baseados no tamanho do território
   */
  territorySizes: {
    SMALL: { width: 16, height: 16 },
    MEDIUM: { width: 32, height: 32 },
    LARGE: { width: 64, height: 64 },
  },

  /**
   * Tamanhos disponíveis para sorteio em Arena
   */
  arenaSizes: ["SMALL", "MEDIUM", "LARGE"] as const,

  /**
   * Tamanho padrão se nenhum for especificado
   */
  defaultSize: "MEDIUM" as const,
} as const;

/**
 * Obtém as dimensões do grid baseado no tamanho do território
 */
export function getGridDimensions(
  territorySize: keyof typeof GRID_CONFIG.territorySizes
): { width: number; height: number } {
  return GRID_CONFIG.territorySizes[territorySize];
}

/**
 * Obtém um tamanho de território aleatório para Arena
 */
export function getRandomArenaSize(): keyof typeof GRID_CONFIG.territorySizes {
  const sizes = GRID_CONFIG.arenaSizes;
  return sizes[Math.floor(Math.random() * sizes.length)];
}

// =============================================================================
// CONFIGURAÇÃO DE CORES DA ARENA/BATALHA
// =============================================================================

export const ARENA_COLORS = {
  // Grid/Mapa
  gridBackground: "#1a1a2e",
  gridLine: "#16213e",
  gridDot: "#0f3460",
  cellLight: "#2d2d44",
  cellDark: "#1f1f33",
  cellHover: "#3d3d5c",
  cellMovable: "#2a4a2a",
  cellAttackable: "#4a2a2a",
  // Jogadores
  hostPrimary: "#4a90d9",
  hostSecondary: "#2d5a8a",
  guestPrimary: "#d94a4a",
  guestSecondary: "#8a2d2d",
} as const;

// =============================================================================
// CONFIGURAÇÃO DE MOVIMENTO
// =============================================================================

export const MOVEMENT_CONFIG = {
  /**
   * Atributo base para calcular movimento
   */
  attribute: "acuity" as const,

  /**
   * Divisor do atributo (1 = valor completo, 2 = metade)
   * Fórmula: floor(Atributo / divisor)
   */
  divisor: 1,

  /**
   * Mínimo de movimento (mesmo com atributo 0)
   */
  minMovement: 1,
} as const;

// =============================================================================
// TIPOS DE DANO
// =============================================================================

export const DAMAGE_TYPES = {
  FISICO: {
    name: "Físico",
    usesProtection: "physical" as const,
  },
  MAGICO: {
    name: "Mágico",
    usesProtection: "magical" as const,
  },
  VERDADEIRO: {
    name: "Verdadeiro",
    usesProtection: null, // Ignora proteções
  },
} as const;

export type DamageTypeName = keyof typeof DAMAGE_TYPES;

// =============================================================================
// CONFIGURAÇÃO DE DADOS D6
// =============================================================================

export const DICE_CONFIG = {
  /**
   * Faces do dado
   */
  sides: 6,

  /**
   * Threshold base para sucesso (sucesso se >= threshold)
   * Com advantage/disadvantage isso muda
   */
  baseSuccessThreshold: 4,

  /**
   * Valor que explode (rola dado adicional)
   */
  explosionValue: 6,

  /**
   * Explosões são recursivas?
   */
  recursiveExplosions: true,
} as const;

// =============================================================================
// HELPER: Obter valor do atributo por nome
// =============================================================================

export type AttributeName =
  | "combat"
  | "acuity"
  | "focus"
  | "armor"
  | "vitality";

export interface UnitAttributes {
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
}

/**
 * Obtém o valor de um atributo de uma unidade pelo nome
 */
export function getAttributeValue(
  unit: UnitAttributes,
  attributeName: AttributeName
): number {
  return unit[attributeName] ?? 0;
}

// =============================================================================
// HELPERS: Cálculos usando configuração
// =============================================================================

/**
 * Calcula quantidade de dados de ataque
 */
export function getAttackDiceCount(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(unit, ATTACK_CONFIG.attribute);
  return Math.max(ATTACK_CONFIG.minDice, attrValue);
}

/**
 * Calcula quantidade de dados de defesa
 */
export function getDefenseDiceCount(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(unit, DEFENSE_CONFIG.attribute);
  return Math.max(DEFENSE_CONFIG.minDice, attrValue);
}

/**
 * Calcula dano bruto a partir de sucessos
 */
export function calculateDamage(
  successes: number,
  unit: UnitAttributes
): number {
  const attrValue = getAttributeValue(unit, ATTACK_CONFIG.attribute);
  return Math.max(0, successes * attrValue * ATTACK_CONFIG.damageMultiplier);
}

/**
 * Calcula redução de dano a partir de sucessos de defesa
 */
export function calculateDefenseReduction(
  successes: number,
  unit: UnitAttributes
): number {
  const attrValue = getAttributeValue(unit, DEFENSE_CONFIG.attribute);
  const multiplier = Math.max(
    DEFENSE_CONFIG.minReductionMultiplier,
    attrValue / DEFENSE_CONFIG.reductionDivisor
  );
  return Math.max(0, Math.floor(successes * multiplier));
}

/**
 * Calcula proteção física inicial
 */
export function calculatePhysicalProtection(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(
    unit,
    PHYSICAL_PROTECTION_CONFIG.attribute
  );
  return Math.max(0, attrValue * PHYSICAL_PROTECTION_CONFIG.multiplier);
}

/**
 * Calcula proteção mágica inicial
 */
export function calculateMagicalProtection(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(
    unit,
    MAGICAL_PROTECTION_CONFIG.attribute
  );
  return Math.max(0, attrValue * MAGICAL_PROTECTION_CONFIG.multiplier);
}

/**
 * Calcula HP máximo
 */
export function calculateMaxHp(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(unit, HP_CONFIG.attribute);
  return Math.max(1, attrValue * HP_CONFIG.multiplier);
}

/**
 * Calcula movimento base
 */
export function calculateMovement(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(unit, MOVEMENT_CONFIG.attribute);
  const movement = Math.floor(attrValue / MOVEMENT_CONFIG.divisor);
  return Math.max(MOVEMENT_CONFIG.minMovement, movement);
}

// =============================================================================
// EXPORT CONSOLIDADO
// =============================================================================

export const GLOBAL_CONFIG = {
  attack: ATTACK_CONFIG,
  defense: DEFENSE_CONFIG,
  physicalProtection: PHYSICAL_PROTECTION_CONFIG,
  magicalProtection: MAGICAL_PROTECTION_CONFIG,
  hp: HP_CONFIG,
  turn: TURN_CONFIG,
  obstacle: OBSTACLE_CONFIG,
  grid: GRID_CONFIG,
  arenaColors: ARENA_COLORS,
  movement: MOVEMENT_CONFIG,
  damageTypes: DAMAGE_TYPES,
  dice: DICE_CONFIG,
  weather: WEATHER_CONFIG,
  terrain: TERRAIN_CONFIG,
  territorySize: TERRITORY_SIZE_CONFIG,
} as const;

export default GLOBAL_CONFIG;

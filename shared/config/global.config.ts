// shared/config/global.config.ts
// Configuração global centralizada do jogo
// Altere valores aqui para ajustar o balanceamento globalmente

// =============================================================================
// NOMES DOS ATRIBUTOS
// =============================================================================
// Altere aqui para mudar o nome dos atributos em toda a aplicação

export type AttributeKey = "combat" | "speed" | "focus" | "armor" | "vitality";

export interface AttributeDefinition {
  key: AttributeKey;
  name: string;
  shortName: string;
  description: string;
}

export const ATTRIBUTE_NAMES: Record<AttributeKey, AttributeDefinition> = {
  combat: {
    key: "combat",
    name: "Combate",
    shortName: "COM",
    description: "Determina dados de ataque e dano. Dano = Sucessos × Combate.",
  },
  speed: {
    key: "speed",
    name: "Velocidade",
    shortName: "VEL",
    description:
      "Determina chance de esquiva e movimento. Esquiva = Speed × 3%.",
  },
  focus: {
    key: "focus",
    name: "Foco",
    shortName: "FOC",
    description: "Poder mágico. Proteção Mágica = Foco × 4. Usado para magias.",
  },
  armor: {
    key: "armor",
    name: "Armadura",
    shortName: "ARM",
    description:
      "Redução de dano físico. Proteção Física = Armadura × 4. Absorve dano antes do HP.",
  },
  vitality: {
    key: "vitality",
    name: "Vitalidade",
    shortName: "VIT",
    description: "Pontos de vida. HP Máximo = Vitalidade × 2.",
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
  "speed",
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
}

export const RESOURCE_NAMES: Record<ResourceKey, ResourceDefinition> = {
  ore: {
    key: "ore",
    name: "Minério",
    shortName: "MIN",
    icon: "⛏️",
    description: "Recurso básico para construção e equipamentos.",
  },
  supplies: {
    key: "supplies",
    name: "Suprimentos",
    shortName: "SUP",
    icon: "📦",
    description: "Mantimentos e provisões para as tropas.",
  },
  arcane: {
    key: "arcane",
    name: "Arcano",
    shortName: "ARC",
    icon: "✨",
    description: "Energia mágica para habilidades e feitiços.",
  },
  experience: {
    key: "experience",
    name: "Experiência",
    shortName: "EXP",
    icon: "⭐",
    description: "Pontos de experiência para evolução.",
  },
  devotion: {
    key: "devotion",
    name: "Devoção",
    shortName: "DEV",
    icon: "🙏",
    description: "Fé e poder divino para habilidades sagradas.",
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

// =============================================================================
// TAMANHO DE UNIDADES (BATTLE ONLY)
// =============================================================================

/**
 * Tamanhos de unidades para batalha
 * Define quantos blocos a unidade ocupa no grid
 */
export type UnitSize = "NORMAL" | "LARGE" | "HUGE" | "GARGANTUAN";

export interface UnitSizeDefinition {
  key: UnitSize;
  name: string;
  /** Dimensão em blocos (NxN) */
  dimension: number;
  /** Número total de células ocupadas */
  cells: number;
  /** Descrição para UI */
  description: string;
  /** Emoji para representação rápida */
  icon: string;
}

export const UNIT_SIZE_CONFIG: Record<UnitSize, UnitSizeDefinition> = {
  NORMAL: {
    key: "NORMAL",
    name: "Normal",
    dimension: 1,
    cells: 1,
    description: "Unidade de tamanho padrão (1x1)",
    icon: "👤",
  },
  LARGE: {
    key: "LARGE",
    name: "Grande",
    dimension: 2,
    cells: 4,
    description: "Unidade grande (2x2)",
    icon: "🦁",
  },
  HUGE: {
    key: "HUGE",
    name: "Enorme",
    dimension: 4,
    cells: 16,
    description: "Unidade enorme (4x4)",
    icon: "🐘",
  },
  GARGANTUAN: {
    key: "GARGANTUAN",
    name: "Colossal",
    dimension: 8,
    cells: 64,
    description: "Unidade colossal (8x8)",
    icon: "🐉",
  },
};

export const ALL_UNIT_SIZES: UnitSize[] = [
  "NORMAL",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
];

/**
 * Obtém a definição de tamanho de unidade
 */
export function getUnitSizeDefinition(size: UnitSize): UnitSizeDefinition {
  return UNIT_SIZE_CONFIG[size];
}

/**
 * Retorna todas as células ocupadas por uma unidade baseado em sua posição e tamanho
 * @param posX Posição X da unidade (canto superior esquerdo)
 * @param posY Posição Y da unidade (canto superior esquerdo)
 * @param size Tamanho da unidade
 * @returns Array de {x, y} para cada célula ocupada
 */
export function getOccupiedCells(
  posX: number,
  posY: number,
  size: UnitSize
): { x: number; y: number }[] {
  const dimension = UNIT_SIZE_CONFIG[size].dimension;
  const cells: { x: number; y: number }[] = [];

  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      cells.push({ x: posX + dx, y: posY + dy });
    }
  }

  return cells;
}

/**
 * Verifica se uma célula está ocupada por uma unidade de tamanho grande
 * @param cellX Posição X da célula a verificar
 * @param cellY Posição Y da célula a verificar
 * @param unitPosX Posição X da unidade (canto superior esquerdo)
 * @param unitPosY Posição Y da unidade (canto superior esquerdo)
 * @param unitSize Tamanho da unidade
 */
export function isCellOccupiedByUnit(
  cellX: number,
  cellY: number,
  unitPosX: number,
  unitPosY: number,
  unitSize: UnitSize
): boolean {
  const dimension = UNIT_SIZE_CONFIG[unitSize].dimension;
  return (
    cellX >= unitPosX &&
    cellX < unitPosX + dimension &&
    cellY >= unitPosY &&
    cellY < unitPosY + dimension
  );
}

// =============================================================================
// SISTEMA DE VISÃO (BATTLE ONLY)
// =============================================================================

/**
 * Configuração do sistema de visão
 */
export const VISION_CONFIG = {
  /** Visão mínima garantida para todas as unidades */
  minVision: 10,
  /** Usar Focus como base de visão (se maior que minVision) */
  usesFocus: true,
} as const;

/**
 * Calcula o alcance de visão de uma unidade
 * Visão = max(VISION_CONFIG.minVision, focus)
 */
export function calculateUnitVision(focus: number): number {
  return Math.max(VISION_CONFIG.minVision, focus);
}

/**
 * Verifica se uma célula está dentro do alcance de visão de uma unidade
 * Usa distância de Manhattan (estilo grid)
 */
export function isCellVisible(
  unitX: number,
  unitY: number,
  cellX: number,
  cellY: number,
  visionRange: number
): boolean {
  const distance = Math.abs(cellX - unitX) + Math.abs(cellY - unitY);
  return distance <= visionRange;
}

/**
 * Verifica se uma célula está dentro do alcance de visão de uma unidade (com tamanho)
 * Para unidades grandes, considera a visão a partir de qualquer célula ocupada
 */
export function isCellVisibleByUnit(
  unitPosX: number,
  unitPosY: number,
  unitSize: UnitSize,
  unitFocus: number,
  cellX: number,
  cellY: number
): boolean {
  const visionRange = calculateUnitVision(unitFocus);
  const dimension = UNIT_SIZE_CONFIG[unitSize].dimension;

  // Para cada célula ocupada pela unidade, verificar se a célula alvo está visível
  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      const checkX = unitPosX + dx;
      const checkY = unitPosY + dy;
      if (isCellVisible(checkX, checkY, cellX, cellY, visionRange)) {
        return true;
      }
    }
  }

  return false;
}

// =============================================================================
// CONFIGURAÇÃO DE TERRENO UNIFICADA
// =============================================================================
// Usado tanto no WorldMap quanto nas batalhas

/**
 * Tipos de terreno disponíveis
 */
export type TerrainType =
  | "FOREST"
  | "PLAINS"
  | "MOUNTAIN"
  | "DESERT"
  | "ICE"
  | "WASTELAND"
  | "SWAMP"
  | "RUINS"
  | "OCEAN";

/**
 * Cor RGB para uso em Canvas/WebGL
 */
export interface TerrainColor {
  hex: string; // Cor em hex (#RRGGBB)
  rgb: { r: number; g: number; b: number }; // RGB para canvas
}

/**
 * Definição completa de um tipo de terreno
 */
export interface TerrainDefinition {
  code: TerrainType;
  name: string;
  emoji: string;
  obstacleEmoji: string;
  obstacleAlt: string;
  /** Cores para o grid de batalha (variações para padrão xadrez) */
  colors: {
    primary: TerrainColor; // Célula clara
    secondary: TerrainColor; // Célula escura
    accent: TerrainColor; // Detalhes/bordas
  };
  /** Cor para o WorldMap (hex) */
  worldMapColor: number;
  /** Se pode ter batalhas neste terreno */
  allowsBattle: boolean;
}

/**
 * Configuração de todos os terrenos
 */
export const TERRAIN_CONFIG = {
  definitions: {
    FOREST: {
      code: "FOREST" as TerrainType,
      name: "Floresta",
      emoji: "🌲",
      obstacleEmoji: "🌲",
      obstacleAlt: "🌳",
      colors: {
        primary: { hex: "#2d5a3f", rgb: { r: 45, g: 90, b: 63 } },
        secondary: { hex: "#1e3d2a", rgb: { r: 30, g: 61, b: 42 } },
        accent: { hex: "#3d7a52", rgb: { r: 61, g: 122, b: 82 } },
      },
      worldMapColor: 0x2d6a4f,
      allowsBattle: true,
    },
    PLAINS: {
      code: "PLAINS" as TerrainType,
      name: "Planície",
      emoji: "🌾",
      obstacleEmoji: "🪨",
      obstacleAlt: "🌾",
      colors: {
        primary: { hex: "#7cb668", rgb: { r: 124, g: 182, b: 104 } },
        secondary: { hex: "#5a9a47", rgb: { r: 90, g: 154, b: 71 } },
        accent: { hex: "#95d5b2", rgb: { r: 149, g: 213, b: 178 } },
      },
      worldMapColor: 0x95d5b2,
      allowsBattle: true,
    },
    MOUNTAIN: {
      code: "MOUNTAIN" as TerrainType,
      name: "Montanha",
      emoji: "⛰️",
      obstacleEmoji: "🗻",
      obstacleAlt: "⛰️",
      colors: {
        primary: { hex: "#6b7b8a", rgb: { r: 107, g: 123, b: 138 } },
        secondary: { hex: "#4a5a68", rgb: { r: 74, g: 90, b: 104 } },
        accent: { hex: "#8a9aaa", rgb: { r: 138, g: 154, b: 170 } },
      },
      worldMapColor: 0x778da9,
      allowsBattle: true,
    },
    DESERT: {
      code: "DESERT" as TerrainType,
      name: "Deserto",
      emoji: "🏜️",
      obstacleEmoji: "🌵",
      obstacleAlt: "🏜️",
      colors: {
        primary: { hex: "#d4a855", rgb: { r: 212, g: 168, b: 85 } },
        secondary: { hex: "#b8923d", rgb: { r: 184, g: 146, b: 61 } },
        accent: { hex: "#e9c46a", rgb: { r: 233, g: 196, b: 106 } },
      },
      worldMapColor: 0xe9c46a,
      allowsBattle: true,
    },
    ICE: {
      code: "ICE" as TerrainType,
      name: "Gelo",
      emoji: "❄️",
      obstacleEmoji: "🧊",
      obstacleAlt: "❄️",
      colors: {
        primary: { hex: "#c5d8f0", rgb: { r: 197, g: 216, b: 240 } },
        secondary: { hex: "#a8c4e8", rgb: { r: 168, g: 196, b: 232 } },
        accent: { hex: "#dbe7ff", rgb: { r: 219, g: 231, b: 255 } },
      },
      worldMapColor: 0xdbe7ff,
      allowsBattle: true,
    },
    WASTELAND: {
      code: "WASTELAND" as TerrainType,
      name: "Terra Devastada",
      emoji: "💀",
      obstacleEmoji: "💀",
      obstacleAlt: "🦴",
      colors: {
        primary: { hex: "#5c4a3d", rgb: { r: 92, g: 74, b: 61 } },
        secondary: { hex: "#3d3229", rgb: { r: 61, g: 50, b: 41 } },
        accent: { hex: "#6c584c", rgb: { r: 108, g: 88, b: 76 } },
      },
      worldMapColor: 0x6c584c,
      allowsBattle: true,
    },
    SWAMP: {
      code: "SWAMP" as TerrainType,
      name: "Pântano",
      emoji: "🐸",
      obstacleEmoji: "🐸",
      obstacleAlt: "🌿",
      colors: {
        primary: { hex: "#4a5d4a", rgb: { r: 74, g: 93, b: 74 } },
        secondary: { hex: "#3a4d3a", rgb: { r: 58, g: 77, b: 58 } },
        accent: { hex: "#5a6d5a", rgb: { r: 90, g: 109, b: 90 } },
      },
      worldMapColor: 0x4a5d4a,
      allowsBattle: true,
    },
    RUINS: {
      code: "RUINS" as TerrainType,
      name: "Ruínas",
      emoji: "🏚️",
      obstacleEmoji: "🏚️",
      obstacleAlt: "🪦",
      colors: {
        primary: { hex: "#5a5a5a", rgb: { r: 90, g: 90, b: 90 } },
        secondary: { hex: "#3a3a3a", rgb: { r: 58, g: 58, b: 58 } },
        accent: { hex: "#7a7a7a", rgb: { r: 122, g: 122, b: 122 } },
      },
      worldMapColor: 0x5a5a5a,
      allowsBattle: true,
    },
    OCEAN: {
      code: "OCEAN" as TerrainType,
      name: "Oceano",
      emoji: "🌊",
      obstacleEmoji: "🌊",
      obstacleAlt: "🐚",
      colors: {
        primary: { hex: "#3d6a8a", rgb: { r: 61, g: 106, b: 138 } },
        secondary: { hex: "#2d5a7a", rgb: { r: 45, g: 90, b: 122 } },
        accent: { hex: "#457b9d", rgb: { r: 69, g: 123, b: 157 } },
      },
      worldMapColor: 0x457b9d,
      allowsBattle: false, // Não permite batalhas no oceano
    },
  } as Record<TerrainType, TerrainDefinition>,
} as const;

// Aliases para compatibilidade
export const TERRAIN_DEFINITIONS = TERRAIN_CONFIG.definitions;
export const ALL_TERRAIN_TYPES: TerrainType[] = Object.keys(
  TERRAIN_CONFIG.definitions
) as TerrainType[];

/** Terrenos que permitem batalhas (exclui OCEAN) */
export const BATTLE_TERRAIN_TYPES: TerrainType[] = ALL_TERRAIN_TYPES.filter(
  (t) => TERRAIN_CONFIG.definitions[t].allowsBattle
);

/**
 * Obter definição de um terreno
 */
export function getTerrainDefinition(terrain: TerrainType): TerrainDefinition {
  return TERRAIN_CONFIG.definitions[terrain];
}

/**
 * Obter terreno aleatório para batalhas (exclui OCEAN)
 */
export function getRandomTerrain(): TerrainType {
  const index = Math.floor(Math.random() * BATTLE_TERRAIN_TYPES.length);
  return BATTLE_TERRAIN_TYPES[index];
}

/**
 * Obter cores do terreno para o grid de batalha
 */
export function getTerrainColors(
  terrain: TerrainType
): TerrainDefinition["colors"] {
  return TERRAIN_CONFIG.definitions[terrain].colors;
}

// Alias legado para compatibilidade
export type BattleTerrainType = TerrainType;
export const BATTLE_TERRAIN_DEFINITIONS = TERRAIN_DEFINITIONS;

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
   * Valores possíveis: "combat" | "speed" | "focus"
   */
  attribute: "combat" as const,

  /**
   * Multiplicador de dano por sucesso
   * Fórmula: Sucessos * (Atributo * multiplier)
   * Ex: multiplier = 1 significa Sucessos * Combat
   */
  damageMultiplier: 0,

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
   * Atributo usado para determinar chance de esquiva
   * Valores possíveis: "combat" | "speed" | "focus"
   */
  attribute: "speed" as const,

  /**
   * Multiplicador de chance de esquiva
   * Fórmula: Atributo * multiplier = % de esquiva
   * Ex: Speed 5 * 3 = 15% de chance
   */
  dodgeMultiplier: 1,

  /**
   * Chance máxima de esquiva (cap)
   */
  maxDodgeChance: 75,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE DANO DE MAGIA
// =============================================================================

export type MagicDamageTier = "LOW" | "MEDIUM" | "HIGH";

export const MAGIC_DAMAGE_CONFIG: Record<MagicDamageTier, number> = {
  /**
   * Dano comum: Focus * 1.5
   */
  LOW: 2,

  /**
   * Dano alto: Focus * 2
   */
  MEDIUM: 2,

  /**
   * Dano extremo: Focus * 4
   */
  HIGH: 2,
} as const;

/**
 * Calcula dano de magia baseado no tier
 * @param focus Atributo Focus do conjurador
 * @param tier Tier do dano (LOW, MEDIUM, HIGH)
 */
export function calculateMagicDamage(
  focus: number,
  tier: MagicDamageTier
): number {
  return Math.floor(focus * MAGIC_DAMAGE_CONFIG[tier]);
}

// =============================================================================
// CONFIGURAÇÃO DE ACTION MARKS (EXAUSTÃO)
// =============================================================================

/**
 * Categorias de unidades e suas respectivas marcas máximas de ação.
 * Quando actionMarks >= maxMarks, a unidade está exausta.
 * Em Arena: unidade exausta perde 5 HP ao agir.
 * Fora de Arena: unidade exausta não pode mais agir.
 */
export type UnitCategory = "TROOP" | "HERO" | "REGENT";

export const ACTION_MARKS_CONFIG: Record<UnitCategory, number> = {
  TROOP: 1,
  HERO: 2,
  REGENT: 3,
} as const;

/**
 * Retorna o número máximo de marcas de ação por categoria de unidade.
 * @param category - Categoria da unidade (TROOP, HERO, REGENT)
 * @returns Número máximo de marcas antes de exaustão
 */
export function getMaxMarksByCategory(category: string): number {
  return ACTION_MARKS_CONFIG[category as UnitCategory] ?? 1;
}

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
  timerSeconds: 1200,
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
    SMALL: { min: 1, max: 8 },
    MEDIUM: { min: 1, max: 16 },
    LARGE: { min: 1, max: 32 },
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
  cellHover: "rgba(239, 68, 68, 0.5)", // Vermelho para hover
  cellMovable: "#2a4a2a",
  cellAttackable: "#4a2a2a",
  // Células de movimento
  cellMovableNormal: "rgba(34, 197, 94, 0.4)", // Verde - movimento normal
  cellMovableNormalBorder: "rgba(34, 197, 94, 0.8)",
  cellMovableEngagement: "rgba(251, 146, 60, 0.4)", // Laranja - com penalidade de engajamento
  cellMovableEngagementBorder: "rgba(251, 146, 60, 0.8)",
  cellMovableBlocked: "rgba(239, 68, 68, 0.4)", // Vermelho - caminho bloqueado
  cellMovableBlockedBorder: "rgba(239, 68, 68, 0.8)",
  // Cores dos jogadores (até 8)
  playerColors: [
    { primary: "#4a90d9", secondary: "#2d5a8a" }, // Azul
    { primary: "#d94a4a", secondary: "#8a2d2d" }, // Vermelho
    { primary: "#2a9d8f", secondary: "#1d6b62" }, // Verde
    { primary: "#f4a261", secondary: "#c47a3f" }, // Laranja
    { primary: "#9b59b6", secondary: "#6c3483" }, // Roxo
    { primary: "#1abc9c", secondary: "#138d75" }, // Turquesa
    { primary: "#e74c3c", secondary: "#b03a2e" }, // Vermelho escuro
    { primary: "#3498db", secondary: "#2471a3" }, // Azul claro
  ],
} as const;

// =============================================================================
// CONFIGURAÇÃO DE MOVIMENTO
// =============================================================================

export const MOVEMENT_CONFIG = {
  /**
   * Atributo base para calcular movimento
   */
  attribute: "speed" as const,

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

export type AttributeName = "combat" | "speed" | "focus" | "armor" | "vitality";

export interface UnitAttributes {
  combat: number;
  speed: number;
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
 * Calcula a chance de esquiva de uma unidade
 * Fórmula: Speed × dodgeMultiplier (cap: maxDodgeChance)
 */
export function getDodgeChance(unit: UnitAttributes): number {
  const speed = getAttributeValue(unit, "speed");
  return Math.min(
    DEFENSE_CONFIG.maxDodgeChance,
    speed * DEFENSE_CONFIG.dodgeMultiplier
  );
}

/**
 * Calcula dano de ataque físico direto
 * Fórmula: Combat (valor direto, sem dados)
 */
export function calculateDamage(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(unit, ATTACK_CONFIG.attribute);
  return Math.max(1, attrValue);
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
  terrain: TERRAIN_CONFIG,
  territorySize: TERRITORY_SIZE_CONFIG,
} as const;

export default GLOBAL_CONFIG;

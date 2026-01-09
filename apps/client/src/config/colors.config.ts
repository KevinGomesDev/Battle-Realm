// client/src/config/colors.config.ts
// Configuração centralizada de cores da aplicação - BOUNDLESS Theme
// ESTE É O ÚNICO ARQUIVO DE CORES DO FRONTEND

// =============================================================================
// PALETA BASE - BOUNDLESS COSMIC THEME
// =============================================================================

export const COLORS = {
  // Cosmos - Backgrounds profundos
  cosmos: {
    void: "#050510",
    deep: "#0a0a1a",
    dark: "#0d0d20",
    space: "#121230",
    nebula: "#1a1a40",
  },

  // Stellar - Dourados e âmbares (destaque primário)
  stellar: {
    gold: "#f59e0b",
    amber: "#fbbf24",
    light: "#fcd34d",
    pale: "#fde68a",
    dark: "#d97706",
    deep: "#b45309",
  },

  // Astral - Pratas e aços (texto secundário)
  astral: {
    silver: "#94a3b8",
    steel: "#64748b",
    chrome: "#cbd5e1",
    dim: "#475569",
    dark: "#334155",
  },

  // Arcane - Violetas e roxos (magia/especial)
  arcane: {
    violet: "#8b5cf6",
    purple: "#7c3aed",
    deep: "#5b21b6",
    dark: "#3b0764",
    glow: "#a78bfa",
  },

  // Mystic - Azuis e cianos (informação/ação)
  mystic: {
    blue: "#3b82f6",
    cyan: "#22d3ee",
    sky: "#0ea5e9",
    deep: "#1d4ed8",
    glow: "#60a5fa",
  },

  // Ember - Verdes (sucesso/vida)
  ember: {
    green: "#22c55e",
    emerald: "#10b981",
    teal: "#14b8a6",
    glow: "#4ade80",
  },

  // Surface - Superfícies de UI
  surface: {
    900: "#0f0f1a",
    800: "#1a1a2d",
    700: "#252545",
    600: "#2f2f56",
    500: "#3d3d6b",
    400: "#4f4f80",
    300: "#6b6b99",
    200: "#8888aa",
    100: "#ababcc",
  },

  // Cores semânticas
  success: {
    light: "#86efac",
    DEFAULT: "#22c55e",
    dark: "#16a34a",
  },
  warning: {
    light: "#fde047",
    DEFAULT: "#eab308",
    dark: "#ca8a04",
  },
  danger: {
    light: "#fca5a5",
    DEFAULT: "#ef4444",
    dark: "#dc2626",
  },
  info: {
    light: "#93c5fd",
    DEFAULT: "#3b82f6",
    dark: "#2563eb",
  },
} as const;

// =============================================================================
// CORES DE ATRIBUTOS
// =============================================================================

export const ATTRIBUTE_COLORS = {
  combat: {
    text: "text-red-400",
    bg: "bg-red-500",
    border: "border-red-500",
    hex: "#f87171",
  },
  speed: {
    text: "text-blue-400",
    bg: "bg-blue-500",
    border: "border-blue-500",
    hex: "#60a5fa",
  },
  focus: {
    text: "text-purple-400",
    bg: "bg-purple-500",
    border: "border-purple-500",
    hex: "#a78bfa",
  },
  resistance: {
    text: "text-amber-400",
    bg: "bg-amber-500",
    border: "border-amber-500",
    hex: "#fbbf24",
  },
  will: {
    text: "text-cyan-400",
    bg: "bg-cyan-500",
    border: "border-cyan-500",
    hex: "#22d3ee",
  },
  vitality: {
    text: "text-green-400",
    bg: "bg-green-500",
    border: "border-green-500",
    hex: "#4ade80",
  },
} as const;

// =============================================================================
// CORES DE RECURSOS
// =============================================================================

export const RESOURCE_COLORS = {
  ore: {
    text: "text-amber-400",
    bg: "bg-amber-500",
    border: "border-amber-500",
    hex: "#fbbf24",
  },
  supplies: {
    text: "text-green-400",
    bg: "bg-green-500",
    border: "border-green-500",
    hex: "#4ade80",
  },
  arcane: {
    text: "text-purple-400",
    bg: "bg-purple-500",
    border: "border-purple-500",
    hex: "#a78bfa",
  },
  experience: {
    text: "text-blue-400",
    bg: "bg-blue-500",
    border: "border-blue-500",
    hex: "#60a5fa",
  },
  devotion: {
    text: "text-yellow-400",
    bg: "bg-yellow-500",
    border: "border-yellow-500",
    hex: "#facc15",
  },
} as const;

// =============================================================================
// CORES DE SEVERIDADE (para eventos/logs)
// =============================================================================

export const SEVERITY_COLORS = {
  INFO: {
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/50",
    hex: "#60a5fa",
  },
  SUCCESS: {
    text: "text-green-400",
    bg: "bg-green-500/20",
    border: "border-green-500/50",
    hex: "#4ade80",
  },
  WARNING: {
    text: "text-yellow-400",
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/50",
    hex: "#facc15",
  },
  DANGER: {
    text: "text-red-400",
    bg: "bg-red-500/20",
    border: "border-red-500/50",
    hex: "#f87171",
  },
  NEUTRAL: {
    text: "text-gray-300",
    bg: "bg-gray-500/20",
    border: "border-gray-500/50",
    hex: "#d1d5db",
  },
} as const;

// =============================================================================
// CORES DE CONDIÇÕES
// =============================================================================

export const CONDITION_COLORS = {
  // Condições de combate gerais
  GRAPPLED: "#845ef7",
  PROTECTED: "#60a5fa",
  STUNNED: "#ffd43b",
  FROZEN: "#74c0fc",
  BURNING: "#ff6b35",
  SLOWED: "#6b7280",
  DISARMED: "#f59e0b",
  PRONE: "#ef4444",
  FRIGHTENED: "#fbbf24",
  POISONED: "#22c55e",
  BLEEDING: "#dc2626",
  HELPED: "#22c55e",

  // Skills - Guerreiro
  EXTRA_ATTACK: "#ef4444",

  // Skills - Bárbaro
  WILD_FURY: "#dc2626",
  RECKLESS_ATTACK: "#f97316",

  // Skills - Ladino
  SNEAK_ATTACK: "#7c3aed",
  CUNNING_ACTION: "#8b5cf6",
  ASSASSINATE: "#1f2937",

  // Skills - Patrulheiro
  NATURAL_EXPLORER: "#16a34a",
  HUNTERS_MARK: "#dc2626",

  // Skills - Mago
  ARCANE_MASTERY: "#6366f1",
  SHIELDED: "#3b82f6",

  // Skills - Clérigo
  BLESSED: "#fbbf24",
  DIVINE_PROTECTION: "#60a5fa",
  CHANNEL_DIVINITY: "#f59e0b",

  // Skills - Paladino
  DIVINE_SMITE: "#fbbf24",
  LAY_ON_HANDS: "#4ade80",
  AURA_OF_PROTECTION: "#60a5fa",

  // Skills - Monge
  FLURRY_OF_BLOWS: "#f97316",
  PATIENT_DEFENSE: "#3b82f6",
  STUNNING_STRIKE: "#fbbf24",

  // Skills - Druida
  WILD_SHAPE: "#16a34a",
  NATURES_WARD: "#22c55e",

  // Skills - Feiticeiro
  METAMAGIC: "#a855f7",
  TIDES_OF_CHAOS: "#6366f1",

  // Skills - Bruxo
  ELDRITCH_INVOCATION: "#7c3aed",
  DARK_ONES_BLESSING: "#1f2937",

  // Skills - Bardo
  BARDIC_INSPIRATION: "#ec4899",
  SONG_OF_REST: "#f472b6",

  // Fallback
  DEFAULT: "#6b7280",
} as const;

// =============================================================================
// CORES DE PROTEÇÃO
// =============================================================================

export const PROTECTION_COLORS = {
  physical: {
    text: "text-blue-400",
    bg: "bg-blue-600",
    bgGradient: "from-blue-600 to-blue-500",
    border: "border-blue-500/30",
    hex: "#2563eb",
  },
  magical: {
    text: "text-purple-400",
    bg: "bg-purple-600",
    bgGradient: "from-purple-600 to-purple-500",
    border: "border-purple-500/30",
    hex: "#9333ea",
  },
} as const;

// =============================================================================
// CORES DE HP
// =============================================================================

export const HP_COLORS = {
  full: {
    bg: "bg-green-500",
    bgGradient: "from-green-600 to-green-500",
    hex: "#22c55e",
  },
  high: {
    bg: "bg-lime-500",
    bgGradient: "from-lime-600 to-lime-500",
    hex: "#84cc16",
  },
  medium: {
    bg: "bg-yellow-500",
    bgGradient: "from-yellow-600 to-yellow-500",
    hex: "#eab308",
  },
  low: {
    bg: "bg-orange-500",
    bgGradient: "from-orange-600 to-orange-500",
    hex: "#f97316",
  },
  critical: {
    bg: "bg-red-500",
    bgGradient: "from-red-600 to-red-500",
    hex: "#ef4444",
  },
} as const;

// =============================================================================
// CORES DE SEÇÕES DO UI
// =============================================================================

export const UI_SECTION_COLORS = {
  basicData: {
    title: "text-amber-400",
    border: "border-amber-400/40",
  },
  attributes: {
    title: "text-blue-400",
    border: "border-blue-400/40",
  },
  stats: {
    title: "text-cyan-400",
    border: "border-cyan-400/40",
  },
  actions: {
    title: "text-green-400",
    border: "border-green-400/40",
  },
  conditions: {
    title: "text-purple-400",
    border: "border-purple-400/40",
  },
} as const;

// =============================================================================
// CORES DE TIMES/JOGADORES
// =============================================================================

export const PLAYER_COLORS = {
  player1: {
    text: "text-blue-400",
    bg: "bg-blue-500",
    border: "border-blue-500",
    hex: "#3b82f6",
  },
  player2: {
    text: "text-red-400",
    bg: "bg-red-500",
    border: "border-red-500",
    hex: "#ef4444",
  },
  neutral: {
    text: "text-gray-400",
    bg: "bg-gray-500",
    border: "border-gray-500",
    hex: "#6b7280",
  },
} as const;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Retorna a cor de uma condição
 */
export function getConditionColor(conditionCode: string): string {
  return (
    CONDITION_COLORS[conditionCode as keyof typeof CONDITION_COLORS] ||
    CONDITION_COLORS.DEFAULT
  );
}

/**
 * Retorna as cores de severidade
 */
export function getSeverityColors(severity: keyof typeof SEVERITY_COLORS) {
  return SEVERITY_COLORS[severity];
}

/**
 * Retorna a cor de HP baseada na porcentagem
 */
export function getHpColor(current: number, max: number) {
  const percentage = (current / max) * 100;
  if (percentage >= 80) return HP_COLORS.full;
  if (percentage >= 60) return HP_COLORS.high;
  if (percentage >= 40) return HP_COLORS.medium;
  if (percentage >= 20) return HP_COLORS.low;
  return HP_COLORS.critical;
}

// =============================================================================
// TIPOS
// =============================================================================

export type AttributeColorKey = keyof typeof ATTRIBUTE_COLORS;
export type ResourceColorKey = keyof typeof RESOURCE_COLORS;
export type SeverityColorKey = keyof typeof SEVERITY_COLORS;
export type ConditionColorKey = keyof typeof CONDITION_COLORS;

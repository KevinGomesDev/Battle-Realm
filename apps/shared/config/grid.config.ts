// shared/config/grid.config.ts
// Configuração do grid de batalha

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
   * Tamanhos disponíveis para sorteio em Battles
   */
  battleSizes: ["SMALL", "SMALL", "SMALL"] as const,

  /**
   * Tamanho padrão se nenhum for especificado
   */
  defaultSize: "MEDIUM" as const,
} as const;

export function getGridDimensions(
  territorySize: keyof typeof GRID_CONFIG.territorySizes
): { width: number; height: number } {
  return GRID_CONFIG.territorySizes[territorySize];
}

export function getRandomBattleSize(): keyof typeof GRID_CONFIG.territorySizes {
  const sizes = GRID_CONFIG.battleSizes;
  return sizes[Math.floor(Math.random() * sizes.length)];
}

// =============================================================================
// CORES DA BATALHA/BATALHA
// =============================================================================

export const BATTLE_COLORS = {
  // Grid/Mapa
  gridBackground: "#1a1a2e",
  gridLine: "#16213e",
  gridDot: "#0f3460",
  cellLight: "#2d2d44",
  cellDark: "#1f1f33",
  cellHover: "rgba(239, 68, 68, 0.5)",
  cellMovable: "#2a4a2a",
  cellAttackable: "#4a2a2a",

  // Células de movimento
  cellMovableNormal: "rgba(250, 204, 21, 0.4)",
  cellMovableNormalBorder: "rgba(250, 204, 21, 0.8)",
  cellMovableEngagement: "rgba(251, 146, 60, 0.4)",
  cellMovableEngagementBorder: "rgba(251, 146, 60, 0.8)",
  cellMovableBlocked: "rgba(239, 68, 68, 0.4)",
  cellMovableBlockedBorder: "rgba(239, 68, 68, 0.8)",

  // Cores de preview de área (spells/skills)
  areaPreviewEmpty: "rgba(255, 255, 255, 0.3)",
  areaPreviewEmptyBorder: "rgba(255, 255, 255, 0.6)",
  areaPreviewTarget: "rgba(34, 197, 94, 0.5)",
  areaPreviewTargetBorder: "rgba(34, 197, 94, 0.9)",
  areaPreviewOutOfRange: "rgba(239, 68, 68, 0.3)",
  areaPreviewOutOfRangeBorder: "rgba(239, 68, 68, 0.6)",
  areaPreviewCenter: "rgba(255, 255, 255, 0.9)",

  // Cores dos jogadores (até 8)
  playerColors: [
    { primary: "#4a90d9", secondary: "#2d5a8a" },
    { primary: "#d94a4a", secondary: "#8a2d2d" },
    { primary: "#2a9d8f", secondary: "#1d6b62" },
    { primary: "#f4a261", secondary: "#c47a3f" },
    { primary: "#9b59b6", secondary: "#6c3483" },
    { primary: "#1abc9c", secondary: "#138d75" },
    { primary: "#e74c3c", secondary: "#b03a2e" },
    { primary: "#3498db", secondary: "#2471a3" },
  ],
} as const;

/**
 * Constantes de cores para elementos de UI do canvas de batalha
 * Cores do grid e mapa vêm da configuração do servidor (battle.config)
 */

// Cores de UI (não do mapa)
export const UI_COLORS = {
  hostHighlight: "#7ab8ff",
  guestHighlight: "#ff7a7a",
  hpFull: "#4ade80",
  hpMedium: "#fbbf24",
  hpLow: "#ef4444",
  protection: "#60a5fa",
  turnIndicator: "#ffd700",
  deadUnit: "#4a4a4a",
} as const;

// Configurações de renderização de unidade
export const UNIT_RENDER_CONFIG = {
  /** Escala do sprite em relação à célula (1.4 = 140%) */
  spriteScale: 2,
  /** Offset Y para centralização vertical (negativo = subir) */
  verticalOffset: -1,
} as const;

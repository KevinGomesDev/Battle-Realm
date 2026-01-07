/**
 * Constantes da Arena - Centralizadas para fácil manutenção
 */

// Re-exportar CONDITIONS_INFO do shared (fonte de verdade)
export {
  CONDITIONS_INFO,
  getConditionInfo,
} from "../../../../../shared/data/conditions.data";

// Re-exportar funções de skills/ações do shared (fonte de verdade)
export {
  isCommonAction,
  getCommonActions,
  getCommonActionCodes,
  getSkillInfo,
} from "../../../../../shared/data/skills.data";

// Importar cores centralizadas
import {
  PLAYER_COLORS,
  HP_COLORS,
  PROTECTION_COLORS,
} from "../../../config/colors.config";

import {
  COMMON_ACTIONS,
  getSkillInfo,
} from "../../../../../shared/data/skills.data";

/**
 * Informações sobre ações disponíveis (formato legado para compatibilidade)
 * @deprecated Use getSkillInfo() do shared/data/skills.data
 */
export const ACTIONS_INFO: Record<
  string,
  { icon: string; name: string; description: string }
> = Object.fromEntries(
  COMMON_ACTIONS.map((action) => {
    const info = getSkillInfo(action.code);
    return [
      action.code,
      {
        icon: info?.icon || "❓",
        name: info?.name || action.name,
        description: info?.description || action.description,
      },
    ];
  })
);

/**
 * Tooltips para atributos
 */
export const ATTRIBUTE_TOOLTIPS: Record<string, string> = {
  combat: "Bônus de ataque corpo-a-corpo",
  speed: "Velocidade - determina chance de esquiva e ordem de turno",
  focus: "Bônus para habilidades mágicas",
  resistance: "Redução de dano físico recebido",
  will: "Força mental e mana",
  vitality: "Pontos de vida máximos = Vitality × 2",
  protection: "Escudo temporário, absorve dano antes do HP",
  initiative: "Ordem de ação na batalha (maior = primeiro)",
  damageReduction: "Redução fixa de dano por ataque",
};

/**
 * Cores padrão para UI (usando config centralizado)
 */
export const UI_COLORS = {
  // Player colors
  host: PLAYER_COLORS.player1.hex,
  guest: PLAYER_COLORS.player2.hex,
  ally: HP_COLORS.full.hex,
  enemy: PLAYER_COLORS.player2.hex,
  neutral: PLAYER_COLORS.neutral.hex,

  // Health bar
  healthHigh: HP_COLORS.full.hex,
  healthMedium: HP_COLORS.medium.hex,
  healthLow: HP_COLORS.low.hex,
  healthCritical: HP_COLORS.critical.hex,

  // Protection
  protection: PROTECTION_COLORS.physical.hex,

  // Grid
  gridDefault: "#1f2937",
  gridHighlight: "#374151",
  gridSelected: "#2563eb",
  gridMovable: "#22c55e40",
  gridAttackable: "#ef444440",

  // Timer
  timerNormal: HP_COLORS.full.hex,
  timerWarning: HP_COLORS.medium.hex,
  timerCritical: HP_COLORS.critical.hex,
};

/**
 * Thresholds para timer
 */
export const TIMER_THRESHOLDS = {
  warning: 15, // segundos
  critical: 5, // segundos
};

/**
 * Categorias de unidades
 */
export const UNIT_CATEGORIES = {
  REGENT: { name: "Regente", icon: "👑" },
  TROOP: { name: "Tropa", icon: "⚔️" },
  HERO: { name: "Herói", icon: "🦸" },
  MONSTER: { name: "Monstro", icon: "👹" },
};

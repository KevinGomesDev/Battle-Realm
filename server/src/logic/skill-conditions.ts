// server/src/logic/skill-conditions.ts
// Condições aplicadas por skills passivas
// FONTE DE VERDADE para efeitos de habilidades passivas

import type { ConditionDefinition } from "../../../shared/types/conditions.types";

// =============================================================================
// CONDIÇÕES DE SKILLS PASSIVAS
// =============================================================================

/**
 * Condições geradas por skills passivas
 * Estas condições têm expiry: "permanent" e modificam o comportamento de combate
 */
export const SKILL_CONDITIONS: Record<string, ConditionDefinition> = {
  // =========================================================================
  // GUERREIRO
  // =========================================================================
  EXTRA_ATTACK: {
    id: "EXTRA_ATTACK",
    name: "Ataque Extra",
    description: "Pode realizar um ataque adicional ao usar a Ação de Ataque",
    expiry: "permanent",
    icon: "⚔️",
    color: "#ef4444",
    effects: {
      extraAttacks: 1, // +1 ataque por ação de ataque
    },
  },

  // =========================================================================
  // BÁRBARO
  // =========================================================================
  WILD_FURY: {
    id: "WILD_FURY",
    name: "Fúria Selvagem",
    description:
      "Dano recebido -1. Ataques têm mínimo 2 acertos. Efeitos duplicados sem Proteção.",
    expiry: "permanent",
    icon: "🔥",
    color: "#dc2626",
    effects: {
      damageReduction: 1, // -1 dano recebido
      minAttackSuccesses: 2, // Mínimo 2 acertos em ataques
      // Quando sem proteção, os efeitos são dobrados (lógica no combate)
    },
  },

  RECKLESS_ATTACK: {
    id: "RECKLESS_ATTACK",
    name: "Ataque Descuidado",
    description: "Pode atacar 2x quando usa Ação de Ataque, mas sem Proteção",
    expiry: "permanent",
    icon: "💢",
    color: "#f97316",
    effects: {
      extraAttacks: 1, // +1 ataque
      // Condição especial: só ativa quando sem proteção
    },
  },

  // =========================================================================
  // LADINO
  // =========================================================================
  SNEAK_ATTACK: {
    id: "SNEAK_ATTACK",
    name: "Ataque Furtivo",
    description: "+3 dano contra alvos que não te viram ou flanqueados",
    expiry: "permanent",
    icon: "🗡️",
    color: "#7c3aed",
    effects: {
      conditionalBonusDamage: 3, // +3 dano (condicional)
      // Condição: alvo não viu atacante ou está flanqueado
    },
  },

  CUNNING_ACTION: {
    id: "CUNNING_ACTION",
    name: "Ação Ardilosa",
    description: "Dash, Disengage e Hide são ações bônus (não consomem ação)",
    expiry: "permanent",
    icon: "🎭",
    color: "#8b5cf6",
    effects: {
      bonusActionSkills: ["dash", "disengage", "hide"],
    },
  },

  ASSASSINATE: {
    id: "ASSASSINATE",
    name: "Assassinar",
    description: "Primeiro ataque contra alvo que não agiu causa dano dobrado",
    expiry: "permanent",
    icon: "☠️",
    color: "#1f2937",
    effects: {
      assassinateDamageMultiplier: 2, // x2 dano no primeiro ataque
    },
  },

  // =========================================================================
  // PATRULHEIRO
  // =========================================================================
  NATURAL_EXPLORER: {
    id: "NATURAL_EXPLORER",
    name: "Explorador Natural",
    description: "+2 movimento em terrenos naturais. Ignora terreno difícil.",
    expiry: "permanent",
    icon: "🌲",
    color: "#16a34a",
    effects: {
      movementMod: 2, // +2 movimento
      ignoreDifficultTerrain: true,
    },
  },

  HUNTERS_MARK: {
    id: "HUNTERS_MARK",
    name: "Marca do Caçador",
    description: "Marcado pelo caçador. Ataques do marcador causam +2 dano.",
    expiry: "end_of_battle",
    icon: "🎯",
    color: "#dc2626",
    effects: {
      markedByHunter: true, // Lógica especial no combate
    },
  },

  // =========================================================================
  // MAGO
  // =========================================================================
  ARCANE_MASTERY: {
    id: "ARCANE_MASTERY",
    name: "Maestria Arcana",
    description: "+1 dado em todos os testes de Foco",
    expiry: "permanent",
    icon: "✨",
    color: "#6366f1",
    effects: {
      focusMod: 1, // +1 em Foco
    },
  },

  SHIELDED: {
    id: "SHIELDED",
    name: "Escudado",
    description: "Proteção mágica aumentada temporariamente",
    expiry: "end_of_turn",
    icon: "🛡️",
    color: "#3b82f6",
    effects: {
      // Efeito já aplicado diretamente na proteção mágica
    },
  },

  // =========================================================================
  // CLÉRIGO
  // =========================================================================
  BLESSED: {
    id: "BLESSED",
    name: "Abençoado",
    description: "+1 em todos os testes",
    expiry: "duration",
    durationRounds: 3,
    icon: "✝️",
    color: "#eab308",
    effects: {
      combatMod: 1,
      acuityMod: 1,
      focusMod: 1,
    },
  },

  HELP_NEXT: {
    id: "HELP_NEXT",
    name: "Ajudado",
    description: "Próximo ataque tem vantagem",
    expiry: "on_action",
    icon: "🤝",
    color: "#22c55e",
    effects: {
      advantageOnNextAttack: true,
    },
  },

  FRIGHTENED: {
    id: "FRIGHTENED",
    name: "Amedrontado",
    description: "Desvantagem em ataques contra a fonte do medo",
    expiry: "end_of_turn",
    icon: "😨",
    color: "#fbbf24",
    effects: {
      disadvantageOnAttacks: true,
    },
  },

  // =========================================================================
  // TROPAS
  // =========================================================================
  ESCUDO_PROTETOR: {
    id: "ESCUDO_PROTETOR",
    name: "Escudo Protetor",
    description:
      "Transfere 2 de dano de aliado adjacente para si automaticamente",
    expiry: "permanent",
    icon: "🛡️",
    color: "#3b82f6",
    effects: {
      shieldAllyDamageTransfer: 2, // Dano transferido de aliados adjacentes
    },
  },

  INVESTIDA: {
    id: "INVESTIDA",
    name: "Investida",
    description: "+2 dano ao mover 2+ casas em linha reta antes de atacar",
    expiry: "permanent",
    icon: "🏇",
    color: "#f59e0b",
    effects: {
      chargeBonusDamage: 2,
      chargeMinDistance: 2,
    },
  },

  EMBOSCADA: {
    id: "EMBOSCADA",
    name: "Emboscada",
    description: "+3 dano contra unidades que não agiram este turno",
    expiry: "permanent",
    icon: "🎯",
    color: "#7c3aed",
    effects: {
      ambushBonusDamage: 3,
    },
  },

  FURTIVIDADE: {
    id: "FURTIVIDADE",
    name: "Furtividade",
    description:
      "Não pode ser alvo de ataques à distância se adjacente a aliado",
    expiry: "permanent",
    icon: "👤",
    color: "#6b7280",
    effects: {
      immuneToRangedIfAdjacentAlly: true,
    },
  },

  TIRO_RAPIDO: {
    id: "TIRO_RAPIDO",
    name: "Tiro Rápido",
    description: "2 ataques à distância por turno, -1 dano cada",
    expiry: "permanent",
    icon: "🏹",
    color: "#10b981",
    effects: {
      extraRangedAttacks: 1,
      rangedDamagePenalty: 1,
    },
  },
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Obtém uma condição de skill pelo ID
 */
export function getSkillCondition(
  conditionId: string
): ConditionDefinition | undefined {
  return SKILL_CONDITIONS[conditionId];
}

/**
 * Verifica se uma condição é de skill passiva
 */
export function isSkillCondition(conditionId: string): boolean {
  return conditionId in SKILL_CONDITIONS;
}

/**
 * Lista todas as condições permanentes (de passivas)
 */
export function getPermanentSkillConditions(): ConditionDefinition[] {
  return Object.values(SKILL_CONDITIONS).filter(
    (c) => c.expiry === "permanent"
  );
}

/**
 * Obtém os efeitos de uma condição de skill
 */
export function getSkillConditionEffects(
  conditionId: string
): ConditionDefinition["effects"] | undefined {
  return SKILL_CONDITIONS[conditionId]?.effects;
}

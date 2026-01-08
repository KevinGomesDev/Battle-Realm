// shared/data/Templates/ConditionsTemplates.ts
// Templates raw de todas as condições do jogo

import type { ConditionDefinition } from "../../types/conditions.types";

// =============================================================================
// CONDIÇÕES DE COMBATE GERAIS
// =============================================================================

export const COMBAT_CONDITIONS: Record<string, ConditionDefinition> = {
  GRAPPLED: {
    id: "GRAPPLED",
    name: "Agarrado",
    description: "A unidade não pode se mover enquanto estiver agarrada.",
    expiry: "manual",
    icon: "🤼",
    color: "#845ef7",
    effects: {
      blockMove: true,
      blockDash: true,
    },
  },

  DODGING: {
    id: "DODGING",
    name: "Esquivando",
    description: "Postura defensiva. Ataques têm 50% de chance de errar.",
    expiry: "next_turn",
    icon: "🌀",
    color: "#60a5fa",
    effects: {
      dodgeChance: 50,
    },
  },

  PROTECTED: {
    id: "PROTECTED",
    name: "Protegido",
    description: "O próximo dano recebido é reduzido em 5 pontos.",
    expiry: "on_action",
    icon: "🛡️",
    color: "#60a5fa",
    effects: {
      damageReduction: 5,
    },
  },

  STUNNED: {
    id: "STUNNED",
    name: "Atordoado",
    description: "Movimentação reduzida em 2 células neste turno.",
    expiry: "end_of_turn",
    icon: "💫",
    color: "#ffd43b",
    effects: {
      movementReduction: 2,
    },
  },

  FROZEN: {
    id: "FROZEN",
    name: "Congelado",
    description: "A unidade não pode realizar nenhuma ação.",
    expiry: "end_of_turn",
    icon: "❄️",
    color: "#74c0fc",
    effects: {
      blockMove: true,
      blockAttack: true,
      blockDash: true,
      blockDodge: true,
    },
  },

  BURNING: {
    id: "BURNING",
    name: "Queimando",
    description: "Recebe 3 de dano no início de cada turno.",
    expiry: "end_of_turn",
    icon: "🔥",
    color: "#ff6b35",
    effects: {
      damagePerTurn: 3,
    },
  },

  SLOWED: {
    id: "SLOWED",
    name: "Lentidão",
    description: "Movimentação reduzida pela metade.",
    expiry: "end_of_turn",
    icon: "🐌",
    color: "#6b7280",
    effects: {
      movementMultiplier: 0.5,
    },
  },

  DISARMED: {
    id: "DISARMED",
    name: "Desarmado",
    description: "Não pode atacar com armas.",
    expiry: "end_of_turn",
    icon: "🔓",
    color: "#f59e0b",
    effects: {
      blockAttack: true,
    },
  },

  PRONE: {
    id: "PRONE",
    name: "Caído",
    description: "Caído no chão, desvantagem em ataques.",
    expiry: "end_of_turn",
    icon: "⬇️",
    color: "#ef4444",
    effects: {
      disadvantageOnAttacks: true,
    },
  },

  HELPED: {
    id: "HELPED",
    name: "Ajudado",
    description: "Vantagem no próximo ataque.",
    expiry: "on_action",
    icon: "🤝",
    color: "#22c55e",
    effects: {
      advantageOnNextAttack: true,
    },
  },

  POISONED: {
    id: "POISONED",
    name: "Envenenado",
    description: "Recebe dano por turno que ignora proteção.",
    expiry: "duration",
    durationRounds: 3,
    icon: "☠️",
    color: "#22c55e",
    effects: {
      damagePerTurn: 2,
    },
  },

  BLEEDING: {
    id: "BLEEDING",
    name: "Sangrando",
    description: "Perde HP gradualmente, aumenta com movimento.",
    expiry: "duration",
    durationRounds: 3,
    icon: "🩸",
    color: "#dc2626",
    effects: {
      damagePerTurn: 1,
    },
  },

  ADRENALINE_RUSH: {
    id: "ADRENALINE_RUSH",
    name: "Adrenalina",
    description:
      "Esquiva perfeita! +1 movimento e próximo ataque é crítico garantido.",
    expiry: "next_turn",
    icon: "⚡",
    color: "#eab308",
    effects: {
      movementMod: 1,
      guaranteedCrit: true,
    },
  },
};

// =============================================================================
// CONDIÇÕES DE SKILLS PASSIVAS
// =============================================================================

export const SKILL_CONDITIONS: Record<string, ConditionDefinition> = {
  // =========================================================================
  // GUERREIRO
  // =========================================================================
  EXTRA_ATTACK: {
    id: "EXTRA_ATTACK",
    name: "Ataque Extra",
    description: "Pode realizar um ataque adicional ao usar a Ação de Ataque.",
    expiry: "permanent",
    icon: "⚔️",
    color: "#ef4444",
    effects: {
      extraAttacks: 1,
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
      damageReduction: 1,
      minAttackSuccesses: 2,
    },
  },

  RECKLESS_ATTACK: {
    id: "RECKLESS_ATTACK",
    name: "Ataque Descuidado",
    description: "Pode atacar 2x quando usa Ação de Ataque, mas sem Proteção.",
    expiry: "permanent",
    icon: "💢",
    color: "#f97316",
    effects: {
      extraAttacks: 1,
    },
  },

  // =========================================================================
  // LADINO
  // =========================================================================
  SNEAK_ATTACK: {
    id: "SNEAK_ATTACK",
    name: "Ataque Furtivo",
    description: "+3 dano contra alvos que não te viram ou flanqueados.",
    expiry: "permanent",
    icon: "🗡️",
    color: "#7c3aed",
    effects: {
      conditionalBonusDamage: 3,
    },
  },

  CUNNING_ACTION: {
    id: "CUNNING_ACTION",
    name: "Ação Ardilosa",
    description: "Dash, Disengage e Hide são ações bônus (não consomem ação).",
    expiry: "permanent",
    icon: "🎭",
    color: "#8b5cf6",
    effects: {
      bonusActionSkills: ["DASH", "DISENGAGE", "HIDE"],
    },
  },

  ASSASSINATE: {
    id: "ASSASSINATE",
    name: "Assassinar",
    description: "Primeiro ataque contra alvo que não agiu causa dano dobrado.",
    expiry: "permanent",
    icon: "☠️",
    color: "#1f2937",
    effects: {
      assassinateDamageMultiplier: 2,
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
      movementMod: 2,
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
      markedByHunter: true,
    },
  },

  // =========================================================================
  // MAGO
  // =========================================================================
  GRIMOIRE: {
    id: "GRIMOIRE",
    name: "Grimório",
    description:
      "Possui um Livro de Magias. Aprende magias conjuradas visíveis permanentemente.",
    expiry: "permanent",
    icon: "📖",
    color: "#6366f1",
    effects: {
      learnsVisibleSpells: true,
    },
  },

  MAGIC_WEAPON: {
    id: "MAGIC_WEAPON",
    name: "Arma Mágica",
    description: "Ataques causam dano Mágico ao invés de Físico.",
    expiry: "end_of_combat",
    icon: "✨",
    color: "#8b5cf6",
    effects: {
      convertPhysicalToMagical: true,
    },
  },

  ARCANE_SHIELD: {
    id: "ARCANE_SHIELD",
    name: "Escudo Arcano",
    description: "Redução de Dano igual à metade do Foco.",
    expiry: "next_turn",
    icon: "🛡️",
    color: "#6366f1",
    effects: {
      arcaneShieldActive: true,
    },
  },

  SHIELDED: {
    id: "SHIELDED",
    name: "Escudado",
    description: "Proteção mágica aumentada temporariamente.",
    expiry: "end_of_turn",
    icon: "🛡️",
    color: "#3b82f6",
    effects: {},
  },

  // =========================================================================
  // CLÉRIGO
  // =========================================================================
  BLESSED: {
    id: "BLESSED",
    name: "Abençoado",
    description: "+1 em todos os testes.",
    expiry: "duration",
    durationRounds: 3,
    icon: "✝️",
    color: "#eab308",
    effects: {
      combatMod: 1,
      speedMod: 1,
      focusMod: 1,
    },
  },

  HELP_NEXT: {
    id: "HELP_NEXT",
    name: "Ajudado",
    description: "Próximo ataque tem vantagem.",
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
    description: "Desvantagem em ataques contra a fonte do medo.",
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
      "Transfere 2 de dano de aliado adjacente para si automaticamente.",
    expiry: "permanent",
    icon: "🛡️",
    color: "#3b82f6",
    effects: {
      shieldAllyDamageTransfer: 2,
    },
  },

  INVESTIDA: {
    id: "INVESTIDA",
    name: "Investida",
    description: "+2 dano ao mover 2+ casas em linha reta antes de atacar.",
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
    description: "+3 dano contra unidades que não agiram este turno.",
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
      "Não pode ser alvo de ataques à distância se adjacente a aliado.",
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
    description: "2 ataques à distância por turno, -1 dano cada.",
    expiry: "permanent",
    icon: "🏹",
    color: "#10b981",
    effects: {
      extraRangedAttacks: 1,
      rangedDamagePenalty: 1,
    },
  },

  // =========================================================================
  // INVOCADOR
  // =========================================================================
  EIDOLON_CHARGE: {
    id: "EIDOLON_CHARGE",
    name: "Carga Eidolon",
    description:
      "Invoca Eidolon no início da batalha. Eidolon ganha +1 em todos stats por kill.",
    expiry: "permanent",
    icon: "👻",
    color: "#8b5cf6",
    effects: {
      summonOnBattleStart: "EIDOLON",
      summonGrowthOnKill: 1,
    },
  },

  EIDOLON_PROTECTION: {
    id: "EIDOLON_PROTECTION",
    name: "Proteção de Eidolon",
    description:
      "Dano recebido adjacente ao Eidolon é convertido em Dano Verdadeiro e transferido para o Eidolon.",
    expiry: "permanent",
    icon: "🛡️",
    color: "#a855f7",
    effects: {
      transferDamageToSummon: "EIDOLON",
      convertToTrueDamage: true,
    },
  },

  EIDOLON_GROWTH: {
    id: "EIDOLON_GROWTH",
    name: "Crescimento Eidolon",
    description:
      "O Eidolon cresce a cada kill. Acúmulos são perdidos se morrer.",
    expiry: "permanent",
    icon: "📈",
    color: "#c084fc",
    effects: {
      isEidolon: true,
      resetsOnDeath: true,
    },
  },
};

// =============================================================================
// CONDIÇÕES DE SPELLS
// =============================================================================

export const SPELL_CONDITIONS: Record<string, ConditionDefinition> = {
  EMPOWERED: {
    id: "EMPOWERED",
    name: "Potencializado",
    description:
      "Todos os atributos aumentados temporariamente. Será seguido por Exaustão.",
    expiry: "next_turn",
    icon: "⚡",
    color: "#fbbf24",
    effects: {
      bonusDamage: 2,
      movementMod: 2,
      dodgeChance: 10,
    },
  },

  EXHAUSTED: {
    id: "EXHAUSTED",
    name: "Exausto",
    description:
      "Penalidade em todos os atributos após o efeito de Potencializar.",
    expiry: "next_turn",
    icon: "💤",
    color: "#6b7280",
    effects: {
      bonusDamage: -2,
      movementMod: -2,
      dodgeChance: -10,
    },
  },
};

// =============================================================================
// CONDIÇÕES DE RAÇA
// =============================================================================

export const RACE_CONDITIONS: Record<string, ConditionDefinition> = {
  // Aberração
  PELE_AMORFA: {
    id: "PELE_AMORFA",
    name: "Pele Amorfa",
    description: "Reduz todos os tipos de danos recebidos em 1.",
    expiry: "permanent",
    icon: "🫠",
    color: "#8e44ad",
    effects: {
      damageReduction: 1,
    },
  },

  // Besta
  FURIA_DA_MATILHA: {
    id: "FURIA_DA_MATILHA",
    name: "Fúria da Matilha",
    description: "Bestas ganham poder quando aliados da mesma raça morrem.",
    expiry: "permanent",
    icon: "🐺",
    color: "#8b4513",
    effects: {},
  },

  FURIA_DA_MATILHA_ATIVA: {
    id: "FURIA_DA_MATILHA_ATIVA",
    name: "Fúria da Matilha Ativa",
    description: "+1D na próxima rolagem (aliado Besta morreu).",
    expiry: "on_action",
    icon: "🐺",
    color: "#c0392b",
    effects: {},
  },

  // Celestial
  LUZ_SAGRADA: {
    id: "LUZ_SAGRADA",
    name: "Luz Sagrada",
    description:
      "Causa o dobro de dano em Diabos, Monstruosidades e Mortos-Vivos.",
    expiry: "permanent",
    icon: "✨",
    color: "#ffd700",
    effects: {},
  },

  // Construto
  PESO_DE_FERRO: {
    id: "PESO_DE_FERRO",
    name: "Peso de Ferro",
    description: "Não pode ser arremessado, agarrado ou derrubado.",
    expiry: "permanent",
    icon: "🤖",
    color: "#95a5a6",
    effects: {
      immuneToConditions: ["GRAPPLED", "PRONE"],
    },
  },

  // Dragão
  SANGUE_ARCANO: {
    id: "SANGUE_ARCANO",
    name: "Sangue Arcano",
    description: "Reduz o custo de Arcana para Magias em 2.",
    expiry: "permanent",
    icon: "🐉",
    color: "#c0392b",
    effects: {},
  },

  // Elemental
  AFINIDADE_ELEMENTAL: {
    id: "AFINIDADE_ELEMENTAL",
    name: "Afinidade Elemental",
    description: "Imune a um elemento, vulnerável a outro.",
    expiry: "permanent",
    icon: "🌊",
    color: "#e67e22",
    effects: {},
  },

  // Fada
  GRACA_FEERICA: {
    id: "GRACA_FEERICA",
    name: "Graça Feérica",
    description: "Imune a efeitos negativos de Climas.",
    expiry: "permanent",
    icon: "🧚",
    color: "#9b59b6",
    effects: {},
  },

  // Diabo
  CHAMAS_DO_INFERNO: {
    id: "CHAMAS_DO_INFERNO",
    name: "Chamas do Inferno",
    description: "Causa o dobro de dano em Celestiais, Humanoides e Fadas.",
    expiry: "permanent",
    icon: "😈",
    color: "#8b0000",
    effects: {},
  },

  // Gigante
  ESTATURA_COLOSSAL: {
    id: "ESTATURA_COLOSSAL",
    name: "Estatura Colossal",
    description: "Ocupa dobro do espaço e aumenta alcance em 1 quadrado.",
    expiry: "permanent",
    icon: "🗿",
    color: "#7f8c8d",
    effects: {
      basicAttackRangeMod: 1, // +1 alcance de ataque básico
    },
  },

  // Humanoide
  VINGANCA_FINAL: {
    id: "VINGANCA_FINAL",
    name: "Vingança Final",
    description: "Pode atacar imediatamente ao ter Vitalidade zerada.",
    expiry: "permanent",
    icon: "⚔️",
    color: "#3498db",
    effects: {},
  },

  // Monstruosidade
  SEDE_DE_SANGUE: {
    id: "SEDE_DE_SANGUE",
    name: "Sede de Sangue",
    description: "Ao matar, pode atacar novamente ou usar Corrida.",
    expiry: "permanent",
    icon: "👹",
    color: "#2c3e50",
    effects: {},
  },

  // Gosma
  ADERENCIA_ACIDA: {
    id: "ADERENCIA_ACIDA",
    name: "Aderência Ácida",
    description:
      "Unidades agarradas por Gosmas sofrem 2 de dano físico por turno.",
    expiry: "permanent",
    icon: "🟢",
    color: "#27ae60",
    effects: {},
  },

  AGARRADO_POR_GOSMA: {
    id: "AGARRADO_POR_GOSMA",
    name: "Agarrado por Gosma",
    description: "Preso em gosma ácida. Sofre 2 de dano físico por turno.",
    expiry: "manual",
    icon: "🟢",
    color: "#27ae60",
    effects: {
      blockMove: true,
      blockDash: true,
      damagePerTurn: 2,
    },
  },

  // Planta
  RAIZES_PROFUNDAS: {
    id: "RAIZES_PROFUNDAS",
    name: "Raízes Profundas",
    description: "Em Batalhas Defensivas, todas as rolagens recebem +1D.",
    expiry: "permanent",
    icon: "🌿",
    color: "#2ecc71",
    effects: {},
  },

  // Morto-Vivo
  DRENAR_VIDA: {
    id: "DRENAR_VIDA",
    name: "Drenar Vida",
    description:
      "Ao render um inimigo, recupera 4 de Vitalidade imediatamente.",
    expiry: "permanent",
    icon: "🧟",
    color: "#1a1a2e",
    effects: {},
  },

  // Inseto
  COLMEIA_PRODUTIVA: {
    id: "COLMEIA_PRODUTIVA",
    name: "Colmeia Produtiva",
    description: "Produção Passiva de um Recurso escolhido aumenta em 2.",
    expiry: "permanent",
    icon: "🐝",
    color: "#d4ac0d",
    effects: {},
  },
};

// =============================================================================
// OBJETO CONSOLIDADO DE TODAS AS CONDIÇÕES
// =============================================================================

export const ALL_CONDITIONS: Record<string, ConditionDefinition> = {
  ...COMBAT_CONDITIONS,
  ...SKILL_CONDITIONS,
  ...SPELL_CONDITIONS,
  ...RACE_CONDITIONS,
};

// Array de todas as condições (para listagem)
export const CONDITION_TEMPLATES: ConditionDefinition[] =
  Object.values(ALL_CONDITIONS);

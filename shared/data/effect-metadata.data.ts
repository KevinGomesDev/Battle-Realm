// shared/data/effect-metadata.data.ts
// Metadados para exibição dos efeitos de condições no cliente

import type { ConditionEffects } from "../types/conditions.types";

/**
 * Metadados de um efeito para exibição no cliente
 */
export interface EffectMetadata {
  /** Nome amigável do efeito */
  name: string;
  /** Ícone emoji */
  icon: string;
  /** Descrição do que o efeito faz */
  description: string;
  /** Cor para exibição (hex) */
  color: string;
  /** Categoria do efeito para agrupamento */
  category: "combat" | "defense" | "mobility" | "special" | "passive";
  /** Indica se valores negativos são ruins (true) ou bons (false) */
  negativeIsBad?: boolean;
  /** Sufixo para o valor (ex: "%", " células") */
  valueSuffix?: string;
  /** Prefixo para o valor (ex: "+", "-") */
  valuePrefix?: string;
  /** Se true, não exibir na aba de características (efeito interno) */
  hidden?: boolean;
}

/**
 * Mapa de metadados para cada chave de ConditionEffects
 * Apenas efeitos com metadata aqui serão exibidos no cliente
 */
export const EFFECT_METADATA: Partial<
  Record<keyof ConditionEffects, EffectMetadata>
> = {
  // === BLOQUEIOS DE AÇÕES ===
  blockMove: {
    name: "Imobilizado",
    icon: "🚫",
    description: "Não pode se mover",
    color: "#ef4444",
    category: "mobility",
    hidden: false,
  },
  blockAttack: {
    name: "Desarmado",
    icon: "🔓",
    description: "Não pode atacar",
    color: "#f59e0b",
    category: "combat",
  },
  blockDash: {
    name: "Sem Corrida",
    icon: "🦵",
    description: "Não pode usar Dash",
    color: "#6b7280",
    category: "mobility",
    hidden: true, // Menos relevante
  },
  blockDodge: {
    name: "Sem Esquiva",
    icon: "🎯",
    description: "Não pode usar Dodge",
    color: "#6b7280",
    category: "defense",
    hidden: true,
  },
  blockAllActions: {
    name: "Paralisado",
    icon: "⚡",
    description: "Não pode realizar nenhuma ação",
    color: "#dc2626",
    category: "special",
  },

  // === MODIFICADORES DE CHANCE ===
  dodgeChance: {
    name: "Esquiva",
    icon: "🌀",
    description: "Chance de evitar ataques",
    color: "#22d3ee",
    category: "defense",
    valueSuffix: "%",
    valuePrefix: "+",
    negativeIsBad: true,
  },
  critChance: {
    name: "Crítico",
    icon: "💥",
    description: "Chance de acerto crítico",
    color: "#f97316",
    category: "combat",
    valueSuffix: "%",
    valuePrefix: "+",
  },
  missChance: {
    name: "Imprecisão",
    icon: "💨",
    description: "Chance de errar ataques",
    color: "#6b7280",
    category: "combat",
    valueSuffix: "%",
    negativeIsBad: false, // Mais miss é ruim
  },

  // === MODIFICADORES DE DANO ===
  damageReduction: {
    name: "Redução de Dano",
    icon: "🛡️",
    description: "Reduz dano recebido",
    color: "#3b82f6",
    category: "defense",
    valuePrefix: "-",
  },
  damageReductionPercent: {
    name: "Resistência",
    icon: "🛡️",
    description: "Reduz dano recebido em %",
    color: "#3b82f6",
    category: "defense",
    valueSuffix: "%",
    valuePrefix: "-",
  },
  bonusDamage: {
    name: "Dano Bônus",
    icon: "⚔️",
    description: "Dano adicional em ataques",
    color: "#ef4444",
    category: "combat",
    valuePrefix: "+",
    negativeIsBad: true,
  },
  bonusDamagePercent: {
    name: "Amplificação",
    icon: "📈",
    description: "Aumenta dano causado em %",
    color: "#ef4444",
    category: "combat",
    valueSuffix: "%",
    valuePrefix: "+",
  },

  // === MODIFICADORES DE ATRIBUTOS ===
  combatMod: {
    name: "Combate",
    icon: "⚔️",
    description: "Modificador de Combate",
    color: "#ef4444",
    category: "combat",
    valuePrefix: "+",
    negativeIsBad: true,
  },
  speedMod: {
    name: "Velocidade",
    icon: "💨",
    description: "Modificador de Speed",
    color: "#22d3ee",
    category: "mobility",
    valuePrefix: "+",
    negativeIsBad: true,
  },
  focusMod: {
    name: "Foco",
    icon: "🎯",
    description: "Modificador de Focus",
    color: "#a78bfa",
    category: "special",
    valuePrefix: "+",
    negativeIsBad: true,
  },
  resistanceMod: {
    name: "Resistência",
    icon: "🏋️",
    description: "Modificador de Resistance",
    color: "#f59e0b",
    category: "defense",
    valuePrefix: "+",
    negativeIsBad: true,
  },
  willMod: {
    name: "Vontade",
    icon: "💜",
    description: "Modificador de Will",
    color: "#8b5cf6",
    category: "special",
    valuePrefix: "+",
    negativeIsBad: true,
  },

  // === MODIFICADORES DE STATS DERIVADOS ===
  movementMod: {
    name: "Movimento",
    icon: "👣",
    description: "Células adicionais de movimento",
    color: "#22c55e",
    category: "mobility",
    valuePrefix: "+",
    valueSuffix: " células",
    negativeIsBad: true,
  },
  movementReduction: {
    name: "Lentidão",
    icon: "🐌",
    description: "Redução de movimento",
    color: "#6b7280",
    category: "mobility",
    valuePrefix: "-",
    valueSuffix: " células",
  },
  basicAttackRangeMod: {
    name: "Alcance",
    icon: "📏",
    description: "Alcance adicional de ataque",
    color: "#f97316",
    category: "combat",
    valuePrefix: "+",
    valueSuffix: " célula(s)",
  },

  // === EFEITOS DE TURNO ===
  damagePerTurn: {
    name: "Dano por Turno",
    icon: "🔥",
    description: "Recebe dano no início do turno",
    color: "#dc2626",
    category: "special",
  },
  healPerTurn: {
    name: "Regeneração",
    icon: "💚",
    description: "Recupera HP no início do turno",
    color: "#22c55e",
    category: "special",
    valuePrefix: "+",
  },

  // === EFEITOS ESPECIAIS ===
  reflectDamagePercent: {
    name: "Reflexão",
    icon: "🪞",
    description: "Reflete parte do dano recebido",
    color: "#e879f9",
    category: "defense",
    valueSuffix: "%",
  },
  lifeStealPercent: {
    name: "Roubo de Vida",
    icon: "🧛",
    description: "Cura baseada no dano causado",
    color: "#dc2626",
    category: "combat",
    valueSuffix: "%",
  },
  taunt: {
    name: "Provocação",
    icon: "😤",
    description: "Inimigos devem atacar esta unidade",
    color: "#f59e0b",
    category: "defense",
  },
  invisible: {
    name: "Invisível",
    icon: "👻",
    description: "Não pode ser alvo de ataques",
    color: "#6b7280",
    category: "special",
  },
  flying: {
    name: "Voando",
    icon: "🦅",
    description: "Ignora terreno e obstáculos",
    color: "#60a5fa",
    category: "mobility",
  },
  phasing: {
    name: "Incorpóreo",
    icon: "💫",
    description: "Pode atravessar unidades",
    color: "#a78bfa",
    category: "mobility",
  },

  // === EFEITOS DE SKILLS PASSIVAS ===
  extraAttacks: {
    name: "Ataques Extras",
    icon: "⚔️",
    description: "Ataques adicionais por ação",
    color: "#ef4444",
    category: "combat",
    valuePrefix: "+",
  },
  minAttackSuccesses: {
    name: "Acertos Mínimos",
    icon: "🎯",
    description: "Mínimo de acertos garantidos",
    color: "#22c55e",
    category: "combat",
  },
  conditionalBonusDamage: {
    name: "Dano Condicional",
    icon: "🗡️",
    description: "Dano bônus em condições específicas",
    color: "#7c3aed",
    category: "combat",
    valuePrefix: "+",
  },
  assassinateDamageMultiplier: {
    name: "Assassinato",
    icon: "☠️",
    description: "Multiplicador de dano no primeiro ataque",
    color: "#1f2937",
    category: "combat",
    valueSuffix: "x",
  },
  ignoreDifficultTerrain: {
    name: "Explorador",
    icon: "🌲",
    description: "Ignora terreno difícil",
    color: "#16a34a",
    category: "mobility",
  },
  advantageOnNextAttack: {
    name: "Vantagem",
    icon: "✨",
    description: "Próximo ataque com vantagem",
    color: "#22c55e",
    category: "combat",
  },
  disadvantageOnAttacks: {
    name: "Desvantagem",
    icon: "😰",
    description: "Ataques com desvantagem",
    color: "#ef4444",
    category: "combat",
  },
  chargeBonusDamage: {
    name: "Investida",
    icon: "🏇",
    description: "Dano bônus ao investir",
    color: "#f59e0b",
    category: "combat",
    valuePrefix: "+",
  },
  ambushBonusDamage: {
    name: "Emboscada",
    icon: "🎯",
    description: "Dano bônus contra desprevenidos",
    color: "#7c3aed",
    category: "combat",
    valuePrefix: "+",
  },
  extraRangedAttacks: {
    name: "Tiros Extras",
    icon: "🏹",
    description: "Ataques à distância extras",
    color: "#10b981",
    category: "combat",
    valuePrefix: "+",
  },
  shieldAllyDamageTransfer: {
    name: "Protetor",
    icon: "🛡️",
    description: "Absorve dano de aliados adjacentes",
    color: "#3b82f6",
    category: "defense",
  },

  // === EFEITOS DE MAGO ===
  convertPhysicalToMagical: {
    name: "Arma Mágica",
    icon: "✨",
    description: "Ataques causam dano mágico",
    color: "#8b5cf6",
    category: "combat",
  },
  arcaneShieldActive: {
    name: "Escudo Arcano",
    icon: "🛡️",
    description: "Redução de dano = Focus/2",
    color: "#6366f1",
    category: "defense",
  },
};

/**
 * Lista de chaves de efeitos que devem ser exibidos na aba de características
 * (apenas efeitos com metadata e não hidden)
 */
export const DISPLAYABLE_EFFECTS = Object.entries(EFFECT_METADATA)
  .filter(([, meta]) => meta && !meta.hidden)
  .map(([key]) => key as keyof ConditionEffects);

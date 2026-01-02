// shared/types/conditions.types.ts
// Tipos compartilhados para o sistema de condições

/**
 * Efeitos que uma condição pode aplicar
 */
export interface ConditionEffects {
  // === BLOQUEIOS DE AÇÕES ===
  blockMove?: boolean;
  blockAttack?: boolean;
  blockDash?: boolean;
  blockDodge?: boolean;
  blockAllActions?: boolean;

  // === MODIFICADORES DE CHANCE ===
  dodgeChance?: number;
  critChance?: number;
  missChance?: number;

  // === MODIFICADORES DE DANO ===
  damageReduction?: number;
  damageReductionPercent?: number;
  bonusDamage?: number;
  bonusDamagePercent?: number;

  // === MODIFICADORES DE ATRIBUTOS ===
  combatMod?: number;
  acuityMod?: number;
  focusMod?: number;
  armorMod?: number;
  vitalityMod?: number;

  // === MODIFICADORES DE STATS DERIVADOS ===
  movementMod?: number;
  movementReduction?: number;
  movementMultiplier?: number;
  maxHpMod?: number;
  currentHpMod?: number;
  protectionMod?: number;
  actionsMod?: number;

  // === EFEITOS DE TURNO ===
  damagePerTurn?: number;
  healPerTurn?: number;

  // === EFEITOS ESPECIAIS ===
  immuneToConditions?: string[];
  reflectDamagePercent?: number;
  lifeStealPercent?: number;
  taunt?: boolean;
  invisible?: boolean;
  flying?: boolean;
  phasing?: boolean;

  // === EFEITOS DE SKILLS PASSIVAS ===
  extraAttacks?: number; // Ataques adicionais por ação de ataque
  minAttackSuccesses?: number; // Mínimo de acertos garantidos em ataques
  conditionalBonusDamage?: number; // Dano bônus condicional
  bonusActionSkills?: string[]; // Skills que são ações bônus (não consomem ação)
  assassinateDamageMultiplier?: number; // Multiplicador de dano para assassinato
  ignoreDifficultTerrain?: boolean; // Ignora terreno difícil
  markedByHunter?: boolean; // Marcado por Hunter's Mark
  advantageOnNextAttack?: boolean; // Vantagem no próximo ataque
  disadvantageOnAttacks?: boolean; // Desvantagem em ataques
  shieldAllyDamageTransfer?: number; // Dano transferido de aliados adjacentes para si
  chargeBonusDamage?: number; // Dano bônus de investida
  chargeMinDistance?: number; // Distância mínima para investida
  ambushBonusDamage?: number; // Dano bônus de emboscada
  immuneToRangedIfAdjacentAlly?: boolean; // Imune a ranged se adjacente a aliado
  extraRangedAttacks?: number; // Ataques à distância extras
  rangedDamagePenalty?: number; // Penalidade de dano em ataques à distância
}

/**
 * Tipo de expiração de uma condição
 */
export type ConditionExpiry =
  | "end_of_turn"
  | "next_turn"
  | "on_action"
  | "on_damage"
  | "manual"
  | "permanent"
  | "end_of_battle"
  | "duration";

/**
 * Definição completa de uma condição
 */
export interface ConditionDefinition {
  id: string;
  name: string;
  description: string;
  expiry: ConditionExpiry;
  durationRounds?: number; // Para expiry: "duration"
  stackable?: boolean;
  maxStacks?: number;
  effects: ConditionEffects;
  icon?: string;
  color?: string;
}

/**
 * Informações visuais de uma condição para o frontend
 */
export interface ConditionInfo {
  icon: string;
  name: string;
  description: string;
  color: string;
}

/**
 * IDs de condições conhecidas
 */
export type ConditionId =
  | "GRAPPLED"
  | "DODGING"
  | "PROTECTED"
  | "STUNNED"
  | "FROZEN"
  | "BURNING"
  | "SLOWED"
  | "DISARMED"
  | "PRONE"
  | "FRIGHTENED"
  | "POISONED"
  | "BLEEDING"
  | "HELPED";

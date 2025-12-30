export interface ConditionEffects {
  // === BLOQUEIOS DE AÇÕES ===
  blockMove?: boolean;
  blockAttack?: boolean;
  blockDash?: boolean;
  blockDodge?: boolean;
  blockAllActions?: boolean;

  // === MODIFICADORES DE CHANCE ===
  dodgeChance?: number; // % chance de esquivar ataques
  critChance?: number; // % chance de crítico
  missChance?: number; // % chance de errar ataques

  // === MODIFICADORES DE DANO ===
  damageReduction?: number; // Redução de dano recebido (flat)
  damageReductionPercent?: number; // Redução de dano recebido (%)
  bonusDamage?: number; // Dano extra causado (flat)
  bonusDamagePercent?: number; // Dano extra causado (%)

  // === MODIFICADORES DE ATRIBUTOS ===
  combatMod?: number; // Modifica Combat
  acuityMod?: number; // Modifica Acuity
  focusMod?: number; // Modifica Focus
  armorMod?: number; // Modifica Armor
  vitalityMod?: number; // Modifica Vitality

  // === MODIFICADORES DE STATS DERIVADOS ===
  movementMod?: number; // Modifica movimento total (flat)
  movementReduction?: number; // Reduz movimento (flat)
  movementMultiplier?: number; // Multiplica movimento (0.5 = metade)
  maxHpMod?: number; // Modifica HP máximo
  currentHpMod?: number; // Modifica HP atual (cura/dano direto)
  protectionMod?: number; // Modifica proteção atual
  actionsMod?: number; // Modifica ações por turno

  // === EFEITOS DE TURNO ===
  damagePerTurn?: number; // Dano no início do turno (burning, poison)
  healPerTurn?: number; // Cura no início do turno (regeneration)

  // === EFEITOS ESPECIAIS ===
  immuneToConditions?: string[]; // Imune a certas condições
  reflectDamagePercent?: number; // Reflete % do dano recebido
  lifeStealPercent?: number; // % do dano causado vira cura
  taunt?: boolean; // Força inimigos a atacar esta unidade
  invisible?: boolean; // Não pode ser alvo de ataques
  flying?: boolean; // Ignora terreno difícil
  phasing?: boolean; // Pode atravessar unidades
}

export interface ConditionEffect {
  id: string;
  name: string;
  description: string;
  expiry:
    | "end_of_turn"
    | "next_turn"
    | "on_action"
    | "on_damage"
    | "manual"
    | "permanent";
  stackable?: boolean; // Pode acumular múltiplas vezes
  maxStacks?: number; // Máximo de stacks se stackable
  effects: ConditionEffects;
}

export const CONDITIONS: Record<string, ConditionEffect> = {
  GRAPPLED: {
    id: "GRAPPLED",
    name: "Grappled",
    description: "Unit cannot move while grappled",
    expiry: "manual",
    effects: {
      blockMove: true,
      blockDash: true,
    },
  },

  DODGING: {
    id: "DODGING",
    name: "Dodging",
    description:
      "Unit is in defensive stance. Attacks have 50% chance to miss.",
    expiry: "next_turn",
    effects: {
      dodgeChance: 50,
    },
  },

  PROTECTED: {
    id: "PROTECTED",
    name: "Protected",
    description: "Next damage received is reduced by 5",
    expiry: "on_action",
    effects: {
      damageReduction: 5,
    },
  },

  STUNNED: {
    id: "STUNNED",
    name: "Stunned",
    description: "Unit has reduced movement",
    expiry: "end_of_turn",
    effects: {
      movementReduction: 2,
    },
  },

  FROZEN: {
    id: "FROZEN",
    name: "Frozen",
    description: "Unit cannot perform any actions",
    expiry: "end_of_turn",
    effects: {
      blockMove: true,
      blockAttack: true,
      blockDash: true,
      blockDodge: true,
    },
  },

  BURNING: {
    id: "BURNING",
    name: "Burning",
    description: "Unit takes damage at the start of its turn",
    expiry: "end_of_turn",
    effects: {
      damagePerTurn: 3,
    },
  },

  SLOWED: {
    id: "SLOWED",
    name: "Slowed",
    description: "Unit movement is halved",
    expiry: "end_of_turn",
    effects: {
      movementMultiplier: 0.5,
    },
  },
};

export interface ConditionModifiers {
  // Chances
  dodgeChance: number;
  critChance: number;
  missChance: number;
  // Dano
  damageReduction: number;
  damageReductionPercent: number;
  bonusDamage: number;
  bonusDamagePercent: number;
  // Atributos
  combatMod: number;
  acuityMod: number;
  focusMod: number;
  armorMod: number;
  vitalityMod: number;
  // Stats derivados
  movementMod: number;
  movementMultiplier: number;
  maxHpMod: number;
  currentHpMod: number;
  protectionMod: number;
  actionsMod: number;
  // Turno
  damagePerTurn: number;
  healPerTurn: number;
}

export interface ConditionScanResult {
  canPerform: boolean;
  blockReason?: string;
  modifiers: ConditionModifiers;
  conditionsToRemove: string[];
}

function createEmptyModifiers(): ConditionModifiers {
  return {
    dodgeChance: 0,
    critChance: 0,
    missChance: 0,
    damageReduction: 0,
    damageReductionPercent: 0,
    bonusDamage: 0,
    bonusDamagePercent: 0,
    combatMod: 0,
    acuityMod: 0,
    focusMod: 0,
    armorMod: 0,
    vitalityMod: 0,
    movementMod: 0,
    movementMultiplier: 1,
    maxHpMod: 0,
    currentHpMod: 0,
    protectionMod: 0,
    actionsMod: 0,
    damagePerTurn: 0,
    healPerTurn: 0,
  };
}

// Varredura inteligente de condições antes de qualquer ação
export function scanConditionsForAction(
  conditions: string[],
  action: string
): ConditionScanResult {
  const result: ConditionScanResult = {
    canPerform: true,
    modifiers: createEmptyModifiers(),
    conditionsToRemove: [],
  };

  for (const condId of conditions) {
    const cond = CONDITIONS[condId];
    if (!cond) continue;

    // Verificar bloqueio geral
    if (cond.effects.blockAllActions) {
      result.canPerform = false;
      result.blockReason = `Blocked by ${cond.name}`;
    }

    // Verificar bloqueios específicos dinamicamente
    const blockKey = `block${
      action.charAt(0).toUpperCase() + action.slice(1)
    }` as keyof typeof cond.effects;
    if (cond.effects[blockKey]) {
      result.canPerform = false;
      result.blockReason = `Blocked by ${cond.name}`;
    }

    // Acumular todos os modificadores numéricos
    const numericKeys: (keyof ConditionModifiers)[] = [
      "dodgeChance",
      "critChance",
      "missChance",
      "damageReduction",
      "damageReductionPercent",
      "bonusDamage",
      "bonusDamagePercent",
      "combatMod",
      "acuityMod",
      "focusMod",
      "armorMod",
      "vitalityMod",
      "movementMod",
      "maxHpMod",
      "currentHpMod",
      "protectionMod",
      "actionsMod",
      "damagePerTurn",
      "healPerTurn",
    ];

    for (const key of numericKeys) {
      const value = cond.effects[key as keyof typeof cond.effects];
      if (typeof value === "number") {
        (result.modifiers[key] as number) += value;
      }
    }

    // Multiplicadores são multiplicados, não somados
    if (cond.effects.movementMultiplier !== undefined) {
      result.modifiers.movementMultiplier *= cond.effects.movementMultiplier;
    }

    // Marcar condições que expiram após ação
    if (cond.expiry === "on_action") {
      result.conditionsToRemove.push(condId);
    }
  }

  // Limitar chances a 0-100
  result.modifiers.dodgeChance = Math.min(
    100,
    Math.max(0, result.modifiers.dodgeChance)
  );
  result.modifiers.critChance = Math.min(
    100,
    Math.max(0, result.modifiers.critChance)
  );
  result.modifiers.missChance = Math.min(
    100,
    Math.max(0, result.modifiers.missChance)
  );

  return result;
}

// Aplica resultado da varredura, removendo condições expiradas
export function applyConditionScanResult(
  conditions: string[],
  scanResult: ConditionScanResult
): string[] {
  if (scanResult.conditionsToRemove.length === 0) return conditions;
  return conditions.filter((c) => !scanResult.conditionsToRemove.includes(c));
}

// Remove condições que expiram no fim do turno
export function removeEndOfTurnConditions(conditions: string[]): string[] {
  return conditions.filter((condId) => {
    const cond = CONDITIONS[condId];
    return cond?.expiry !== "end_of_turn";
  });
}

// Remove condições que expiram no próximo turno
export function removeNextTurnConditions(conditions: string[]): string[] {
  return conditions.filter((condId) => {
    const cond = CONDITIONS[condId];
    return cond?.expiry !== "next_turn";
  });
}

export function hasCondition(
  conditions: string[],
  conditionId: string
): boolean {
  return conditions.includes(conditionId);
}

export function addCondition(
  conditions: string[],
  conditionId: string
): string[] {
  if (conditions.includes(conditionId)) return conditions;
  return [...conditions, conditionId];
}

export function removeCondition(
  conditions: string[],
  conditionId: string
): string[] {
  return conditions.filter((c) => c !== conditionId);
}

// =============================================================================
// LISTA DE EFEITOS POSSÍVEIS
// =============================================================================
// Esta lista serve como referência para todos os efeitos que podem ser
// aplicados por condições, habilidades, itens, terrenos, etc.
//
// BLOQUEIOS DE AÇÕES:
//   blockMove          - Impede movimento
//   blockAttack        - Impede ataques
//   blockDash          - Impede disparada
//   blockDodge         - Impede esquiva
//   blockAllActions    - Impede todas as ações
//   blockSpell         - Impede uso de magias (futuro)
//   blockItem          - Impede uso de itens (futuro)
//
// MODIFICADORES DE CHANCE (%):
//   dodgeChance        - Chance de esquivar ataques
//   critChance         - Chance de acerto crítico
//   missChance         - Chance de errar ataques
//   blockChance        - Chance de bloquear ataques (futuro)
//   parryChance        - Chance de aparar ataques (futuro)
//
// MODIFICADORES DE DANO:
//   damageReduction         - Redução de dano recebido (flat)
//   damageReductionPercent  - Redução de dano recebido (%)
//   bonusDamage             - Dano extra causado (flat)
//   bonusDamagePercent      - Dano extra causado (%)
//   critMultiplier          - Multiplicador de crítico (futuro, default 2x)
//
// MODIFICADORES DE ATRIBUTOS (soma/subtrai do base):
//   combatMod      - Modifica Combat
//   acuityMod      - Modifica Acuity
//   focusMod       - Modifica Focus
//   armorMod       - Modifica Armor
//   vitalityMod    - Modifica Vitality
//
// MODIFICADORES DE STATS DERIVADOS:
//   movementMod         - Modifica movimento total (flat +/-)
//   movementMultiplier  - Multiplica movimento (0.5 = metade, 2 = dobro)
//   maxHpMod            - Modifica HP máximo
//   currentHpMod        - Modifica HP atual (cura positivo, dano negativo)
//   protectionMod       - Modifica proteção atual
//   actionsMod          - Modifica ações por turno
//   initiativeMod       - Modifica iniciativa (futuro)
//
// EFEITOS DE TURNO (aplicados no início/fim do turno):
//   damagePerTurn   - Dano no início do turno (burning, poison, bleed)
//   healPerTurn     - Cura no início do turno (regeneration)
//   manaPerTurn     - Mana restaurada por turno (futuro)
//
// IMUNIDADES E RESISTÊNCIAS:
//   immuneToConditions[]    - Lista de condições que não afetam
//   immuneToDamageTypes[]   - Imune a tipos de dano (futuro)
//   resistDamageTypes{}     - Resistência (%) a tipos de dano (futuro)
//   vulnerableDamageTypes{} - Vulnerabilidade a tipos de dano (futuro)
//
// EFEITOS ESPECIAIS:
//   reflectDamagePercent  - Reflete % do dano recebido ao atacante
//   lifeStealPercent      - % do dano causado retorna como cura
//   taunt                 - Força inimigos adjacentes a atacar esta unidade
//   invisible             - Não pode ser alvo de ataques à distância
//   flying                - Ignora terreno difícil, pode sobrevoar unidades
//   phasing               - Pode atravessar unidades (não pode parar no mesmo tile)
//   anchored              - Não pode ser empurrado/puxado
//   silenced              - Não pode usar habilidades ativas (futuro)
//   disarmed              - Não pode usar armas/ataques básicos (futuro)
//   blinded               - Ataques têm missChance aumentada (futuro)
//   feared                - Deve se mover para longe da fonte (futuro)
//   charmed               - Não pode atacar a fonte (futuro)
//   confused              - Ações têm alvo aleatório (futuro)
//   poisoned              - Dano por turno que ignora proteção (futuro)
//   bleeding              - Dano por turno que aumenta com movimento (futuro)
//   marked                - Ataques contra esta unidade têm bônus (futuro)
//   hasted                - Ações extras por turno (futuro)
//   slowed                - Menos movimento
//   rooted                - Não pode se mover mas pode agir (futuro)
//   stunned               - Não pode agir, mas pode se mover (futuro)
//   paralyzed             - Não pode fazer nada (futuro)
//   petrified             - Como paralyzed + resistências aumentadas (futuro)
//   unconscious           - Não pode agir, vulnerável (futuro)
//   dead                  - Unidade morta (tratado separadamente)
//
// EFEITOS DE TERRENO (aplicados pela posição no mapa):
//   difficultTerrain      - Custa 2 de movimento por tile
//   hazardousTerrain      - Causa dano ao entrar/permanecer
//   healingTerrain        - Cura ao permanecer
//   concealment           - Ataques à distância têm missChance
//   cover                 - Redução de dano de ataques à distância
//   highGround            - Bônus de dano para ataques à distância
//   lowGround             - Penalidade de dano para ataques à distância
// =============================================================================

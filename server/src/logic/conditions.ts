// src/logic/conditions.ts
// Lógica de condições do jogo (processamento e varredura)
// As DEFINIÇÕES de condições estão em shared/data/conditions.data.ts

import type {
  ConditionEffects,
  ConditionDefinition,
  ConditionExpiry,
  ConditionInfo,
} from "../../../shared/types/conditions.types";

// Importar definições centralizadas do shared
import {
  CONDITIONS,
  COMBAT_CONDITIONS,
  SKILL_CONDITIONS,
  SPELL_CONDITIONS,
  RACE_CONDITIONS,
  getConditionsInfo,
  getConditionInfo,
  getConditionColorsMap,
  getCondition,
  hasConditionDefinition,
} from "../../../shared/data/conditions.data";

// Re-exportar tipos para uso em outros arquivos do server
export type {
  ConditionEffects,
  ConditionDefinition,
  ConditionExpiry,
  ConditionInfo,
};

// Re-exportar definições e funções do shared
export {
  CONDITIONS,
  COMBAT_CONDITIONS,
  SKILL_CONDITIONS,
  SPELL_CONDITIONS,
  RACE_CONDITIONS,
  getConditionsInfo,
  getConditionInfo,
  getConditionColorsMap,
  getCondition,
  hasConditionDefinition,
};

// Alias para manter compatibilidade com código existente
export type ConditionEffect = ConditionDefinition;

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
  speedMod: number;
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
  basicAttackRangeMod: number; // Modifica alcance do ataque básico (base: 1)
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
    speedMod: 0,
    focusMod: 0,
    armorMod: 0,
    vitalityMod: 0,
    movementMod: 0,
    movementMultiplier: 1,
    maxHpMod: 0,
    currentHpMod: 0,
    protectionMod: 0,
    actionsMod: 0,
    basicAttackRangeMod: 0,
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
      "speedMod",
      "focusMod",
      "armorMod",
      "vitalityMod",
      "movementMod",
      "maxHpMod",
      "currentHpMod",
      "protectionMod",
      "actionsMod",
      "basicAttackRangeMod",
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
// BUSCA GENÉRICA DE EFEITOS DE CONDIÇÕES
// =============================================================================

/**
 * Resultado de uma busca de efeito em condições
 */
export interface ConditionEffectMatch {
  conditionId: string;
  conditionName: string;
  effectValue: unknown;
}

/**
 * Busca um efeito específico em todas as condições de uma unidade
 * @param conditions Lista de IDs de condições da unidade
 * @param effectKey Nome do efeito a buscar (ex: "extraAttacks", "minAttackSuccesses")
 * @returns Lista de matches com conditionId, nome e valor do efeito
 */
export function searchConditionEffect(
  conditions: string[],
  effectKey: keyof ConditionEffects
): ConditionEffectMatch[] {
  const matches: ConditionEffectMatch[] = [];

  for (const condId of conditions) {
    const cond = CONDITIONS[condId];
    if (!cond) continue;

    const value = cond.effects[effectKey];
    if (value !== undefined) {
      matches.push({
        conditionId: condId,
        conditionName: cond.name,
        effectValue: value,
      });
    }
  }

  return matches;
}

/**
 * Soma valores numéricos de um efeito em todas as condições
 * @param conditions Lista de IDs de condições da unidade
 * @param effectKey Nome do efeito numérico
 * @returns Soma de todos os valores
 */
export function sumConditionEffect(
  conditions: string[],
  effectKey: keyof ConditionEffects
): number {
  let total = 0;

  for (const condId of conditions) {
    const cond = CONDITIONS[condId];
    if (!cond) continue;

    const value = cond.effects[effectKey];
    if (typeof value === "number") {
      total += value;
    }
  }

  return total;
}

/**
 * Pega o maior valor numérico de um efeito em todas as condições
 * @param conditions Lista de IDs de condições da unidade
 * @param effectKey Nome do efeito numérico
 * @returns Maior valor encontrado (0 se nenhum)
 */
export function maxConditionEffect(
  conditions: string[],
  effectKey: keyof ConditionEffects
): number {
  let max = 0;

  for (const condId of conditions) {
    const cond = CONDITIONS[condId];
    if (!cond) continue;

    const value = cond.effects[effectKey];
    if (typeof value === "number" && value > max) {
      max = value;
    }
  }

  return max;
}

/**
 * Calcula o número de ataques extras baseado nas condições da unidade
 * @param conditions Lista de IDs de condições da unidade
 * @param hasProtection Se a unidade ainda tem proteção física > 0
 * @returns Número de ataques extras (0 = apenas 1 ataque normal)
 */
export function getExtraAttacksFromConditions(
  conditions: string[],
  hasProtection: boolean
): number {
  let extraAttacks = 0;

  // Busca todas as condições que têm extraAttacks
  const matches = searchConditionEffect(conditions, "extraAttacks");

  for (const match of matches) {
    // RECKLESS_ATTACK só dá extra attacks se NÃO tiver proteção
    if (match.conditionId === "RECKLESS_ATTACK") {
      if (!hasProtection && typeof match.effectValue === "number") {
        extraAttacks += match.effectValue;
      }
      continue;
    }

    // Outras condições com extraAttacks (como EXTRA_ATTACK do Warrior)
    if (typeof match.effectValue === "number") {
      extraAttacks += match.effectValue;
    }
  }

  return extraAttacks;
}

/**
 * Calcula o mínimo de acertos garantidos em ataques (ex: WILD_FURY)
 */
export function getMinAttackSuccesses(conditions: string[]): number {
  return maxConditionEffect(conditions, "minAttackSuccesses");
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
//   speedMod      - Modifica speed
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

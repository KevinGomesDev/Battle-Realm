import type {
  AbilityDefinition as SpellDefinition,
  AbilityExecutionResult as SpellExecutionResult,
  AbilityExecutorFn as SpellExecutorFn,
} from "../../../shared/types/ability.types";
import {
  resolveDynamicValue,
  type DynamicValue,
} from "../../../shared/types/ability.types";
import { scanConditionsForAction } from "../logic/conditions";
import { processUnitDeath } from "../logic/death-logic";
import { applyDamage } from "../utils/damage.utils";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Resolve um valor dinâmico de spell com fallback
 */
function resolveSpellValue(
  value: DynamicValue | undefined,
  caster: BattleUnit,
  fallback: number
): number {
  if (value === undefined) return fallback;
  return resolveDynamicValue(value, caster);
}

/**
 * 🌀 TELEPORT - Move instantaneamente para uma posição
 * Nota: Validação de alcance já foi feita em validateSpellUse()
 */
function executeTeleport(
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  spell: SpellDefinition,
  _battleId?: string
): SpellExecutionResult {
  // Validação: target deve ser uma posição
  if (!target || "id" in target) {
    return {
      success: false,
      error: "Teleporte requer uma posição válida como alvo",
    };
  }

  const position = target as { x: number; y: number };

  // Validação específica: verificar se a posição não está ocupada
  const occupied = allUnits.some(
    (u) => u.isAlive && u.posX === position.x && u.posY === position.y
  );
  if (occupied) {
    return {
      success: false,
      error: "Posição ocupada por outra unidade",
    };
  }

  // Executar teleporte
  const from = { x: caster.posX, y: caster.posY };
  caster.posX = position.x;
  caster.posY = position.y;

  return {
    success: true,
    unitsMoved: [
      {
        unitId: caster.id,
        from,
        to: position,
      },
    ],
  };
}

/**
 * 🔥 FIRE - Causa dano mágico em área 3x3
 * Nota: Validação de alcance já foi feita em validateSpellUse()
 */
function executeFire(
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  spell: SpellDefinition,
  battleId?: string
): SpellExecutionResult {
  // Validação: target deve ser uma posição
  if (!target || "id" in target) {
    return {
      success: false,
      error: "Fogo requer uma posição válida como alvo",
    };
  }

  const position = target as { x: number; y: number };

  // Encontrar todas as unidades na área 3x3
  const targetsInArea = allUnits.filter((u) => {
    if (!u.isAlive) return false;
    const dx = Math.abs(u.posX - position.x);
    const dy = Math.abs(u.posY - position.y);
    return dx <= 1 && dy <= 1; // 3x3 centered on position
  });

  if (targetsInArea.length === 0) {
    return {
      success: false,
      error: "Nenhuma unidade na área alvo",
    };
  }

  // Aplicar dano a cada unidade na área
  const targetIds: string[] = [];
  const dodgeResults: SpellExecutionResult["dodgeResults"] = [];
  let totalDamage = 0;
  let totalRawDamage = 0;
  let totalDamageReduction = 0;

  for (const targetUnit of targetsInArea) {
    // Sistema de esquiva (Speed × 3%)
    const dodgeChance = targetUnit.speed * 3;
    const dodgeRoll = Math.floor(Math.random() * 100) + 1;
    const dodged = dodgeRoll <= dodgeChance;

    // Registrar resultado de esquiva
    dodgeResults.push({
      targetId: targetUnit.id,
      targetName: targetUnit.name,
      dodged,
      dodgeChance,
      dodgeRoll,
    });

    if (dodged) {
      console.log(
        `🌀 ${targetUnit.name} esquivou do Fogo! (${dodgeRoll} <= ${dodgeChance}%)`
      );
      continue;
    }

    // Dano base: resolver valor dinâmico (pode ser número fixo ou atributo)
    let baseDamage = resolveSpellValue(spell.baseDamage, caster, caster.focus);

    // Aplicar multiplicador de dano se existir
    if (spell.damageMultiplier) {
      baseDamage = Math.floor(baseDamage * (1 + spell.damageMultiplier));
    }

    // Scan condições do alvo para redução de dano
    const targetConditionEffects = scanConditionsForAction(
      targetUnit.conditions,
      "take_damage"
    );
    const damageReduction =
      targetConditionEffects.modifiers.damageReduction || 0;

    // Aplicar redução de dano das condições
    let finalDamage = baseDamage - damageReduction;
    if (finalDamage < 0) finalDamage = 0;

    // Aplicar dano usando o sistema de proteção dual (absorve na proteção mágica primeiro)
    const damageResult = applyDamage(
      targetUnit.physicalProtection,
      targetUnit.magicalProtection,
      targetUnit.currentHp,
      finalDamage,
      "MAGICO"
    );

    // Atualizar valores do alvo
    targetUnit.physicalProtection = damageResult.newPhysicalProtection;
    targetUnit.magicalProtection = damageResult.newMagicalProtection;
    targetUnit.currentHp = damageResult.newHp;
    totalDamage += finalDamage;
    totalRawDamage += baseDamage;
    totalDamageReduction += damageReduction;

    if (targetUnit.currentHp <= 0) {
      targetUnit.currentHp = 0;
      processUnitDeath(targetUnit, allUnits, caster, "arena", battleId);
    }

    targetIds.push(targetUnit.id);

    console.log(
      `🔥 ${targetUnit.name} recebeu ${finalDamage} de dano mágico (base: ${baseDamage}, redução: ${damageReduction}, absorvido: ${damageResult.damageAbsorbed}, HP: ${damageResult.damageToHp})`
    );
  }

  return {
    success: true,
    damageDealt: totalDamage,
    rawDamage: totalRawDamage,
    damageReduction: totalDamageReduction,
    targetIds,
    dodgeResults,
  };
}

/**
 * ⚡ EMPOWER - Potencializa unidade adjacente temporariamente
 * Nota: Validação de alcance e tipo de alvo já foi feita em validateSpellUse()
 */
function executeEmpower(
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  spell: SpellDefinition,
  _battleId?: string
): SpellExecutionResult {
  // Validação: target deve ser uma unidade
  if (!target || !("id" in target)) {
    return {
      success: false,
      error: "Potencializar requer uma unidade como alvo",
    };
  }

  const targetUnit = target as BattleUnit;

  // Resolver duração da condição (pode ser dinâmica)
  const duration = resolveSpellValue(spell.conditionDuration, caster, 1);

  // Aplicar condição EMPOWERED
  if (!targetUnit.conditions.includes("EMPOWERED")) {
    targetUnit.conditions.push("EMPOWERED");
  }

  // Valor do boost baseado no Focus do conjurador
  const boostValue = Math.floor(caster.focus / 2);

  console.log(
    `⚡ ${targetUnit.name} foi potencializado por ${duration} turno(s)! (+${boostValue} em todos atributos)`
  );

  return {
    success: true,
    conditionsApplied: [
      {
        targetId: targetUnit.id,
        conditionId: "EMPOWERED",
      },
    ],
  };
}

/**
 * Mapa de executores de spells
 */
export const SPELL_EXECUTORS: Record<string, SpellExecutorFn> = {
  executeTeleport,
  executeFire,
  executeEmpower,
};

/**
 * Executa uma spell
 */
export function executeSpell(
  spell: SpellDefinition,
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  battleId?: string
): SpellExecutionResult {
  const executor = SPELL_EXECUTORS[spell.functionName];

  if (!executor) {
    return {
      success: false,
      error: `Executor não encontrado: ${spell.functionName}`,
    };
  }

  return executor(caster, target, allUnits, spell, battleId);
}

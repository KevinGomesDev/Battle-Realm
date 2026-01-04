import { BattleUnit } from "../../../shared/types/battle.types";
import {
  SpellDefinition,
  SpellExecutionResult,
  SpellExecutorFn,
} from "../../../shared/types/spells.types";
import { scanConditionsForAction } from "../logic/conditions";
import { processSummonerDeath } from "../logic/summon-logic";

/**
 * 🌀 TELEPORT - Move instantaneamente para uma posição
 * Nota: Validação de alcance já foi feita em validateSpellUse()
 */
function executeTeleport(
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  spell: SpellDefinition
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
  spell: SpellDefinition
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
  let totalDamage = 0;

  for (const targetUnit of targetsInArea) {
    // Sistema de esquiva (Speed × 3%)
    const dodgeChance = targetUnit.speed * 3;
    const dodgeRoll = Math.floor(Math.random() * 100) + 1;
    if (dodgeRoll <= dodgeChance) {
      console.log(
        `🌀 ${targetUnit.name} esquivou do Fogo! (${dodgeRoll} <= ${dodgeChance}%)`
      );
      continue;
    }

    // Dano base = Focus do conjurador
    const baseDamage = caster.focus;

    // Scan condições do alvo para redução de dano
    const targetConditionEffects = scanConditionsForAction(
      targetUnit.conditions,
      "take_damage"
    );
    const damageReduction =
      targetConditionEffects.modifiers.damageReduction || 0;

    // Aplicar proteção mágica (Focus × 2)
    const magicalProtection = targetUnit.focus * 2;

    // Calcular dano final
    let finalDamage = baseDamage - damageReduction - magicalProtection;
    if (finalDamage < 0) finalDamage = 0;

    // Aplicar dano
    targetUnit.currentHp -= finalDamage;
    totalDamage += finalDamage;

    if (targetUnit.currentHp <= 0) {
      targetUnit.currentHp = 0;
      targetUnit.isAlive = false;

      // Matar invocações do alvo (summons morrem com o invocador)
      processSummonerDeath(targetUnit, allUnits, "arena");
    }

    targetIds.push(targetUnit.id);

    console.log(
      `🔥 ${targetUnit.name} recebeu ${finalDamage} de dano mágico (base: ${baseDamage}, redução: ${damageReduction}, proteção: ${magicalProtection})`
    );
  }

  return {
    success: true,
    damageDealt: totalDamage,
    targetIds,
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
  spell: SpellDefinition
): SpellExecutionResult {
  // Validação: target deve ser uma unidade
  if (!target || !("id" in target)) {
    return {
      success: false,
      error: "Potencializar requer uma unidade como alvo",
    };
  }

  const targetUnit = target as BattleUnit;

  // Aplicar condição EMPOWERED
  if (!targetUnit.conditions.includes("EMPOWERED")) {
    targetUnit.conditions.push("EMPOWERED");
  }

  // Armazenar o valor do boost baseado no Focus do conjurador
  // Nota: A condição EMPOWERED precisa ser configurada com o valor dinâmico
  // Por enquanto, vamos usar um valor fixo na definição da condição
  const boostValue = Math.floor(caster.focus / 2);

  console.log(
    `⚡ ${targetUnit.name} foi potencializado! (+${boostValue} em todos atributos)`
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
  allUnits: BattleUnit[]
): SpellExecutionResult {
  const executor = SPELL_EXECUTORS[spell.functionName];

  if (!executor) {
    return {
      success: false,
      error: `Executor não encontrado: ${spell.functionName}`,
    };
  }

  return executor(caster, target, allUnits, spell);
}

// server/src/logic/skill-executors.ts
// Executores de skills ativas - Funções que implementam a mecânica de cada skill
// FONTE DE VERDADE para execução de habilidades ativas

import type {
  SkillExecutionResult,
  SkillCombatUnit,
  SkillDefinition,
} from "../../../shared/types/skills.types";
import {
  getManhattanDistance,
  isAdjacentOmnidirectional,
} from "../../../shared/types/skills.types";
import { findSkillByCode } from "../data/skills.data";

// =============================================================================
// TIPOS LOCAIS
// =============================================================================

export type SkillExecutorFn = (
  caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  allUnits: SkillCombatUnit[],
  skill: SkillDefinition
) => SkillExecutionResult;

// =============================================================================
// REGISTRO DE EXECUTORES
// =============================================================================

/**
 * Mapa de functionName -> função executora
 * Adicione novos executores aqui
 */
export const SKILL_EXECUTORS: Record<string, SkillExecutorFn> = {
  // Guerreiro
  executeSecondWind,
  executeActionSurge,

  // Bárbaro
  executeTotalDestruction,

  // Clérigo
  executeHeal,
  executeBless,
  executeDivineFavor,
  executeCureWounds,
  executeTurnUndead,
  executeCelestialExpulsion,

  // Mago
  executeFireball,
  executeTeleport,
  executeMagicMissile,
  executeShield,

  // Ranger
  executeHuntersMark,
  executeVolley,
};

// =============================================================================
// FUNÇÃO PRINCIPAL DE EXECUÇÃO
// =============================================================================

/**
 * Executa uma skill pelo seu functionName
 * Gerencia consumo de ação e cooldown automaticamente
 */
export function executeSkill(
  caster: SkillCombatUnit,
  skillCode: string,
  target: SkillCombatUnit | null,
  allUnits: SkillCombatUnit[]
): SkillExecutionResult {
  const skill = findSkillByCode(skillCode);
  if (!skill) {
    return { success: false, error: "Skill não encontrada" };
  }

  if (!skill.functionName) {
    return { success: false, error: "Skill não possui executor definido" };
  }

  const executor = SKILL_EXECUTORS[skill.functionName];
  if (!executor) {
    return {
      success: false,
      error: `Executor '${skill.functionName}' não implementado`,
    };
  }

  // Verificar cooldown
  if (
    caster.skillCooldowns?.[skillCode] &&
    caster.skillCooldowns[skillCode] > 0
  ) {
    return {
      success: false,
      error: `Skill em cooldown (${caster.skillCooldowns[skillCode]} rodadas)`,
    };
  }

  // Executar a skill
  const result = executor(caster, target, allUnits, skill);

  // Se sucesso, aplicar consumo de ação e cooldown
  if (result.success) {
    // Consumir ação (a menos que consumesAction === false)
    if (skill.consumesAction !== false) {
      caster.actionsLeft = Math.max(0, caster.actionsLeft - 1);
    }
    result.casterActionsLeft = caster.actionsLeft;

    // Aplicar cooldown
    if (skill.cooldown && skill.cooldown > 0) {
      if (!caster.skillCooldowns) {
        caster.skillCooldowns = {};
      }
      caster.skillCooldowns[skillCode] = skill.cooldown;
    }

    result.skillCode = skillCode;
  }

  return result;
}

/**
 * Reduz todos os cooldowns de uma unidade em 1 (chamado no início de cada rodada)
 */
export function tickSkillCooldowns(unit: SkillCombatUnit): void {
  if (!unit.skillCooldowns) return;

  for (const skillCode of Object.keys(unit.skillCooldowns)) {
    if (unit.skillCooldowns[skillCode] > 0) {
      unit.skillCooldowns[skillCode]--;
    }
  }
}

/**
 * Verifica se uma skill está em cooldown
 */
export function isSkillOnCooldown(
  unit: SkillCombatUnit,
  skillCode: string
): boolean {
  return (unit.skillCooldowns?.[skillCode] ?? 0) > 0;
}

/**
 * Obtém o cooldown restante de uma skill
 */
export function getSkillCooldown(
  unit: SkillCombatUnit,
  skillCode: string
): number {
  return unit.skillCooldowns?.[skillCode] ?? 0;
}

// =============================================================================
// EXECUTORES - GUERREIRO
// =============================================================================

/**
 * WARRIOR_SECOND_WIND: Recupera HP igual à Vitalidade
 * Cooldown: 1 vez por batalha (tratado via metadata ou condição especial)
 */
function executeSecondWind(
  caster: SkillCombatUnit,
  _target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const healAmount = caster.vitality;
  const maxHp = caster.vitality * 2;

  const oldHp = caster.currentHp;
  caster.currentHp = Math.min(caster.currentHp + healAmount, maxHp);
  const actualHeal = caster.currentHp - oldHp;

  return {
    success: true,
    healAmount: actualHeal,
  };
}

/**
 * WARRIOR_ACTION_SURGE: Ganha uma ação extra (NÃO consome ação)
 */
function executeActionSurge(
  caster: SkillCombatUnit,
  _target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  // Ganha uma ação extra (consumesAction=false na definição)
  caster.actionsLeft += 1;

  return {
    success: true,
    actionsGained: 1,
  };
}

// =============================================================================
// EXECUTORES - BÁRBARO
// =============================================================================

/**
 * BARBARIAN_TOTAL_DESTRUCTION: Dano igual ao Combat em alvo adjacente, recebe o mesmo dano
 */
function executeTotalDestruction(
  caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um alvo" };
  }

  const damage = caster.combat;

  // Aplicar dano no alvo
  target.currentHp = Math.max(0, target.currentHp - damage);
  const targetDefeated = target.currentHp <= 0;
  if (targetDefeated) {
    target.isAlive = false;
  }

  // Aplicar mesmo dano no caster
  caster.currentHp = Math.max(0, caster.currentHp - damage);
  if (caster.currentHp <= 0) {
    caster.isAlive = false;
  }

  return {
    success: true,
    damageDealt: damage,
    targetHpAfter: target.currentHp,
    targetDefeated,
  };
}

// =============================================================================
// EXECUTORES - CLÉRIGO
// =============================================================================

/**
 * CLERIC_HEAL: Cura aliado adjacente (Focus de HP)
 */
function executeHeal(
  caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const healTarget = target || caster;

  if (healTarget.ownerId !== caster.ownerId) {
    return { success: false, error: "Só pode curar aliados" };
  }

  const healAmount = caster.focus;
  const maxHp = healTarget.vitality * 2;

  const oldHp = healTarget.currentHp;
  healTarget.currentHp = Math.min(healTarget.currentHp + healAmount, maxHp);
  const actualHeal = healTarget.currentHp - oldHp;

  return {
    success: true,
    healAmount: actualHeal,
    targetHpAfter: healTarget.currentHp,
  };
}

/**
 * CLERIC_BLESS: Aliados em área ganham BLESSED
 */
function executeBless(
  caster: SkillCombatUnit,
  _target: SkillCombatUnit | null,
  allUnits: SkillCombatUnit[],
  skill: SkillDefinition
): SkillExecutionResult {
  const radius = skill.rangeValue ?? 2;
  let unitsBlessed = 0;

  for (const unit of allUnits) {
    if (unit.ownerId !== caster.ownerId) continue;
    if (!unit.isAlive) continue;

    const distance = getManhattanDistance(
      caster.posX,
      caster.posY,
      unit.posX,
      unit.posY
    );
    if (distance > radius) continue;

    if (!unit.conditions.includes("BLESSED")) {
      unit.conditions.push("BLESSED");
      unitsBlessed++;
    }
  }

  return {
    success: true,
    conditionApplied: "BLESSED",
    damageDealt: unitsBlessed,
  };
}

/**
 * CLERIC_DIVINE_FAVOR: Próximo ataque tem vantagem
 */
function executeDivineFavor(
  caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const effectTarget = target || caster;

  if (!effectTarget.conditions.includes("HELP_NEXT")) {
    effectTarget.conditions.push("HELP_NEXT");
  }

  return {
    success: true,
    conditionApplied: "HELP_NEXT",
  };
}

/**
 * CLERIC_CURE_WOUNDS: Cura aliado adjacente (Focus de HP)
 */
function executeCureWounds(
  caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const healTarget = target || caster;

  if (healTarget.ownerId !== caster.ownerId) {
    return { success: false, error: "Só pode curar aliados" };
  }

  const healAmount = caster.focus;
  const maxHp = healTarget.vitality * 2;

  const oldHp = healTarget.currentHp;
  healTarget.currentHp = Math.min(healTarget.currentHp + healAmount, maxHp);
  const actualHeal = healTarget.currentHp - oldHp;

  return {
    success: true,
    healAmount: actualHeal,
    targetHpAfter: healTarget.currentHp,
  };
}

/**
 * CLERIC_TURN_UNDEAD: Aplica FRIGHTENED em inimigos adjacentes
 */
function executeTurnUndead(
  caster: SkillCombatUnit,
  _target: SkillCombatUnit | null,
  allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const affectedUnits: SkillCombatUnit[] = [];

  for (const unit of allUnits) {
    if (unit.ownerId === caster.ownerId) continue;
    if (!unit.isAlive) continue;
    if (
      !isAdjacentOmnidirectional(caster.posX, caster.posY, unit.posX, unit.posY)
    )
      continue;

    if (!unit.conditions.includes("FRIGHTENED")) {
      unit.conditions.push("FRIGHTENED");
      affectedUnits.push(unit);
    }
  }

  return {
    success: true,
    conditionApplied: "FRIGHTENED",
    damageDealt: affectedUnits.length,
  };
}

/**
 * CLERIC_CELESTIAL_EXPULSION: Remove condições negativas do alvo
 */
function executeCelestialExpulsion(
  _caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um alvo" };
  }

  // Lista de condições negativas que podem ser removidas
  const negativeConditions = [
    "STUNNED",
    "FROZEN",
    "BURNING",
    "SLOWED",
    "FRIGHTENED",
    "POISONED",
    "BLEEDING",
    "GRAPPLED",
    "PRONE",
    "DISARMED",
    "HUNTERS_MARK",
  ];

  const removedConditions: string[] = [];

  for (const condition of negativeConditions) {
    if (target.conditions.includes(condition)) {
      target.conditions = target.conditions.filter((c) => c !== condition);
      removedConditions.push(condition);
    }
  }

  return {
    success: true,
    conditionRemoved: removedConditions.join(", ") || "nenhuma",
  };
}

// =============================================================================
// EXECUTORES - MAGO
// =============================================================================

/**
 * WIZARD_FIREBALL: Dano em área (Focus de dano para todos em raio)
 */
function executeFireball(
  caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  allUnits: SkillCombatUnit[],
  skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um ponto alvo" };
  }

  const damage = caster.focus;
  const radius = skill.rangeValue ?? 2;
  let totalDamage = 0;

  for (const unit of allUnits) {
    if (!unit.isAlive) continue;

    const distance = getManhattanDistance(
      target.posX,
      target.posY,
      unit.posX,
      unit.posY
    );
    if (distance > radius) continue;

    // Dano mágico - aplica em proteção mágica primeiro
    let remainingDamage = damage;

    if (unit.magicalProtection > 0) {
      const absorbed = Math.min(unit.magicalProtection, remainingDamage);
      unit.magicalProtection -= absorbed;
      remainingDamage -= absorbed;
    }

    if (remainingDamage > 0) {
      unit.currentHp = Math.max(0, unit.currentHp - remainingDamage);
      totalDamage += remainingDamage;
    }

    if (unit.currentHp <= 0) {
      unit.isAlive = false;
    }
  }

  return {
    success: true,
    damageDealt: totalDamage,
    targetHpAfter: target.currentHp,
    targetDefeated: !target.isAlive,
  };
}

/**
 * WIZARD_TELEPORT: Teleporta para posição
 */
function executeTeleport(
  caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um destino" };
  }

  const destX = target.posX;
  const destY = target.posY;

  caster.posX = destX;
  caster.posY = destY;

  return {
    success: true,
    newPosX: destX,
    newPosY: destY,
  };
}

/**
 * WIZARD_MAGIC_MISSILE: Dano mágico garantido (Focus de dano)
 */
function executeMagicMissile(
  caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um alvo" };
  }

  const damage = caster.focus;
  let remainingDamage = damage;

  if (target.magicalProtection > 0) {
    const absorbed = Math.min(target.magicalProtection, remainingDamage);
    target.magicalProtection -= absorbed;
    remainingDamage -= absorbed;
  }

  if (remainingDamage > 0) {
    target.currentHp = Math.max(0, target.currentHp - remainingDamage);
  }

  const targetDefeated = target.currentHp <= 0;
  if (targetDefeated) {
    target.isAlive = false;
  }

  return {
    success: true,
    damageDealt: damage,
    targetHpAfter: target.currentHp,
    targetDefeated,
  };
}

/**
 * WIZARD_SHIELD: Ganha proteção mágica temporária
 */
function executeShield(
  caster: SkillCombatUnit,
  _target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const shieldAmount = caster.focus * 2;
  caster.magicalProtection = Math.min(
    caster.magicalProtection + shieldAmount,
    caster.maxMagicalProtection * 2
  );

  return {
    success: true,
    conditionApplied: "SHIELDED",
  };
}

// =============================================================================
// EXECUTORES - RANGER
// =============================================================================

/**
 * RANGER_HUNTERS_MARK: Marca um inimigo (+2 dano em ataques contra ele)
 */
function executeHuntersMark(
  _caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  _allUnits: SkillCombatUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um alvo" };
  }

  if (!target.conditions.includes("HUNTERS_MARK")) {
    target.conditions.push("HUNTERS_MARK");
  }

  return {
    success: true,
    conditionApplied: "HUNTERS_MARK",
  };
}

/**
 * RANGER_VOLLEY: Ataca todos os inimigos em área com metade do dano
 */
function executeVolley(
  caster: SkillCombatUnit,
  target: SkillCombatUnit | null,
  allUnits: SkillCombatUnit[],
  skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um ponto alvo" };
  }

  const baseDamage = Math.floor(caster.combat / 2);
  const radius = skill.rangeValue ?? 2;
  let totalDamage = 0;
  let unitsHit = 0;

  for (const unit of allUnits) {
    if (unit.ownerId === caster.ownerId) continue;
    if (!unit.isAlive) continue;

    const distance = getManhattanDistance(
      target.posX,
      target.posY,
      unit.posX,
      unit.posY
    );
    if (distance > radius) continue;

    // Dano físico
    let remainingDamage = baseDamage;

    if (unit.physicalProtection > 0) {
      const absorbed = Math.min(unit.physicalProtection, remainingDamage);
      unit.physicalProtection -= absorbed;
      remainingDamage -= absorbed;
    }

    if (remainingDamage > 0) {
      unit.currentHp = Math.max(0, unit.currentHp - remainingDamage);
      totalDamage += remainingDamage;
    }

    if (unit.currentHp <= 0) {
      unit.isAlive = false;
    }

    unitsHit++;
  }

  return {
    success: true,
    damageDealt: totalDamage,
  };
}

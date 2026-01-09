// server/src/ai/core/action-executor.ts
// Executor de ações da IA - integra com movement-actions e skill-executors

import type { BattleSession } from "@boundless/shared/types/battle-lobby.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type { AIDecision } from "../types/ai.types";
import {
  executeMoveAction,
  calculateBaseMovement,
} from "../../modules/combat/movement-actions";
import {
  executeSkill as executeSkillLogic,
  executeAttack as executeAttackLogic,
} from "../../modules/abilities/executors";
import { executeSpell as executeSpellLogic } from "../../modules/abilities/executors";
import { getAbilityByCode as getSpellByCode } from "@boundless/shared/data/abilities.data";
import {
  processAIUnit,
  aiActionDelay,
  logAIDecision,
  getAIUnits,
} from "./ai-controller";
import { emitAttackHitEvent } from "../../modules/combat/combat-events";

// Delay padrão entre ações da IA (ms)
const AI_ACTION_DELAY = 600;

// Callback type para emissão de eventos
type AIEventEmitter = (eventType: string, data: unknown) => void;

export interface AIExecutionResult {
  decision: AIDecision;
  success: boolean;
  error?: string;
  stateChanges?: {
    unitMoved?: {
      unitId: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    };
    unitAttacked?: {
      attackerId: string;
      attackerName: string;
      targetId: string;
      targetName: string;
      rawDamage: number;
      damageReduction: number;
      finalDamage: number;
      damageType: string;
      targetHpAfter: number;
      targetPhysicalProtection: number;
      targetMagicalProtection: number;
      defeated: boolean;
      missed: boolean;
    };
    skillUsed?: { casterId: string; skillCode: string; targetId: string };
  };
}

/**
 * Executa uma decisão de movimento
 */
function executeMove(
  decision: AIDecision,
  battle: BattleSession
): AIExecutionResult {
  const unit = battle.units.find((u) => u.id === decision.unitId);
  if (!unit || !unit.isAlive) {
    return {
      decision,
      success: false,
      error: "Unidade não encontrada ou morta",
    };
  }

  if (!decision.targetPosition) {
    return {
      decision,
      success: false,
      error: "Posição de destino não especificada",
    };
  }

  const obstacles = battle.config.map.obstacles || [];

  const result = executeMoveAction(
    unit,
    decision.targetPosition.x,
    decision.targetPosition.y,
    battle.config.grid.width,
    battle.config.grid.height,
    battle.units,
    obstacles
  );

  if (result.success) {
    // Atualizar estado da unidade na batalha
    unit.posX = decision.targetPosition.x;
    unit.posY = decision.targetPosition.y;
    unit.movesLeft = result.movesLeft ?? unit.movesLeft - 1;

    return {
      decision,
      success: true,
      stateChanges: {
        unitMoved: {
          unitId: unit.id,
          fromX: result.fromX!,
          fromY: result.fromY!,
          toX: result.toX!,
          toY: result.toY!,
        },
      },
    };
  }

  return { decision, success: false, error: result.error };
}

/**
 * Executa uma decisão de ataque
 */
function executeAttack(
  decision: AIDecision,
  battle: BattleSession
): AIExecutionResult {
  const attacker = battle.units.find((u) => u.id === decision.unitId);
  if (!attacker || !attacker.isAlive) {
    return {
      decision,
      success: false,
      error: "Atacante não encontrado ou morto",
    };
  }

  const target = battle.units.find((u) => u.id === decision.targetId);
  if (!target || !target.isAlive) {
    return { decision, success: false, error: "Alvo não encontrado ou morto" };
  }

  const result = executeAttackLogic(
    attacker,
    target,
    battle.units,
    {
      code: "ATTACK",
      name: "Atacar",
      category: "ACTIVE",
      commonAction: true,
    } as any,
    "FISICO",
    undefined,
    battle.battleId
  );

  if (result.success) {
    // Atualizar estado do alvo
    target.currentHp = result.targetHpAfter ?? target.currentHp;
    target.physicalProtection =
      result.targetPhysicalProtection ?? target.physicalProtection;
    target.magicalProtection =
      result.targetMagicalProtection ?? target.magicalProtection;
    target.isAlive = !result.targetDefeated;

    // Atualizar ataques restantes do atacante
    attacker.attacksLeftThisTurn = result.attacksLeftThisTurn ?? 0;
    if (attacker.attacksLeftThisTurn <= 0) {
      attacker.actionsLeft = Math.max(0, attacker.actionsLeft - 1);
    }

    return {
      decision,
      success: true,
      stateChanges: {
        unitAttacked: {
          attackerId: attacker.id,
          attackerName: attacker.name,
          targetId: target.id,
          targetName: target.name,
          rawDamage: result.rawDamage ?? 0,
          damageReduction: result.damageReduction ?? 0,
          finalDamage: result.finalDamage ?? 0,
          damageType: result.damageType ?? "FISICO",
          targetHpAfter: result.targetHpAfter ?? target.currentHp,
          targetPhysicalProtection:
            result.targetPhysicalProtection ?? target.physicalProtection,
          targetMagicalProtection:
            result.targetMagicalProtection ?? target.magicalProtection,
          defeated: result.targetDefeated ?? false,
          missed: result.missed ?? false,
        },
      },
    };
  }

  return { decision, success: false, error: result.error };
}

/**
 * Executa uma decisão de skill
 * Reutiliza o sistema de skills existente
 */
function executeSkill(
  decision: AIDecision,
  battle: BattleSession
): AIExecutionResult {
  const caster = battle.units.find((u) => u.id === decision.unitId);
  if (!caster || !caster.isAlive) {
    return {
      decision,
      success: false,
      error: "Caster não encontrado ou morto",
    };
  }

  if (!decision.skillCode) {
    return {
      decision,
      success: false,
      error: "Código da skill não especificado",
    };
  }

  // Encontrar alvo se especificado
  const target = decision.targetId
    ? battle.units.find((u) => u.id === decision.targetId) || null
    : null;

  // Executar skill usando o sistema existente
  // Nota: executeSkillLogic já gerencia consumo de ação e cooldown automaticamente
  const result = executeSkillLogic(
    caster,
    decision.skillCode,
    target,
    battle.units,
    true // isBattle - sempre true para batalhas
  );

  if (result.success) {
    return {
      decision,
      success: true,
      stateChanges: {
        skillUsed: {
          casterId: caster.id,
          skillCode: decision.skillCode,
          targetId: decision.targetId || caster.id,
        },
      },
    };
  }

  return { decision, success: false, error: result.error };
}

/**
 * Executa uma decisão de dash (corrida)
 * Agora usa o sistema de skills com código "DASH"
 */
function executeDash(
  decision: AIDecision,
  battle: BattleSession
): AIExecutionResult {
  const unit = battle.units.find((u) => u.id === decision.unitId);
  if (!unit || !unit.isAlive) {
    return {
      decision,
      success: false,
      error: "Unidade não encontrada ou morta",
    };
  }

  // Usar o executor de skill DASH (PvP sempre tem isBattle = true)
  const result = executeSkillLogic(unit, "DASH", null, battle.units, true);

  if (result.success) {
    return {
      decision,
      success: true,
    };
  }

  return { decision, success: false, error: result.error };
}

/**
 * Executa uma decisão de spell (magia)
 */
function executeSpellAction(
  decision: AIDecision,
  battle: BattleSession
): AIExecutionResult {
  const caster = battle.units.find((u) => u.id === decision.unitId);
  if (!caster || !caster.isAlive) {
    return {
      decision,
      success: false,
      error: "Caster não encontrado ou morto",
    };
  }

  if (!decision.spellCode) {
    return {
      decision,
      success: false,
      error: "Código da spell não especificado",
    };
  }

  const spellResult = getSpellByCode(decision.spellCode);
  if (!spellResult) {
    return {
      decision,
      success: false,
      error: `Spell não encontrada: ${decision.spellCode}`,
    };
  }
  const spell = spellResult.ability;

  // Determinar o alvo (pode ser unidade ou posição)
  let target: BattleUnit | { x: number; y: number } | null = null;

  if (decision.targetId) {
    target = battle.units.find((u) => u.id === decision.targetId) || null;
  } else if (decision.targetPosition) {
    target = decision.targetPosition;
  }

  // Executar spell
  const result = executeSpellLogic(spell, caster, target, battle.units);

  if (result.success) {
    // Consumir ação
    caster.actionsLeft = Math.max(0, caster.actionsLeft - 1);

    return {
      decision,
      success: true,
    };
  }

  return { decision, success: false, error: result.error };
}

/**
 * Executa uma única decisão da IA
 */
export function executeAIDecision(
  decision: AIDecision,
  battle: BattleSession
): AIExecutionResult {
  switch (decision.type) {
    case "MOVE":
      return executeMove(decision, battle);
    case "ATTACK":
      return executeAttack(decision, battle);
    case "SKILL":
      return executeSkill(decision, battle);
    case "SPELL":
      return executeSpellAction(decision, battle);
    case "DASH":
      return executeDash(decision, battle);
    case "PASS":
      return { decision, success: true };
    default:
      return {
        decision,
        success: false,
        error: "Tipo de decisão desconhecido",
      };
  }
}

/**
 * Executa o turno completo da IA com delays para visualização
 * Usa callback para emitir eventos para os clientes
 */
export async function executeFullAITurn(
  battle: BattleSession,
  emit: AIEventEmitter
): Promise<AIExecutionResult[]> {
  const results: AIExecutionResult[] = [];
  const aiUnits = getAIUnits(battle);

  console.log(`[AI] Executando turno completo - ${aiUnits.length} unidades`);

  // Emitir início do turno da IA
  emit("battle:ai-turn-start", {
    battleId: battle.battleId,
    aiUnitsCount: aiUnits.length,
  });

  // Processar cada unidade
  for (const unit of aiUnits) {
    // Resetar recursos da unidade para o turno
    unit.movesLeft = Math.max(1, unit.speed);
    unit.actionsLeft = 1;
    unit.attacksLeftThisTurn = 0;

    // Emitir que esta unidade está agindo
    emit("battle:ai-unit-acting", {
      battleId: battle.battleId,
      unitId: unit.id,
      unitName: unit.name,
    });

    await aiActionDelay(AI_ACTION_DELAY / 2);

    // Loop de ações até a unidade não ter mais o que fazer
    let actionCount = 0;
    const maxActions = 10; // Limite de segurança

    while (actionCount < maxActions) {
      // Processar decisão para esta unidade específica (O(1) ao invés de O(n))
      const decision = await processAIUnit(battle, unit.id);

      if (!decision || decision.type === "PASS") {
        break;
      }

      logAIDecision(decision, unit);

      // Executar decisão
      const result = executeAIDecision(decision, battle);
      results.push(result);

      if (result.success) {
        // Emitir ação executada
        emit("battle:ai-action", {
          battleId: battle.battleId,
          unitId: unit.id,
          action: decision.type,
          targetPosition: decision.targetPosition,
          targetId: decision.targetId,
          skillCode: decision.skillCode,
          reason: decision.reason,
          stateChanges: result.stateChanges,
        });

        // === EMITIR EVENTOS DETALHADOS DE ATAQUE ===
        if (decision.type === "ATTACK" && result.stateChanges?.unitAttacked) {
          const attack = result.stateChanges.unitAttacked;
          const targetUnit = battle.units.find((u) => u.id === attack.targetId);

          // Emitir evento detalhado de ataque via callback (Colyseus)
          emit("battle:unit_attacked", {
            battleId: battle.battleId,
            attackerUnitId: attack.attackerId,
            targetUnitId: attack.targetId,
            targetObstacleId: null,
            targetType: "unit",
            damage: attack.finalDamage,
            damageType: attack.damageType,
            targetHpAfter: attack.targetHpAfter,
            attackerActionsLeft: unit.actionsLeft,
            attackerAttacksLeftThisTurn: unit.attacksLeftThisTurn,
            missed: attack.missed,
            rawDamage: attack.rawDamage,
            damageReduction: attack.damageReduction,
            finalDamage: attack.finalDamage,
            targetPhysicalProtection: attack.targetPhysicalProtection,
            targetMagicalProtection: attack.targetMagicalProtection,
            targetDefeated: attack.defeated,
            obstacleDestroyed: false,
            obstacleId: null,
            attackerName: attack.attackerName,
            attackerIcon: "🤖",
            attackerCombat: unit.combat,
            targetName: attack.targetName,
            targetIcon: "🛡️",
            targetCombat: 0,
            targetSpeed: 0,
          });

          // Emitir eventos de combate para o log de batalha (com visibilidade)
          if (targetUnit) {
            if (!attack.missed) {
              emitAttackHitEvent(
                battle.battleId,
                unit,
                targetUnit,
                {
                  success: true,
                  rawDamage: attack.rawDamage,
                  finalDamage: attack.finalDamage,
                  damageType: attack.damageType,
                  targetHpAfter: attack.targetHpAfter,
                  targetDefeated: attack.defeated,
                  damageReduction: attack.damageReduction,
                  targetPhysicalProtection: attack.targetPhysicalProtection,
                  targetMagicalProtection: attack.targetMagicalProtection,
                },
                battle.units
              );
            }
          }
        }

        // Emitir estado atualizado da batalha
        emit("battle:state-updated", {
          battleId: battle.battleId,
          units: battle.units,
        });
      } else {
        console.log(`[AI] Ação falhou: ${result.error}`);
      }

      await aiActionDelay(AI_ACTION_DELAY);
      actionCount++;

      // Se não tem mais ações ou movimentos, parar
      if (unit.movesLeft <= 0 && unit.actionsLeft <= 0) {
        break;
      }
    }
  }

  // Emitir fim do turno da IA
  emit("battle:ai-turn-end", {
    battleId: battle.battleId,
    actionsExecuted: results.length,
  });

  console.log(`[AI] Turno completo - ${results.length} ações executadas`);

  return results;
}

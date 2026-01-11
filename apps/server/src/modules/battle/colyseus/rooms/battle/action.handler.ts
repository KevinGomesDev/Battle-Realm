// action.handler.ts - Handlers de ações de unidades
import type { Client, Room } from "@colyseus/core";
import type { BattleSessionState, BattleUnitSchema } from "../../schemas";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type { CommandPayload } from "@boundless/shared/types/commands.types";
import { getUnitSizeDefinition, type UnitSize } from "@boundless/shared/config";
import { findAbilityByCode } from "@boundless/shared/data/abilities.data";
import { executeSkill } from "../../../../abilities/executors";
import { handleCommand } from "../../../../match/commands";
import { createAndEmitEvent } from "../../../../match/services/event.service";
import { emitAbilityExecutedEvent } from "../../../../combat/combat-events";
import { processUnitDeath } from "../../../../combat/death-logic";
import { schemaUnitToBattleUnit, syncUnitFromResult } from "./utils";
import { getUserData, sendError } from "./types";
import { canUnitAct } from "./turn.handler";

/**
 * Handler de início de ação
 */
export function handleBeginAction(
  client: Client,
  unitId: string,
  state: BattleSessionState,
  broadcast: Room<BattleSessionState>["broadcast"]
): void {
  const userData = getUserData(client);
  if (!userData) return;

  const unit = state.units.get(unitId);
  if (!unit) {
    sendError(client, "Unidade não encontrada");
    return;
  }

  if (unit.ownerId !== userData.userId) {
    sendError(client, "Esta unidade não é sua");
    return;
  }

  if (state.activeUnitId !== unitId) {
    sendError(client, "Não é o turno desta unidade");
    return;
  }

  // Verificar se a unidade pode agir (viva e sem DISABLED)
  if (!canUnitAct(unit)) {
    sendError(client, "Esta unidade está desabilitada e não pode agir");
    return;
  }

  unit.hasStartedAction = true;
  broadcast("battle:action_started", { unitId });
}

/**
 * Handler de fim de ação
 */
export function handleEndAction(
  client: Client,
  unitId: string,
  state: BattleSessionState,
  advanceToNextUnit: () => void
): void {
  const userData = getUserData(client);
  if (!userData) return;

  const unit = state.units.get(unitId);
  if (!unit || unit.ownerId !== userData.userId) {
    return;
  }

  if (state.activeUnitId !== unitId) {
    return;
  }

  advanceToNextUnit();
}

/**
 * Handler ÚNICO para execução de abilities (skills + spells)
 * PONTO DE ENTRADA: battle:use_ability
 */
export function handleAbility(
  client: Client,
  unitId: string,
  abilityCode: string,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"],
  targetPosition?: { x: number; y: number },
  targetUnitId?: string
): void {
  const userData = getUserData(client);
  if (!userData) return;

  const unit = state.units.get(unitId);
  if (!unit || unit.ownerId !== userData.userId) {
    sendError(client, "Ação inválida");
    return;
  }

  if (!abilityCode) {
    sendError(client, "abilityCode é obrigatório");
    return;
  }

  const ability = findAbilityByCode(abilityCode);
  if (!ability) {
    sendError(client, `Ability não encontrada: ${abilityCode}`);
    return;
  }

  // Log: Ability recebida e executor que será usado
  console.log(`[BattleRoom] 📦 Ability recebida:`, {
    abilityCode,
    abilityName: ability.name,
    executor: ability.functionName || "SEM_EXECUTOR",
    caster: unit.name,
    casterId: unitId,
    targetPosition,
  });

  if (state.activeUnitId !== unitId) {
    sendError(client, "Não é o turno desta unidade");
    return;
  }

  const allUnits: BattleUnit[] = Array.from(state.units.values()).map((u) =>
    schemaUnitToBattleUnit(u)
  );
  const casterUnit = schemaUnitToBattleUnit(unit);

  // Target é encontrado pela targetPosition (células) - NÃO pelo targetUnitId
  // O frontend envia apenas as células, o servidor encontra as unidades afetadas
  let target: BattleUnit | null = null;

  if (targetPosition) {
    // Buscar unidade viva na posição alvo (considerando tamanho)
    const targetUnit = allUnits.find((u) => {
      if (!u.isAlive) return false;
      const sizeDef = getUnitSizeDefinition(u.size as UnitSize);
      const dimension = sizeDef.dimension;
      for (let dx = 0; dx < dimension; dx++) {
        for (let dy = 0; dy < dimension; dy++) {
          if (
            u.posX + dx === targetPosition.x &&
            u.posY + dy === targetPosition.y
          ) {
            return true;
          }
        }
      }
      return false;
    });
    if (targetUnit) {
      target = targetUnit;
    }
  }

  const obstacleArray = Array.from(state.obstacles).filter(
    (o): o is NonNullable<typeof o> => o != null
  );
  const context = {
    obstacles: obstacleArray.map((o) => ({
      id: o.id,
      posX: o.posX,
      posY: o.posY,
      hp: o.hp,
      destroyed: o.destroyed || false,
      type: (o.type || "default") as any,
      size: o.size || "SMALL",
    })),
    targetPosition,
    battleId: roomId,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
  };

  // FLUXO UNIFICADO: Todas as abilities passam pelo executeSkill
  const result = executeSkill(
    casterUnit,
    abilityCode,
    target,
    allUnits,
    true,
    context
  );

  // Log: Resultado do executor
  console.log(
    `[BattleRoom] 📤 Resultado do executor ${ability.functionName}:`,
    {
      success: result.success,
      error: result.error,
      casterActionsLeft: result.casterActionsLeft,
      targetHpAfter: result.targetHpAfter,
    }
  );

  if (!result.success) {
    sendError(client, result.error || "Falha ao executar ability");
    return;
  }

  // === TRATAMENTO DE ATTACK MISS (ataque no ar) ===
  if (result.missed) {
    unit.actionsLeft = casterUnit.actionsLeft;
    unit.attacksLeftThisTurn = casterUnit.attacksLeftThisTurn ?? 0;
    unit.hasStartedAction = true;

    broadcast("battle:attack_missed", {
      attackerId: unitId,
      targetPosition,
      message: "O ataque não atingiu nenhum alvo!",
      actionsLeft: unit.actionsLeft,
      attacksLeftThisTurn: unit.attacksLeftThisTurn,
    });

    createAndEmitEvent({
      context: "BATTLE",
      scope: "GLOBAL",
      category: "COMBAT",
      severity: "INFO",
      battleId: roomId,
      sourceUserId: unit.ownerId,
      message: `${unit.name} atacou a posição (${targetPosition?.x}, ${targetPosition?.y}) mas não acertou nenhum alvo!`,
      code: "ATTACK_MISSED",
      data: { targetPosition },
      actorId: unitId,
      actorName: unit.name,
    }).catch(console.error);
    return;
  }

  // === FLUXO NORMAL: Sincronizar resultado ===
  console.log(`[BattleRoom] 🔍 ANTES sync - Schema:`, {
    actionsLeft: unit.actionsLeft,
    movesLeft: unit.movesLeft,
  });
  console.log(`[BattleRoom] 🔍 ANTES sync - BattleUnit:`, {
    actionsLeft: casterUnit.actionsLeft,
    movesLeft: casterUnit.movesLeft,
  });

  syncUnitFromResult(unit, casterUnit, result);

  console.log(`[BattleRoom] 🔍 DEPOIS sync - Schema:`, {
    actionsLeft: unit.actionsLeft,
    movesLeft: unit.movesLeft,
  });

  // Sincronizar alvo se houver
  if (target && result.targetHpAfter !== undefined) {
    const targetSchema = state.units.get(target.id);
    if (targetSchema) {
      const targetUnit = allUnits.find((u) => u.id === target.id);
      if (targetUnit) {
        syncUnitFromResult(targetSchema, targetUnit, result);

        if (targetUnit.currentHp <= 0 && targetSchema.isAlive) {
          targetSchema.isAlive = false;
          processUnitDeath(targetUnit, allUnits);
        }
      }
    }
  }

  // Sincronizar múltiplas unidades afetadas (spells de área)
  if (result.affectedUnits && result.affectedUnits.length > 0) {
    for (const affected of result.affectedUnits) {
      const affectedSchema = state.units.get(affected.unitId);
      if (affectedSchema) {
        const affectedUnit = allUnits.find((u) => u.id === affected.unitId);
        if (affectedUnit) {
          // Sincronizar HP
          affectedSchema.currentHp = affected.hpAfter;
          affectedUnit.currentHp = affected.hpAfter;

          // Verificar morte
          if (affected.defeated && affectedSchema.isAlive) {
            affectedSchema.isAlive = false;
            processUnitDeath(affectedUnit, allUnits);
          }
        }
      }
    }
  }

  // Sincronizar obstáculo se foi atacado
  if (result.obstacleDestroyed !== undefined && result.obstacleId) {
    const obstacle = state.obstacles.find((o) => o.id === result.obstacleId);
    if (obstacle) {
      obstacle.hp = result.targetHpAfter ?? 0;
      obstacle.destroyed = result.obstacleDestroyed;

      broadcast("battle:obstacle_attacked", {
        attackerId: unitId,
        obstacleId: obstacle.id,
        damage: result.damageDealt,
        destroyed: obstacle.destroyed,
      });
    }
  }

  // Log: Enviando resposta para o client
  console.log(`[BattleRoom] 📡 Enviando battle:skill_used para clients:`, {
    casterUnitId: unitId,
    skillCode: abilityCode,
    resultSuccess: result.success,
  });

  // Serializar activeEffects para envio
  const serializedActiveEffects: Record<string, any> = {};
  unit.activeEffects?.forEach((effect: any, key: string) => {
    serializedActiveEffects[key] = {
      key: effect.key,
      value:
        typeof effect.value === "string"
          ? isNaN(Number(effect.value))
            ? effect.value === "true"
            : Number(effect.value)
          : effect.value,
      sources:
        typeof effect.sources === "string"
          ? JSON.parse(effect.sources)
          : effect.sources,
    };
  });

  broadcast("battle:skill_used", {
    casterUnitId: unitId,
    skillCode: abilityCode,
    targetPosition,
    // Enviar impactPoint do resultado (pode ser diferente do targetPosition se interceptado)
    impactPoint: result.metadata?.impactPoint ?? targetPosition,
    affectedCells: result.metadata?.affectedCells,
    isAreaAbility: !!(
      result.metadata?.affectedCells?.length &&
      result.metadata.affectedCells.length > 1
    ),
    result,
    casterUpdated: {
      actionsLeft: unit.actionsLeft,
      movesLeft: unit.movesLeft,
      currentHp: unit.currentHp,
      currentMana: unit.currentMana,
      attacksLeftThisTurn: unit.attacksLeftThisTurn,
      conditions: Array.from(unit.conditions),
      activeEffects: serializedActiveEffects,
      unitCooldowns: Object.fromEntries(unit.unitCooldowns.entries()),
    },
  });

  // Emitir evento detalhado com todos os dados do resultado
  emitAbilityExecutedEvent(
    roomId,
    ability,
    casterUnit,
    target,
    result,
    allUnits
  ).catch((err) =>
    console.error("[BattleRoom] Erro ao criar evento de ability:", err)
  );
}

/**
 * Handler para comandos de batalha (ex: /spawn, /godmode)
 */
export function handleBattleCommand(
  client: Client,
  payload: CommandPayload,
  userId: string,
  state: BattleSessionState,
  broadcast: Room<BattleSessionState>["broadcast"]
): void {
  const { commandCode, selectedUnitId } = payload;

  if (state.status !== "ACTIVE") {
    client.send("battle:command:response", {
      commandCode,
      result: {
        success: false,
        message: "Comandos só podem ser executados durante uma batalha ativa",
      },
    });
    return;
  }

  let selectedUnit = null;
  if (selectedUnitId) {
    selectedUnit = state.units.get(selectedUnitId) || null;
  }

  const context = {
    battleState: state,
    userId,
    selectedUnit,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
  };

  const result = handleCommand(payload, context);

  client.send("battle:command:response", {
    commandCode,
    result,
  });

  if (result.success) {
    broadcast("battle:command:executed", {
      commandCode,
      userId,
      message: result.message,
    });
  }
}

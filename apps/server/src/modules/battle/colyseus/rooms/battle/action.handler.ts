// action.handler.ts - Handlers de ações de unidades
import type { Client, Room } from "@colyseus/core";
import type { BattleSessionState, BattleUnitSchema } from "../../schemas";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type { CommandPayload } from "@boundless/shared/types/commands.types";
import { findAbilityByCode } from "@boundless/shared/data/abilities.data";
import { executeSkill } from "../../../../abilities/executors";
import { handleCommand } from "../../../../match/commands";
import { createAndEmitEvent } from "../../../../match/services/event.service";
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
 * Handler de execução de ação/ability
 * FLUXO UNIFICADO: Todas as abilities passam pelo mesmo caminho
 */
export function handleExecuteAction(
  client: Client,
  actionName: string,
  unitId: string,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"],
  startQTEFn: (client: Client, attackerId: string, targetId: string) => void,
  params?: Record<string, unknown>
): void {
  const userData = getUserData(client);
  if (!userData) return;

  const unit = state.units.get(unitId);
  if (!unit || unit.ownerId !== userData.userId) {
    sendError(client, "Ação inválida");
    return;
  }

  if (actionName === "use_ability") {
    handleUseAbility(
      client,
      unit,
      unitId,
      state,
      roomId,
      broadcast,
      startQTEFn,
      params
    );
    return;
  }

  sendError(client, `Ação desconhecida: ${actionName}`);
}

function handleUseAbility(
  client: Client,
  unit: BattleUnitSchema,
  unitId: string,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"],
  startQTEFn: (client: Client, attackerId: string, targetId: string) => void,
  params?: Record<string, unknown>
): void {
  const abilityCode = params?.abilityCode as string;
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
    targetUnitId: params?.targetUnitId,
    targetPosition: params?.targetPosition,
  });

  if (state.activeUnitId !== unitId) {
    sendError(client, "Não é o turno desta unidade");
    return;
  }

  const allUnits: BattleUnit[] = Array.from(state.units.values()).map((u) =>
    schemaUnitToBattleUnit(u)
  );
  const casterUnit = schemaUnitToBattleUnit(unit);

  let target: BattleUnit | null = null;

  if (params?.targetUnitId) {
    const targetSchema = state.units.get(params.targetUnitId as string);
    if (targetSchema) {
      target = schemaUnitToBattleUnit(targetSchema);
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
    })),
    targetPosition: params?.targetPosition as
      | { x: number; y: number }
      | undefined,
    battleId: roomId,
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
      requiresQTE: result.requiresQTE,
      casterActionsLeft: result.casterActionsLeft,
      targetHpAfter: result.targetHpAfter,
    }
  );

  if (!result.success) {
    sendError(client, result.error || "Falha ao executar ability");
    return;
  }

  // === TRATAMENTO DE QTE (para ATTACK em unidade viva) ===
  if (result.requiresQTE && result.qteAttackerId && result.qteTargetId) {
    // Inicia QTE - o callback vai executar o ataque real após o QTE
    startQTEFn(client, result.qteAttackerId, result.qteTargetId);
    return;
  }

  // === TRATAMENTO DE ATTACK MISS (ataque no ar) ===
  if (
    abilityCode === "ATTACK" &&
    result.damageDealt === 0 &&
    !result.targetHpAfter
  ) {
    unit.actionsLeft = casterUnit.actionsLeft;
    unit.attacksLeftThisTurn = casterUnit.attacksLeftThisTurn ?? 0;
    unit.hasStartedAction = true;

    const targetPos = params?.targetPosition as { x: number; y: number };
    broadcast("battle:attack_missed", {
      attackerId: unitId,
      targetPosition: targetPos,
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
      message: `${unit.name} atacou a posição (${targetPos?.x}, ${targetPos?.y}) mas não acertou nenhum alvo!`,
      code: "ATTACK_MISSED",
      data: { targetPosition: targetPos },
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

  broadcast("battle:skill_used", {
    casterUnitId: unitId,
    skillCode: abilityCode,
    targetUnitId: params?.targetUnitId,
    targetPosition: params?.targetPosition,
    result,
    casterUpdated: {
      actionsLeft: unit.actionsLeft,
      movesLeft: unit.movesLeft,
      currentHp: unit.currentHp,
      currentMana: unit.currentMana,
      attacksLeftThisTurn: unit.attacksLeftThisTurn,
    },
  });

  createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
    category: "SKILL",
    severity: "INFO",
    battleId: roomId,
    sourceUserId: unit.ownerId,
    message: `${unit.name} usou ${ability.name}`,
    code: "ABILITY_USED",
    actorId: unitId,
    actorName: unit.name,
    targetId: params?.targetUnitId as string | undefined,
    targetName: params?.targetUnitId
      ? state.units.get(params.targetUnitId as string)?.name
      : undefined,
  }).catch((err) =>
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

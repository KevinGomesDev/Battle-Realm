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
 */
export function handleExecuteAction(
  client: Client,
  actionName: string,
  unitId: string,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"],
  handleAttackFn: (
    client: Client,
    unitId: string,
    targetUnitId?: string,
    targetPosition?: { x: number; y: number }
  ) => void,
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
      handleAttackFn,
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
  handleAttackFn: (
    client: Client,
    unitId: string,
    targetUnitId?: string,
    targetPosition?: { x: number; y: number }
  ) => void,
  params?: Record<string, unknown>
): void {
  const abilityCode = params?.abilityCode as string;
  if (!abilityCode) {
    sendError(client, "abilityCode é obrigatório");
    return;
  }

  // ATTACK usa handler separado (tem QTE)
  if (abilityCode === "ATTACK") {
    handleAttackFn(
      client,
      unitId,
      params?.targetUnitId as string | undefined,
      params?.targetPosition as { x: number; y: number } | undefined
    );
    return;
  }

  const ability = findAbilityByCode(abilityCode);
  if (!ability) {
    sendError(client, `Ability não encontrada: ${abilityCode}`);
    return;
  }

  if (state.activeUnitId !== unitId) {
    sendError(client, "Não é o turno desta unidade");
    return;
  }

  const allUnits: BattleUnit[] = Array.from(state.units.values()).map((u) =>
    schemaUnitToBattleUnit(u)
  );
  const casterUnit = schemaUnitToBattleUnit(unit);

  let target: BattleUnit | { x: number; y: number } | null = null;

  if (params?.targetUnitId) {
    const targetSchema = state.units.get(params.targetUnitId as string);
    if (targetSchema) {
      target = schemaUnitToBattleUnit(targetSchema);
    }
  } else if (params?.targetPosition) {
    target = params.targetPosition as { x: number; y: number };
  }

  const obstacleArray = Array.from(state.obstacles).filter(
    (o): o is NonNullable<typeof o> => o != null
  );
  const context = {
    obstacles: obstacleArray.map((o) => ({
      x: o.posX,
      y: o.posY,
      type: o.type || "default",
    })),
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    targetPosition: params?.targetPosition as
      | { x: number; y: number }
      | undefined,
  };

  const result = executeSkill(
    casterUnit,
    abilityCode,
    target as BattleUnit | null,
    allUnits,
    true,
    context
  );

  if (!result.success) {
    sendError(client, result.error || "Falha ao executar ability");
    return;
  }

  syncUnitFromResult(unit, casterUnit, result);

  if (target && "id" in target && result.targetHpAfter !== undefined) {
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

  broadcast("battle:skill_used", {
    casterUnitId: unitId,
    skillCode: abilityCode,
    targetUnitId: params?.targetUnitId,
    targetPosition: params?.targetPosition,
    result,
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

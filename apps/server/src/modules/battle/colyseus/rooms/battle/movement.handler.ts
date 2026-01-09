// movement.handler.ts - Handler de movimento de unidades
import type { Client, Room } from "@colyseus/core";
import type { BattleSessionState } from "../../schemas";
import { createAndEmitEvent } from "../../../../match/services/event.service";
import { getAllUnitsAsBattleUnits, schemaUnitToBattleUnit } from "./utils";
import { getUserData, sendError } from "./types";
import { validateMove } from "@boundless/shared/utils/engagement.utils";

/**
 * Handler de movimento de unidade
 */
export function handleMove(
  client: Client,
  unitId: string,
  toX: number,
  toY: number,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"]
): void {
  const userData = getUserData(client);
  if (!userData) return;

  const unitSchema = state.units.get(unitId);
  if (!unitSchema) {
    sendError(client, "Unidade não encontrada");
    return;
  }

  if (unitSchema.ownerId !== userData.userId) {
    sendError(client, "Esta unidade não é sua");
    return;
  }

  // Converter schemas para tipos de batalha
  const unit = schemaUnitToBattleUnit(unitSchema);
  const allUnits = getAllUnitsAsBattleUnits(state);
  const obstacles = Array.from(state.obstacles)
    .filter((o): o is NonNullable<typeof o> => o !== undefined)
    .map((o) => ({
      posX: o.posX,
      posY: o.posY,
      destroyed: o.destroyed,
    }));

  // Validar movimento com custo de engajamento
  const moveValidation = validateMove(
    unit,
    toX,
    toY,
    allUnits,
    obstacles,
    state.gridWidth,
    state.gridHeight
  );

  if (!moveValidation.valid) {
    sendError(client, moveValidation.error || "Movimento inválido");
    return;
  }

  const fromX = unitSchema.posX;
  const fromY = unitSchema.posY;

  // Aplicar movimento usando custo TOTAL (base + engajamento)
  unitSchema.posX = toX;
  unitSchema.posY = toY;
  unitSchema.movesLeft -= moveValidation.totalCost;

  broadcast("battle:unit_moved", {
    unitId,
    fromX,
    fromY,
    toX,
    toY,
    movesLeft: unitSchema.movesLeft,
    baseCost: moveValidation.baseCost,
    engagementCost: moveValidation.engagementCost,
    totalCost: moveValidation.totalCost,
  });

  createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
    category: "COMBAT",
    severity: "INFO",
    battleId: roomId,
    sourceUserId: unitSchema.ownerId,
    message:
      moveValidation.engagementCost > 0
        ? `${unitSchema.name} se moveu de (${fromX}, ${fromY}) para (${toX}, ${toY}) [Custo de engajamento: ${moveValidation.engagementCost}]`
        : `${unitSchema.name} se moveu de (${fromX}, ${fromY}) para (${toX}, ${toY})`,
    code: "UNIT_MOVED",
    data: {
      fromPosition: { x: fromX, y: fromY },
      toPosition: { x: toX, y: toY },
      baseCost: moveValidation.baseCost,
      engagementCost: moveValidation.engagementCost,
      totalCost: moveValidation.totalCost,
      movesLeft: unitSchema.movesLeft,
    },
    actorId: unitSchema.id,
    actorName: unitSchema.name,
  }).catch((err) =>
    console.error("[BattleRoom] Erro ao criar evento de movimento:", err)
  );
}

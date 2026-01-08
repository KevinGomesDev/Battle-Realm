// movement.handler.ts - Handler de movimento de unidades
import type { Client, Room } from "@colyseus/core";
import type { BattleSessionState } from "../../schemas";
import { createAndEmitEvent } from "../../../../match/services/event.service";
import { isValidPosition } from "./utils";
import { getUserData, sendError } from "./types";

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

  const unit = state.units.get(unitId);
  if (!unit) {
    sendError(client, "Unidade não encontrada");
    return;
  }

  if (unit.ownerId !== userData.userId) {
    sendError(client, "Esta unidade não é sua");
    return;
  }

  const distance = Math.abs(toX - unit.posX) + Math.abs(toY - unit.posY);

  if (distance > unit.movesLeft) {
    sendError(client, "Movimento insuficiente");
    return;
  }

  if (!isValidPosition(state, toX, toY)) {
    sendError(client, "Posição inválida");
    return;
  }

  const fromX = unit.posX;
  const fromY = unit.posY;

  unit.posX = toX;
  unit.posY = toY;
  unit.movesLeft -= distance;

  broadcast("battle:unit_moved", {
    unitId,
    fromX,
    fromY,
    toX,
    toY,
    movesLeft: unit.movesLeft,
  });

  createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
    category: "COMBAT",
    severity: "INFO",
    battleId: roomId,
    sourceUserId: unit.ownerId,
    message: `${unit.name} se moveu de (${fromX}, ${fromY}) para (${toX}, ${toY})`,
    code: "UNIT_MOVED",
    data: {
      fromPosition: { x: fromX, y: fromY },
      toPosition: { x: toX, y: toY },
      distance,
      movesLeft: unit.movesLeft,
    },
    actorId: unit.id,
    actorName: unit.name,
  }).catch((err) =>
    console.error("[BattleRoom] Erro ao criar evento de movimento:", err)
  );
}

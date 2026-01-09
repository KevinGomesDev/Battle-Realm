// combat.handler.ts - Handlers de combate
import type { Client, Room } from "@colyseus/core";
import type {
  BattleSessionState,
  BattleUnitSchema,
  BattleObstacleSchema,
} from "../../schemas";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import {
  type ObstacleType,
  getUnitSizeDefinition,
  getObstacleDimension,
  type UnitSize,
  type ObstacleSize,
} from "@boundless/shared/config";
import { isWithinRange } from "@boundless/shared/utils/distance.utils";
import { executeAttack } from "../../../../abilities/executors";
import { createAndEmitEvent } from "../../../../match/services/event.service";
import {
  schemaUnitToBattleUnit,
  canAttack,
  consumeAttackResource,
} from "./utils";
import { getUserData, sendError } from "./types";

/**
 * Handler principal de ataque
 */
export function handleAttack(
  client: Client,
  attackerId: string,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"],
  startQTEFn: (
    client: Client,
    attacker: BattleUnitSchema,
    target: BattleUnitSchema
  ) => void,
  targetId?: string,
  targetObstacleId?: string,
  targetPosition?: { x: number; y: number }
): void {
  const userData = getUserData(client);
  if (!userData) return;

  const attacker = state.units.get(attackerId);
  if (!attacker) {
    sendError(client, "Atacante não encontrado");
    return;
  }

  if (attacker.ownerId !== userData.userId) {
    sendError(client, "Esta unidade não é sua");
    return;
  }

  if (!canAttack(attacker)) {
    sendError(client, "Sem ataques ou ações restantes");
    return;
  }

  if (targetId) {
    handleUnitAttack(client, attacker, targetId, state, startQTEFn);
  } else if (targetObstacleId) {
    handleObstacleAttack(
      client,
      attacker,
      targetObstacleId,
      state,
      roomId,
      broadcast
    );
  } else if (targetPosition) {
    handlePositionAttack(
      client,
      attackerId,
      attacker,
      targetPosition,
      state,
      roomId,
      broadcast,
      startQTEFn
    );
  }
}

function handleUnitAttack(
  client: Client,
  attacker: BattleUnitSchema,
  targetId: string,
  state: BattleSessionState,
  startQTEFn: (
    client: Client,
    attacker: BattleUnitSchema,
    target: BattleUnitSchema
  ) => void
): void {
  const target = state.units.get(targetId);
  if (!target) {
    sendError(client, "Alvo não encontrado");
    return;
  }

  if (
    !isWithinRange(attacker.posX, attacker.posY, target.posX, target.posY, 1)
  ) {
    sendError(client, "Alvo fora de alcance");
    return;
  }

  startQTEFn(client, attacker, target);
}

function handleObstacleAttack(
  client: Client,
  attacker: BattleUnitSchema,
  targetObstacleId: string,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"]
): void {
  const obstacle = state.obstacles.find((o) => o.id === targetObstacleId);
  if (!obstacle) {
    sendError(client, "Obstáculo não encontrado");
    return;
  }

  if (
    !isWithinRange(
      attacker.posX,
      attacker.posY,
      obstacle.posX,
      obstacle.posY,
      1
    )
  ) {
    sendError(client, "Obstáculo fora de alcance");
    return;
  }

  performObstacleAttack(attacker, obstacle, state, roomId, broadcast);
}

function handlePositionAttack(
  client: Client,
  attackerId: string,
  attacker: BattleUnitSchema,
  targetPosition: { x: number; y: number },
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"],
  startQTEFn: (
    client: Client,
    attacker: BattleUnitSchema,
    target: BattleUnitSchema
  ) => void
): void {
  if (
    !isWithinRange(
      attacker.posX,
      attacker.posY,
      targetPosition.x,
      targetPosition.y,
      1
    )
  ) {
    sendError(client, "Posição fora de alcance");
    return;
  }

  // Verificar se há uma unidade na posição (considerando tamanho)
  const unitAtPosition = Array.from(state.units.values()).find((u) => {
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

  if (unitAtPosition) {
    handleUnitAttack(client, attacker, unitAtPosition.id, state, startQTEFn);
    return;
  }

  // Verificar se há um obstáculo na posição (considerando tamanho)
  const obstacleAtPosition = Array.from(state.obstacles.values()).find((o) => {
    if (o.destroyed) return false;
    const dimension = getObstacleDimension(o.size as ObstacleSize);
    for (let dx = 0; dx < dimension; dx++) {
      for (let dy = 0; dy < dimension; dy++) {
        if (
          o.posX + dx === targetPosition.x &&
          o.posY + dy === targetPosition.y
        ) {
          return true;
        }
      }
    }
    return false;
  });

  if (obstacleAtPosition) {
    handleObstacleAttack(
      client,
      attacker,
      obstacleAtPosition.id,
      state,
      roomId,
      broadcast
    );
    return;
  }

  // Ataque no ar (miss)
  consumeAttackResource(attacker);
  attacker.hasStartedAction = true;

  broadcast("battle:attack_missed", {
    attackerId,
    targetPosition,
    message: "O ataque não atingiu nenhum alvo!",
    actionsLeft: attacker.actionsLeft,
    attacksLeftThisTurn: attacker.attacksLeftThisTurn,
  });

  createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
    category: "COMBAT",
    severity: "INFO",
    battleId: roomId,
    sourceUserId: attacker.ownerId,
    message: `${attacker.name} atacou a posição (${targetPosition.x}, ${targetPosition.y}) mas não acertou nenhum alvo!`,
    code: "ATTACK_MISSED",
    data: {
      targetPosition,
      actionsLeft: attacker.actionsLeft,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
    },
    actorId: attacker.id,
    actorName: attacker.name,
  }).catch((err) =>
    console.error("[BattleRoom] Erro ao criar evento de miss:", err)
  );

  console.log(
    `[BattleRoom] ⚔️ Ataque no ar: ${attacker.name} atacou posição (${targetPosition.x}, ${targetPosition.y}) sem alvo`
  );
}

/**
 * Executa ataque em obstáculo
 */
export function performObstacleAttack(
  attacker: BattleUnitSchema,
  obstacle: BattleObstacleSchema,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"]
): void {
  const attackerUnit = schemaUnitToBattleUnit(attacker);
  const obstacleData = {
    id: obstacle.id,
    posX: obstacle.posX,
    posY: obstacle.posY,
    type: obstacle.type as ObstacleType,
    hp: obstacle.hp,
    destroyed: obstacle.destroyed,
  };

  const result = executeAttack(
    attackerUnit,
    null,
    [],
    { code: "ATTACK" } as any,
    "FISICO",
    obstacleData,
    state.battleId
  );

  if (!result.success) {
    console.error("[BattleRoom] performObstacleAttack falhou:", result.error);
    return;
  }

  // Sincronizar recursos
  attacker.actionsLeft = attackerUnit.actionsLeft;
  attacker.attacksLeftThisTurn = attackerUnit.attacksLeftThisTurn;

  // Sincronizar condições
  attacker.conditions.clear();
  attackerUnit.conditions.forEach((c) => attacker.conditions.push(c));
  attacker.syncActiveEffects();

  // Sincronizar obstáculo
  obstacle.hp = result.targetHpAfter ?? obstacle.hp;
  obstacle.destroyed = result.obstacleDestroyed ?? false;

  broadcast("battle:obstacle_attacked", {
    attackerId: attacker.id,
    obstacleId: obstacle.id,
    damage: result.finalDamage,
    destroyed: obstacle.destroyed,
  });

  createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
    category: "COMBAT",
    severity: "INFO",
    battleId: roomId,
    sourceUserId: attacker.ownerId,
    message: `${attacker.name} atacou um obstáculo causando ${
      result.finalDamage
    } de dano${obstacle.destroyed ? " - DESTRUÍDO!" : ""}`,
    code: "OBSTACLE_ATTACKED",
    data: {
      damage: result.finalDamage,
      obstacleHp: obstacle.hp,
      destroyed: obstacle.destroyed,
    },
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: obstacle.id,
    targetName: "Obstáculo",
  }).catch((err) =>
    console.error(
      "[BattleRoom] Erro ao criar evento de ataque a obstáculo:",
      err
    )
  );
}

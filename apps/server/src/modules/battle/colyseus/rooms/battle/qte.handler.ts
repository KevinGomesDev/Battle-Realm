// qte.handler.ts - Sistema de Quick Time Events
import type { Client, Room } from "@colyseus/core";
import type { BattleSessionState, BattleUnitSchema } from "../../schemas";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type { QTEResponse } from "@boundless/shared/qte";
import type {
  QTEResultForExecutor,
  AttackActionResult,
} from "../../../../abilities/executors/types";
import { QTEManager, type QTECombatResult } from "../../../../../qte";
import {
  prepareAttackContext,
  executeAttackFromQTEResult,
} from "../../../../abilities/executors";
import { createAndEmitEvent } from "../../../../match/services/event.service";
import {
  schemaUnitToBattleUnit,
  getAllUnitsAsBattleUnits,
  syncAttackResultToSchemas,
} from "./utils";
import { getUserData, sendError } from "./types";

/**
 * Inicializa o gerenciador de QTE para a batalha
 */
export function initializeQTEManager(
  state: BattleSessionState,
  broadcast: Room<BattleSessionState>["broadcast"],
  clients: Room<BattleSessionState>["clients"],
  clock: Room<BattleSessionState>["clock"]
): QTEManager {
  const broadcastFn = (event: string, data: unknown) => {
    broadcast(event, data);
  };

  const sendToClientFn = (userId: string, event: string, data: unknown) => {
    clients.forEach((client) => {
      const userData = getUserData(client);
      if (userData?.userId === userId) {
        client.send(event, data);
      }
    });
  };

  const getServerTime = () => clock.currentTime;

  const manager = new QTEManager(broadcastFn, sendToClientFn, getServerTime);
  updateQTEManagerUnits(manager, state);

  return manager;
}

/**
 * Atualiza as unidades no QTE Manager com o estado atual
 */
export function updateQTEManagerUnits(
  qteManager: QTEManager,
  state: BattleSessionState
): void {
  const units: BattleUnit[] = [];
  state.units.forEach((schemaUnit) => {
    units.push(schemaUnitToBattleUnit(schemaUnit));
  });

  const obstacles = Array.from(state.obstacles)
    .filter((o): o is NonNullable<typeof o> => o !== undefined)
    .map((o) => ({
      id: o.id,
      posX: o.posX,
      posY: o.posY,
      type: o.type,
      hp: o.hp,
      maxHp: o.maxHp,
      destroyed: o.destroyed,
    }));

  qteManager.updateBattleState(
    units,
    obstacles as any,
    state.gridWidth,
    state.gridHeight
  );
}

/**
 * Inicia um QTE de ataque
 */
export function startAttackQTE(
  client: Client,
  attacker: BattleUnitSchema,
  target: BattleUnitSchema,
  state: BattleSessionState,
  qteManager: QTEManager | null,
  onQTEComplete: (
    attackerId: string,
    targetId: string,
    result: QTECombatResult
  ) => void,
  fallbackAttack: (
    attacker: BattleUnitSchema,
    target: BattleUnitSchema,
    qteResult: QTEResultForExecutor
  ) => void
): void {
  const attackerUnit = schemaUnitToBattleUnit(attacker);
  const targetUnit = schemaUnitToBattleUnit(target);

  const attackContext = prepareAttackContext(attackerUnit);

  if (!attackContext.canAttack) {
    sendError(client, attackContext.blockReason || "Não pode atacar");
    return;
  }

  if (!qteManager) {
    console.warn(
      "[BattleRoom] QTE Manager não inicializado, atacando diretamente"
    );
    fallbackAttack(attacker, target, {
      dodged: false,
      attackerDamageModifier: 1.0,
      defenderDamageModifier: 1.0,
    });
    return;
  }

  updateQTEManagerUnits(qteManager, state);

  qteManager.initiateAttack(
    attackerUnit,
    targetUnit,
    state.battleId,
    attackContext.baseDamage,
    attackContext.isMagicAttack,
    (result) => {
      onQTEComplete(attacker.id, target.id, result);
    }
  );
}

/**
 * Processa a resposta de um QTE
 */
export function handleQTEResponse(
  client: Client,
  response: QTEResponse,
  state: BattleSessionState,
  qteManager: QTEManager | null
): void {
  if (!qteManager) {
    sendError(client, "QTE não está ativo");
    return;
  }

  const userData = getUserData(client);
  if (!userData) return;

  const unit = state.units.get(response.unitId);
  if (!unit || unit.ownerId !== userData.userId) {
    sendError(client, "Não é sua vez de responder ao QTE");
    return;
  }

  qteManager.processResponse(response);
}

/**
 * Executa ataque usando o executor e faz broadcast dos resultados
 */
export function executeAttackAndBroadcast(
  attacker: BattleUnitSchema,
  target: BattleUnitSchema,
  qteResult: QTEResultForExecutor,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"],
  checkBattleEnd: () => void,
  qteData?: { attackerQTE?: unknown; defenderQTE?: unknown }
): void {
  const allUnits = getAllUnitsAsBattleUnits(state);
  const attackerUnit = allUnits.find((u) => u.id === attacker.id);
  const targetUnit = allUnits.find((u) => u.id === target.id);

  if (!attackerUnit || !targetUnit) {
    console.error(
      "[BattleRoom] executeAttackAndBroadcast: Unidade não encontrada"
    );
    return;
  }

  const result = executeAttackFromQTEResult(
    attackerUnit,
    targetUnit,
    allUnits,
    qteResult,
    state.battleId
  );

  if (!result.success) {
    console.error(
      "[BattleRoom] executeAttackAndBroadcast falhou:",
      result.error
    );
    return;
  }

  syncAttackResultToSchemas(
    attacker,
    target,
    attackerUnit,
    targetUnit,
    allUnits,
    result,
    state
  );

  if (result.dodged) {
    broadcastDodge(attacker, target, result, state, roomId, broadcast, qteData);
  } else {
    broadcastAttack(
      attacker,
      target,
      result,
      state,
      roomId,
      broadcast,
      checkBattleEnd
    );
  }
}

function broadcastDodge(
  attacker: BattleUnitSchema,
  target: BattleUnitSchema,
  result: AttackActionResult,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"],
  qteData?: { attackerQTE?: unknown; defenderQTE?: unknown }
): void {
  if (result.newDefenderPosition) {
    broadcast("battle:unit_dodged", {
      unitId: target.id,
      fromX: target.posX,
      fromY: target.posY,
      toX: result.newDefenderPosition.x,
      toY: result.newDefenderPosition.y,
    });
    target.posX = result.newDefenderPosition.x;
    target.posY = result.newDefenderPosition.y;
  }

  if (result.perfectDodgeBuff) {
    broadcast("battle:condition_applied", {
      unitId: target.id,
      conditionId: result.perfectDodgeBuff,
    });
  }

  broadcast("battle:attack_dodged", {
    attackerId: attacker.id,
    targetId: target.id,
    attackerQTE: qteData?.attackerQTE,
    defenderQTE: qteData?.defenderQTE,
  });

  const perfeitaMsg = result.perfectDodgeBuff ? " com esquiva PERFEITA!" : "";
  createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
    category: "COMBAT",
    severity: "INFO",
    battleId: roomId,
    sourceUserId: target.ownerId,
    targetUserIds: [attacker.ownerId],
    message: `${target.name} esquivou do ataque de ${attacker.name}${perfeitaMsg}`,
    code: "ATTACK_DODGED",
    data: {
      attackerQTE: qteData?.attackerQTE,
      defenderQTE: qteData?.defenderQTE,
      isPerfect: !!result.perfectDodgeBuff,
      newPosition: result.newDefenderPosition,
    },
    actorId: target.id,
    actorName: target.name,
    targetId: attacker.id,
    targetName: attacker.name,
  }).catch((err) =>
    console.error("[BattleRoom] Erro ao criar evento de esquiva:", err)
  );
}

function broadcastAttack(
  attacker: BattleUnitSchema,
  target: BattleUnitSchema,
  result: AttackActionResult,
  state: BattleSessionState,
  roomId: string,
  broadcast: Room<BattleSessionState>["broadcast"],
  checkBattleEnd: () => void
): void {
  broadcast("battle:unit_attacked", {
    attackerId: attacker.id,
    targetId: target.id,
    damage: result.damageTransferredToEidolon ? 0 : result.finalDamage,
    rawDamage: result.rawDamage,
    bonusDamage: result.bonusDamage,
    damageReduction: result.damageReduction,
    attackModifier: result.attackModifier,
    defenseModifier: result.defenseModifier,
    damageType: result.damageType,
    targetHpAfter: result.targetHpAfter,
    targetDefeated: result.targetDefeated,
    damageTransferredToEidolon: result.damageTransferredToEidolon,
    eidolonDefeated: result.eidolonDefeated,
  });

  const damageMsg = result.damageTransferredToEidolon
    ? `(transferido para Eidolon)`
    : `causando ${result.finalDamage} de dano`;
  createAndEmitEvent({
    context: "BATTLE",
    scope: "GLOBAL",
    category: "COMBAT",
    severity: "WARNING",
    battleId: roomId,
    sourceUserId: attacker.ownerId,
    targetUserIds: [target.ownerId],
    message: `${attacker.name} atacou ${target.name} ${damageMsg}${
      result.targetDefeated ? " - DERROTADO!" : ""
    }`,
    code: "UNIT_ATTACKED",
    data: {
      damage: result.finalDamage,
      rawDamage: result.rawDamage,
      bonusDamage: result.bonusDamage,
      targetHp: result.targetHpAfter,
      targetDefeated: result.targetDefeated,
      attackModifier: result.attackModifier,
      defenseModifier: result.defenseModifier,
      damageType: result.damageType,
      damageTransferredToEidolon: result.damageTransferredToEidolon,
      eidolonDefeated: result.eidolonDefeated,
    },
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: target.id,
    targetName: target.name,
  }).catch((err) =>
    console.error("[BattleRoom] Erro ao criar evento de ataque:", err)
  );

  if (result.targetDefeated || result.eidolonDefeated) {
    checkBattleEnd();
  }
}

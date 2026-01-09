// ai.handler.ts - Lógica de turno da IA
import type { Room } from "@colyseus/core";
import type { BattleSessionState, BattleUnitSchema } from "../../schemas";
import { isValidPosition, canAttack } from "./utils";
import type { QTEResultForExecutor } from "../../../../abilities/executors/types";
import { createAndEmitEvent } from "../../../../match/services/event.service";

/**
 * Executa o turno de uma unidade controlada por IA
 */
export function executeAITurn(
  state: BattleSessionState,
  unit: BattleUnitSchema,
  broadcast: Room<BattleSessionState>["broadcast"],
  isValidPositionFn: (x: number, y: number) => boolean,
  executeAttackFn: (
    attacker: BattleUnitSchema,
    target: BattleUnitSchema,
    qteResult: QTEResultForExecutor
  ) => void,
  advanceToNextUnitFn: () => void,
  roomId?: string
): void {
  console.log(
    `[BattleRoom] 🤖 executeAITurn iniciado para: ${unit.name} (${unit.id})`
  );

  setTimeout(() => {
    console.log(`[BattleRoom] 🤖 IA processando turno de: ${unit.name}`);

    // Encontrar inimigo mais próximo
    let closestEnemy: BattleUnitSchema | undefined = undefined;
    let closestDist = Infinity;

    state.units.forEach((other) => {
      if (other.ownerId === unit.ownerId || !other.isAlive) return;

      const dist =
        Math.abs(other.posX - unit.posX) + Math.abs(other.posY - unit.posY);
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = other;
      }
    });

    if (!closestEnemy) {
      console.log(
        `[BattleRoom] 🤖 IA: Nenhum inimigo encontrado, passando turno`
      );
      advanceToNextUnitFn();
      return;
    }

    const enemy = closestEnemy as BattleUnitSchema;
    console.log(
      `[BattleRoom] 🤖 IA: Inimigo mais próximo: ${enemy.name} a ${closestDist} células`
    );

    // Mover em direção ao inimigo
    const dx = Math.sign(enemy.posX - unit.posX);
    const dy = Math.sign(enemy.posY - unit.posY);

    if (unit.movesLeft > 0 && closestDist > 1) {
      const newX = unit.posX + dx;
      const newY = unit.posY + dy;

      if (isValidPositionFn(newX, newY)) {
        const fromX = unit.posX;
        const fromY = unit.posY;
        unit.posX = newX;
        unit.posY = newY;
        unit.movesLeft--;

        console.log(
          `[BattleRoom] 🤖 IA: ${unit.name} moveu de (${fromX},${fromY}) para (${newX},${newY})`
        );

        broadcast("battle:unit_moved", {
          unitId: unit.id,
          fromX,
          fromY,
          toX: newX,
          toY: newY,
          movesLeft: unit.movesLeft,
        });

        // Emitir evento de movimento da IA
        if (roomId) {
          createAndEmitEvent({
            context: "BATTLE",
            scope: "GLOBAL",
            category: "MOVEMENT",
            severity: "INFO",
            battleId: roomId,
            sourceUserId: unit.ownerId,
            message: `🤖 ${unit.name} se moveu de (${fromX}, ${fromY}) para (${newX}, ${newY})`,
            code: "UNIT_MOVED",
            data: {
              fromPosition: { x: fromX, y: fromY },
              toPosition: { x: newX, y: newY },
              movesLeft: unit.movesLeft,
              isAI: true,
            },
            actorId: unit.id,
            actorName: unit.name,
          }).catch((err) =>
            console.error(
              "[BattleRoom] Erro ao criar evento de movimento IA:",
              err
            )
          );
        }
      } else {
        console.log(
          `[BattleRoom] 🤖 IA: Posição (${newX},${newY}) inválida, não moveu`
        );
      }
    }

    // Atacar se adjacente
    const newDist =
      Math.abs(enemy.posX - unit.posX) + Math.abs(enemy.posY - unit.posY);
    if (newDist <= 1 && canAttack(unit)) {
      console.log(`[BattleRoom] 🤖 IA: ${unit.name} atacando ${enemy.name}`);
      executeAttackFn(unit, enemy, {
        dodged: false,
        attackerDamageModifier: 1.0,
        defenderDamageModifier: 1.0,
      });
    } else {
      console.log(
        `[BattleRoom] 🤖 IA: Distância ${newDist}, ataques restantes: ${unit.attacksLeftThisTurn}, ações: ${unit.actionsLeft}, não atacou`
      );
    }

    console.log(`[BattleRoom] 🤖 IA: ${unit.name} finalizando turno`);
    advanceToNextUnitFn();
  }, 1000);
}

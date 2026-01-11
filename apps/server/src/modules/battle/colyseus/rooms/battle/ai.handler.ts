// ai.handler.ts - Lógica de turno da IA
import type { Room } from "@colyseus/core";
import type { BattleSessionState, BattleUnitSchema } from "../../schemas";
import {
  isValidPosition,
  canAttack,
  schemaUnitToBattleUnit,
  syncUnitFromResult,
} from "./utils";
import { createAndEmitEvent } from "../../../../match/services/event.service";
import { executeSkill } from "../../../../abilities/executors";
import { processUnitDeath } from "../../../../combat/death-logic";
import type { BattleUnit } from "@boundless/shared/types/battle.types";

/**
 * Executa o turno de uma unidade controlada por IA
 */
export function executeAITurn(
  state: BattleSessionState,
  unit: BattleUnitSchema,
  broadcast: Room<BattleSessionState>["broadcast"],
  isValidPositionFn: (x: number, y: number) => boolean,
  advanceToNextUnitFn: () => void,
  roomId?: string
): void {
  setTimeout(() => {
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
      advanceToNextUnitFn();
      return;
    }

    const enemy = closestEnemy as BattleUnitSchema;

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
      }
    }

    // Atacar se adjacente
    const newDist =
      Math.abs(enemy.posX - unit.posX) + Math.abs(enemy.posY - unit.posY);
    if (newDist <= 1 && canAttack(unit)) {
      // Executar ataque usando executeSkill diretamente (sem QTE)
      const allUnits: BattleUnit[] = Array.from(state.units.values()).map((u) =>
        schemaUnitToBattleUnit(u)
      );
      const casterUnit = schemaUnitToBattleUnit(unit);
      const targetUnit = schemaUnitToBattleUnit(enemy);

      const result = executeSkill(
        casterUnit,
        "ATTACK",
        targetUnit,
        allUnits,
        true,
        { targetPosition: { x: enemy.posX, y: enemy.posY } }
      );

      if (result.success) {
        // Sincronizar resultado
        syncUnitFromResult(unit, casterUnit, result);

        // Sincronizar alvo
        if (result.targetHpAfter !== undefined) {
          enemy.currentHp = result.targetHpAfter;
          if (result.targetHpAfter <= 0 && enemy.isAlive) {
            enemy.isAlive = false;
            processUnitDeath(targetUnit, allUnits);
          }
        }

        // Broadcast ataque
        broadcast("battle:skill_used", {
          casterUnitId: unit.id,
          skillCode: "ATTACK",
          targetPosition: { x: enemy.posX, y: enemy.posY },
          result,
          casterUpdated: {
            actionsLeft: unit.actionsLeft,
            movesLeft: unit.movesLeft,
            currentHp: unit.currentHp,
            currentMana: unit.currentMana,
            attacksLeftThisTurn: unit.attacksLeftThisTurn,
          },
        });
      }
    }
    advanceToNextUnitFn();
  }, 1000);
}

import { Server, Socket } from "socket.io";
import type { BattleObstacle } from "../../../../shared/types/battle.types";
import {
  executeAttackAction,
  executeDashAction,
  executeDodgeAction,
  executeMoveAction,
  executeSkillAction,
  type CombatUnit,
} from "../../logic/combat-actions";
import { findSkillByCode } from "../../data/skills.data";
import {
  processUnitTurnEndConditions,
  advanceToNextPlayer,
  recordPlayerAction,
  checkVictoryCondition,
  checkExhaustionCondition,
  processNewRound,
  emitBattleEndEvents,
  emitExhaustionEndEvents,
} from "../../logic/round-control";
import {
  getEffectiveAcuityWithConditions,
  getMaxMarksByCategory,
} from "../../utils/battle.utils";
import {
  getExtraAttacksFromConditions,
  getMinAttackSuccesses,
} from "../../logic/conditions";
import {
  activeBattles,
  battleLobbies,
  battleDiceModalPaused,
  userToLobby,
} from "./battle-state";
import {
  deleteBattleFromDB,
  deleteLobbyFromDB,
  saveBattleToDB,
  updateUserStats,
} from "./battle-persistence";
import { startBattleTurnTimer, stopBattleTurnTimer } from "./battle-timer";
import { generateId } from "./battle-types";

export function registerBattleActionHandlers(io: Server, socket: Socket): void {
  socket.on("battle:dice_modal_open", ({ battleId }) => {
    if (!battleId) return;
    battleDiceModalPaused.set(battleId, true);
    console.log(
      `[ARENA] Timer pausado - modal de dice aberto na batalha ${battleId}`
    );
  });

  socket.on("battle:dice_modal_close", ({ battleId }) => {
    if (!battleId) return;
    battleDiceModalPaused.delete(battleId);
    console.log(
      `[ARENA] Timer retomado - modal de dice fechado na batalha ${battleId}`
    );
  });

  socket.on("battle:begin_action", async ({ battleId, unitId, userId }) => {
    try {
      const battle = activeBattles.get(battleId);
      if (!battle) {
        return socket.emit("battle:error", {
          message: "Batalha não encontrada",
        });
      }

      if (battle.actionOrder.length) {
        const currentPlayerId = battle.actionOrder[battle.currentTurnIndex];
        if (currentPlayerId !== userId) {
          return socket.emit("battle:error", {
            message: "Não é sua vez de agir",
          });
        }
      }

      if (battle.activeUnitId && battle.activeUnitId !== unitId) {
        return socket.emit("battle:error", {
          message: "Você já escolheu uma unidade para este turno",
        });
      }

      const unit = battle.units.find((u) => u.id === unitId);
      if (!unit || !unit.isAlive) {
        return socket.emit("battle:error", { message: "Unidade inválida" });
      }
      if (unit.ownerId !== userId) {
        return socket.emit("battle:error", {
          message: "Você não controla esta unidade",
        });
      }

      if (unit.conditions.includes("DESABILITADA")) {
        return socket.emit("battle:error", {
          message: "Unidade desabilitada",
        });
      }

      if (unit.hasStartedAction) {
        socket.emit("battle:action_started", {
          battleId,
          unitId,
          movesLeft: unit.movesLeft,
          actionsLeft: unit.actionsLeft,
        });
        return;
      }

      const effectiveAcuity = getEffectiveAcuityWithConditions(
        unit.acuity,
        unit.conditions
      );
      unit.movesLeft = effectiveAcuity;
      unit.actionsLeft = 1;
      unit.hasStartedAction = true;
      battle.activeUnitId = unitId;

      // Em arena, se a unidade está exausta (actionMarks >= maxMarks), perde 5 HP
      if (
        battle.isArena &&
        unit.actionMarks >= getMaxMarksByCategory(unit.category)
      ) {
        unit.currentHp = Math.max(0, unit.currentHp - 5);
        unit.actionMarks = 0; // Reset das marcas após penalidade

        if (unit.currentHp <= 0) {
          unit.isAlive = false;
        }
      }

      socket.emit("battle:action_started", {
        battleId,
        unitId,
        movesLeft: effectiveAcuity,
        actionsLeft: unit.actionsLeft,
        currentHp: unit.currentHp,
        isAlive: unit.isAlive,
        actionMarks: unit.actionMarks,
      });

      await saveBattleToDB(battle);
    } catch (err) {
      console.error("[ARENA] begin_action error:", err);
      socket.emit("battle:error", { message: "Erro ao iniciar ação" });
    }
  });

  socket.on("battle:end_unit_action", async ({ battleId, unitId }) => {
    try {
      const battle = activeBattles.get(battleId);
      if (!battle) {
        console.error(
          `[ARENA] end_unit_action: Batalha ${battleId} não encontrada`
        );
        return;
      }

      const unit = battle.units.find((u) => u.id === unitId);
      if (!unit) {
        console.error(
          `[ARENA] end_unit_action: Unidade ${unitId} não encontrada`
        );
        return;
      }

      const currentPlayerId = battle.actionOrder[battle.currentTurnIndex];
      if (unit.ownerId !== currentPlayerId) {
        console.warn(
          `[ARENA] end_unit_action: Não é o turno do jogador ${unit.ownerId} (turno atual: ${currentPlayerId})`
        );
        return socket.emit("battle:error", { message: "Não é seu turno" });
      }

      console.log(
        `[ARENA] end_unit_action: ${unit.name} (${unitId}) finalizando turno`
      );

      const lobby = battleLobbies.get(battle.lobbyId);
      if (!lobby) {
        console.error(`[ARENA] Lobby não encontrado para batalha ${battleId}`);
        return;
      }

      // 1. Processar condições de fim de turno usando RoundControl
      const turnEndResult = processUnitTurnEndConditions(unit);

      // 2. Registrar ação do jogador
      recordPlayerAction(battle, currentPlayerId);

      // 3. Verificar vitória (pode ter morrido por condição)
      const victoryCheck = checkVictoryCondition(battle);

      if (victoryCheck.battleEnded) {
        battle.status = "ENDED";
        stopBattleTurnTimer(battle.id);

        emitBattleEndEvents(
          io,
          lobby.lobbyId,
          battle.id,
          victoryCheck,
          battle.units
        );

        const loserId =
          victoryCheck.winnerId === lobby.hostUserId
            ? lobby.guestUserId
            : lobby.hostUserId;
        await updateUserStats(victoryCheck.winnerId, loserId, battle.isArena);

        userToLobby.delete(lobby.hostUserId);
        if (lobby.guestUserId) {
          userToLobby.delete(lobby.guestUserId);
        }

        lobby.status = "ENDED";
        await deleteBattleFromDB(battleId);
        await deleteLobbyFromDB(lobby.lobbyId);
        console.log(
          `[BATTLE] Batalha ${battleId} finalizada. Vencedor: ${victoryCheck.winnerId}`
        );
        return;
      }

      // 4. Avançar para próximo jogador usando RoundControl
      const oldTurnIndex = battle.currentTurnIndex;
      const turnTransition = advanceToNextPlayer(battle);

      console.log(
        `[ARENA] Turno avançado: index ${oldTurnIndex} -> ${turnTransition.nextTurnIndex}, próximo jogador: ${turnTransition.nextPlayerId}`
      );

      // 5. Emitir eventos de socket
      io.to(lobby.lobbyId).emit("battle:unit_turn_ended", {
        battleId,
        unitId,
        actionMarks: unit.actionMarks,
        currentHp: unit.currentHp,
        isAlive: unit.isAlive,
        conditions: unit.conditions,
        damageFromConditions: turnEndResult.damageFromConditions,
        conditionsRemoved: turnEndResult.conditionsRemoved,
      });

      if (turnEndResult.unitDefeated) {
        io.to(lobby.lobbyId).emit("battle:unit_defeated", {
          battleId,
          unitId,
          reason: "condition_damage",
        });
      }

      io.to(lobby.lobbyId).emit("battle:next_player", {
        battleId,
        currentPlayerId: turnTransition.nextPlayerId,
        index: turnTransition.nextTurnIndex,
        round: battle.round,
      });

      console.log(
        `[ARENA] Evento battle:next_player emitido para lobby ${lobby.lobbyId}`
      );

      // 6. Se avançou rodada, emitir evento e processar nova rodada
      if (turnTransition.roundAdvanced) {
        await processNewRound(battle, io, lobby.lobbyId);

        // Enviar unidades atualizadas junto com nova rodada
        // O servidor é a fonte de verdade - cliente usa estes dados
        const serializedUnits = battle.units.map((u) => ({
          id: u.id,
          hasStartedAction: u.hasStartedAction,
          movesLeft: u.movesLeft,
          actionsLeft: u.actionsLeft,
          attacksLeftThisTurn: u.attacksLeftThisTurn,
          conditions: u.conditions,
          currentHp: u.currentHp,
          isAlive: u.isAlive,
        }));

        io.to(lobby.lobbyId).emit("battle:new_round", {
          battleId,
          round: battle.round,
          units: serializedUnits,
        });
        io.to(lobby.lobbyId).emit("battle:next_player", {
          battleId,
          currentPlayerId: turnTransition.nextPlayerId,
          index: turnTransition.nextTurnIndex,
          round: battle.round,
        });
        console.log(
          `[ARENA] Nova rodada ${battle.round} - Re-emitido battle:next_player com round atualizado`
        );
      }

      // 7. Verificar exaustão (apenas para batalhas não-arena)
      if (!battle.isArena) {
        const exhaustionCheck = checkExhaustionCondition(battle);

        if (exhaustionCheck.allExhausted) {
          battle.status = "ENDED";
          stopBattleTurnTimer(battle.id);

          emitExhaustionEndEvents(
            io,
            lobby.lobbyId,
            battle.id,
            exhaustionCheck,
            battle.units
          );

          const loserId =
            exhaustionCheck.winnerId === lobby.hostUserId
              ? lobby.guestUserId
              : lobby.hostUserId;
          await updateUserStats(
            exhaustionCheck.winnerId,
            loserId,
            battle.isArena
          );

          userToLobby.delete(lobby.hostUserId);
          if (lobby.guestUserId) {
            userToLobby.delete(lobby.guestUserId);
          }

          lobby.status = "ENDED";
          await deleteBattleFromDB(battleId);
          await deleteLobbyFromDB(lobby.lobbyId);
          console.log(
            `[BATTLE] Batalha ${battleId} finalizada por exaustão. Vencedor: ${exhaustionCheck.winnerId}`
          );
          return;
        }
      }

      startBattleTurnTimer(battle);
      await saveBattleToDB(battle);
    } catch (err) {
      console.error("[ARENA] end_unit_action error:", err);
    }
  });

  socket.on("battle:move", async ({ battleId, unitId, toX, toY }) => {
    try {
      const battle = activeBattles.get(battleId);
      if (!battle || battle.status !== "ACTIVE") {
        return socket.emit("battle:error", { message: "Batalha inválida" });
      }

      const unit = battle.units.find((u) => u.id === unitId);
      if (!unit || !unit.isAlive) {
        return socket.emit("battle:error", { message: "Unidade inválida" });
      }

      const result = executeMoveAction(
        unit as CombatUnit,
        toX,
        toY,
        battle.gridWidth,
        battle.gridHeight,
        battle.units as CombatUnit[],
        battle.config.map.obstacles || []
      );

      if (!result.success) {
        return socket.emit("battle:error", { message: result.error });
      }

      const lobby = battleLobbies.get(battle.lobbyId);
      if (lobby) {
        io.to(lobby.lobbyId).emit("battle:unit_moved", {
          battleId,
          unitId,
          fromX: result.fromX,
          fromY: result.fromY,
          toX: result.toX,
          toY: result.toY,
          movesLeft: result.movesLeft,
        });
      }

      await saveBattleToDB(battle);
    } catch (err) {
      console.error("[ARENA] move error:", err);
      socket.emit("battle:error", { message: "Erro ao mover" });
    }
  });

  socket.on(
    "battle:attack",
    async ({
      battleId,
      attackerUnitId,
      targetUnitId,
      targetObstacleId,
      damageType = "FISICO",
    }) => {
      try {
        const battle = activeBattles.get(battleId);
        if (!battle || battle.status !== "ACTIVE") {
          return socket.emit("battle:error", { message: "Batalha inválida" });
        }

        const attacker = battle.units.find((u) => u.id === attackerUnitId);
        if (!attacker || !attacker.isAlive) {
          return socket.emit("battle:error", { message: "Atacante inválido" });
        }

        let target: (typeof battle.units)[number] | undefined = undefined;
        let obstacle: BattleObstacle | undefined = undefined;

        if (targetUnitId) {
          target = battle.units.find((u) => u.id === targetUnitId);
          if (!target) {
            return socket.emit("battle:error", { message: "Alvo inválido" });
          }
        } else if (targetObstacleId) {
          obstacle = battle.config.map?.obstacles?.find(
            (o) => o.id === targetObstacleId
          );
          if (!obstacle) {
            return socket.emit("battle:error", {
              message: "Obstáculo não encontrado",
            });
          }
          if (obstacle.destroyed) {
            return socket.emit("battle:error", {
              message: "Obstáculo já destruído",
            });
          }
        } else {
          return socket.emit("battle:error", {
            message: "Nenhum alvo especificado",
          });
        }

        const result = executeAttackAction(
          attacker as CombatUnit,
          target as CombatUnit | null,
          damageType,
          obstacle
        );

        if (!result.success) {
          return socket.emit("battle:error", { message: result.error });
        }

        const lobby = battleLobbies.get(battle.lobbyId);
        if (lobby) {
          io.to(lobby.lobbyId).emit("battle:unit_attacked", {
            battleId,
            attackerUnitId,
            targetUnitId: targetUnitId || null,
            targetObstacleId: targetObstacleId || null,
            targetType: result.targetType,
            damage: result.finalDamage,
            damageType: result.damageType,
            targetHpAfter: result.targetHpAfter,
            attackerActionsLeft: attacker.actionsLeft,
            attackerAttacksLeftThisTurn: result.attacksLeftThisTurn ?? 0,
            missed: result.missed ?? false,
            attackDiceCount: result.attackDiceCount ?? 0,
            attackRolls: result.attackRolls ?? [],
            attackSuccesses: result.attackSuccesses ?? 0,
            rawDamage: result.rawDamage ?? 0,
            defenseDiceCount: result.defenseDiceCount ?? 0,
            defenseRolls: result.defenseRolls ?? [],
            defenseSuccesses: result.defenseSuccesses ?? 0,
            damageReduction: result.damageReduction ?? 0,
            finalDamage: result.finalDamage ?? 0,
            targetPhysicalProtection: result.targetPhysicalProtection ?? 0,
            targetMagicalProtection: result.targetMagicalProtection ?? 0,
            targetDefeated: result.targetDefeated ?? false,
            obstacleDestroyed: result.obstacleDestroyed ?? false,
            obstacleId: result.obstacleId ?? null,
            attackerName: attacker.name,
            attackerIcon: "⚔️",
            attackerCombat: attacker.combat,
            targetName: target?.name ?? obstacle?.id ?? "Obstáculo",
            targetIcon: target ? "🛡️" : "🪨",
            targetCombat: target?.combat ?? 0,
            targetAcuity: target?.acuity ?? 0,
          });

          // Emitir toast se houver ataques extras disponíveis
          if ((result.attacksLeftThisTurn ?? 0) > 0) {
            io.to(lobby.lobbyId).emit("battle:toast", {
              battleId,
              targetUserId: attacker.ownerId,
              type: "info",
              title: "⚔️ Ataques Extras!",
              message: `${attacker.name} pode atacar mais ${result.attacksLeftThisTurn} vez(es)!`,
              duration: 3000,
            });
          }

          if (result.obstacleDestroyed && result.obstacleId) {
            io.to(lobby.lobbyId).emit("battle:obstacle_destroyed", {
              battleId,
              obstacleId: result.obstacleId,
            });
          }

          if (result.targetDefeated && target) {
            io.to(lobby.lobbyId).emit("battle:unit_defeated", {
              battleId,
              unitId: target.id,
            });

            console.log("[ARENA] ⚔️ ATAQUE RESOLVIDO:", {
              attackerUnitId,
              targetUnitId,
              damageDealt: result.finalDamage,
              targetHpAfter: result.targetHpAfter,
              targetDefeated: result.targetDefeated,
              targetIsAliveInMemory: target?.isAlive,
            });

            // Usar checkVictoryCondition centralizado do RoundControl
            const victoryCheck = checkVictoryCondition(battle);

            console.log("[ARENA] 🏁 VERIFICANDO VITÓRIA:", {
              battleEnded: victoryCheck.battleEnded,
              winnerId: victoryCheck.winnerId,
              reason: victoryCheck.reason,
            });

            if (victoryCheck.battleEnded) {
              battle.status = "ENDED";
              stopBattleTurnTimer(battle.id);

              emitBattleEndEvents(
                io,
                lobby.lobbyId,
                battle.id,
                victoryCheck,
                battle.units
              );

              const loserId =
                victoryCheck.winnerId === lobby.hostUserId
                  ? lobby.guestUserId
                  : lobby.hostUserId;
              await updateUserStats(
                victoryCheck.winnerId,
                loserId,
                battle.isArena
              );

              userToLobby.delete(lobby.hostUserId);
              if (lobby.guestUserId) {
                userToLobby.delete(lobby.guestUserId);
              }

              lobby.status = "ENDED";
              await deleteBattleFromDB(battleId);
              await deleteLobbyFromDB(lobby.lobbyId);
              console.log(
                `[ARENA] Batalha ${battleId} finalizada. Vencedor: ${victoryCheck.winnerId}`
              );
            }
          }
        }

        if (battle.status === "ACTIVE") {
          await saveBattleToDB(battle);
        }
      } catch (err) {
        console.error("[ARENA] attack error:", err);
        socket.emit("battle:error", { message: "Erro ao atacar" });
      }
    }
  );

  socket.on("battle:dash", async ({ battleId, unitId }) => {
    try {
      const battle = activeBattles.get(battleId);
      if (!battle || battle.status !== "ACTIVE") {
        return socket.emit("battle:error", { message: "Batalha inválida" });
      }

      const unit = battle.units.find((u) => u.id === unitId);
      if (!unit || !unit.isAlive) {
        return socket.emit("battle:error", { message: "Unidade inválida" });
      }

      const result = executeDashAction(unit as CombatUnit);

      if (!result.success) {
        return socket.emit("battle:error", { message: result.error });
      }

      const lobby = battleLobbies.get(battle.lobbyId);
      if (lobby) {
        io.to(lobby.lobbyId).emit("battle:unit_dashed", {
          battleId,
          unitId,
          movesLeft: result.newMovesLeft,
          actionsLeft: unit.actionsLeft,
        });
      }

      await saveBattleToDB(battle);
    } catch (err) {
      console.error("[ARENA] dash error:", err);
      socket.emit("battle:error", { message: "Erro ao disparar" });
    }
  });

  socket.on("battle:dodge", async ({ battleId, unitId }) => {
    try {
      const battle = activeBattles.get(battleId);
      if (!battle || battle.status !== "ACTIVE") {
        return socket.emit("battle:error", { message: "Batalha inválida" });
      }

      const unit = battle.units.find((u) => u.id === unitId);
      if (!unit || !unit.isAlive) {
        return socket.emit("battle:error", { message: "Unidade inválida" });
      }

      const result = executeDodgeAction(unit as CombatUnit);

      if (!result.success) {
        return socket.emit("battle:error", { message: result.error });
      }

      const lobby = battleLobbies.get(battle.lobbyId);
      if (lobby) {
        io.to(lobby.lobbyId).emit("battle:unit_dodged", {
          battleId,
          unitId,
          actionsLeft: unit.actionsLeft,
          conditions: unit.conditions,
        });
      }

      await saveBattleToDB(battle);
    } catch (err) {
      console.error("[ARENA] dodge error:", err);
      socket.emit("battle:error", { message: "Erro ao esquivar" });
    }
  });

  socket.on("battle:get_battle_state", async ({ battleId }) => {
    try {
      const battle = activeBattles.get(battleId);
      if (!battle) {
        return socket.emit("battle:error", {
          message: "Batalha não encontrada",
        });
      }

      socket.emit("battle:battle_state", {
        battleId,
        config: battle.config,
        round: battle.round,
        status: battle.status,
        currentTurnIndex: battle.currentTurnIndex,
        currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
        actionOrder: battle.actionOrder,
        units: battle.units,
      });
    } catch (err) {
      console.error("[ARENA] get_battle_state error:", err);
    }
  });

  socket.on("battle:surrender", async ({ battleId, userId }) => {
    try {
      const battle = activeBattles.get(battleId);
      if (!battle || battle.status !== "ACTIVE") {
        return socket.emit("battle:error", {
          message: "Batalha não encontrada",
        });
      }

      const lobby = battleLobbies.get(battle.lobbyId);
      if (!lobby) return;

      const winnerId =
        lobby.hostUserId === userId ? lobby.guestUserId : lobby.hostUserId;

      battle.status = "ENDED";
      lobby.status = "ENDED";
      stopBattleTurnTimer(battle.id);

      userToLobby.delete(lobby.hostUserId);
      if (lobby.guestUserId) {
        userToLobby.delete(lobby.guestUserId);
      }

      await deleteLobbyFromDB(lobby.lobbyId);

      const winnerKingdom = battle.units.find(
        (u) => u.ownerId === winnerId
      )?.ownerKingdomId;

      io.to(lobby.lobbyId).emit("battle:battle_ended", {
        battleId,
        winnerId,
        winnerKingdomId: winnerKingdom,
        reason: "Oponente se rendeu",
        surrenderedBy: userId,
        finalUnits: battle.units,
      });

      await updateUserStats(winnerId, userId, battle.isArena);

      await deleteBattleFromDB(battleId);

      console.log(`[ARENA] ${userId} se rendeu na batalha ${battleId}`);
    } catch (err) {
      console.error("[ARENA] surrender error:", err);
    }
  });

  // ==========================================================================
  // SKILL HANDLER - Uso de habilidades ativas
  // ==========================================================================
  socket.on(
    "battle:use_skill",
    async ({
      battleId,
      casterUnitId,
      skillCode,
      targetUnitId,
    }: {
      battleId: string;
      casterUnitId: string;
      skillCode: string;
      targetUnitId?: string;
    }) => {
      try {
        const battle = activeBattles.get(battleId);
        if (!battle || battle.status !== "ACTIVE") {
          return socket.emit("battle:error", { message: "Batalha inválida" });
        }

        const caster = battle.units.find((u) => u.id === casterUnitId);
        if (!caster || !caster.isAlive) {
          return socket.emit("battle:error", { message: "Unidade inválida" });
        }

        // Buscar skill para info
        const skill = findSkillByCode(skillCode);
        if (!skill) {
          return socket.emit("battle:error", {
            message: "Skill não encontrada",
          });
        }

        let target: (typeof battle.units)[number] | null = null;
        if (targetUnitId) {
          target = battle.units.find((u) => u.id === targetUnitId) || null;
          if (!target) {
            return socket.emit("battle:error", {
              message: "Alvo não encontrado",
            });
          }
        }

        // Executar skill
        const result = executeSkillAction(
          caster as CombatUnit,
          skillCode,
          target as CombatUnit | null,
          battle.units as CombatUnit[],
          battle.isArena
        );

        if (!result.success) {
          return socket.emit("battle:error", { message: result.error });
        }

        const lobby = battleLobbies.get(battle.lobbyId);
        if (lobby) {
          // Emitir evento de skill usada
          io.to(lobby.lobbyId).emit("battle:skill_used", {
            battleId,
            casterUnitId,
            skillCode,
            skillName: skill.name,
            targetUnitId: targetUnitId || null,
            result: {
              healAmount: result.healAmount,
              damageDealt: result.damageDealt,
              conditionApplied: result.conditionApplied,
              conditionRemoved: result.conditionRemoved,
              actionsGained: result.actionsGained,
            },
            casterActionsLeft: result.casterActionsLeft,
            targetHpAfter: result.targetHpAfter,
            targetDefeated: result.targetDefeated,
            casterName: caster.name,
            targetName: target?.name || null,
          });

          // Se alvo foi derrotado, verificar vitória
          if (result.targetDefeated && target) {
            io.to(lobby.lobbyId).emit("battle:unit_defeated", {
              battleId,
              unitId: target.id,
            });

            const victoryCheck = checkVictoryCondition(battle);

            if (victoryCheck.battleEnded) {
              battle.status = "ENDED";
              stopBattleTurnTimer(battle.id);

              emitBattleEndEvents(
                io,
                lobby.lobbyId,
                battle.id,
                victoryCheck,
                battle.units
              );

              const loserId =
                victoryCheck.winnerId === lobby.hostUserId
                  ? lobby.guestUserId
                  : lobby.hostUserId;
              await updateUserStats(
                victoryCheck.winnerId,
                loserId,
                battle.isArena
              );

              userToLobby.delete(lobby.hostUserId);
              if (lobby.guestUserId) {
                userToLobby.delete(lobby.guestUserId);
              }

              lobby.status = "ENDED";
              await deleteBattleFromDB(battleId);
              await deleteLobbyFromDB(lobby.lobbyId);
              console.log(
                `[ARENA] Batalha ${battleId} finalizada por skill. Vencedor: ${victoryCheck.winnerId}`
              );
            }
          }
        }

        if (battle.status === "ACTIVE") {
          await saveBattleToDB(battle);
        }

        console.log(
          `[ARENA] Skill ${skillCode} usada por ${caster.name} -> ${
            target?.name || "self"
          }`
        );
      } catch (err) {
        console.error("[ARENA] use_skill error:", err);
        socket.emit("battle:error", { message: "Erro ao usar skill" });
      }
    }
  );

  socket.on("battle:leave_battle", async ({ battleId, userId }) => {
    try {
      const battle = activeBattles.get(battleId);
      if (!battle || battle.status !== "ACTIVE") {
        return socket.emit("battle:error", {
          message: "Batalha não encontrada ou já finalizada",
        });
      }

      const lobby = battleLobbies.get(battle.lobbyId);
      if (!lobby) {
        return socket.emit("battle:error", { message: "Lobby não encontrado" });
      }

      if (lobby.hostUserId !== userId && lobby.guestUserId !== userId) {
        return socket.emit("battle:error", {
          message: "Você não está nesta batalha",
        });
      }

      const winnerId =
        lobby.hostUserId === userId ? lobby.guestUserId : lobby.hostUserId;

      battle.status = "ENDED";
      lobby.status = "ENDED";
      stopBattleTurnTimer(battle.id);

      userToLobby.delete(lobby.hostUserId);
      if (lobby.guestUserId) {
        userToLobby.delete(lobby.guestUserId);
      }

      await deleteLobbyFromDB(lobby.lobbyId);

      io.to(battle.lobbyId).emit("battle:battle_ended", {
        battleId,
        winnerId,
        reason: "Oponente abandonou a batalha",
        abandonedBy: userId,
        finalUnits: battle.units,
      });

      await updateUserStats(winnerId, userId, battle.isArena);

      await deleteBattleFromDB(battleId);

      socket.leave(battle.lobbyId);

      socket.emit("battle:left_battle", {
        message: "Você abandonou a batalha. Derrota!",
      });

      console.log(
        `[ARENA] ${userId} abandonou batalha ${battleId}. Vencedor: ${winnerId}`
      );
    } catch (err) {
      console.error("[ARENA] leave_battle error:", err);
      socket.emit("battle:error", { message: "Erro ao sair da batalha" });
    }
  });
}

import { Server, Socket } from "socket.io";
import type {
  BattleObstacle,
  BattleUnit,
} from "../../../../shared/types/battle.types";
import { executeMoveAction } from "../../logic/movement-actions";
import { executeAttack, executeSkill } from "../../logic/skill-executors";
import { findSkillByCode } from "../../../../shared/data/skills.data";
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
  getEffectiveSpeedWithConditions,
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
import {
  checkAndProcessBotTurn,
  checkAndProcessAIControlledUnit,
  clearAIControlForBattle,
  processPlayerSummons,
} from "./battle-bot";
import { processSummonerDeath } from "../../logic/summon-logic";

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
        console.log(`[BEGIN_ACTION] Unidade não encontrada:`, {
          unitId,
          allIds: battle.units.map((u) => u.id),
        });
        return socket.emit("battle:error", {
          message: "[begin_action] Unidade inválida",
        });
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
        // Garantir que activeUnitId está definido (caso de reconexão)
        if (!battle.activeUnitId) {
          battle.activeUnitId = unitId;
        }
        socket.emit("battle:action_started", {
          battleId,
          unitId,
          movesLeft: unit.movesLeft,
          actionsLeft: unit.actionsLeft,
        });
        return;
      }

      const effectiveSpeed = getEffectiveSpeedWithConditions(
        unit.speed,
        unit.conditions
      );
      unit.movesLeft = effectiveSpeed;
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

        const lobby = battleLobbies.get(battle.lobbyId);

        if (unit.currentHp <= 0) {
          unit.isAlive = false;

          // Processar morte de invocações vinculadas
          const killedSummons = processSummonerDeath(
            unit,
            battle.units,
            "arena"
          );
          if (killedSummons.length > 0) {
            console.log(
              `[ARENA] Invocações mortas junto com ${unit.name} (exaustão):`,
              killedSummons.map((s) => s.name)
            );
          }

          // Emitir unit_defeated para todos na sala
          if (lobby) {
            io.to(lobby.lobbyId).emit("battle:unit_defeated", {
              battleId,
              unitId,
              reason: "exhaustion",
            });

            // Emitir também para invocações mortas
            killedSummons.forEach((summon) => {
              io.to(lobby.lobbyId).emit("battle:unit_defeated", {
                battleId,
                unitId: summon.id,
                reason: "summoner_death",
              });
            });
          }

          // Verificar vitória após morte por exaustão
          const victoryResult = checkVictoryCondition(battle);
          if (victoryResult && victoryResult.battleEnded) {
            battle.status = "ENDED";
            if (lobby) {
              emitBattleEndEvents(
                io,
                lobby.lobbyId,
                battleId,
                victoryResult,
                battle.units,
                lobby.vsBot
              );
            }
            stopBattleTurnTimer(battleId);
            await deleteBattleFromDB(battleId);
            if (lobby) await deleteLobbyFromDB(lobby.lobbyId);
            activeBattles.delete(battleId);
            if (lobby) battleLobbies.delete(lobby.lobbyId);
            return;
          }

          // Se a unidade morreu, avançar turno automaticamente
          const advanceResult = advanceToNextPlayer(battle);
          if (advanceResult) {
            if (lobby) {
              io.to(lobby.lobbyId).emit("battle:next_player", {
                battleId,
                currentPlayerId: advanceResult.nextPlayerId,
                currentTurnIndex: advanceResult.nextTurnIndex,
                round: advanceResult.newRound,
                actionOrder: battle.actionOrder,
              });
            }
            await saveBattleToDB(battle);
            await checkAndProcessBotTurn(battle);
          }
          return;
        }
      }

      socket.emit("battle:action_started", {
        battleId,
        unitId,
        movesLeft: effectiveSpeed,
        actionsLeft: unit.actionsLeft,
        currentHp: unit.currentHp,
        isAlive: unit.isAlive,
        actionMarks: unit.actionMarks,
      });

      await saveBattleToDB(battle);

      // Verificar se esta unidade está marcada para controle IA
      // Se estiver, a IA assume automaticamente
      const aiTookOver = await checkAndProcessAIControlledUnit(
        battleId,
        unitId
      );
      if (aiTookOver) {
        console.log(
          `[ARENA] Unidade ${unitId} foi processada pela IA automaticamente`
        );
      }
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

        // Limpar controle IA de todas as unidades desta batalha
        await clearAIControlForBattle(battle);

        emitBattleEndEvents(
          io,
          lobby.lobbyId,
          battle.id,
          victoryCheck,
          battle.units,
          lobby.vsBot
        );

        const loser = battle.players.find(
          (p) => p.userId !== victoryCheck.winnerId
        );
        const loserId = loser?.userId;
        await updateUserStats(victoryCheck.winnerId, loserId, battle.isArena);

        for (const player of battle.players) {
          userToLobby.delete(player.userId);
        }

        lobby.status = "ENDED";
        await deleteBattleFromDB(battleId);
        await deleteLobbyFromDB(lobby.lobbyId);
        console.log(
          `[BATTLE] Batalha ${battleId} finalizada. Vencedor: ${victoryCheck.winnerId}`
        );
        return;
      }

      // 3.5 Processar invocações do jogador (SUMMON/MONSTER) via IA
      // Antes de passar o turno, as invocações do jogador atual agem automaticamente
      await processPlayerSummons(battle, currentPlayerId);

      // Verificar vitória novamente (invocações podem ter matado inimigos)
      const victoryAfterSummons = checkVictoryCondition(battle);
      if (victoryAfterSummons.battleEnded) {
        battle.status = "ENDED";
        stopBattleTurnTimer(battle.id);
        await clearAIControlForBattle(battle);

        emitBattleEndEvents(
          io,
          lobby.lobbyId,
          battle.id,
          victoryAfterSummons,
          battle.units,
          lobby.vsBot
        );

        const loser = battle.players.find(
          (p) => p.userId !== victoryAfterSummons.winnerId
        );
        const loserId = loser?.userId;
        await updateUserStats(
          victoryAfterSummons.winnerId,
          loserId,
          battle.isArena
        );

        for (const player of battle.players) {
          userToLobby.delete(player.userId);
        }

        lobby.status = "ENDED";
        await deleteBattleFromDB(battleId);
        await deleteLobbyFromDB(lobby.lobbyId);
        console.log(
          `[BATTLE] Batalha ${battleId} finalizada após invocações. Vencedor: ${victoryAfterSummons.winnerId}`
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
        // Campos de recursos resetados - cliente precisa desses para evitar auto-end loop
        hasStartedAction: unit.hasStartedAction,
        movesLeft: unit.movesLeft,
        actionsLeft: unit.actionsLeft,
        attacksLeftThisTurn: unit.attacksLeftThisTurn,
      });

      if (turnEndResult.unitDefeated) {
        io.to(lobby.lobbyId).emit("battle:unit_defeated", {
          battleId,
          unitId,
          reason: "condition_damage",
        });

        // Matar invocações do jogador que morreu por condições
        const killedSummons = processSummonerDeath(unit, battle.units, "arena");
        for (const summon of killedSummons) {
          io.to(lobby.lobbyId).emit("battle:unit_defeated", {
            battleId,
            unitId: summon.id,
            reason: "summoner_death",
          });
        }
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
          unitCooldowns: u.unitCooldowns,
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
            battle.units,
            lobby.vsBot
          );

          const loser = battle.players.find(
            (p) => p.userId !== exhaustionCheck.winnerId
          );
          const loserId = loser?.userId;
          await updateUserStats(
            exhaustionCheck.winnerId,
            loserId,
            battle.isArena
          );

          for (const player of battle.players) {
            userToLobby.delete(player.userId);
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

      // Verificar se é turno do BOT e processar automaticamente
      await checkAndProcessBotTurn(battle);
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
        console.log(`[MOVE] Unidade não encontrada:`, {
          unitId,
          allIds: battle.units.map((u) => u.id),
        });
        return socket.emit("battle:error", {
          message: "[move] Unidade inválida",
        });
      }

      const result = executeMoveAction(
        unit,
        toX,
        toY,
        battle.gridWidth,
        battle.gridHeight,
        battle.units,
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

  // NOTA: battle:attack foi removido - usar battle:use_skill com skillCode "ATTACK"
  // NOTA: battle:dash e battle:dodge foram removidos
  // Agora são tratados como skills via battle:use_skill com skillCode "DASH" ou "DODGE"

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

      const winner = battle.players.find((p) => p.userId !== userId);
      const winnerId = winner?.userId;

      battle.status = "ENDED";
      lobby.status = "ENDED";
      stopBattleTurnTimer(battle.id);

      for (const player of battle.players) {
        userToLobby.delete(player.userId);
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
  // SKILL HANDLER - Uso de habilidades ativas (incluindo ações comuns)
  // ==========================================================================
  socket.on(
    "battle:use_skill",
    async ({
      battleId,
      casterUnitId,
      skillCode,
      targetUnitId,
      targetObstacleId,
    }: {
      battleId: string;
      casterUnitId: string;
      skillCode: string;
      targetUnitId?: string;
      targetObstacleId?: string;
    }) => {
      try {
        const battle = activeBattles.get(battleId);
        if (!battle || battle.status !== "ACTIVE") {
          return socket.emit("battle:error", { message: "Batalha inválida" });
        }

        const caster = battle.units.find((u) => u.id === casterUnitId);
        if (!caster || !caster.isAlive) {
          const foundUnit = battle.units.find((u) => u.id === casterUnitId);
          console.log(`[SKILL] Caster inválido:`, {
            casterUnitId,
            casterFound: !!foundUnit,
            casterIsAlive: foundUnit?.isAlive,
            allUnits: battle.units.map((u) => ({
              id: u.id,
              name: u.name,
              isAlive: u.isAlive,
            })),
          });
          return socket.emit("battle:error", {
            message: "[skill] Unidade inválida",
          });
        }

        // Buscar skill para info
        const skill = findSkillByCode(skillCode);
        if (!skill) {
          return socket.emit("battle:error", {
            message: "Skill não encontrada",
          });
        }

        let target: (typeof battle.units)[number] | null = null;
        let obstacle: BattleObstacle | undefined = undefined;

        if (targetUnitId) {
          target = battle.units.find((u) => u.id === targetUnitId) || null;
          if (!target) {
            return socket.emit("battle:error", {
              message: "Alvo não encontrado",
            });
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
        }

        // === ATTACK: Usar executeAttack diretamente para resultado completo ===
        if (skillCode === "ATTACK") {
          if (!target && !obstacle) {
            return socket.emit("battle:error", {
              message: "Ataque requer um alvo",
            });
          }

          const attackResult = executeAttack(
            caster,
            target,
            battle.units,
            skill,
            "FISICO",
            obstacle
          );

          if (!attackResult.success) {
            return socket.emit("battle:error", { message: attackResult.error });
          }

          const lobby = battleLobbies.get(battle.lobbyId);
          if (lobby) {
            console.log("[ATTACK_EVENT] Emitindo battle:unit_attacked", {
              battleId,
              attackerUnitId: casterUnitId,
              targetUnitId,
              targetObstacleId,
              targetDefeated: attackResult.targetDefeated,
              timestamp: Date.now(),
            });

            io.to(lobby.lobbyId).emit("battle:unit_attacked", {
              battleId,
              attackerUnitId: casterUnitId,
              targetUnitId: targetUnitId || null,
              targetObstacleId: targetObstacleId || null,
              targetType: attackResult.targetType,
              damage: attackResult.finalDamage,
              damageType: attackResult.damageType,
              targetHpAfter: attackResult.targetHpAfter,
              attackerActionsLeft: caster.actionsLeft,
              attackerAttacksLeftThisTurn:
                attackResult.attacksLeftThisTurn ?? 0,
              missed: attackResult.missed ?? false,
              rawDamage: attackResult.rawDamage ?? 0,
              damageReduction: attackResult.damageReduction ?? 0,
              finalDamage: attackResult.finalDamage ?? 0,
              targetPhysicalProtection:
                attackResult.targetPhysicalProtection ?? 0,
              targetMagicalProtection:
                attackResult.targetMagicalProtection ?? 0,
              targetDefeated: attackResult.targetDefeated ?? false,
              obstacleDestroyed: attackResult.obstacleDestroyed ?? false,
              obstacleId: attackResult.obstacleId ?? null,
              attackerName: caster.name,
              attackerIcon: "⚔️",
              attackerCombat: caster.combat,
              targetName: target?.name ?? obstacle?.id ?? "Obstáculo",
              targetIcon: target ? "🛡️" : "🪨",
              targetCombat: target?.combat ?? 0,
              targetSpeed: target?.speed ?? 0,
              dodgeChance: attackResult.dodgeChance ?? 0,
              dodgeRoll: attackResult.dodgeRoll ?? 0,
              killedSummonIds: attackResult.killedSummonIds ?? [],
            });

            // === COMBAT TOASTS ===
            // Toast de esquiva
            if (attackResult.missed && attackResult.dodged && target) {
              io.to(lobby.lobbyId).emit("battle:toast", {
                battleId,
                type: "success",
                title: "💨 Esquivou!",
                message: `${target.name} desviou do ataque de ${caster.name}!`,
                duration: 2500,
              });
            }

            // Toast de dano ao alvo
            if (
              !attackResult.missed &&
              target &&
              (attackResult.finalDamage ?? 0) > 0
            ) {
              const damageReduction = attackResult.damageReduction ?? 0;
              const hpDamage =
                (attackResult.finalDamage ?? 0) - damageReduction;

              if (damageReduction > 0 && hpDamage <= 0) {
                io.to(lobby.lobbyId).emit("battle:toast", {
                  battleId,
                  type: "warning",
                  title: "🛡️ Proteção!",
                  message: `${target.name} absorveu ${damageReduction} de dano de ${caster.name}`,
                  duration: 2000,
                });
              } else if (hpDamage > 0) {
                io.to(lobby.lobbyId).emit("battle:toast", {
                  battleId,
                  type: "error",
                  title: "💔 Dano!",
                  message: `${caster.name} causou ${attackResult.finalDamage} de dano a ${target.name}`,
                  duration: 2000,
                });
              }
            }

            // Toast de ataques extras
            if ((attackResult.attacksLeftThisTurn ?? 0) > 0) {
              io.to(lobby.lobbyId).emit("battle:toast", {
                battleId,
                type: "info",
                title: "⚔️ Ataques Extras!",
                message: `${caster.name} pode atacar mais ${attackResult.attacksLeftThisTurn} vez(es)!`,
                duration: 3000,
              });
            }

            // Obstáculo destruído
            if (attackResult.obstacleDestroyed && attackResult.obstacleId) {
              io.to(lobby.lobbyId).emit("battle:obstacle_destroyed", {
                battleId,
                obstacleId: attackResult.obstacleId,
              });
            }

            // Verificar vitória
            if (attackResult.targetDefeated && target) {
              io.to(lobby.lobbyId).emit("battle:unit_defeated", {
                battleId,
                unitId: target.id,
              });

              console.log("[ARENA] ⚔️ ATAQUE RESOLVIDO:", {
                casterUnitId,
                targetUnitId,
                damageDealt: attackResult.finalDamage,
                targetHpAfter: attackResult.targetHpAfter,
                targetDefeated: attackResult.targetDefeated,
                targetIsAliveInMemory: target?.isAlive,
              });

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
                  battleId,
                  victoryCheck,
                  battle.units,
                  lobby.vsBot
                );

                const loser = battle.players.find(
                  (p) => p.userId !== victoryCheck.winnerId
                );
                const loserId = loser?.userId;
                await updateUserStats(
                  victoryCheck.winnerId,
                  loserId,
                  battle.isArena
                );

                for (const player of battle.players) {
                  userToLobby.delete(player.userId);
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
          return;
        }

        // Executar skill (para outras skills que não ATTACK)
        const result = executeSkill(
          caster,
          skillCode,
          target,
          battle.units,
          battle.isArena
        );

        if (!result.success) {
          return socket.emit("battle:error", { message: result.error });
        }

        const lobby = battleLobbies.get(battle.lobbyId);
        if (lobby) {
          // Emitir eventos específicos para ações comuns
          if (skillCode === "DASH") {
            io.to(lobby.lobbyId).emit("battle:unit_dashed", {
              battleId,
              unitId: casterUnitId,
              movesLeft: caster.movesLeft,
              actionsLeft: caster.actionsLeft,
            });
            await saveBattleToDB(battle);
            return;
          }

          if (skillCode === "DODGE") {
            io.to(lobby.lobbyId).emit("battle:unit_dodged", {
              battleId,
              unitId: casterUnitId,
              actionsLeft: caster.actionsLeft,
              conditions: caster.conditions,
            });
            await saveBattleToDB(battle);
            return;
          }

          // Para outras skills, emitir evento genérico
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
            casterUnitCooldowns: caster.unitCooldowns,
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
                battle.units,
                lobby.vsBot
              );

              const loser = battle.players.find(
                (p) => p.userId !== victoryCheck.winnerId
              );
              const loserId = loser?.userId;
              await updateUserStats(
                victoryCheck.winnerId,
                loserId,
                battle.isArena
              );

              for (const player of battle.players) {
                userToLobby.delete(player.userId);
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

      const isPlayerInBattle = battle.players.some((p) => p.userId === userId);
      if (!isPlayerInBattle) {
        return socket.emit("battle:error", {
          message: "Você não está nesta batalha",
        });
      }

      const winner = battle.players.find((p) => p.userId !== userId);
      const winnerId = winner?.userId;

      battle.status = "ENDED";
      lobby.status = "ENDED";
      stopBattleTurnTimer(battle.id);

      for (const player of battle.players) {
        userToLobby.delete(player.userId);
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

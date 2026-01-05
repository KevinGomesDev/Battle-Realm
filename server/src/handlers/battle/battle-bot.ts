// server/src/handlers/battle/battle-bot.ts
// Gerenciador de turnos do BOT - IA controlando unidades

import { getBattleIo } from "./battle-state";
import { activeBattles, battleLobbies } from "./battle-state";
import { saveBattleToDB } from "./battle-persistence";
import { prisma } from "../../lib/prisma";
import { startBattleTurnTimer, stopBattleTurnTimer } from "./battle-timer";
import type { Battle } from "./battle-types";
import { BOT_USER_ID, BOT_KINGDOM_ID } from "./battle-creation";
import {
  processBotUnitDecision,
  aiActionDelay,
  executeAIDecision as executeAIDecisionCore,
} from "../../ai";
import type { AIDecision } from "../../ai";
import {
  processUnitTurnEndConditions,
  recordPlayerAction,
  advanceToNextPlayer,
  processNewRound,
  checkVictoryCondition,
} from "../../logic/round-control";
import { getEffectiveSpeedWithConditions } from "../../utils/battle.utils";

/**
 * Verifica se é o turno do BOT
 */
export function isBotTurn(battle: Battle): boolean {
  const currentPlayerId = battle.actionOrder[battle.currentTurnIndex];
  return currentPlayerId === BOT_USER_ID;
}

/**
 * Verifica se a batalha tem um BOT
 */
export function hasBotPlayer(battle: Battle): boolean {
  return battle.players.some((p) => p.userId === BOT_USER_ID);
}

/**
 * Processa o turno do BOT automaticamente
 * Chamado quando o turno muda para o BOT
 */
export async function processBotTurn(battle: Battle): Promise<void> {
  const io = getBattleIo();
  if (!io) return;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return;

  if (!isBotTurn(battle)) {
    console.log(`[BOT] Não é o turno do BOT, ignorando`);
    return;
  }

  console.log(`[BOT] 🤖 Iniciando turno do BOT na batalha ${battle.id}`);

  // Delay inicial maior para dar tempo do modal de turno aparecer no cliente
  // O modal tem animação de ~3200ms, então esperamos um pouco mais
  await aiActionDelay(3500);

  // Obter unidades do BOT
  const botUnits = battle.units.filter(
    (u) => u.isAlive && u.ownerId === BOT_USER_ID && !u.hasStartedAction
  );

  if (botUnits.length === 0) {
    console.log(`[BOT] Nenhuma unidade BOT disponível, passando turno`);
    await passBotTurn(battle);
    return;
  }

  // Para cada unidade do BOT, processar ação
  for (const unit of botUnits) {
    if (battle.status === "ENDED") break;

    console.log(`[BOT] Processando unidade: ${unit.name}`);

    // Iniciar ação da unidade (usar mesma lógica do jogador humano)
    const effectiveSpeed = getEffectiveSpeedWithConditions(
      unit.speed,
      unit.conditions
    );
    unit.hasStartedAction = true;
    unit.movesLeft = effectiveSpeed;
    unit.actionsLeft = 1;
    battle.activeUnitId = unit.id;

    console.log(
      `[BOT] Unidade ${unit.name} - movesLeft=${unit.movesLeft}, actionsLeft=${unit.actionsLeft}, pos=(${unit.posX}, ${unit.posY})`
    );

    // Emitir que a ação foi iniciada
    io.to(lobby.lobbyId).emit("battle:action_started", {
      battleId: battle.id,
      unitId: unit.id,
      movesLeft: unit.movesLeft,
      actionsLeft: unit.actionsLeft,
    });

    await aiActionDelay(500);

    // Processar decisões da IA para esta unidade
    await processBotUnitDecisions(battle, unit.id);

    // Se a batalha terminou, não continuar processando
    if ((battle.status as string) === "ENDED") {
      console.log(`[BOT] Batalha terminou, parando processamento de unidades`);
      break;
    }

    // Finalizar turno da unidade usando processUnitTurnEndConditions
    const turnEndResult = processUnitTurnEndConditions(unit);
    battle.activeUnitId = undefined;

    io.to(lobby.lobbyId).emit("battle:unit_turn_ended", {
      battleId: battle.id,
      unitId: unit.id,
      actionMarks: unit.actionMarks,
      currentHp: unit.currentHp,
      isAlive: unit.isAlive,
      conditions: unit.conditions,
      damageFromConditions: turnEndResult.damageFromConditions,
      conditionsRemoved: turnEndResult.conditionsRemoved,
      // Campos de recursos resetados
      hasStartedAction: unit.hasStartedAction,
      movesLeft: unit.movesLeft,
      actionsLeft: unit.actionsLeft,
      attacksLeftThisTurn: unit.attacksLeftThisTurn,
    });

    await aiActionDelay(300);
  }

  // Só passar turno se a batalha não terminou
  if ((battle.status as string) !== "ENDED") {
    await passBotTurn(battle);
  }
}

/**
 * Processa as decisões da IA para uma unidade específica do BOT
 * Com limite de iterações para evitar loops infinitos
 */
async function processBotUnitDecisions(
  battle: Battle,
  unitId: string,
  iteration: number = 0
): Promise<void> {
  const MAX_ITERATIONS = 20; // Limite de segurança

  if (iteration >= MAX_ITERATIONS) {
    console.log(`[BOT] Limite de iterações atingido para ${unitId}`);
    return;
  }

  const io = getBattleIo();
  if (!io) return;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return;

  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit || !unit.isAlive) return;

  // Verificar se a unidade pode fazer algo útil
  const canMove = unit.movesLeft > 0;
  const canAct = unit.actionsLeft > 0;

  if (!canMove && !canAct) {
    console.log(`[BOT] Unidade ${unit.name} sem recursos, finalizando`);
    return;
  }

  console.log(
    `[BOT] Unidade ${unit.name} - movesLeft=${unit.movesLeft}, actionsLeft=${unit.actionsLeft}, pos=(${unit.posX}, ${unit.posY})`
  );

  // Processar decisão para esta unidade específica do BOT
  const decision = await processBotUnitDecision(battle as any, unit as any);

  console.log(
    `[BOT] Decisão recebida:`,
    decision
      ? {
          type: decision.type,
          reason: decision.reason,
          targetPosition: decision.targetPosition,
          targetId: decision.targetId,
        }
      : "null"
  );

  if (!decision || decision.type === "PASS") {
    console.log(`[BOT] IA decidiu passar`);
    return;
  }

  // Verificar se a decisão é válida para os recursos atuais
  if (decision.type === "ATTACK" && !canAct) {
    console.log(`[BOT] IA quer atacar mas não tem ações, passando`);
    return;
  }
  if (decision.type === "MOVE" && !canMove) {
    console.log(`[BOT] IA quer mover mas não tem movimentos, passando`);
    return;
  }

  // Executar e emitir eventos
  const executed = await executeBotDecision(battle, decision);

  if (executed) {
    // Verificar se a batalha terminou após a execução
    if ((battle.status as string) === "ENDED") {
      console.log(`[BOT] Batalha terminou, parando processamento`);
      return;
    }

    await aiActionDelay(500); // Delay para visualização

    // Continuar processando se ainda tem recursos
    const unitAfter = battle.units.find((u) => u.id === unitId);
    if (
      unitAfter &&
      unitAfter.isAlive &&
      (unitAfter.movesLeft > 0 || unitAfter.actionsLeft > 0)
    ) {
      await processBotUnitDecisions(battle, unitId, iteration + 1);
    }
  } else {
    // Decisão falhou (ex: caminho bloqueado) - tentar continuar com próxima decisão
    console.log(`[BOT] Decisão ${decision.type} falhou, tentando novamente...`);
    const unitAfter = battle.units.find((u) => u.id === unitId);
    if (
      unitAfter &&
      unitAfter.isAlive &&
      (unitAfter.movesLeft > 0 || unitAfter.actionsLeft > 0)
    ) {
      await aiActionDelay(200);
      await processBotUnitDecisions(battle, unitId, iteration + 1);
    }
  }
}

/**
 * Executa uma decisão do BOT e emite eventos para os clientes
 * Usa executeAIDecisionCore para cálculos corretos (proteções, etc)
 */
async function executeBotDecision(
  battle: Battle,
  decision: AIDecision
): Promise<boolean> {
  const io = getBattleIo();
  if (!io) return false;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return false;

  const unit = battle.units.find((u) => u.id === decision.unitId);
  if (!unit) return false;

  console.log(
    `[BOT] Executando decisão: ${decision.type} - ${decision.reason}`
  );

  // Usar o executor core para cálculos corretos
  const result = executeAIDecisionCore(decision, battle as any);

  if (!result.success) {
    console.log(`[BOT] Decisão falhou: ${result.error}`);
    return false;
  }

  // Emitir eventos baseado no tipo de ação
  switch (decision.type) {
    case "MOVE":
      if (result.stateChanges?.unitMoved) {
        const { unitId, fromX, fromY, toX, toY } =
          result.stateChanges.unitMoved;
        const movedUnit = battle.units.find((u) => u.id === unitId);
        io.to(lobby.lobbyId).emit("battle:unit_moved", {
          battleId: battle.id,
          unitId,
          fromX,
          fromY,
          toX,
          toY,
          movesLeft: movedUnit?.movesLeft ?? 0,
        });
      }
      break;

    case "ATTACK":
      if (result.stateChanges?.unitAttacked) {
        const { attackerId, targetId, finalDamage, defeated } =
          result.stateChanges.unitAttacked;
        const attack = result.stateChanges.unitAttacked;
        const attacker = battle.units.find((u) => u.id === attackerId);
        const target = battle.units.find((u) => u.id === targetId);

        console.log(`[BOT ATTACK] Resultado:`, {
          attackerId,
          targetId,
          finalDamage,
          defeated,
          targetIsAlive: target?.isAlive,
          targetCurrentHp: target?.currentHp,
        });

        if (attacker && target) {
          io.to(lobby.lobbyId).emit("battle:unit_attacked", {
            battleId: battle.id,
            attackerUnitId: attackerId,
            targetUnitId: targetId,
            damage: finalDamage,
            finalDamage: finalDamage,
            targetHpAfter: target.currentHp,
            targetPhysicalProtection: target.physicalProtection,
            targetMagicalProtection: target.magicalProtection,
            targetDefeated: defeated,
            damageType: attack.damageType ?? "FISICO",
            attackerActionsLeft: attacker.actionsLeft,
            attackerAttacksLeftThisTurn: attacker.attacksLeftThisTurn,
            missed: attack.missed ?? false,
            rawDamage: attack.rawDamage ?? finalDamage,
            damageReduction: attack.damageReduction ?? 0,
            attackerName: attack.attackerName ?? attacker.name,
            targetName: attack.targetName ?? target.name,
            dodgeChance: attack.dodgeChance ?? 0,
            dodgeRoll: attack.dodgeRoll ?? 0,
          });

          // === COMBAT TOASTS ===
          // Toast de esquiva
          if (attack.missed && attack.dodged) {
            io.to(lobby.lobbyId).emit("battle:toast", {
              battleId: battle.id,
              type: "success",
              title: "💨 Esquivou!",
              message: `${target.name} desviou do ataque de ${attacker.name}!`,
              duration: 2500,
            });
          }

          // Toast de dano ao alvo
          if (!attack.missed && finalDamage > 0) {
            io.to(lobby.lobbyId).emit("battle:toast", {
              battleId: battle.id,
              type: "error",
              title: "⚔️ Ataque!",
              message: `${attacker.name} causou ${finalDamage} de dano em ${target.name}!`,
              duration: 2000,
            });
          }

          // Toast de derrota
          if (defeated) {
            console.log(`[BOT] 💀 Unidade derrotada! Verificando vitória...`);

            io.to(lobby.lobbyId).emit("battle:toast", {
              battleId: battle.id,
              type: "error",
              title: "💀 Derrotado!",
              message: `${target.name} foi derrotado por ${attacker.name}!`,
              duration: 3000,
            });

            io.to(lobby.lobbyId).emit("battle:unit_defeated", {
              battleId: battle.id,
              unitId: targetId,
            });

            // Verificar vitória após derrotar unidade
            const victoryCheck = checkVictoryCondition(battle);
            if (victoryCheck.battleEnded) {
              battle.status = "ENDED";
              stopBattleTurnTimer(battle.id);

              io.to(lobby.lobbyId).emit("battle:battle_ended", {
                battleId: battle.id,
                winnerId: victoryCheck.winnerId,
                winnerKingdomId: victoryCheck.winnerKingdomId,
                reason: victoryCheck.reason,
                finalUnits: battle.units,
              });

              console.log(
                `[BOT] Batalha finalizada após ataque. Vencedor: ${victoryCheck.winnerId}`
              );
              await saveBattleToDB(battle);
              return true; // Retornar imediatamente, batalha acabou
            }
          }
        }
      }
      break;

    case "PASS":
      // Não emite nada
      break;

    case "SKILL":
      console.log(`[BOT] Skill não implementado ainda: ${decision.skillCode}`);
      break;
  }

  await saveBattleToDB(battle);
  return true;
}

/**
 * Passa o turno do BOT para o próximo jogador
 * Usa mesma lógica de round-control do handler normal
 */
async function passBotTurn(battle: Battle): Promise<void> {
  const io = getBattleIo();
  if (!io) return;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return;

  // Encontrar jogador humano (não-BOT)
  const humanPlayer = battle.players.find((p) => p.userId !== BOT_USER_ID);
  const humanUserId = humanPlayer?.userId || "";
  const humanKingdomId = humanPlayer?.kingdomId || "";

  // Verificar vitória com logs
  const humanAlive = battle.units.some(
    (u) => u.ownerId === humanUserId && u.isAlive
  );
  const botAlive = battle.units.some(
    (u) => u.ownerId === BOT_USER_ID && u.isAlive
  );

  console.log(`[BOT passBotTurn] Verificando vitória:`, {
    humanUserId,
    humanAlive,
    botAlive,
    unitsAlive: battle.units
      .filter((u) => u.isAlive)
      .map((u) => ({ id: u.id, ownerId: u.ownerId, name: u.name })),
  });

  if (!humanAlive || !botAlive) {
    const winnerId = humanAlive ? humanUserId : BOT_USER_ID;
    battle.status = "ENDED";
    stopBattleTurnTimer(battle.id);

    io.to(lobby.lobbyId).emit("battle:battle_ended", {
      battleId: battle.id,
      winnerId,
      winnerKingdomId:
        winnerId === humanUserId ? humanKingdomId : BOT_KINGDOM_ID,
      reason:
        winnerId === BOT_USER_ID ? "🤖 O BOT venceu!" : "Você derrotou o BOT!",
      finalUnits: battle.units,
    });

    console.log(`[BOT] Batalha finalizada. Vencedor: ${winnerId}`);
    return;
  }

  // Registrar ação do BOT na rodada
  recordPlayerAction(battle, BOT_USER_ID);

  // Avançar para próximo jogador usando mesma lógica do handler
  const turnTransition = advanceToNextPlayer(battle);

  console.log(
    `[BOT] Turno avançado: ${turnTransition.previousPlayerId} -> ${turnTransition.nextPlayerId}, roundAdvanced: ${turnTransition.roundAdvanced}`
  );

  // Emitir evento de próximo jogador
  io.to(lobby.lobbyId).emit("battle:next_player", {
    battleId: battle.id,
    currentPlayerId: turnTransition.nextPlayerId,
    index: turnTransition.nextTurnIndex,
    round: battle.round,
  });

  // Se avançou rodada, processar nova rodada
  if (turnTransition.roundAdvanced) {
    await processNewRound(battle, io, lobby.lobbyId);

    // Emitir evento de nova rodada com unidades atualizadas
    io.to(lobby.lobbyId).emit("battle:new_round", {
      battleId: battle.id,
      round: battle.round,
      units: battle.units.map((u) => ({
        id: u.id,
        hasStartedAction: u.hasStartedAction,
        movesLeft: u.movesLeft,
        actionsLeft: u.actionsLeft,
        attacksLeftThisTurn: u.attacksLeftThisTurn,
        conditions: u.conditions,
        currentHp: u.currentHp,
        isAlive: u.isAlive,
        unitCooldowns: u.unitCooldowns,
      })),
    });

    // Re-emitir next_player com round atualizado
    io.to(lobby.lobbyId).emit("battle:next_player", {
      battleId: battle.id,
      currentPlayerId: turnTransition.nextPlayerId,
      index: turnTransition.nextTurnIndex,
      round: battle.round,
    });
  }

  await saveBattleToDB(battle);

  // Se o próximo também é o BOT, processar novamente
  if (turnTransition.nextPlayerId === BOT_USER_ID) {
    await aiActionDelay(1000);
    await processBotTurn(battle);
  } else {
    // Reiniciar timer para o jogador humano
    startBattleTurnTimer(battle);
  }
}

/**
 * Hook para ser chamado quando o turno muda
 * Verifica se é turno do BOT e processa automaticamente
 */
export async function checkAndProcessBotTurn(battle: Battle): Promise<void> {
  if (hasBotPlayer(battle) && isBotTurn(battle)) {
    await processBotTurn(battle);
  }
}

// =============================================================================
// PROCESSAMENTO DE SUMMONS/MONSTERS DO JOGADOR
// =============================================================================

/**
 * Processa todas as invocações (SUMMON/MONSTER) de um jogador via IA
 * Chamado após o turno do jogador terminar, antes de passar para o próximo
 */
export async function processPlayerSummons(
  battle: Battle,
  playerId: string
): Promise<void> {
  const io = getBattleIo();
  if (!io) return;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return;

  // Encontrar summons/monsters do jogador que ainda não agiram
  const playerSummons = battle.units.filter(
    (u) =>
      u.isAlive &&
      u.ownerId === playerId &&
      (u.category === "SUMMON" || u.category === "MONSTER") &&
      !u.hasStartedAction
  );

  if (playerSummons.length === 0) {
    return;
  }

  console.log(
    `[SUMMON-AI] 🎭 Processando ${playerSummons.length} invocação(ões) de ${playerId}`
  );

  for (const summon of playerSummons) {
    if ((battle.status as string) === "ENDED") break;

    console.log(`[SUMMON-AI] Processando invocação: ${summon.name}`);

    // Iniciar ação da unidade
    const effectiveSpeed = getEffectiveSpeedWithConditions(
      summon.speed,
      summon.conditions
    );
    summon.hasStartedAction = true;
    summon.movesLeft = effectiveSpeed;
    summon.actionsLeft = 1;
    battle.activeUnitId = summon.id;

    // Emitir que a ação foi iniciada
    io.to(lobby.lobbyId).emit("battle:action_started", {
      battleId: battle.id,
      unitId: summon.id,
      movesLeft: summon.movesLeft,
      actionsLeft: summon.actionsLeft,
    });

    await aiActionDelay(500);

    // Processar decisões da IA para esta invocação
    await processSummonDecisions(battle, summon.id);

    // Se a batalha terminou, não continuar
    if ((battle.status as string) === "ENDED") {
      console.log(
        `[SUMMON-AI] Batalha terminou, parando processamento de invocações`
      );
      break;
    }

    // Finalizar turno da invocação
    const turnEndResult = processUnitTurnEndConditions(summon);
    battle.activeUnitId = undefined;

    io.to(lobby.lobbyId).emit("battle:unit_turn_ended", {
      battleId: battle.id,
      unitId: summon.id,
      actionMarks: summon.actionMarks,
      currentHp: summon.currentHp,
      isAlive: summon.isAlive,
      conditions: summon.conditions,
      damageFromConditions: turnEndResult.damageFromConditions,
      conditionsRemoved: turnEndResult.conditionsRemoved,
      hasStartedAction: summon.hasStartedAction,
      movesLeft: summon.movesLeft,
      actionsLeft: summon.actionsLeft,
      attacksLeftThisTurn: summon.attacksLeftThisTurn,
    });

    await aiActionDelay(300);
    await saveBattleToDB(battle);
  }
}

/**
 * Processa decisões da IA para uma invocação específica
 * Similar a processBotUnitDecisions mas para summons do jogador
 */
async function processSummonDecisions(
  battle: Battle,
  unitId: string,
  iteration: number = 0
): Promise<void> {
  const MAX_ITERATIONS = 20;

  if (iteration >= MAX_ITERATIONS) {
    console.log(`[SUMMON-AI] Limite de iterações atingido para ${unitId}`);
    return;
  }

  const io = getBattleIo();
  if (!io) return;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return;

  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit || !unit.isAlive) return;

  const canMove = unit.movesLeft > 0;
  const canAct = unit.actionsLeft > 0;

  if (!canMove && !canAct) {
    console.log(`[SUMMON-AI] Invocação ${unit.name} sem recursos, finalizando`);
    return;
  }

  console.log(
    `[SUMMON-AI] Invocação ${unit.name} - movesLeft=${unit.movesLeft}, actionsLeft=${unit.actionsLeft}, pos=(${unit.posX}, ${unit.posY})`
  );

  // Processar decisão usando o mesmo sistema do BOT
  const decision = await processBotUnitDecision(battle as any, unit as any);

  console.log(
    `[SUMMON-AI] Decisão:`,
    decision
      ? {
          type: decision.type,
          reason: decision.reason,
          targetPosition: decision.targetPosition,
          targetId: decision.targetId,
        }
      : "null"
  );

  if (!decision || decision.type === "PASS") {
    console.log(`[SUMMON-AI] IA decidiu passar`);
    return;
  }

  console.log(
    `[SUMMON-AI] Executando decisão: ${decision.type} - ${decision.reason}`
  );

  // Executar a decisão
  const executeResult = executeAIDecisionCore(decision, battle as any);

  if (!executeResult.success) {
    console.log(
      `[SUMMON-AI] Falha ao executar decisão: ${executeResult.error}`
    );
    // Tentar novamente com próxima decisão
    console.log(`[SUMMON-AI] Tentando próxima decisão...`);
    if (unit.isAlive && (unit.movesLeft > 0 || unit.actionsLeft > 0)) {
      await aiActionDelay(200);
      await processSummonDecisions(battle, unitId, iteration + 1);
    }
    return;
  }

  // Emitir evento apropriado baseado no tipo de ação
  await emitDecisionEvents(battle, unit, decision, executeResult);

  await saveBattleToDB(battle);

  // Continuar processando se ainda pode fazer algo
  if (unit.isAlive && (unit.movesLeft > 0 || unit.actionsLeft > 0)) {
    await aiActionDelay(400);
    await processSummonDecisions(battle, unitId, iteration + 1);
  }
}

/**
 * Emite eventos de socket baseado no tipo de decisão executada
 */
async function emitDecisionEvents(
  battle: Battle,
  unit: any,
  decision: AIDecision,
  executeResult: any
): Promise<void> {
  const io = getBattleIo();
  if (!io) return;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return;

  switch (decision.type) {
    case "MOVE":
      io.to(lobby.lobbyId).emit("battle:unit_moved", {
        battleId: battle.id,
        unitId: unit.id,
        fromX: executeResult.fromX,
        fromY: executeResult.toX !== undefined ? unit.posX : undefined,
        toX: unit.posX,
        toY: unit.posY,
        movesLeft: unit.movesLeft,
      });
      await aiActionDelay(300);
      break;

    case "ATTACK":
      if (executeResult.stateChanges?.unitAttacked) {
        const attack = executeResult.stateChanges.unitAttacked;
        const target = battle.units.find((u) => u.id === attack.targetId);

        console.log(`[SUMMON-AI] Ataque executado:`, {
          attackerId: attack.attackerId,
          targetId: attack.targetId,
          finalDamage: attack.finalDamage,
          targetHpAfter: attack.targetHpAfter,
          defeated: attack.defeated,
        });

        io.to(lobby.lobbyId).emit("battle:unit_attacked", {
          battleId: battle.id,
          attackerUnitId: attack.attackerId,
          targetUnitId: attack.targetId,
          damage: attack.finalDamage,
          finalDamage: attack.finalDamage,
          targetHpAfter: attack.targetHpAfter,
          targetPhysicalProtection: attack.targetPhysicalProtection,
          targetMagicalProtection: attack.targetMagicalProtection,
          targetDefeated: attack.defeated,
          damageType: attack.damageType ?? "FISICO",
          attackerActionsLeft: unit.actionsLeft,
          attackerAttacksLeftThisTurn: unit.attacksLeftThisTurn,
          missed: attack.missed ?? false,
          rawDamage: attack.rawDamage ?? attack.finalDamage,
          damageReduction: attack.damageReduction ?? 0,
          attackerName: attack.attackerName ?? unit.name,
          targetName: attack.targetName ?? target?.name ?? "Alvo",
          dodgeChance: attack.dodgeChance ?? 0,
          dodgeRoll: attack.dodgeRoll ?? 0,
        });

        // Toast de ataque
        if (!attack.missed && attack.finalDamage > 0) {
          io.to(lobby.lobbyId).emit("battle:toast", {
            battleId: battle.id,
            type: "error",
            title: "⚔️ Ataque!",
            message: `${attack.attackerName ?? unit.name} causou ${
              attack.finalDamage
            } de dano em ${attack.targetName ?? "alvo"}!`,
            duration: 2000,
          });
        }

        // Se derrotou o alvo
        if (attack.defeated) {
          io.to(lobby.lobbyId).emit("battle:toast", {
            battleId: battle.id,
            type: "error",
            title: "💀 Derrotado!",
            message: `${attack.targetName ?? "Alvo"} foi derrotado por ${
              attack.attackerName ?? unit.name
            }!`,
            duration: 3000,
          });

          io.to(lobby.lobbyId).emit("battle:unit_defeated", {
            battleId: battle.id,
            unitId: attack.targetId,
          });

          // Verificar vitória
          const victoryCheck = checkVictoryCondition(battle);
          if (victoryCheck.battleEnded) {
            battle.status = "ENDED";
            stopBattleTurnTimer(battle.id);

            io.to(lobby.lobbyId).emit("battle:battle_ended", {
              battleId: battle.id,
              winnerId: victoryCheck.winnerId,
              winnerKingdomId: victoryCheck.winnerKingdomId,
              reason: victoryCheck.reason,
              finalUnits: battle.units,
            });
          }
        }
      }
      await aiActionDelay(500);
      break;

    case "SKILL":
      io.to(lobby.lobbyId).emit("battle:skill_used", {
        battleId: battle.id,
        unitId: unit.id,
        skillCode: decision.skillCode,
        targetId: decision.targetId,
        result: executeResult,
      });
      await aiActionDelay(500);
      break;
  }
}

// =============================================================================
// FUNNEL: TRANSFERIR CONTROLE DE UNIDADE PARA IA (PERSISTIDO NO BANCO)
// =============================================================================

/**
 * Marca uma unidade para ser controlada pela IA (persiste no banco)
 * A unidade será processada automaticamente quando for seu turno
 */
export async function enableAIControl(
  battleId: string,
  unitId: string
): Promise<void> {
  // Atualiza no banco
  await prisma.battleUnit.update({
    where: { id: unitId },
    data: { isAIControlled: true },
  });

  // Atualiza na memória também
  const battle = activeBattles.get(battleId);
  if (battle) {
    const unit = battle.units.find((u) => u.id === unitId);
    if (unit) {
      (unit as unknown as { isAIControlled: boolean }).isAIControlled = true;
    }
  }

  console.log(`[AI-FUNNEL] Unidade ${unitId} agora é controlada pela IA`);
}

/**
 * Remove controle da IA de uma unidade (persiste no banco)
 * O jogador volta a controlar manualmente
 */
export async function disableAIControl(
  battleId: string,
  unitId: string
): Promise<void> {
  // Atualiza no banco
  await prisma.battleUnit.update({
    where: { id: unitId },
    data: { isAIControlled: false },
  });

  // Atualiza na memória também
  const battle = activeBattles.get(battleId);
  if (battle) {
    const unit = battle.units.find((u) => u.id === unitId);
    if (unit) {
      (unit as unknown as { isAIControlled: boolean }).isAIControlled = false;
    }
  }

  console.log(`[AI-FUNNEL] Unidade ${unitId} voltou ao controle do jogador`);
}

/**
 * Verifica se uma unidade está sob controle da IA
 * Primeiro verifica na memória, depois no banco se necessário
 */
export function isAIControlled(battle: Battle, unitId: string): boolean {
  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit) return false;
  return (
    (unit as unknown as { isAIControlled?: boolean }).isAIControlled === true
  );
}

/**
 * Verifica se uma unidade está sob controle da IA (versão async para checar banco)
 */
export async function isAIControlledAsync(unitId: string): Promise<boolean> {
  const dbUnit = await prisma.battleUnit.findUnique({
    where: { id: unitId },
    select: { isAIControlled: true },
  });
  return dbUnit?.isAIControlled === true;
}

/**
 * Limpa todas as unidades controladas por IA de uma batalha (persiste no banco)
 * Chamar quando a batalha termina
 */
export async function clearAIControlForBattle(battle: Battle): Promise<void> {
  // Atualiza no banco todas as unidades da batalha
  await prisma.battleUnit.updateMany({
    where: { battleId: battle.id },
    data: { isAIControlled: false },
  });

  // Atualiza na memória
  for (const unit of battle.units) {
    (unit as unknown as { isAIControlled: boolean }).isAIControlled = false;
  }

  console.log(`[AI-FUNNEL] Controle IA limpo para batalha ${battle.id}`);
}

/**
 * FUNÇÃO FUNIL: Processa uma unidade como se fosse controlada pela IA
 *
 * Pode ser chamada a qualquer momento para fazer a IA assumir uma unidade.
 * Não altera o ownerId - apenas processa as decisões da IA.
 *
 * @param battleId - ID da batalha
 * @param unitId - ID da unidade a ser controlada
 * @param autoComplete - Se true, finaliza o turno automaticamente após processar
 * @returns true se processou com sucesso
 */
export async function funnelToAI(
  battleId: string,
  unitId: string,
  autoComplete: boolean = true
): Promise<boolean> {
  const io = getBattleIo();
  if (!io) {
    console.error("[AI-FUNNEL] IO não disponível");
    return false;
  }

  const battle = activeBattles.get(battleId);
  if (!battle) {
    console.error(`[AI-FUNNEL] Batalha ${battleId} não encontrada`);
    return false;
  }

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) {
    console.error(`[AI-FUNNEL] Lobby não encontrado para batalha ${battleId}`);
    return false;
  }

  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit || !unit.isAlive) {
    console.error(`[AI-FUNNEL] Unidade ${unitId} não encontrada ou morta`);
    return false;
  }

  console.log(`[AI-FUNNEL] 🤖 IA assumindo controle de ${unit.name}`);

  // Se a unidade ainda não iniciou a ação, iniciar agora
  if (!unit.hasStartedAction) {
    const effectiveSpeed = getEffectiveSpeedWithConditions(
      unit.speed,
      unit.conditions
    );
    unit.hasStartedAction = true;
    unit.movesLeft = effectiveSpeed;
    unit.actionsLeft = 1;
    battle.activeUnitId = unitId;

    io.to(lobby.lobbyId).emit("battle:action_started", {
      battleId: battle.id,
      unitId: unit.id,
      movesLeft: unit.movesLeft,
      actionsLeft: unit.actionsLeft,
    });

    await aiActionDelay(300);
  }

  // Processar decisões da IA
  await processBotUnitDecisions(battle, unitId);

  // Se autoComplete, finalizar turno
  if (autoComplete) {
    const turnEndResult = processUnitTurnEndConditions(unit);
    battle.activeUnitId = undefined;

    io.to(lobby.lobbyId).emit("battle:unit_turn_ended", {
      battleId: battle.id,
      unitId: unit.id,
      actionMarks: unit.actionMarks,
      currentHp: unit.currentHp,
      isAlive: unit.isAlive,
      conditions: unit.conditions,
      damageFromConditions: turnEndResult.damageFromConditions,
      conditionsRemoved: turnEndResult.conditionsRemoved,
      hasStartedAction: unit.hasStartedAction,
      movesLeft: unit.movesLeft,
      actionsLeft: unit.actionsLeft,
      attacksLeftThisTurn: unit.attacksLeftThisTurn,
    });

    await saveBattleToDB(battle);
  }

  console.log(`[AI-FUNNEL] ✅ IA finalizou controle de ${unit.name}`);
  return true;
}

/**
 * Verifica se uma unidade deve ser processada pela IA
 * e processa automaticamente se necessário.
 *
 * Chamar no início do turno de qualquer unidade.
 */
export async function checkAndProcessAIControlledUnit(
  battleId: string,
  unitId: string
): Promise<boolean> {
  const battle = activeBattles.get(battleId);
  if (!battle) return false;

  if (isAIControlled(battle, unitId)) {
    console.log(`[AI-FUNNEL] Unidade ${unitId} está marcada para controle IA`);
    return await funnelToAI(battleId, unitId, true);
  }
  return false;
}

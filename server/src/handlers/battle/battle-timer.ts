import { getBattleIo } from "./battle-state";
import {
  activeBattles,
  battleDiceModalPaused,
  battleLobbies,
  battleTimerIntervals,
  disconnectedPlayers,
  userToLobby,
} from "./battle-state";
import {
  deleteBattleFromDB,
  deleteLobbyFromDB,
  saveBattleToDB,
  updateUserStats,
} from "./battle-persistence";
import {
  getEffectiveSpeedWithConditions,
  getMaxMarksByCategory,
} from "../../utils/battle.utils";
import type { Battle } from "./battle-types";
import { TURN_TIMER_SECONDS } from "./battle-types";
import {
  processUnitTurnEndConditions,
  advanceToNextPlayer,
  checkVictoryCondition,
  recordPlayerAction,
  emitBattleEndEvents,
  processNewRound,
} from "../../logic/round-control";
import { checkAndProcessBotTurn } from "./battle-bot";

function hasConnectedPlayers(battle: Battle): boolean {
  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return false;

  // Verificar se pelo menos um jogador está conectado
  return battle.players.some(
    (player) => !disconnectedPlayers.has(player.userId)
  );
}

export function startBattleTurnTimer(battle: Battle): void {
  stopBattleTurnTimer(battle.id);

  if (battle.status === "ENDED") {
    console.log(
      `[ARENA] Timer não iniciado - batalha ${battle.id} já terminou`
    );
    return;
  }

  if (!hasConnectedPlayers(battle)) {
    console.log(
      `[ARENA] Timer não iniciado - nenhum jogador conectado na batalha ${battle.id}`
    );
    return;
  }

  battle.turnTimer = TURN_TIMER_SECONDS;

  const lobby = battleLobbies.get(battle.lobbyId);
  const io = getBattleIo();
  if (!lobby || !io) return;

  io.to(lobby.lobbyId).emit("battle:turn_timer", {
    battleId: battle.id,
    timer: battle.turnTimer,
    currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
  });

  const interval = setInterval(() => {
    if (battleDiceModalPaused.get(battle.id)) {
      return;
    }

    battle.turnTimer--;

    if (battle.turnTimer <= 0) {
      stopBattleTurnTimer(battle.id);
      void handleTimerExpired(battle);
    } else {
      const currentLobby = battleLobbies.get(battle.lobbyId);
      const currentIo = getBattleIo();
      if (currentLobby && currentIo) {
        currentIo.to(currentLobby.lobbyId).emit("battle:turn_timer", {
          battleId: battle.id,
          timer: battle.turnTimer,
          currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
        });
      }
    }
  }, 1000);

  battleTimerIntervals.set(battle.id, interval);
}

export function stopBattleTurnTimer(battleId: string): void {
  const interval = battleTimerIntervals.get(battleId);
  if (interval) {
    clearInterval(interval);
    battleTimerIntervals.delete(battleId);
  }
}

export function cleanupBattle(battleId: string): void {
  stopBattleTurnTimer(battleId);
  battleDiceModalPaused.delete(battleId);
  activeBattles.delete(battleId);
}

export function pauseBattleTimerIfNoPlayers(battleId: string): void {
  const battle = activeBattles.get(battleId);
  if (!battle) return;

  if (!hasConnectedPlayers(battle)) {
    console.log(
      `[ARENA] Pausando timer - todos os jogadores desconectaram da batalha ${battleId}`
    );
    stopBattleTurnTimer(battleId);
  }
}

export function resumeBattleTimer(battleId: string): void {
  const battle = activeBattles.get(battleId);
  if (!battle) {
    console.log(
      `[ARENA] resumeBattleTimer: Batalha ${battleId} não encontrada`
    );
    return;
  }

  const hasPlayers = hasConnectedPlayers(battle);
  const hasTimer = battleTimerIntervals.has(battleId);

  console.log(
    `[ARENA] resumeBattleTimer: battleId=${battleId}, hasPlayers=${hasPlayers}, hasTimer=${hasTimer}, currentTimer=${battle.turnTimer}`
  );

  if (!hasTimer && hasPlayers) {
    console.log(
      `[ARENA] Retomando timer - jogador reconectou na batalha ${battleId}`
    );
    startBattleTurnTimer(battle);
  } else if (hasTimer && hasPlayers) {
    const lobby = battleLobbies.get(battle.lobbyId);
    const io = getBattleIo();
    if (lobby && io) {
      io.to(lobby.lobbyId).emit("battle:turn_timer", {
        battleId: battle.id,
        timer: battle.turnTimer,
        currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
      });
      console.log(
        `[ARENA] Timer sync emitido para ${lobby.lobbyId}, timer=${battle.turnTimer}`
      );
    }
  }
}

async function handleTimerExpired(battle: Battle): Promise<void> {
  const io = getBattleIo();
  if (!io) return;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return;

  const currentPlayerId = battle.actionOrder[battle.currentTurnIndex];

  const currentUnit = battle.activeUnitId
    ? battle.units.find((u) => u.id === battle.activeUnitId)
    : null;

  // Se havia uma unidade com turno iniciado, processar fim de turno
  if (currentUnit && currentUnit.hasStartedAction) {
    // Usar RoundControl para processar condições de fim de turno
    const turnEndResult = processUnitTurnEndConditions(currentUnit);

    // Emitir evento de turno finalizado
    io.to(lobby.lobbyId).emit("battle:unit_turn_ended", {
      battleId: battle.id,
      unitId: currentUnit.id,
      actionMarks: currentUnit.actionMarks,
      currentHp: currentUnit.currentHp,
      isAlive: currentUnit.isAlive,
      conditions: currentUnit.conditions,
      damageFromConditions: turnEndResult.damageFromConditions,
      conditionsRemoved: turnEndResult.conditionsRemoved,
    });

    if (turnEndResult.unitDefeated) {
      io.to(lobby.lobbyId).emit("battle:unit_defeated", {
        battleId: battle.id,
        unitId: currentUnit.id,
        reason: "condition_damage",
      });
    }
  } else {
    // Jogador não escolheu nenhuma unidade - apenas passar o turno
    console.log(
      `[ARENA] Timer expirado - Jogador ${currentPlayerId} não escolheu nenhuma unidade, passando turno`
    );
  }

  // Registrar ação do jogador (mesmo que não tenha escolhido unidade)
  // Isso garante que o sistema de rodadas funcione corretamente
  recordPlayerAction(battle, currentPlayerId);

  // Verificar condições de vitória usando RoundControl
  const victoryCheck = checkVictoryCondition(battle);

  console.log("[ARENA] Timer expirado - Verificando vitória:", {
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
      battle.units,
      lobby.vsBot
    );

    // Encontrar perdedores (todos que não são o vencedor)
    const losers = battle.players.filter(
      (p) => p.userId !== victoryCheck.winnerId
    );
    for (const loser of losers) {
      await updateUserStats(
        victoryCheck.winnerId,
        loser.userId,
        battle.isArena
      );
    }

    // Limpar todos os jogadores do mapeamento
    for (const player of battle.players) {
      userToLobby.delete(player.userId);
    }

    lobby.status = "ENDED";
    await deleteBattleFromDB(battle.id);
    await deleteLobbyFromDB(lobby.lobbyId);
    console.log(
      `[ARENA] Batalha ${battle.id} finalizada via timer. Vencedor: ${victoryCheck.winnerId}`
    );
    return;
  }

  // Avançar para próximo jogador usando RoundControl
  const turnTransition = advanceToNextPlayer(battle);

  // Emitir evento de próximo jogador
  io.to(lobby.lobbyId).emit("battle:next_player", {
    battleId: battle.id,
    currentPlayerId: turnTransition.nextPlayerId,
    index: turnTransition.nextTurnIndex,
    round: battle.round,
  });

  // Se avançou rodada, emitir evento
  if (turnTransition.roundAdvanced) {
    // Processar nova rodada (reseta hasStartedAction de todas as unidades)
    await processNewRound(battle, io, lobby.lobbyId);

    // Enviar unidades atualizadas junto com nova rodada
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
      battleId: battle.id,
      round: battle.round,
      units: serializedUnits,
    });
    io.to(lobby.lobbyId).emit("battle:next_player", {
      battleId: battle.id,
      currentPlayerId: turnTransition.nextPlayerId,
      index: turnTransition.nextTurnIndex,
      round: battle.round,
    });
    console.log(
      `[ARENA] Nova rodada ${battle.round} (via timer) - Re-emitido battle:next_player com round atualizado`
    );
  }

  startBattleTurnTimer(battle);
  await saveBattleToDB(battle);

  // Verificar se é turno do BOT e processar automaticamente
  await checkAndProcessBotTurn(battle);
}

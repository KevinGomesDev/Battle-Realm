// src/handlers/battle.handler.ts
// Sistema Unificado de Batalha - Arena PvP e Batalhas de Partida
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import {
  getMaxMarksByCategory,
  getEffectiveAcuityWithConditions,
} from "../utils/battle.utils";
import {
  createBattleUnitsForSide,
  createBattleUnitsWithRandomPositions,
  getArenaBattleGridSize,
  sortByInitiative,
  determineActionOrder,
  BattleUnit,
} from "../utils/battle-unit.factory";
import { canJoinNewSession } from "../utils/session.utils";
import {
  executeMoveAction,
  executeAttackAction,
  executeDashAction,
  executeDodgeAction,
  executeHelpAction,
  executeProtectAction,
  executeKnockdownAction,
  executeDisarmAction,
  executeGrabAction,
  executeThrowAction,
  executeFleeAction,
  executeCastAction,
  CombatUnit,
  calculateBaseMovement,
} from "../logic/combat-actions";
import { determineUnitActions } from "../logic/unit-actions";
import { getConditionColorsMap } from "../logic/conditions";
import { generateBattleMap } from "../logic/battle-map";
import {
  PHYSICAL_PROTECTION_CONFIG,
  MAGICAL_PROTECTION_CONFIG,
  HP_CONFIG,
  TURN_CONFIG,
  ARENA_COLORS,
} from "../../../shared/config/global.config";
import type {
  ArenaLobbyData,
  ArenaBattleData,
} from "../../../shared/types/session.types";
import type { ArenaConfig } from "../../../shared/types/arena.types";
import type {
  BattleObstacle,
  WeatherType,
  BattleTerrainType,
  TerritorySize,
} from "../../../shared/types/battle.types";
import {
  WEATHER_DEFINITIONS,
  BATTLE_TERRAIN_DEFINITIONS,
} from "../../../shared/types/battle.types";

// Usar tipos do shared para consistência
type BattleLobby = ArenaLobbyData;

interface Battle {
  id: string;
  lobbyId: string; // Para Arena
  matchId?: string; // Para batalhas de partida (null para Arena)
  isArena: boolean; // true = Arena PvP, false = batalha de partida
  gridWidth: number;
  gridHeight: number;
  round: number;
  currentTurnIndex: number;
  status: "ACTIVE" | "ENDED";
  turnTimer: number; // Segundos restantes no turno atual
  initiativeOrder: string[]; // BattleUnit ids
  actionOrder: string[]; // Player ids (baseado em iniciativa)
  units: BattleUnit[];
  logs: BattleLog[];
  createdAt: Date;
  config: ArenaConfig; // Configuração completa (inclui mapa, clima, obstáculos)
  activeUnitId?: string; // ID da unidade ativa no turno atual (escolhida pelo jogador)
  roundActionsCount: Map<string, number>; // Contador de ações por jogador na rodada atual
  // IDs para persistência
  hostUserId: string;
  guestUserId: string;
  hostKingdomId: string;
  guestKingdomId: string;
  // Sistema de resgate (apenas para batalhas de partida)
  ransomPrice?: number;
  ransomResource?: string;
}

// BattleUnit é importado de battle-unit.factory.ts

interface BattleLog {
  id: string;
  timestamp: Date;
  type: string;
  payload: any;
}

// Constantes (agora usando config centralizada)
const TURN_TIMER_SECONDS = TURN_CONFIG.timerSeconds;

// Armazenamento em memória (pode ser migrado para Redis/DB depois)
const battleLobbies: Map<string, BattleLobby> = new Map();
const activeBattles: Map<string, Battle> = new Map();
const userToLobby: Map<string, string> = new Map(); // userId -> lobbyId
const socketToUser: Map<string, string> = new Map(); // socketId -> userId

// Mapa para rastrear jogadores desconectados (para notificar quando reconectarem)
const disconnectedPlayers: Map<string, string> = new Map(); // odUsuerId -> lobbyId

// Mapa para rastrear pedidos de revanche
const rematchRequests: Map<string, Set<string>> = new Map(); // lobbyId -> Set of userIds who want rematch

// Lock para evitar race condition em rematch
const rematchLocks: Map<string, boolean> = new Map(); // lobbyId -> isProcessing

// Mapa para intervalos de timer de batalha
const battleTimerIntervals: Map<
  string,
  ReturnType<typeof setInterval>
> = new Map();

// Mapa para rastrear batalhas com modal de dice ativo (timer pausado)
const battleDiceModalPaused: Map<string, boolean> = new Map();

// Exportar referências para o session handler (mantendo nomes antigos para compatibilidade)
export {
  battleLobbies,
  activeBattles,
  battleLobbies as arenaLobbies,
  activeBattles as arenaBattles,
  userToLobby,
  disconnectedPlayers,
  socketToUser,
};

// Helpers
function generateId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Variável para armazenar referência do io (será definida no registerBattleHandler)
let ioRef: Server | null = null;

/**
 * Verifica se há pelo menos um jogador conectado na batalha
 */
function hasConnectedPlayers(battle: Battle): boolean {
  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return false;

  // Se algum jogador não está na lista de desconectados, há alguém conectado
  const hostDisconnected = disconnectedPlayers.has(battle.hostUserId);
  const guestDisconnected = disconnectedPlayers.has(battle.guestUserId);

  return !hostDisconnected || !guestDisconnected;
}

/**
 * Inicia/reinicia o timer compartilhado do turno
 */
function startBattleTurnTimer(battle: Battle): void {
  // Limpar timer anterior se existir
  stopBattleTurnTimer(battle.id);

  // Não iniciar timer se batalha já terminou
  if (battle.status === "ENDED") {
    console.log(
      `[ARENA] Timer não iniciado - batalha ${battle.id} já terminou`
    );
    return;
  }

  // Não iniciar timer se nenhum jogador está conectado
  if (!hasConnectedPlayers(battle)) {
    console.log(
      `[ARENA] Timer não iniciado - nenhum jogador conectado na batalha ${battle.id}`
    );
    return;
  }

  battle.turnTimer = TURN_TIMER_SECONDS;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby || !ioRef) return;

  // Emitir timer inicial
  ioRef.to(lobby.lobbyId).emit("battle:turn_timer", {
    battleId: battle.id,
    timer: battle.turnTimer,
    currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
  });

  // Iniciar intervalo de 1 segundo
  const interval = setInterval(() => {
    // Se modal de dice está ativo, pausar contagem
    if (battleDiceModalPaused.get(battle.id)) {
      return; // Não decrementa timer enquanto modal está aberto
    }

    battle.turnTimer--;

    if (battle.turnTimer <= 0) {
      // Tempo esgotado - auto-skip turno
      stopBattleTurnTimer(battle.id);
      handleTimerExpired(battle);
    } else {
      // Emitir atualização do timer
      const currentLobby = battleLobbies.get(battle.lobbyId);
      if (currentLobby && ioRef) {
        ioRef.to(currentLobby.lobbyId).emit("battle:turn_timer", {
          battleId: battle.id,
          timer: battle.turnTimer,
          currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
        });
      }
    }
  }, 1000);

  battleTimerIntervals.set(battle.id, interval);
}

/**
 * Para o timer da batalha
 */
function stopBattleTurnTimer(battleId: string): void {
  const interval = battleTimerIntervals.get(battleId);
  if (interval) {
    clearInterval(interval);
    battleTimerIntervals.delete(battleId);
  }
}

/**
 * Limpa todos os recursos de uma batalha (timer, mapa, etc.)
 */
function cleanupBattle(battleId: string): void {
  stopBattleTurnTimer(battleId);
  battleDiceModalPaused.delete(battleId);
  activeBattles.delete(battleId);
}

/**
 * Pausa o timer de uma batalha quando todos os jogadores desconectam
 * Exportada para uso no session.handler
 */
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

/**
 * Retoma o timer de uma batalha quando um jogador reconecta
 * Exportada para uso no session.handler
 */
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

  // Só retomar se não houver timer ativo e houver jogadores conectados
  if (!hasTimer && hasPlayers) {
    console.log(
      `[ARENA] Retomando timer - jogador reconectou na batalha ${battleId}`
    );
    startBattleTurnTimer(battle);
  } else if (hasTimer && hasPlayers) {
    // Timer já está rodando, emitir estado atual para sincronizar cliente
    const lobby = battleLobbies.get(battle.lobbyId);
    if (lobby && ioRef) {
      ioRef.to(lobby.lobbyId).emit("battle:turn_timer", {
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

/**
 * Chamado quando o timer expira - avança o turno automaticamente
 */
async function handleTimerExpired(battle: Battle): Promise<void> {
  if (!ioRef) return;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return;

  const currentPlayerId = battle.actionOrder[battle.currentTurnIndex];

  // Usar a unidade ativa do turno (se definida), senão não incrementa actionMarks
  const currentUnit = battle.activeUnitId
    ? battle.units.find((u) => u.id === battle.activeUnitId)
    : null;

  if (currentUnit && currentUnit.hasStartedAction) {
    // Aplica queimando
    if (currentUnit.conditions.includes("QUEIMANDO")) {
      currentUnit.currentHp = Math.max(0, currentUnit.currentHp - 2);
      if (currentUnit.currentHp <= 0) {
        currentUnit.isAlive = false;
      }
    }

    // Remove DERRUBADA e condições que expiram no fim do turno
    currentUnit.conditions = currentUnit.conditions.filter(
      (c) => c !== "DERRUBADA" && c !== "DODGING"
    );

    const maxMarks = getMaxMarksByCategory(currentUnit.category);
    currentUnit.actionMarks = Math.min(maxMarks, currentUnit.actionMarks + 1);
    currentUnit.movesLeft = 0;
    currentUnit.actionsLeft = 0;
    currentUnit.hasStartedAction = false;

    // Emitir estado atualizado da unidade
    ioRef.to(lobby.lobbyId).emit("battle:unit_turn_ended", {
      battleId: battle.id,
      unitId: currentUnit.id,
      actionMarks: currentUnit.actionMarks,
      currentHp: currentUnit.currentHp,
      isAlive: currentUnit.isAlive,
      conditions: currentUnit.conditions,
    });

    // Se unidade morreu (por QUEIMANDO, etc), emitir evento de derrota
    if (!currentUnit.isAlive) {
      ioRef.to(lobby.lobbyId).emit("battle:unit_defeated", {
        battleId: battle.id,
        unitId: currentUnit.id,
      });
    }
  }

  // ============================================================
  // VERIFICAR VITÓRIA - Pode acontecer por morte via condição
  // ============================================================
  const aliveBySide = new Map<string, number>();
  for (const u of battle.units) {
    if (u.isAlive) {
      const count = aliveBySide.get(u.ownerId) || 0;
      aliveBySide.set(u.ownerId, count + 1);
    }
  }

  console.log("[ARENA] Timer expirado - Verificando vitória:", {
    aliveBySideSize: aliveBySide.size,
    aliveBySide: Object.fromEntries(aliveBySide),
  });

  if (aliveBySide.size <= 1) {
    battle.status = "ENDED";
    stopBattleTurnTimer(battle.id);
    const winnerId = aliveBySide.keys().next().value || null;
    const winnerKingdom = battle.units.find(
      (u) => u.ownerId === winnerId
    )?.ownerKingdomId;

    ioRef.to(lobby.lobbyId).emit("battle:battle_ended", {
      battleId: battle.id,
      winnerId,
      winnerKingdomId: winnerKingdom,
      reason:
        aliveBySide.size === 0
          ? "Empate - Todas as unidades foram derrotadas"
          : "Todas as unidades inimigas foram derrotadas",
      finalUnits: battle.units,
    });

    // Atualizar estatísticas
    const loserId =
      winnerId === lobby.hostUserId ? lobby.guestUserId : lobby.hostUserId;
    await updateUserStats(winnerId, loserId, battle.isArena);

    // Limpar referências
    userToLobby.delete(lobby.hostUserId);
    if (lobby.guestUserId) {
      userToLobby.delete(lobby.guestUserId);
    }

    lobby.status = "ENDED";
    await deleteBattleFromDB(battle.id);
    await deleteLobbyFromDB(lobby.lobbyId);
    console.log(
      `[ARENA] Batalha ${battle.id} finalizada via timer. Vencedor: ${winnerId}`
    );
    return; // Não continuar se a batalha terminou
  }

  // Incrementar contador de ações do jogador (se agiu com uma unidade)
  if (currentUnit && currentUnit.hasStartedAction) {
    const currentCount = battle.roundActionsCount.get(currentPlayerId) || 0;
    battle.roundActionsCount.set(currentPlayerId, currentCount + 1);
  }

  // Avança jogador e reseta unidade ativa
  battle.activeUnitId = undefined;
  if (battle.actionOrder.length) {
    battle.currentTurnIndex =
      (battle.currentTurnIndex + 1) % battle.actionOrder.length;
  }

  // Emitir mudança de turno
  ioRef.to(lobby.lobbyId).emit("battle:next_player", {
    battleId: battle.id,
    currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
    index: battle.currentTurnIndex,
  });

  // Checa fim do round - todos os jogadores agiram 1x
  const allPlayersActed = battle.actionOrder.every(
    (playerId) => (battle.roundActionsCount.get(playerId) || 0) >= 1
  );

  if (allPlayersActed) {
    // Novo round - reseta contadores
    battle.round++;
    for (const playerId of battle.actionOrder) {
      battle.roundActionsCount.set(playerId, 0);
    }
    ioRef.to(lobby.lobbyId).emit("battle:new_round", {
      battleId: battle.id,
      round: battle.round,
    });
  }

  // Iniciar timer para o próximo turno
  startBattleTurnTimer(battle);

  // Salvar estado da batalha no banco
  await saveBattleToDB(battle);
}

// === FUNÇÕES DE PERSISTÊNCIA NO BANCO ===

/**
 * Salva uma batalha de Arena no banco de dados
 */
async function saveBattleToDB(battle: Battle): Promise<void> {
  try {
    // Extrair dados do mapa
    const mapConfig = battle.config?.map;

    // Criar ou atualizar a batalha
    await prisma.battle.upsert({
      where: { id: battle.id },
      update: {
        status: battle.status,
        round: battle.round,
        currentTurnIndex: battle.currentTurnIndex,
        initiativeOrder: JSON.stringify(battle.initiativeOrder),
        actionOrder: JSON.stringify(battle.actionOrder),
        // Persistir obstáculos atualizados (podem ser destruídos)
        obstacles: JSON.stringify(mapConfig?.obstacles || []),
        updatedAt: new Date(),
      },
      create: {
        id: battle.id,
        isArena: true,
        lobbyId: battle.lobbyId,
        hostUserId: battle.hostUserId,
        guestUserId: battle.guestUserId,
        hostKingdomId: battle.hostKingdomId,
        guestKingdomId: battle.guestKingdomId,
        status: battle.status,
        gridWidth: battle.gridWidth,
        gridHeight: battle.gridHeight,
        round: battle.round,
        currentTurnIndex: battle.currentTurnIndex,
        initiativeOrder: JSON.stringify(battle.initiativeOrder),
        actionOrder: JSON.stringify(battle.actionOrder),
        // Clima e Terreno
        weather: mapConfig?.weather || "SUNNY",
        terrainType: mapConfig?.terrainType || "PLAINS",
        territorySize: mapConfig?.territorySize || "MEDIUM",
        obstacles: JSON.stringify(mapConfig?.obstacles || []),
      },
    });

    // Save/update all units
    for (const unit of battle.units) {
      await prisma.battleUnit.upsert({
        where: { id: unit.id },
        update: {
          posX: unit.posX,
          posY: unit.posY,
          currentHp: unit.currentHp,
          movesLeft: unit.movesLeft,
          actionsLeft: unit.actionsLeft,
          isAlive: unit.isAlive,
          actionMarks: unit.actionMarks,
          protection: unit.protection,
          protectionBroken: unit.protectionBroken,
          conditions: JSON.stringify(unit.conditions),
          hasStartedAction: unit.hasStartedAction,
        },
        create: {
          id: unit.id,
          battleId: battle.id,
          userId: unit.ownerId,
          kingdomId: unit.ownerKingdomId,
          name: unit.name,
          avatar: unit.avatar,
          category: unit.category,
          troopSlot: unit.troopSlot,
          level: unit.level,
          classCode: unit.classCode,
          classFeatures: JSON.stringify(unit.classFeatures),
          equipment: JSON.stringify(unit.equipment),
          combat: unit.combat,
          acuity: unit.acuity,
          focus: unit.focus,
          armor: unit.armor,
          vitality: unit.vitality,
          damageReduction: unit.damageReduction || 0,
          currentHp: unit.currentHp,
          posX: unit.posX,
          posY: unit.posY,
          initiative: unit.initiative,
          movesLeft: unit.movesLeft,
          actionsLeft: unit.actionsLeft,
          isAlive: unit.isAlive,
          actionMarks: unit.actionMarks,
          protection: unit.protection,
          protectionBroken: unit.protectionBroken,
          conditions: JSON.stringify(unit.conditions),
          hasStartedAction: unit.hasStartedAction,
          actions: JSON.stringify(unit.actions),
        },
      });
    }

    console.log(`[ARENA] Batalha ${battle.id} salva no banco`);
  } catch (err) {
    console.error("[ARENA] Erro ao salvar batalha no banco:", err);
  }
}

/**
 * Salva um lobby de Arena no banco de dados
 */
async function saveLobbyToDB(lobby: BattleLobby): Promise<void> {
  try {
    // Buscar nomes do host
    const hostKingdom = await prisma.kingdom.findUnique({
      where: { id: lobby.hostKingdomId },
      include: { owner: true },
    });

    // Buscar nomes do guest (se existir)
    let guestKingdom = null;
    if (lobby.guestKingdomId) {
      guestKingdom = await prisma.kingdom.findUnique({
        where: { id: lobby.guestKingdomId },
        include: { owner: true },
      });
    }

    await prisma.arenaLobby.upsert({
      where: { id: lobby.lobbyId },
      update: {
        hostSocketId: lobby.hostSocketId,
        guestUserId: lobby.guestUserId,
        guestSocketId: lobby.guestSocketId || null,
        guestKingdomId: lobby.guestKingdomId,
        guestUsername: guestKingdom?.owner?.username,
        guestKingdomName: guestKingdom?.name,
        status: lobby.status,
        updatedAt: new Date(),
      },
      create: {
        id: lobby.lobbyId,
        hostUserId: lobby.hostUserId,
        hostSocketId: lobby.hostSocketId,
        hostKingdomId: lobby.hostKingdomId,
        hostUsername: hostKingdom?.owner?.username || "",
        hostKingdomName: hostKingdom?.name || "",
        guestUserId: lobby.guestUserId,
        guestSocketId: lobby.guestSocketId,
        guestKingdomId: lobby.guestKingdomId,
        guestUsername: guestKingdom?.owner?.username,
        guestKingdomName: guestKingdom?.name,
        status: lobby.status,
        createdAt: lobby.createdAt,
      },
    });
    console.log(`[ARENA] Lobby ${lobby.lobbyId} salvo no banco`);
  } catch (err) {
    console.error("[ARENA] Erro ao salvar lobby no banco:", err);
  }
}

/**
 * Deleta um lobby de Arena do banco de dados
 */
async function deleteLobbyFromDB(lobbyId: string): Promise<void> {
  try {
    await prisma.arenaLobby.delete({
      where: { id: lobbyId },
    });
    console.log(`[ARENA] Lobby ${lobbyId} deletado do banco`);
  } catch (err) {
    // Ignorar se não existir
    if ((err as any).code !== "P2025") {
      console.error("[ARENA] Erro ao deletar lobby do banco:", err);
    }
  }
}

/**
 * Carrega lobbies ativos do banco de dados (para recuperação após restart)
 */
async function loadLobbiesFromDB(): Promise<void> {
  try {
    const dbLobbies = await prisma.arenaLobby.findMany({
      where: {
        status: { in: ["WAITING", "READY", "BATTLING"] },
      },
    });

    for (const dbLobby of dbLobbies) {
      const lobby: BattleLobby = {
        lobbyId: dbLobby.id,
        hostUserId: dbLobby.hostUserId,
        hostSocketId: dbLobby.hostSocketId,
        hostKingdomId: dbLobby.hostKingdomId,
        guestUserId: dbLobby.guestUserId || undefined,
        guestSocketId: dbLobby.guestSocketId || undefined,
        guestKingdomId: dbLobby.guestKingdomId || undefined,
        status: dbLobby.status as "WAITING" | "READY" | "BATTLING" | "ENDED",
        createdAt: dbLobby.createdAt,
      };

      battleLobbies.set(lobby.lobbyId, lobby);

      // Mapear usuários para o lobby
      userToLobby.set(lobby.hostUserId, lobby.lobbyId);
      if (lobby.guestUserId) {
        userToLobby.set(lobby.guestUserId, lobby.lobbyId);
      }
    }

    console.log(`[ARENA] ${dbLobbies.length} lobbies carregados do banco`);
  } catch (err) {
    console.error("[ARENA] Erro ao carregar lobbies do banco:", err);
  }
}

/**
 * Deleta uma batalha de Arena do banco de dados
 */
async function deleteBattleFromDB(battleId: string): Promise<void> {
  try {
    // BattleUnits são deletados em cascata devido ao onDelete: Cascade
    await prisma.battle.delete({
      where: { id: battleId },
    });
    console.log(`[ARENA] Batalha ${battleId} deletada do banco`);
  } catch (err) {
    console.error("[ARENA] Erro ao deletar batalha do banco:", err);
  }
}

/**
 * Atualiza estatísticas de vitórias/derrotas dos usuários
 */
async function updateUserStats(
  winnerId: string | null | undefined,
  loserId: string | null | undefined,
  isArena: boolean
): Promise<void> {
  try {
    // Proteção: não contar se winnerId e loserId forem iguais
    if (winnerId && loserId && winnerId === loserId) {
      console.error(
        `[STATS] ❌ ERRO: winnerId e loserId são iguais! (${winnerId})`
      );
      return;
    }

    if (winnerId) {
      if (isArena) {
        await prisma.user.update({
          where: { id: winnerId },
          data: { arenaWins: { increment: 1 } },
        });
      } else {
        await prisma.user.update({
          where: { id: winnerId },
          data: { matchWins: { increment: 1 } },
        });
      }
      console.log(`[STATS] ${winnerId} ganhou +1 vitória (arena=${isArena})`);
    }

    if (loserId) {
      if (isArena) {
        await prisma.user.update({
          where: { id: loserId },
          data: { arenaLosses: { increment: 1 } },
        });
      } else {
        await prisma.user.update({
          where: { id: loserId },
          data: { matchLosses: { increment: 1 } },
        });
      }
      console.log(`[STATS] ${loserId} ganhou +1 derrota (arena=${isArena})`);
    }
  } catch (err) {
    console.error("[STATS] Erro ao atualizar estatísticas:", err);
  }
}

/**
 * Cria a configuração base da Arena usando cores e condições globais
 */
function createBaseArenaConfig(): Omit<ArenaConfig, "grid" | "map"> {
  return {
    colors: ARENA_COLORS,
    conditionColors: getConditionColorsMap(),
  };
}

/**
 * Reconstrói a ArenaConfig a partir dos dados salvos no banco de dados
 */
function reconstructArenaConfig(dbBattle: {
  gridWidth: number;
  gridHeight: number;
  weather: string;
  terrainType: string;
  territorySize: string;
  obstacles: string;
}): ArenaConfig {
  const weather = dbBattle.weather as WeatherType;
  const terrainType = dbBattle.terrainType as BattleTerrainType;
  const territorySize = dbBattle.territorySize as TerritorySize;
  const obstacles: BattleObstacle[] = JSON.parse(dbBattle.obstacles || "[]");

  const weatherDef = WEATHER_DEFINITIONS[weather] || WEATHER_DEFINITIONS.SUNNY;
  const terrainDef =
    BATTLE_TERRAIN_DEFINITIONS[terrainType] ||
    BATTLE_TERRAIN_DEFINITIONS.PLAINS;

  return {
    ...createBaseArenaConfig(),
    grid: { width: dbBattle.gridWidth, height: dbBattle.gridHeight },
    map: {
      weather,
      weatherEmoji: weatherDef.emoji,
      weatherName: weatherDef.name,
      weatherEffect: weatherDef.effect,
      weatherCssFilter: weatherDef.cssFilter,
      terrainType,
      terrainName: terrainDef.name,
      territorySize,
      obstacles,
    },
  };
}

/**
 * Load active Arena activeBattles from database (for recovery after restart)
 */
async function loadBattlesFromDB(): Promise<void> {
  try {
    const dbActiveBattles = await prisma.battle.findMany({
      where: { isArena: true, status: "ACTIVE" },
      include: { units: true },
    });

    for (const dbBattle of dbActiveBattles) {
      const units: BattleUnit[] = dbBattle.units.map((u) => ({
        id: u.id,
        sourceUnitId: u.unitId || "",
        ownerId: u.userId || "",
        ownerKingdomId: u.kingdomId || "",
        name: u.name,
        avatar: u.avatar ?? undefined,
        category: u.category,
        troopSlot: u.troopSlot ?? undefined,
        level: u.level,
        classCode: u.classCode ?? undefined,
        classFeatures: JSON.parse(u.classFeatures || "[]"),
        equipment: JSON.parse(u.equipment || "[]"),
        combat: u.combat,
        acuity: u.acuity,
        focus: u.focus,
        armor: u.armor,
        vitality: u.vitality,
        damageReduction: u.damageReduction,
        currentHp: u.currentHp,
        maxHp: u.vitality * HP_CONFIG.multiplier,
        posX: u.posX,
        posY: u.posY,
        initiative: u.initiative,
        movesLeft: u.movesLeft,
        actionsLeft: u.actionsLeft,
        isAlive: u.isAlive,
        actionMarks: u.actionMarks,
        // Proteção dual - usa config centralizado
        physicalProtection: u.armor * PHYSICAL_PROTECTION_CONFIG.multiplier,
        maxPhysicalProtection: u.armor * PHYSICAL_PROTECTION_CONFIG.multiplier,
        physicalProtectionBroken: false,
        magicalProtection: u.focus * MAGICAL_PROTECTION_CONFIG.multiplier,
        maxMagicalProtection: u.focus * MAGICAL_PROTECTION_CONFIG.multiplier,
        magicalProtectionBroken: false,
        // Legado
        protection: u.protection,
        protectionBroken: u.protectionBroken,
        conditions: JSON.parse(u.conditions),
        hasStartedAction: u.hasStartedAction,
        actions: JSON.parse(u.actions),
      }));

      const battle: Battle = {
        id: dbBattle.id,
        lobbyId: dbBattle.lobbyId || "",
        gridWidth: dbBattle.gridWidth,
        gridHeight: dbBattle.gridHeight,
        round: dbBattle.round,
        currentTurnIndex: dbBattle.currentTurnIndex,
        status: dbBattle.status as "ACTIVE" | "ENDED",
        turnTimer: TURN_TIMER_SECONDS,
        initiativeOrder: JSON.parse(dbBattle.initiativeOrder),
        actionOrder: JSON.parse(dbBattle.actionOrder),
        units,
        logs: [],
        createdAt: dbBattle.createdAt,
        config: reconstructArenaConfig(dbBattle), // Reconstruir config com dados do banco
        roundActionsCount: new Map<string, number>([
          [dbBattle.hostUserId || "", 0],
          [dbBattle.guestUserId || "", 0],
        ]),
        hostUserId: dbBattle.hostUserId || "",
        guestUserId: dbBattle.guestUserId || "",
        hostKingdomId: dbBattle.hostKingdomId || "",
        guestKingdomId: dbBattle.guestKingdomId || "",
        isArena: true,
      };

      activeBattles.set(battle.id, battle);

      // IMPORTANTE: Recriar o lobby e o mapeamento userToLobby
      // para que canJoinNewSession funcione corretamente
      if (dbBattle.lobbyId) {
        const lobbyId = dbBattle.lobbyId;

        // Criar lobby se não existir
        if (!battleLobbies.has(lobbyId)) {
          const lobby: BattleLobby = {
            lobbyId: lobbyId,
            hostUserId: battle.hostUserId,
            hostSocketId: "", // Será atualizado quando reconectar
            hostKingdomId: battle.hostKingdomId,
            guestUserId: battle.guestUserId,
            guestSocketId: "", // Será atualizado quando reconectar
            guestKingdomId: battle.guestKingdomId,
            status: "BATTLING",
            createdAt: battle.createdAt,
          };
          battleLobbies.set(lobbyId, lobby);
        }

        // Mapear usuários para o lobby
        if (battle.hostUserId) {
          userToLobby.set(battle.hostUserId, lobbyId);
        }
        if (battle.guestUserId) {
          userToLobby.set(battle.guestUserId, lobbyId);
        }
      }

      console.log(`[ARENA] Batalha ${battle.id} carregada do banco`);
    }

    console.log(`[ARENA] ${activeBattles.size} batalhas carregadas do banco`);
    console.log(`[ARENA] ${battleLobbies.size} lobbies recriados`);
    console.log(`[ARENA] ${userToLobby.size} usuários mapeados para lobbies`);
  } catch (err) {
    console.error("[ARENA] Erro ao carregar batalhas do banco:", err);
  }
}

/**
 * Limpa batalhas duplicadas/órfãs do banco de dados
 * Mantém apenas a batalha mais recente por par de usuários
 */
async function cleanupDuplicateBattles(): Promise<void> {
  try {
    const activeBattlesDB = await prisma.battle.findMany({
      where: { isArena: true, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    // Agrupar por par de usuários (ordenado para consistência)
    const battlesByUserPair = new Map<string, typeof activeBattlesDB>();

    for (const battle of activeBattlesDB) {
      const users = [battle.hostUserId, battle.guestUserId]
        .filter(Boolean)
        .sort();
      const key = users.join("_");

      if (!battlesByUserPair.has(key)) {
        battlesByUserPair.set(key, []);
      }
      battlesByUserPair.get(key)!.push(battle);
    }

    // Para cada par de usuários, manter apenas a batalha mais recente
    let deletedCount = 0;
    for (const [userPair, battles] of battlesByUserPair) {
      if (battles.length > 1) {
        // A primeira é a mais recente (ordenamos por createdAt desc)
        const toDelete = battles.slice(1);

        for (const battle of toDelete) {
          console.log(
            `[ARENA] Deletando batalha duplicada ${battle.id} (usuários: ${userPair})`
          );
          await prisma.battleUnit.deleteMany({
            where: { battleId: battle.id },
          });
          await prisma.battle.delete({ where: { id: battle.id } });
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`[ARENA] ${deletedCount} batalhas duplicadas removidas`);
    }
  } catch (err) {
    console.error("[ARENA] Erro ao limpar batalhas duplicadas:", err);
  }
}

// Limpar batalhas duplicadas e carregar ao inicializar
cleanupDuplicateBattles().then(() => {
  loadLobbiesFromDB();
  loadBattlesFromDB();
});

function generateUnitId(): string {
  return `bunit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const registerBattleHandlers = (io: Server, socket: Socket) => {
  // Definir referência do io para uso nas funções de timer
  ioRef = io;

  // ============================================
  // LOBBY MANAGEMENT (Arena)
  // ============================================

  // Criar um lobby de Arena
  socket.on("battle:create_lobby", async ({ userId, kingdomId }) => {
    try {
      // Verificar se usuário já está em uma sessão ativa (match ou outra arena)
      const blockReason = await canJoinNewSession(userId);
      if (blockReason) {
        return socket.emit("battle:error", { message: blockReason });
      }

      // Valida se usuário e reino existem
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return socket.emit("battle:error", {
          message: "Usuário não encontrado",
        });
      }

      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
        include: { units: { where: { category: "REGENT" } } },
      });
      if (!kingdom) {
        return socket.emit("battle:error", { message: "Reino não encontrado" });
      }
      if (kingdom.ownerId !== userId) {
        return socket.emit("battle:error", {
          message: "Este reino não pertence a você",
        });
      }
      if (!kingdom.units.length) {
        return socket.emit("battle:error", {
          message: "Reino sem Regente definido",
        });
      }

      // Verifica se já está em um lobby (redundante após canJoinNewSession, mas mantido por segurança)
      if (userToLobby.has(userId)) {
        return socket.emit("battle:error", {
          message: "Você já está em um lobby",
        });
      }

      const lobbyId = generateId();
      const lobby: BattleLobby = {
        lobbyId: lobbyId,
        hostUserId: userId,
        hostSocketId: socket.id,
        hostKingdomId: kingdomId,
        status: "WAITING",
        createdAt: new Date(),
      };

      battleLobbies.set(lobbyId, lobby);
      userToLobby.set(userId, lobbyId);
      socketToUser.set(socket.id, userId);

      // Persistir lobby no banco
      await saveLobbyToDB(lobby);

      socket.join(lobbyId);

      socket.emit("battle:lobby_created", {
        lobbyId,
        hostUserId: userId,
        hostKingdomName: kingdom.name,
        status: "WAITING",
      });

      console.log(`[ARENA] Lobby criado: ${lobbyId} por ${user.username}`);
    } catch (err) {
      console.error("[ARENA] create_lobby error:", err);
      socket.emit("battle:error", { message: "Erro ao criar lobby" });
    }
  });

  // Listar lobbies disponíveis
  socket.on("battle:list_lobbies", async () => {
    try {
      const availableLobbies: any[] = [];

      for (const [id, lobby] of battleLobbies) {
        if (lobby.status === "WAITING") {
          const hostKingdom = await prisma.kingdom.findUnique({
            where: { id: lobby.hostKingdomId },
          });
          const hostUser = await prisma.user.findUnique({
            where: { id: lobby.hostUserId },
          });
          availableLobbies.push({
            lobbyId: id,
            hostUsername: hostUser?.username || "Unknown",
            hostKingdomName: hostKingdom?.name || "Unknown",
            createdAt: lobby.createdAt,
          });
        }
      }

      socket.emit("battle:lobbies_list", { lobbies: availableLobbies });
    } catch (err) {
      console.error("[ARENA] list_lobbies error:", err);
      socket.emit("battle:error", { message: "Erro ao listar lobbies" });
    }
  });

  // Entrar em um lobby
  socket.on("battle:join_lobby", async ({ lobbyId, userId, kingdomId }) => {
    try {
      // Verificar se usuário já está em uma sessão ativa (match ou outra arena)
      const blockReason = await canJoinNewSession(userId);
      if (blockReason) {
        return socket.emit("battle:error", { message: blockReason });
      }

      const lobby = battleLobbies.get(lobbyId);
      if (!lobby) {
        return socket.emit("battle:error", { message: "Lobby não encontrado" });
      }
      if (lobby.status !== "WAITING") {
        return socket.emit("battle:error", {
          message: "Lobby não está disponível",
        });
      }
      if (lobby.hostUserId === userId) {
        return socket.emit("battle:error", {
          message: "Você é o host deste lobby",
        });
      }
      if (userToLobby.has(userId)) {
        return socket.emit("battle:error", {
          message: "Você já está em um lobby",
        });
      }

      // Valida reino do guest
      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
        include: { units: { where: { category: "REGENT" } } },
      });
      if (!kingdom) {
        return socket.emit("battle:error", { message: "Reino não encontrado" });
      }
      if (kingdom.ownerId !== userId) {
        return socket.emit("battle:error", {
          message: "Este reino não pertence a você",
        });
      }
      if (!kingdom.units.length) {
        return socket.emit("battle:error", {
          message: "Reino sem Regente definido",
        });
      }

      // Atualiza lobby
      lobby.guestUserId = userId;
      lobby.guestSocketId = socket.id;
      lobby.guestKingdomId = kingdomId;
      lobby.status = "READY";

      userToLobby.set(userId, lobbyId);
      socketToUser.set(socket.id, userId);

      socket.join(lobbyId);

      const hostKingdom = await prisma.kingdom.findUnique({
        where: { id: lobby.hostKingdomId },
      });
      const guestUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      const hostUser = await prisma.user.findUnique({
        where: { id: lobby.hostUserId },
      });

      // Enviar dados completos do lobby para o guest que acabou de entrar
      socket.emit("battle:lobby_joined", {
        lobbyId,
        hostUserId: lobby.hostUserId,
        hostUsername: hostUser?.username || "Unknown",
        hostKingdomName: hostKingdom?.name || "Unknown",
        guestUserId: userId,
        guestUsername: guestUser?.username || "Unknown",
        guestKingdomName: kingdom.name,
        status: "READY",
        createdAt: lobby.createdAt,
      });

      // Notificar o host que alguém entrou
      io.to(lobbyId).emit("battle:player_joined", {
        lobbyId,
        guestUserId: userId,
        guestUsername: guestUser?.username || "Unknown",
        guestKingdomName: kingdom.name,
        status: "READY",
      });

      // Persistir lobby atualizado no banco
      await saveLobbyToDB(lobby);

      console.log(`[ARENA] ${guestUser?.username} entrou no lobby ${lobbyId}`);
    } catch (err) {
      console.error("[ARENA] join_lobby error:", err);
      socket.emit("battle:error", { message: "Erro ao entrar no lobby" });
    }
  });

  // Sair do lobby
  socket.on("battle:leave_lobby", async ({ userId }) => {
    try {
      const lobbyId = userToLobby.get(userId);
      if (!lobbyId) {
        return socket.emit("battle:error", {
          message: "Você não está em um lobby",
        });
      }

      const lobby = battleLobbies.get(lobbyId);
      if (!lobby) {
        userToLobby.delete(userId);
        return;
      }

      socket.leave(lobbyId);
      userToLobby.delete(userId);
      socketToUser.delete(socket.id);

      if (lobby.hostUserId === userId) {
        // Host saiu, fecha o lobby
        if (lobby.guestUserId) {
          userToLobby.delete(lobby.guestUserId);
          io.to(lobbyId).emit("battle:lobby_closed", {
            lobbyId,
            reason: "Host saiu do lobby",
          });
        }
        battleLobbies.delete(lobbyId);
        // Deletar lobby do banco
        await deleteLobbyFromDB(lobbyId);
        console.log(`[ARENA] Lobby ${lobbyId} fechado (host saiu)`);
      } else {
        // Guest saiu
        lobby.guestUserId = undefined;
        lobby.guestSocketId = undefined;
        lobby.guestKingdomId = undefined;
        lobby.status = "WAITING";

        io.to(lobbyId).emit("battle:player_left", {
          lobbyId,
          userId: userId,
          status: "WAITING",
        });

        // Atualizar lobby no banco
        await saveLobbyToDB(lobby);
      }
    } catch (err) {
      console.error("[ARENA] leave_lobby error:", err);
    }
  });

  // ============================================
  // BATTLE START
  // ============================================

  // Host inicia a batalha
  socket.on("battle:start_battle", async ({ lobbyId, userId }) => {
    try {
      const lobby = battleLobbies.get(lobbyId);
      if (!lobby) {
        return socket.emit("battle:error", { message: "Lobby não encontrado" });
      }
      if (lobby.hostUserId !== userId) {
        return socket.emit("battle:error", {
          message: "Apenas o host pode iniciar",
        });
      }
      if (lobby.status !== "READY") {
        return socket.emit("battle:error", {
          message: "Lobby não está pronto",
        });
      }
      if (!lobby.guestUserId || !lobby.guestKingdomId) {
        return socket.emit("battle:error", { message: "Aguardando oponente" });
      }

      // Busca Regentes de ambos os reinos
      const hostKingdom = await prisma.kingdom.findUnique({
        where: { id: lobby.hostKingdomId },
        include: { units: { where: { category: "REGENT" } } },
      });
      const guestKingdom = await prisma.kingdom.findUnique({
        where: { id: lobby.guestKingdomId },
        include: { units: { where: { category: "REGENT" } } },
      });

      if (!hostKingdom?.units.length || !guestKingdom?.units.length) {
        return socket.emit("battle:error", {
          message: "Um dos reinos não tem Regente",
        });
      }

      // Obter tamanho do grid baseado em território aleatório para Arena
      const {
        width: gridWidth,
        height: gridHeight,
        territorySize,
      } = getArenaBattleGridSize();

      const battleId = generateId();

      // Criar unidades com posicionamento aleatório
      const { units: allUnits, occupiedPositions } =
        createBattleUnitsWithRandomPositions(
          hostKingdom.units,
          lobby.hostUserId,
          { id: hostKingdom.id, name: hostKingdom.name },
          guestKingdom.units,
          lobby.guestUserId as string,
          { id: guestKingdom.id, name: guestKingdom.name },
          gridWidth,
          gridHeight,
          "arena"
        );

      // Ordenar por iniciativa para exibição
      const orderedUnits = sortByInitiative(allUnits);

      // Determinar ordem de ação baseada na soma de Acuity das unidades de cada jogador
      const actionOrder = determineActionOrder(
        allUnits,
        lobby.hostUserId,
        lobby.guestUserId
      );

      // Gerar configuração do mapa com clima, terreno e obstáculos
      // Usa o territorySize sorteado para definir quantidade de obstáculos
      const mapConfig = generateBattleMap({
        gridWidth,
        gridHeight,
        territorySize,
        unitPositions: occupiedPositions,
      });

      const arenaConfig: ArenaConfig = {
        ...createBaseArenaConfig(),
        grid: { width: gridWidth, height: gridHeight },
        map: mapConfig,
      };

      const battle: Battle = {
        id: battleId,
        lobbyId,
        gridWidth,
        gridHeight,
        round: 1,
        currentTurnIndex: 0,
        status: "ACTIVE",
        turnTimer: TURN_TIMER_SECONDS,
        initiativeOrder: orderedUnits.map((u) => u.id),
        actionOrder,
        units: orderedUnits,
        logs: [
          {
            id: generateId(),
            timestamp: new Date(),
            type: "START",
            payload: {
              hostKingdomName: hostKingdom.name,
              guestKingdomName: guestKingdom.name,
            },
          },
        ],
        createdAt: new Date(),
        config: arenaConfig,
        roundActionsCount: new Map<string, number>([
          [lobby.hostUserId, 0],
          [lobby.guestUserId as string, 0],
        ]),
        hostUserId: lobby.hostUserId,
        guestUserId: lobby.guestUserId as string,
        hostKingdomId: lobby.hostKingdomId,
        guestKingdomId: lobby.guestKingdomId as string,
        isArena: true,
      };

      activeBattles.set(battleId, battle);
      lobby.status = "BATTLING";

      // Persistir batalha e lobby no banco
      await saveBattleToDB(battle);
      await saveLobbyToDB(lobby);

      // Log de debug para verificar quem está no room
      const roomSockets = await io.in(lobbyId).fetchSockets();
      console.log(
        `[ARENA] Room ${lobbyId} tem ${roomSockets.length} sockets:`,
        roomSockets.map((s) => ({ id: s.id, userId: socketToUser.get(s.id) }))
      );

      io.to(lobbyId).emit("battle:battle_started", {
        battleId,
        lobbyId, // Incluir lobbyId para revanche
        config: arenaConfig, // Configuração visual completa com mapa dinâmico
        units: orderedUnits,
        initiativeOrder: orderedUnits.map((u) => u.id),
        actionOrder: battle.actionOrder,
        hostKingdom: {
          id: hostKingdom.id,
          name: hostKingdom.name,
          ownerId: lobby.hostUserId,
        },
        guestKingdom: {
          id: guestKingdom.id,
          name: guestKingdom.name,
          ownerId: lobby.guestUserId,
        },
      });

      // Iniciar timer compartilhado do turno
      startBattleTurnTimer(battle);

      // Log detalhado das configurações do mapa
      console.log("\n" + "=".repeat(60));
      console.log("[ARENA] 🗺️  NOVA BATALHA INICIADA");
      console.log("=".repeat(60));
      console.log(`[ARENA] ID da Batalha: ${battleId}`);
      console.log(`[ARENA] Lobby ID: ${lobbyId}`);
      console.log(`[ARENA] Host: ${hostKingdom.name} (${lobby.hostUserId})`);
      console.log(`[ARENA] Guest: ${guestKingdom.name} (${lobby.guestUserId})`);
      console.log("-".repeat(60));
      console.log("[ARENA] 📐 GRID:");
      console.log(`[ARENA]   Tamanho do Território: ${territorySize}`);
      console.log(
        `[ARENA]   Dimensões: ${gridWidth}x${gridHeight} (${
          gridWidth * gridHeight
        } células)`
      );
      console.log("-".repeat(60));
      console.log("[ARENA] 🌤️  CLIMA E TERRENO:");
      console.log(
        `[ARENA]   Clima: ${mapConfig.weatherName} ${mapConfig.weatherEmoji}`
      );
      console.log(`[ARENA]   Efeito: ${mapConfig.weatherEffect}`);
      console.log(`[ARENA]   Terreno: ${mapConfig.terrainName}`);
      console.log("-".repeat(60));
      console.log("[ARENA] 🪨 OBSTÁCULOS:");
      console.log(`[ARENA]   Quantidade: ${mapConfig.obstacles.length}`);
      if (mapConfig.obstacles.length > 0) {
        console.log(
          `[ARENA]   Posições: ${mapConfig.obstacles
            .map((o) => `(${o.posX},${o.posY})`)
            .join(", ")}`
        );
      }
      console.log("-".repeat(60));
      console.log("[ARENA] ⚔️  UNIDADES:");
      orderedUnits.forEach((unit, idx) => {
        const side = unit.ownerId === lobby.hostUserId ? "HOST" : "GUEST";
        console.log(
          `[ARENA]   ${idx + 1}. [${side}] ${unit.name} - Pos: (${unit.posX},${
            unit.posY
          }) - Initiative: ${unit.initiative}`
        );
      });
      console.log("-".repeat(60));
      console.log("[ARENA] 🎲 ORDEM DE AÇÃO:");
      console.log(
        `[ARENA]   ${actionOrder
          .map(
            (id, i) =>
              `${i + 1}. ${
                id === lobby.hostUserId ? hostKingdom.name : guestKingdom.name
              }`
          )
          .join(" → ")}`
      );
      console.log("=".repeat(60) + "\n");
    } catch (err) {
      console.error("[ARENA] start_battle error:", err);
      socket.emit("battle:error", { message: "Erro ao iniciar batalha" });
    }
  });

  // ============================================
  // BATTLE ACTIONS
  // ============================================

  // Handler para pausar timer quando modal de dice abre
  socket.on("battle:dice_modal_open", ({ battleId }) => {
    if (!battleId) return;
    battleDiceModalPaused.set(battleId, true);
    console.log(
      `[ARENA] Timer pausado - modal de dice aberto na batalha ${battleId}`
    );
  });

  // Handler para retomar timer quando modal de dice fecha
  socket.on("battle:dice_modal_close", ({ battleId }) => {
    if (!battleId) return;
    battleDiceModalPaused.delete(battleId);
    console.log(
      `[ARENA] Timer retomado - modal de dice fechado na batalha ${battleId}`
    );
  });

  // Começar ação de uma unidade
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

      // Impedir escolha de outra unidade se já há uma ativa neste turno
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

      const maxMarks = getMaxMarksByCategory(unit.category);

      // Em batalhas normais, se atingiu marcas máximas, a unidade não pode agir
      if (!battle.isArena && unit.actionMarks >= maxMarks) {
        return socket.emit("battle:error", {
          message: "Marcas de ação atingidas - unidade exausta",
        });
      }

      // Se a unidade já iniciou ação neste turno, não resetar movimentos
      if (unit.hasStartedAction) {
        // Apenas emitir o estado atual sem resetar
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

      // Arena: se atingiu 3 marcas, recebe 2 ações neste turno (bônus)
      // Mas perde 5 HP como custo
      if (battle.isArena && unit.actionMarks >= maxMarks) {
        unit.actionsLeft = 2; // Ação extra como recompensa
        unit.currentHp = Math.max(0, unit.currentHp - 5); // Custo de 5 HP
        unit.actionMarks = 0; // Reseta marcas após receber bônus

        // Verificar se morreu pelo custo de HP
        if (unit.currentHp <= 0) {
          unit.isAlive = false;
        }
      } else {
        unit.actionsLeft = 1;
      }
      unit.hasStartedAction = true;
      battle.activeUnitId = unitId; // Define esta unidade como ativa do turno

      socket.emit("battle:action_started", {
        battleId,
        unitId,
        movesLeft: effectiveAcuity,
        actionsLeft: unit.actionsLeft,
        currentHp: unit.currentHp,
        isAlive: unit.isAlive,
        actionMarks: unit.actionMarks,
      });

      // Salvar estado da batalha no banco
      await saveBattleToDB(battle);
    } catch (err) {
      console.error("[ARENA] begin_action error:", err);
      socket.emit("battle:error", { message: "Erro ao iniciar ação" });
    }
  });

  // Finalizar ação da unidade
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

      // Verificar se é realmente o turno deste jogador
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

      // Aplica queimando
      if (unit.conditions.includes("QUEIMANDO")) {
        unit.currentHp = Math.max(0, unit.currentHp - 2);
        if (unit.currentHp <= 0) {
          unit.isAlive = false;
        }
      }

      // Remove DERRUBADA e condições que expiram no fim do turno
      unit.conditions = unit.conditions.filter(
        (c) => c !== "DERRUBADA" && c !== "DODGING"
      );

      const maxMarks = getMaxMarksByCategory(unit.category);
      unit.actionMarks = Math.min(maxMarks, unit.actionMarks + 1);
      unit.movesLeft = 0;
      unit.actionsLeft = 0;
      unit.hasStartedAction = false; // Reset para próxima ação

      // Incrementar contador de ações do jogador
      const currentActionsCount =
        battle.roundActionsCount.get(currentPlayerId) || 0;
      battle.roundActionsCount.set(currentPlayerId, currentActionsCount + 1);

      // Avança jogador e reseta unidade ativa
      battle.activeUnitId = undefined;
      const oldTurnIndex = battle.currentTurnIndex;
      if (battle.actionOrder.length) {
        battle.currentTurnIndex =
          (battle.currentTurnIndex + 1) % battle.actionOrder.length;
      }

      const newPlayerId = battle.actionOrder[battle.currentTurnIndex];
      console.log(
        `[ARENA] Turno avançado: index ${oldTurnIndex} -> ${battle.currentTurnIndex}, próximo jogador: ${newPlayerId}`
      );

      const lobby = battleLobbies.get(battle.lobbyId);
      if (lobby) {
        // Emitir estado atualizado da unidade que finalizou
        io.to(lobby.lobbyId).emit("battle:unit_turn_ended", {
          battleId,
          unitId,
          actionMarks: unit.actionMarks,
          currentHp: unit.currentHp,
          isAlive: unit.isAlive,
          conditions: unit.conditions,
        });

        // Emitir mudança de turno
        io.to(lobby.lobbyId).emit("battle:next_player", {
          battleId,
          currentPlayerId: newPlayerId,
          index: battle.currentTurnIndex,
        });

        console.log(
          `[ARENA] Evento battle:next_player emitido para lobby ${lobby.lobbyId}`
        );
      } else {
        console.error(`[ARENA] Lobby não encontrado para batalha ${battleId}`);
      }

      // Checa fim do round - todos os jogadores agiram 1x
      const allPlayersActed = battle.actionOrder.every(
        (playerId) => (battle.roundActionsCount.get(playerId) || 0) >= 1
      );

      if (allPlayersActed) {
        // Novo round - reseta contadores
        battle.round++;
        for (const playerId of battle.actionOrder) {
          battle.roundActionsCount.set(playerId, 0);
        }
        if (lobby) {
          io.to(lobby.lobbyId).emit("battle:new_round", {
            battleId,
            round: battle.round,
          });
        }
      }

      // ============================================================
      // VERIFICAR TÉRMINO PARA BATALHAS NÃO-ARENA (3 Action Marks)
      // ============================================================
      if (!battle.isArena && lobby) {
        // Verificar se TODAS as unidades vivas atingiram o máximo de actionMarks
        const allUnitsExhausted = battle.units
          .filter((u) => u.isAlive)
          .every((u) => {
            const maxMarks = getMaxMarksByCategory(u.category);
            return u.actionMarks >= maxMarks;
          });

        if (allUnitsExhausted) {
          battle.status = "ENDED";
          stopBattleTurnTimer(battle.id);

          // Determinar vencedor por HP total restante
          const hpByPlayer = new Map<string, number>();
          for (const u of battle.units) {
            if (u.isAlive) {
              const currentHp = hpByPlayer.get(u.ownerId) || 0;
              hpByPlayer.set(u.ownerId, currentHp + u.currentHp);
            }
          }

          // Encontrar jogador com mais HP
          let winnerId: string | null = null;
          let maxHp = -1;
          for (const [playerId, totalHp] of hpByPlayer.entries()) {
            if (totalHp > maxHp) {
              maxHp = totalHp;
              winnerId = playerId;
            }
          }

          const winnerKingdom = battle.units.find(
            (u) => u.ownerId === winnerId
          )?.ownerKingdomId;

          io.to(lobby.lobbyId).emit("battle:battle_ended", {
            battleId,
            winnerId,
            winnerKingdomId: winnerKingdom,
            reason: "Todas as unidades estão exaustas (3 Action Marks)",
            finalUnits: battle.units,
          });

          // Atualizar estatísticas
          const loserId =
            winnerId === lobby.hostUserId
              ? lobby.guestUserId
              : lobby.hostUserId;
          await updateUserStats(winnerId, loserId, battle.isArena);

          // Limpar referências
          userToLobby.delete(lobby.hostUserId);
          if (lobby.guestUserId) {
            userToLobby.delete(lobby.guestUserId);
          }

          lobby.status = "ENDED";
          await deleteBattleFromDB(battleId);
          await deleteLobbyFromDB(lobby.lobbyId);
          console.log(
            `[BATTLE] Batalha ${battleId} finalizada por exaustão. Vencedor: ${winnerId}`
          );

          return; // Não continuar se a batalha terminou
        }
      }

      // Reiniciar timer compartilhado para o próximo turno
      startBattleTurnTimer(battle);

      // Salvar estado da batalha no banco
      await saveBattleToDB(battle);
    } catch (err) {
      console.error("[ARENA] end_unit_action error:", err);
    }
  });

  // Mover unidade
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

      // Executar ação de movimento usando combat-actions
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

      battle.logs.push({
        id: generateId(),
        timestamp: new Date(),
        type: "MOVE",
        payload: {
          unitId,
          from: [result.fromX, result.fromY],
          to: [result.toX, result.toY],
        },
      });

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

      // Salvar estado da batalha no banco
      await saveBattleToDB(battle);
    } catch (err) {
      console.error("[ARENA] move error:", err);
      socket.emit("battle:error", { message: "Erro ao mover" });
    }
  });

  // Atacar unidade adjacente, cadáver ou obstáculo
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

        // Determinar alvo: unidade/cadáver OU obstáculo
        let target: BattleUnit | undefined = undefined;
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

        // Executar ação de ataque unificada
        const result = executeAttackAction(
          attacker as CombatUnit,
          target as CombatUnit | null,
          damageType,
          obstacle
        );

        if (!result.success) {
          return socket.emit("battle:error", { message: result.error });
        }

        // Log de ataque
        const logType = result.obstacleDestroyed
          ? "ATTACK_OBSTACLE_DESTROY"
          : result.targetDefeated
          ? "ATTACK_KILL"
          : "ATTACK";

        battle.logs.push({
          id: generateId(),
          timestamp: new Date(),
          type: logType,
          payload: {
            attackerUnitId,
            targetUnitId: targetUnitId || null,
            targetObstacleId: targetObstacleId || null,
            targetType: result.targetType,
            diceCount: result.diceCount,
            rolls: result.rolls,
            damage: result.finalDamage,
            damageType: result.damageType,
            targetHpAfter: result.targetHpAfter,
          },
        });

        const lobby = battleLobbies.get(battle.lobbyId);
        if (lobby) {
          // Emitir evento para todos os clientes
          io.to(lobby.lobbyId).emit("battle:unit_attacked", {
            battleId,
            attackerUnitId,
            targetUnitId: targetUnitId || null,
            targetObstacleId: targetObstacleId || null,
            targetType: result.targetType,
            // Legado
            diceCount: result.diceCount,
            rolls: result.rolls,
            damage: result.finalDamage,
            damageType: result.damageType,
            targetHpAfter: result.targetHpAfter,
            targetProtection: result.targetProtection,
            attackerActionsLeft: attacker.actionsLeft,
            // Dados detalhados de rolagem
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
            // Dados dos combatentes para o painel visual
            attackerName: attacker.name,
            attackerIcon: "⚔️",
            attackerCombat: attacker.combat,
            targetName: target?.name ?? obstacle?.id ?? "Obstáculo",
            targetIcon: target ? "🛡️" : "🪨",
            targetCombat: target?.combat ?? 0,
            targetAcuity: target?.acuity ?? 0,
          });

          // Emitir evento de obstáculo destruído
          if (result.obstacleDestroyed && result.obstacleId) {
            io.to(lobby.lobbyId).emit("battle:obstacle_destroyed", {
              battleId,
              obstacleId: result.obstacleId,
            });
          }

          // Verificar derrota de unidade
          if (result.targetDefeated && target) {
            io.to(lobby.lobbyId).emit("battle:unit_defeated", {
              battleId,
              unitId: target.id,
            });

            // Verifica vitória
            const aliveBySide = new Map<string, number>();
            for (const u of battle.units) {
              if (u.isAlive) {
                const count = aliveBySide.get(u.ownerId) || 0;
                aliveBySide.set(u.ownerId, count + 1);
              }
            }

            console.log("[ARENA] Verificando vitória:", {
              aliveBySideSize: aliveBySide.size,
              aliveBySide: Object.fromEntries(aliveBySide),
              totalUnits: battle.units.length,
              aliveUnits: battle.units.filter((u) => u.isAlive).length,
            });

            if (aliveBySide.size <= 1) {
              battle.status = "ENDED";
              stopBattleTurnTimer(battle.id);
              const winnerId = aliveBySide.keys().next().value || null;
              const winnerKingdom = battle.units.find(
                (u) => u.ownerId === winnerId
              )?.ownerKingdomId;

              io.to(lobby.lobbyId).emit("battle:battle_ended", {
                battleId,
                winnerId,
                winnerKingdomId: winnerKingdom,
                reason: "Todas as unidades inimigas foram derrotadas",
                finalUnits: battle.units,
              });

              // Atualizar estatísticas de vitórias/derrotas
              const loserId =
                winnerId === lobby.hostUserId
                  ? lobby.guestUserId
                  : lobby.hostUserId;
              await updateUserStats(winnerId, loserId, battle.isArena);

              // Limpar referências de sessão
              userToLobby.delete(lobby.hostUserId);
              if (lobby.guestUserId) {
                userToLobby.delete(lobby.guestUserId);
              }

              // Limpa lobby e deleta batalha do banco
              lobby.status = "ENDED";
              await deleteBattleFromDB(battleId);
              await deleteLobbyFromDB(lobby.lobbyId);
              console.log(
                `[ARENA] Batalha ${battleId} finalizada. Vencedor: ${winnerId}`
              );
            }
          }
        }

        // Salvar estado da batalha no banco (se ainda ativa)
        if (battle.status === "ACTIVE") {
          await saveBattleToDB(battle);
        }
      } catch (err) {
        console.error("[ARENA] attack error:", err);
        socket.emit("battle:error", { message: "Erro ao atacar" });
      }
    }
  );

  // Disparada: gasta 1 ação para resetar movimentação
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

      battle.logs.push({
        id: generateId(),
        timestamp: new Date(),
        type: "DASH",
        payload: { unitId, newMovesLeft: result.newMovesLeft },
      });

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

  // Esquiva: gasta 1 ação para entrar em modo defensivo
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

      battle.logs.push({
        id: generateId(),
        timestamp: new Date(),
        type: "DODGE",
        payload: { unitId },
      });

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

  // Obter estado atual da batalha
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
        config: battle.config, // Configuração completa (inclui mapa dinâmico)
        round: battle.round,
        status: battle.status,
        currentTurnIndex: battle.currentTurnIndex,
        currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
        actionOrder: battle.actionOrder,
        units: battle.units,
        logs: battle.logs.slice(-20), // Últimos 20 logs
      });
    } catch (err) {
      console.error("[ARENA] get_battle_state error:", err);
    }
  });

  // Rendição
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

      // Limpar referências de sessão
      userToLobby.delete(lobby.hostUserId);
      if (lobby.guestUserId) {
        userToLobby.delete(lobby.guestUserId);
      }

      // Deletar lobby do banco
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

      // Atualizar estatísticas de vitórias/derrotas
      await updateUserStats(winnerId, userId, battle.isArena);

      // Deletar batalha do banco
      await deleteBattleFromDB(battleId);

      console.log(`[ARENA] ${userId} se rendeu na batalha ${battleId}`);
    } catch (err) {
      console.error("[ARENA] surrender error:", err);
    }
  });

  // ============================================
  // SAIR DA ARENA (ABANDONAR BATALHA EM ANDAMENTO)
  // ============================================
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

      // Verificar se o usuário está na batalha
      if (lobby.hostUserId !== userId && lobby.guestUserId !== userId) {
        return socket.emit("battle:error", {
          message: "Você não está nesta batalha",
        });
      }

      // Determinar vencedor (o outro jogador)
      const winnerId =
        lobby.hostUserId === userId ? lobby.guestUserId : lobby.hostUserId;

      // Finalizar batalha
      battle.status = "ENDED";
      lobby.status = "ENDED";
      stopBattleTurnTimer(battle.id);

      // Limpar referências
      userToLobby.delete(lobby.hostUserId);
      if (lobby.guestUserId) {
        userToLobby.delete(lobby.guestUserId);
      }

      // Deletar lobby do banco
      await deleteLobbyFromDB(lobby.lobbyId);

      // Notificar todos na sala
      io.to(battle.lobbyId).emit("battle:battle_ended", {
        battleId,
        winnerId,
        reason: "Oponente abandonou a batalha",
        abandonedBy: userId,
        finalUnits: battle.units,
      });

      // Atualizar estatísticas de vitórias/derrotas
      await updateUserStats(winnerId, userId, battle.isArena);

      // Deletar batalha do banco
      await deleteBattleFromDB(battleId);

      // Remover socket da sala
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

  // ============================================
  // REVANCHE - SOLICITAR OU ACEITAR
  // ============================================

  socket.on("battle:request_rematch", async ({ lobbyId, userId }) => {
    try {
      console.log(
        `[ARENA] request_rematch recebido: lobbyId=${lobbyId}, userId=${userId}`
      );

      const lobby = battleLobbies.get(lobbyId);
      if (!lobby) {
        console.log(
          `[ARENA] request_rematch ERRO: lobby não encontrado. Lobbies existentes: ${Array.from(
            battleLobbies.keys()
          ).join(", ")}`
        );
        return socket.emit("battle:error", { message: "Lobby não encontrado" });
      }

      console.log(
        `[ARENA] request_rematch: lobby encontrado com status=${lobby.status}, host=${lobby.hostUserId}, guest=${lobby.guestUserId}`
      );

      // Verificar se é participante
      if (lobby.hostUserId !== userId && lobby.guestUserId !== userId) {
        return socket.emit("battle:error", {
          message: "Você não está neste lobby",
        });
      }

      // Verificar se a batalha acabou
      if (lobby.status !== "ENDED") {
        console.log(
          `[ARENA] request_rematch ERRO: batalha ainda não terminou (status=${lobby.status})`
        );
        return socket.emit("battle:error", {
          message: "A batalha ainda não terminou",
        });
      }

      // Registrar pedido de revanche
      if (!rematchRequests.has(lobbyId)) {
        rematchRequests.set(lobbyId, new Set());
      }
      rematchRequests.get(lobbyId)!.add(userId);

      console.log(
        `[ARENA] ${userId} solicitou revanche no lobby ${lobbyId}. Pedidos: ${
          rematchRequests.get(lobbyId)!.size
        }/2`
      );

      // Notificar todos no lobby
      io.to(lobbyId).emit("battle:rematch_requested", { lobbyId, userId });

      // Se ambos querem revanche, iniciar nova batalha
      const requests = rematchRequests.get(lobbyId)!;
      if (
        requests.has(lobby.hostUserId) &&
        lobby.guestUserId &&
        requests.has(lobby.guestUserId)
      ) {
        // Proteção contra race condition - verificar se já está processando
        if (rematchLocks.has(lobbyId)) {
          console.log(
            `[ARENA] Rematch já em processamento para lobby ${lobbyId}`
          );
          return;
        }
        rematchLocks.set(lobbyId, true);

        try {
          console.log(
            `[ARENA] Ambos jogadores querem revanche! Iniciando nova batalha...`
          );

          // Limpar pedidos
          rematchRequests.delete(lobbyId);

          // Buscar os regentes de ambos os jogadores novamente
          const hostKingdom = await prisma.kingdom.findUnique({
            where: { id: lobby.hostKingdomId },
            include: { units: { where: { category: "REGENT" } } },
          });

          const guestKingdom = await prisma.kingdom.findUnique({
            where: { id: lobby.guestKingdomId },
            include: { units: { where: { category: "REGENT" } } },
          });

          if (!hostKingdom?.units[0] || !guestKingdom?.units[0]) {
            io.to(lobbyId).emit("battle:error", {
              message:
                "Não foi possível iniciar revanche - regentes não encontrados",
            });
            return;
          }

          // Limpar batalha antiga
          const oldBattle = [...activeBattles.values()].find(
            (b) => b.lobbyId === lobbyId
          );
          if (oldBattle) {
            cleanupBattle(oldBattle.id);
          }

          // Criar nova batalha usando factory com posições aleatórias
          const battleId = generateId();
          const {
            width: gridWidth,
            height: gridHeight,
            territorySize,
          } = getArenaBattleGridSize();

          // Criar unidades com posicionamento aleatório
          const { units: allUnits, occupiedPositions } =
            createBattleUnitsWithRandomPositions(
              hostKingdom.units,
              lobby.hostUserId,
              { id: hostKingdom.id, name: hostKingdom.name },
              guestKingdom.units,
              lobby.guestUserId as string,
              { id: guestKingdom.id, name: guestKingdom.name },
              gridWidth,
              gridHeight,
              "arena"
            );

          // Ordenar por iniciativa para exibição
          const orderedUnits = sortByInitiative(allUnits);
          const initiativeOrder = orderedUnits.map((u) => u.id);
          const actionOrder = determineActionOrder(
            allUnits,
            lobby.hostUserId,
            lobby.guestUserId
          );

          // Gerar configuração do mapa para a revanche
          const mapConfig = generateBattleMap({
            gridWidth,
            gridHeight,
            territorySize,
            unitPositions: occupiedPositions,
          });

          const rematchConfig: ArenaConfig = {
            ...createBaseArenaConfig(),
            grid: { width: gridWidth, height: gridHeight },
            map: mapConfig,
          };

          // Criar nova batalha
          const newBattle: Battle = {
            id: battleId,
            lobbyId,
            gridWidth,
            gridHeight,
            round: 1,
            currentTurnIndex: 0,
            status: "ACTIVE",
            turnTimer: TURN_TIMER_SECONDS,
            initiativeOrder,
            actionOrder,
            units: orderedUnits,
            logs: [],
            createdAt: new Date(),
            config: rematchConfig,
            roundActionsCount: new Map<string, number>([
              [lobby.hostUserId, 0],
              [lobby.guestUserId as string, 0],
            ]),
            hostUserId: lobby.hostUserId,
            guestUserId: lobby.guestUserId as string,
            hostKingdomId: hostKingdom.id,
            guestKingdomId: guestKingdom.id,
            isArena: true,
          };

          activeBattles.set(battleId, newBattle);
          lobby.status = "BATTLING";

          // Persistir batalha e lobby no banco
          await saveBattleToDB(newBattle);
          await saveLobbyToDB(lobby);

          // Emitir evento de revanche iniciada
          io.to(lobbyId).emit("battle:rematch_started", {
            battleId,
            lobbyId,
            config: rematchConfig,
            units: orderedUnits,
            initiativeOrder,
            actionOrder,
            hostKingdom: {
              id: hostKingdom.id,
              name: hostKingdom.name,
              ownerId: lobby.hostUserId,
            },
            guestKingdom: {
              id: guestKingdom.id,
              name: guestKingdom.name,
              ownerId: lobby.guestUserId,
            },
          });

          // Log detalhado das configurações da revanche
          console.log("\n" + "=".repeat(60));
          console.log("[ARENA] 🔄 REVANCHE INICIADA");
          console.log("=".repeat(60));
          console.log(`[ARENA] ID da Batalha: ${battleId}`);
          console.log(`[ARENA] Lobby ID: ${lobbyId}`);
          console.log(
            `[ARENA] Host: ${hostKingdom.name} (${lobby.hostUserId})`
          );
          console.log(
            `[ARENA] Guest: ${guestKingdom.name} (${lobby.guestUserId})`
          );
          console.log("-".repeat(60));
          console.log("[ARENA] 📐 GRID:");
          console.log(`[ARENA]   Tamanho do Território: ${territorySize}`);
          console.log(
            `[ARENA]   Dimensões: ${gridWidth}x${gridHeight} (${
              gridWidth * gridHeight
            } células)`
          );
          console.log("-".repeat(60));
          console.log("[ARENA] 🌤️  CLIMA E TERRENO:");
          console.log(
            `[ARENA]   Clima: ${mapConfig.weatherName} ${mapConfig.weatherEmoji}`
          );
          console.log(`[ARENA]   Efeito: ${mapConfig.weatherEffect}`);
          console.log(`[ARENA]   Terreno: ${mapConfig.terrainName}`);
          console.log("-".repeat(60));
          console.log("[ARENA] 🪨 OBSTÁCULOS:");
          console.log(`[ARENA]   Quantidade: ${mapConfig.obstacles.length}`);
          if (mapConfig.obstacles.length > 0) {
            console.log(
              `[ARENA]   Posições: ${mapConfig.obstacles
                .map((o) => `(${o.posX},${o.posY})`)
                .join(", ")}`
            );
          }
          console.log("-".repeat(60));
          console.log("[ARENA] ⚔️  UNIDADES:");
          orderedUnits.forEach((unit, idx) => {
            const side = unit.ownerId === lobby.hostUserId ? "HOST" : "GUEST";
            console.log(
              `[ARENA]   ${idx + 1}. [${side}] ${unit.name} - Pos: (${
                unit.posX
              },${unit.posY}) - Initiative: ${unit.initiative}`
            );
          });
          console.log("-".repeat(60));
          console.log("[ARENA] 🎲 ORDEM DE AÇÃO:");
          console.log(
            `[ARENA]   ${actionOrder
              .map(
                (id, i) =>
                  `${i + 1}. ${
                    id === lobby.hostUserId
                      ? hostKingdom.name
                      : guestKingdom.name
                  }`
              )
              .join(" → ")}`
          );
          console.log("=".repeat(60) + "\n");
        } finally {
          // Sempre limpar o lock
          rematchLocks.delete(lobbyId);
        }
      }
    } catch (err) {
      console.error("[ARENA] request_rematch error:", err);
      socket.emit("battle:error", { message: "Erro ao solicitar revanche" });
    }
  });

  // Cleanup ao desconectar - notificar outro jogador mas NÃO finalizar batalha
  socket.on("disconnect", () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      const lobbyId = userToLobby.get(userId);
      if (lobbyId) {
        const lobby = battleLobbies.get(lobbyId);
        if (lobby && lobby.status === "BATTLING") {
          // Em batalha - apenas notificar o outro jogador, NÃO finalizar
          console.log(
            `[ARENA] Usuário ${userId} desconectou durante batalha. Aguardando reconexão...`
          );

          // Marcar jogador como desconectado
          disconnectedPlayers.set(userId, lobbyId);

          // Notificar o outro jogador que o oponente desconectou temporariamente
          io.to(lobbyId).emit("battle:player_disconnected", {
            lobbyId,
            userId,
          });

          // Verificar se ambos desconectaram para pausar o timer
          const battle = Array.from(activeBattles.values()).find(
            (b) => b.lobbyId === lobbyId && b.status === "ACTIVE"
          );
          if (battle) {
            pauseBattleTimerIfNoPlayers(battle.id);
          }
        } else if (lobby && lobby.status !== "BATTLING") {
          // Não está em batalha, limpar normalmente
          if (lobby.hostUserId === userId) {
            // Host saiu, fechar lobby
            if (lobby.guestUserId) {
              userToLobby.delete(lobby.guestUserId);
            }
            battleLobbies.delete(lobbyId);
            io.to(lobbyId).emit("battle:lobby_closed", {
              lobbyId,
              reason: "Host desconectou",
            });
          } else {
            // Guest saiu
            lobby.guestUserId = undefined;
            lobby.guestSocketId = undefined;
            lobby.guestKingdomId = undefined;
            lobby.status = "WAITING";
            io.to(lobbyId).emit("battle:player_left", {
              lobbyId,
              userId,
              status: "WAITING",
            });
          }
          userToLobby.delete(userId);
        }
      }
      socketToUser.delete(socket.id);
    }
  });
};

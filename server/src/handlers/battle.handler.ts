// src/handlers/battle.handler.ts
// Sistema Unificado de Batalha - Arena PvP e Batalhas de Partida
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import {
  rollInitiative,
  getMaxMarksByCategory,
  getEffectiveAcuityWithConditions,
} from "../utils/battle.utils";
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
  executeAttackObstacle,
  CombatUnit,
  calculateBaseMovement,
} from "../logic/combat-actions";
import { determineUnitActions } from "../logic/unit-actions";

// Estrutura para gerenciar lobbies de Arena em memória
interface BattleLobby {
  id: string;
  hostUserId: string;
  hostSocketId: string;
  hostKingdomId: string;
  guestUserId?: string;
  guestSocketId?: string;
  guestKingdomId?: string;
  status: "WAITING" | "READY" | "BATTLING" | "ENDED";
  createdAt: Date;
}

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
  // IDs para persistência
  hostUserId: string;
  guestUserId: string;
  hostKingdomId: string;
  guestKingdomId: string;
  // Sistema de resgate (apenas para batalhas de partida)
  ransomPrice?: number;
  ransomResource?: string;
}

interface BattleUnit {
  id: string;
  sourceUnitId: string; // Original Unit ID in database
  ownerId: string; // UserId (Arena) ou MatchPlayerId (Match)
  ownerKingdomId: string;
  name: string;
  category: string;
  troopSlot?: number; // Para TROOP: índice do template (0-4)
  level: number;
  classId?: string; // ID da classe do herói/regente
  classFeatures: string[]; // Skills aprendidas
  equipment: string[]; // Itens equipados
  // Stats
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
  damageReduction: number; // Fixed DR, most units have 0
  currentHp: number;
  maxHp: number; // HP máximo = vitality * 2
  // Battle state
  posX: number;
  posY: number;
  initiative: number;
  movesLeft: number;
  actionsLeft: number;
  isAlive: boolean;
  actionMarks: number;
  protection: number;
  protectionBroken: boolean;
  conditions: string[];
  hasStartedAction: boolean; // If unit already started action this turn
  actions: string[]; // Available actions: ["attack", "move", ...]
  grabbedByUnitId?: string; // ID da unidade que está agarrando
}

interface BattleLog {
  id: string;
  timestamp: Date;
  type: string;
  payload: any;
}

// Constantes
const TURN_TIMER_SECONDS = 30; // Duração do turno em segundos

// Armazenamento em memória (pode ser migrado para Redis/DB depois)
const battleLobbies: Map<string, BattleLobby> = new Map();
const activeBattles: Map<string, Battle> = new Map();
const userToLobby: Map<string, string> = new Map(); // userId -> lobbyId
const socketToUser: Map<string, string> = new Map(); // socketId -> userId

// Mapa para rastrear jogadores desconectados (para notificar quando reconectarem)
const disconnectedPlayers: Map<string, string> = new Map(); // odUsuerId -> lobbyId

// Mapa para rastrear pedidos de revanche
const rematchRequests: Map<string, Set<string>> = new Map(); // lobbyId -> Set of userIds who want rematch

// Mapa para intervalos de timer de batalha
const battleTimerIntervals: Map<
  string,
  ReturnType<typeof setInterval>
> = new Map();

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
 * Inicia/reinicia o timer compartilhado do turno
 */
function startBattleTurnTimer(battle: Battle): void {
  // Limpar timer anterior se existir
  stopBattleTurnTimer(battle.id);

  battle.turnTimer = TURN_TIMER_SECONDS;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby || !ioRef) return;

  // Emitir timer inicial
  ioRef.to(lobby.id).emit("battle:turn_timer", {
    battleId: battle.id,
    timer: battle.turnTimer,
    currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
  });

  // Iniciar intervalo de 1 segundo
  const interval = setInterval(() => {
    battle.turnTimer--;

    if (battle.turnTimer <= 0) {
      // Tempo esgotado - auto-skip turno
      stopBattleTurnTimer(battle.id);
      handleTimerExpired(battle);
    } else {
      // Emitir atualização do timer
      const currentLobby = battleLobbies.get(battle.lobbyId);
      if (currentLobby && ioRef) {
        ioRef.to(currentLobby.id).emit("battle:turn_timer", {
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
 * Chamado quando o timer expira - avança o turno automaticamente
 */
async function handleTimerExpired(battle: Battle): Promise<void> {
  if (!ioRef) return;

  const lobby = battleLobbies.get(battle.lobbyId);
  if (!lobby) return;

  const currentPlayerId = battle.actionOrder[battle.currentTurnIndex];
  const currentUnit = battle.units.find(
    (u) => u.ownerId === currentPlayerId && u.isAlive
  );

  if (currentUnit) {
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
    ioRef.to(lobby.id).emit("battle:unit_turn_ended", {
      battleId: battle.id,
      unitId: currentUnit.id,
      actionMarks: currentUnit.actionMarks,
      currentHp: currentUnit.currentHp,
      isAlive: currentUnit.isAlive,
      conditions: currentUnit.conditions,
    });
  }

  // Avança jogador
  if (battle.actionOrder.length) {
    battle.currentTurnIndex =
      (battle.currentTurnIndex + 1) % battle.actionOrder.length;
  }

  // Emitir mudança de turno
  ioRef.to(lobby.id).emit("battle:next_player", {
    battleId: battle.id,
    currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
    index: battle.currentTurnIndex,
  });

  // Checa fim do round
  const aliveUnits = battle.units.filter((u) => u.isAlive);
  let allDone = true;
  for (const u of aliveUnits) {
    const m = getMaxMarksByCategory(u.category);
    if (u.actionMarks < m) {
      allDone = false;
      break;
    }
  }

  if (allDone) {
    // Novo round - reseta marcas
    battle.round++;
    for (const u of battle.units) {
      if (u.isAlive) {
        u.actionMarks = 0;
      }
    }
    ioRef.to(lobby.id).emit("battle:new_round", {
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
    // Criar ou atualizar a batalha
    await prisma.battle.upsert({
      where: { id: battle.id },
      update: {
        status: battle.status,
        round: battle.round,
        currentTurnIndex: battle.currentTurnIndex,
        initiativeOrder: JSON.stringify(battle.initiativeOrder),
        actionOrder: JSON.stringify(battle.actionOrder),
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
          category: unit.category,
          troopSlot: unit.troopSlot,
          level: unit.level,
          classId: unit.classId,
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
        category: u.category,
        troopSlot: u.troopSlot ?? undefined,
        level: u.level,
        classId: u.classId ?? undefined,
        classFeatures: JSON.parse(u.classFeatures || "[]"),
        equipment: JSON.parse(u.equipment || "[]"),
        combat: u.combat,
        acuity: u.acuity,
        focus: u.focus,
        armor: u.armor,
        vitality: u.vitality,
        damageReduction: u.damageReduction,
        currentHp: u.currentHp,
        maxHp: u.vitality * 2, // HP máximo = vitality * 2
        posX: u.posX,
        posY: u.posY,
        initiative: u.initiative,
        movesLeft: u.movesLeft,
        actionsLeft: u.actionsLeft,
        isAlive: u.isAlive,
        actionMarks: u.actionMarks,
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
        initiativeOrder: JSON.parse(dbBattle.initiativeOrder),
        actionOrder: JSON.parse(dbBattle.actionOrder),
        units,
        logs: [],
        createdAt: dbBattle.createdAt,
        hostUserId: dbBattle.hostUserId || "",
        guestUserId: dbBattle.guestUserId || "",
        hostKingdomId: dbBattle.hostKingdomId || "",
        guestKingdomId: dbBattle.guestKingdomId || "",
        isArena: true,
      };

      activeBattles.set(battle.id, battle);
      console.log(`[ARENA] Batalha ${battle.id} carregada do banco`);
    }

    console.log(`[ARENA] ${activeBattles.size} batalhas carregadas do banco`);
  } catch (err) {
    console.error("[ARENA] Erro ao carregar batalhas do banco:", err);
  }
}

// Carregar batalhas ao inicializar
loadBattlesFromDB();

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
        id: lobbyId,
        hostUserId: userId,
        hostSocketId: socket.id,
        hostKingdomId: kingdomId,
        status: "WAITING",
        createdAt: new Date(),
      };

      battleLobbies.set(lobbyId, lobby);
      userToLobby.set(userId, lobbyId);
      socketToUser.set(socket.id, userId);

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

      const gridWidth = 20;
      const gridHeight = 20;
      const battleId = generateId();

      // Cria BattleUnits a partir dos Regentes
      const BattleUnits: BattleUnit[] = [];

      // Host Regente(s) - posicionados no topo
      let hostX = 9;
      for (const regent of hostKingdom.units) {
        // Determinar ações dinamicamente baseado nos stats
        const unitActions = determineUnitActions(
          {
            combat: regent.combat,
            acuity: regent.acuity,
            focus: regent.focus,
            armor: regent.armor,
            vitality: regent.vitality,
            category: regent.category,
          },
          { battleType: "arena" }
        );

        BattleUnits.push({
          id: generateUnitId(),
          sourceUnitId: regent.id,
          ownerId: lobby.hostUserId,
          ownerKingdomId: lobby.hostKingdomId,
          name: regent.name || hostKingdom.name + " Regente",
          category: regent.category,
          troopSlot: regent.troopSlot ?? undefined,
          level: regent.level,
          classId: regent.classId ?? undefined,
          classFeatures: JSON.parse(regent.classFeatures || "[]"),
          equipment: JSON.parse(regent.equipment || "[]"),
          combat: regent.combat,
          acuity: regent.acuity,
          focus: regent.focus,
          armor: regent.armor,
          vitality: regent.vitality,
          damageReduction: regent.damageReduction || 0,
          currentHp: regent.vitality * 2, // HP = 2x Vitality
          maxHp: regent.vitality * 2,
          posX: hostX++,
          posY: 1,
          initiative: Math.floor(Math.random() * 20) + 1 + regent.acuity,
          movesLeft: 0,
          actionsLeft: 1,
          isAlive: true,
          actionMarks: 0,
          protection: (regent.armor || 0) * 2,
          protectionBroken: false,
          conditions: [],
          hasStartedAction: false,
          actions: unitActions,
        });
      }

      // Guest Regente(s) - posicionados no fundo
      let guestX = 9;
      for (const regent of guestKingdom.units) {
        // Determinar ações dinamicamente baseado nos stats
        const unitActions = determineUnitActions(
          {
            combat: regent.combat,
            acuity: regent.acuity,
            focus: regent.focus,
            armor: regent.armor,
            vitality: regent.vitality,
            category: regent.category,
          },
          { battleType: "arena" }
        );

        BattleUnits.push({
          id: generateUnitId(),
          sourceUnitId: regent.id,
          ownerId: lobby.guestUserId,
          ownerKingdomId: lobby.guestKingdomId,
          name: regent.name || guestKingdom.name + " Regente",
          category: regent.category,
          troopSlot: regent.troopSlot ?? undefined,
          level: regent.level,
          classId: regent.classId ?? undefined,
          classFeatures: JSON.parse(regent.classFeatures || "[]"),
          equipment: JSON.parse(regent.equipment || "[]"),
          combat: regent.combat,
          acuity: regent.acuity,
          focus: regent.focus,
          armor: regent.armor,
          vitality: regent.vitality,
          damageReduction: regent.damageReduction || 0,
          currentHp: regent.vitality * 2, // HP = 2x Vitality
          maxHp: regent.vitality * 2,
          posX: guestX++,
          posY: gridHeight - 2,
          initiative: Math.floor(Math.random() * 20) + 1 + regent.acuity,
          movesLeft: 0,
          actionsLeft: 1,
          isAlive: true,
          actionMarks: 0,
          protection: (regent.armor || 0) * 2,
          protectionBroken: false,
          conditions: [],
          hasStartedAction: false,
          actions: unitActions,
        });
      }

      // Ordena por iniciativa
      const orderedUnits = rollInitiative(BattleUnits);

      // ActionOrder baseado na iniciativa das unidades (não mais leilão)
      // O jogador com a unidade de maior iniciativa joga primeiro
      const firstUnit = orderedUnits[0];
      const actionOrder =
        firstUnit.ownerId === lobby.hostUserId
          ? [lobby.hostUserId, lobby.guestUserId]
          : [lobby.guestUserId, lobby.hostUserId];

      const battle: Battle = {
        id: battleId,
        lobbyId,
        gridWidth,
        gridHeight,
        round: 1,
        currentTurnIndex: 0,
        status: "ACTIVE",
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
        hostUserId: lobby.hostUserId,
        guestUserId: lobby.guestUserId as string,
        hostKingdomId: lobby.hostKingdomId,
        guestKingdomId: lobby.guestKingdomId as string,
        isArena: true,
      };

      activeBattles.set(battleId, battle);
      lobby.status = "BATTLING";

      // Persistir batalha no banco
      await saveBattleToDB(battle);

      io.to(lobbyId).emit("battle:battle_started", {
        battleId,
        grid: { width: gridWidth, height: gridHeight },
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

      console.log(`[ARENA] Batalha iniciada: ${battleId}`);
    } catch (err) {
      console.error("[ARENA] start_battle error:", err);
      socket.emit("battle:error", { message: "Erro ao iniciar batalha" });
    }
  });

  // ============================================
  // BATTLE ACTIONS
  // ============================================

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
      if (!battle) return;

      const unit = battle.units.find((u) => u.id === unitId);
      if (!unit) return;

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

      // Avança jogador
      if (battle.actionOrder.length) {
        battle.currentTurnIndex =
          (battle.currentTurnIndex + 1) % battle.actionOrder.length;
      }

      const lobby = battleLobbies.get(battle.lobbyId);
      if (lobby) {
        // Emitir estado atualizado da unidade que finalizou
        io.to(lobby.id).emit("battle:unit_turn_ended", {
          battleId,
          unitId,
          actionMarks: unit.actionMarks,
          currentHp: unit.currentHp,
          isAlive: unit.isAlive,
          conditions: unit.conditions,
        });

        // Emitir mudança de turno
        io.to(lobby.id).emit("battle:next_player", {
          battleId,
          currentPlayerId: battle.actionOrder[battle.currentTurnIndex],
          index: battle.currentTurnIndex,
        });
      }

      // Checa fim da batalha
      const aliveUnits = battle.units.filter((u) => u.isAlive);
      let allDone = true;
      for (const u of aliveUnits) {
        const m = getMaxMarksByCategory(u.category);
        if (u.actionMarks < m) {
          allDone = false;
          break;
        }
      }

      if (allDone) {
        // Novo round - reseta marcas
        battle.round++;
        for (const u of battle.units) {
          if (u.isAlive) {
            u.actionMarks = 0;
          }
        }
        if (lobby) {
          io.to(lobby.id).emit("battle:new_round", {
            battleId,
            round: battle.round,
          });
        }
      }

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
        battle.units as CombatUnit[]
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
        io.to(lobby.id).emit("battle:unit_moved", {
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

  // Atacar unidade adjacente
  socket.on(
    "battle:attack",
    async ({
      battleId,
      attackerUnitId,
      targetUnitId,
      damageType = "FISICO",
    }) => {
      try {
        const battle = activeBattles.get(battleId);
        if (!battle || battle.status !== "ACTIVE") {
          return socket.emit("battle:error", { message: "Batalha inválida" });
        }

        const attacker = battle.units.find((u) => u.id === attackerUnitId);
        const target = battle.units.find((u) => u.id === targetUnitId);

        if (!attacker || !attacker.isAlive) {
          return socket.emit("battle:error", { message: "Atacante inválido" });
        }
        if (!target) {
          return socket.emit("battle:error", { message: "Alvo inválido" });
        }

        // Executar ação de ataque usando combat-actions
        const result = executeAttackAction(
          attacker as CombatUnit,
          target as CombatUnit,
          damageType
        );

        if (!result.success) {
          return socket.emit("battle:error", { message: result.error });
        }

        battle.logs.push({
          id: generateId(),
          timestamp: new Date(),
          type: result.targetDefeated ? "ATTACK_KILL" : "ATTACK",
          payload: {
            attackerUnitId,
            targetUnitId,
            diceCount: result.diceCount,
            rolls: result.rolls,
            damage: result.finalDamage,
            damageType: result.damageType,
            targetHpAfter: result.targetHpAfter,
          },
        });

        const lobby = battleLobbies.get(battle.lobbyId);
        if (lobby) {
          io.to(lobby.id).emit("battle:unit_attacked", {
            battleId,
            attackerUnitId,
            targetUnitId,
            diceCount: result.diceCount,
            rolls: result.rolls,
            damage: result.finalDamage,
            damageType: result.damageType,
            targetHpAfter: result.targetHpAfter,
            targetProtection: result.targetProtection,
            attackerActionsLeft: attacker.actionsLeft,
          });

          if (result.targetDefeated) {
            io.to(lobby.id).emit("battle:unit_defeated", {
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

            if (aliveBySide.size <= 1) {
              battle.status = "ENDED";
              const winnerId = aliveBySide.keys().next().value || null;
              const winnerKingdom = battle.units.find(
                (u) => u.ownerId === winnerId
              )?.ownerKingdomId;

              io.to(lobby.id).emit("battle:battle_ended", {
                battleId,
                winnerId,
                winnerKingdomId: winnerKingdom,
                reason: "Todas as unidades inimigas foram derrotadas",
                finalUnits: battle.units,
              });

              // Limpa lobby e deleta batalha do banco
              lobby.status = "ENDED";
              await deleteBattleFromDB(battleId);
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
        io.to(lobby.id).emit("battle:unit_dashed", {
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
        io.to(lobby.id).emit("battle:unit_dodged", {
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
        grid: { width: battle.gridWidth, height: battle.gridHeight },
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

      const winnerKingdom = battle.units.find(
        (u) => u.ownerId === winnerId
      )?.ownerKingdomId;

      io.to(lobby.id).emit("battle:battle_ended", {
        battleId,
        winnerId,
        winnerKingdomId: winnerKingdom,
        reason: "Oponente se rendeu",
        surrenderedBy: userId,
        finalUnits: battle.units,
      });

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
      if (!battle) {
        return socket.emit("battle:error", {
          message: "Batalha não encontrada",
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

      // Limpar referências
      userToLobby.delete(lobby.hostUserId);
      if (lobby.guestUserId) {
        userToLobby.delete(lobby.guestUserId);
      }

      // Notificar todos na sala
      io.to(battle.lobbyId).emit("battle:battle_ended", {
        battleId,
        winnerId,
        reason: "Oponente abandonou a batalha",
        abandonedBy: userId,
        finalUnits: battle.units,
      });

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
      const lobby = battleLobbies.get(lobbyId);
      if (!lobby) {
        return socket.emit("battle:error", { message: "Lobby não encontrado" });
      }

      // Verificar se é participante
      if (lobby.hostUserId !== userId && lobby.guestUserId !== userId) {
        return socket.emit("battle:error", {
          message: "Você não está neste lobby",
        });
      }

      // Verificar se a batalha acabou
      if (lobby.status !== "ENDED") {
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
        console.log(
          `[ARENA] Ambos jogadores querem revanche! Iniciando nova batalha...`
        );

        // Limpar pedidos
        rematchRequests.delete(lobbyId);

        // Buscar os regentes de ambos os jogadores novamente (usando kingdomId do lobby)
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

        // Resetar batalha antiga
        const oldBattle = [...activeBattles.values()].find(
          (b) => b.lobbyId === lobbyId
        );
        if (oldBattle) {
          activeBattles.delete(oldBattle.id);
        }

        // Criar nova batalha
        const battleId = generateId();
        const gridWidth = 20;
        const gridHeight = 20;

        const hostRegent = hostKingdom.units[0];
        const guestRegent = guestKingdom.units[0];

        // Criar unidades da arena
        const hostActions = determineUnitActions(
          {
            combat: hostRegent.combat,
            acuity: hostRegent.acuity,
            focus: hostRegent.focus,
            armor: hostRegent.armor,
            vitality: hostRegent.vitality,
            category: hostRegent.category,
          },
          { battleType: "arena" }
        );

        const hostUnit: BattleUnit = {
          id: generateId(),
          sourceUnitId: hostRegent.id,
          ownerId: lobby.hostUserId,
          ownerKingdomId: hostKingdom.id,
          name: hostRegent.name || hostKingdom.name + " Regente",
          category: hostRegent.category,
          troopSlot: hostRegent.troopSlot ?? undefined,
          level: hostRegent.level,
          classId: hostRegent.classId ?? undefined,
          classFeatures: JSON.parse(hostRegent.classFeatures || "[]"),
          equipment: JSON.parse(hostRegent.equipment || "[]"),
          combat: hostRegent.combat,
          acuity: hostRegent.acuity,
          focus: hostRegent.focus,
          armor: hostRegent.armor,
          vitality: hostRegent.vitality,
          damageReduction: hostRegent.damageReduction || 0,
          currentHp: hostRegent.vitality * 2,
          maxHp: hostRegent.vitality * 2,
          posX: 0,
          posY: Math.floor(gridHeight / 2),
          initiative: Math.floor(Math.random() * 20) + 1 + hostRegent.acuity,
          movesLeft: 0,
          actionsLeft: 1,
          isAlive: true,
          actionMarks: 0,
          protection: hostRegent.armor * 2,
          protectionBroken: false,
          conditions: [],
          hasStartedAction: false,
          actions: hostActions,
        };

        const guestActions = determineUnitActions(
          {
            combat: guestRegent.combat,
            acuity: guestRegent.acuity,
            focus: guestRegent.focus,
            armor: guestRegent.armor,
            vitality: guestRegent.vitality,
            category: guestRegent.category,
          },
          { battleType: "arena" }
        );

        const guestUnit: BattleUnit = {
          id: generateId(),
          sourceUnitId: guestRegent.id,
          ownerId: lobby.guestUserId,
          ownerKingdomId: guestKingdom.id,
          name: guestRegent.name || guestKingdom.name + " Regente",
          category: guestRegent.category,
          troopSlot: guestRegent.troopSlot ?? undefined,
          level: guestRegent.level,
          classId: guestRegent.classId ?? undefined,
          classFeatures: JSON.parse(guestRegent.classFeatures || "[]"),
          equipment: JSON.parse(guestRegent.equipment || "[]"),
          combat: guestRegent.combat,
          acuity: guestRegent.acuity,
          focus: guestRegent.focus,
          armor: guestRegent.armor,
          vitality: guestRegent.vitality,
          damageReduction: guestRegent.damageReduction || 0,
          currentHp: guestRegent.vitality * 2,
          maxHp: guestRegent.vitality * 2,
          posX: gridWidth - 1,
          posY: Math.floor(gridHeight / 2),
          initiative: Math.floor(Math.random() * 20) + 1 + guestRegent.acuity,
          movesLeft: 0,
          actionsLeft: 1,
          isAlive: true,
          actionMarks: 0,
          protection: guestRegent.armor * 2,
          protectionBroken: false,
          conditions: [],
          hasStartedAction: false,
          actions: guestActions,
        };

        // Ordenar por iniciativa
        const units = [hostUnit, guestUnit].sort(
          (a, b) => b.initiative - a.initiative
        );
        const initiativeOrder = units.map((u) => u.id);
        // ActionOrder baseado em iniciativa
        const firstUnit = units[0];
        const actionOrder =
          firstUnit.ownerId === lobby.hostUserId
            ? [lobby.hostUserId, lobby.guestUserId as string]
            : [lobby.guestUserId as string, lobby.hostUserId];

        // Criar nova batalha
        const newBattle: Battle = {
          id: battleId,
          lobbyId,
          gridWidth,
          gridHeight,
          round: 1,
          currentTurnIndex: 0,
          status: "ACTIVE",
          initiativeOrder,
          actionOrder,
          units,
          logs: [],
          createdAt: new Date(),
          hostUserId: lobby.hostUserId,
          guestUserId: lobby.guestUserId as string,
          hostKingdomId: hostKingdom.id,
          guestKingdomId: guestKingdom.id,
          isArena: true,
        };

        activeBattles.set(battleId, newBattle);
        lobby.status = "BATTLING";

        // Emitir evento de revanche iniciada
        io.to(lobbyId).emit("battle:rematch_started", {
          battleId,
          grid: { width: gridWidth, height: gridHeight },
          units: units.map((u) => ({
            id: u.id,
            dbId: u.sourceUnitId,
            ownerId: u.ownerId,
            ownerKingdomId: u.ownerKingdomId,
            name: u.name,
            category: u.category,
            combat: u.combat,
            acuity: u.acuity,
            focus: u.focus,
            armor: u.armor,
            vitality: u.vitality,
            currentHp: u.currentHp,
            posX: u.posX,
            posY: u.posY,
            initiative: u.initiative,
            movesLeft: u.movesLeft,
            actionsLeft: u.actionsLeft,
            isAlive: u.isAlive,
            actionMarks: u.actionMarks,
            protection: u.protection,
            protectionBroken: u.protectionBroken,
            conditions: u.conditions,
          })),
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

        console.log(`[ARENA] Revanche iniciada! Nova batalha: ${battleId}`);
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

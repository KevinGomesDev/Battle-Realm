// server/src/colyseus/rooms/BattleRoom.ts
// Room principal para Battle (Lobby + Battle)

import { Room, Client, Delayed } from "@colyseus/core";
import { prisma } from "../../../../lib/prisma";
import {
  BattleSessionState,
  BattlePlayerSchema,
  BattleUnitSchema,
  BattleObstacleSchema,
  BattleConfigSchema,
  BattleMapConfigSchema,
} from "../schemas";
import {
  createBattleUnitsForBattle,
  createBotUnitsFromTemplate,
  createBattleUnit,
} from "../../../units/battle-unit.factory";
import {
  KINGDOM_TEMPLATES,
  resolveKingdomTemplate,
} from "../../../../../../shared/data/kingdoms.data";
import {
  TURN_CONFIG,
  GRID_CONFIG,
  getGridDimensions,
  getRandomTerrain,
  getRandomBattleSize,
  getObstacleCount,
  getRandomObstacleType,
  getMaxMarksByCategory,
  HP_CONFIG,
  MANA_CONFIG,
  type ObstacleType,
} from "../../../../../../shared/config";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";
import {
  saveBattleSession,
  loadBattle,
  deleteBattle,
  markBattleEnded,
  type PersistedBattleState,
} from "../../../match/services/battle-persistence.service";
import { QTEManager } from "../../../../qte";
import type {
  QTEConfig,
  QTEResponse,
  QTEResult,
} from "../../../../../../shared/qte";
import type { CommandPayload } from "../../../../../../shared/types/commands.types";
import { handleCommand, parseCommandArgs } from "../../../match/commands";
import { processUnitDeath } from "../../../combat/death-logic";
import { isWithinRange } from "../../../../../../shared/utils/distance.utils";
import {
  createAndEmitEvent,
  setEventEmitter,
} from "../../../match/services/event.service";
import {
  executeSkill,
  executeAttack,
  prepareAttackContext,
  executeAttackFromQTEResult,
} from "../../../abilities/executors";
import { findAbilityByCode } from "../../../../../../shared/data/abilities.data";
import type {
  AttackActionResult,
  QTEResultForExecutor,
} from "../../../abilities/executors/types";

// Configurar o callback de emissão de eventos uma vez
let eventEmitterConfigured = false;
function configureEventEmitter(
  broadcastFn: (event: string, data: any) => void
) {
  if (eventEmitterConfigured) return;

  setEventEmitter((event) => {
    // Broadcast o evento como "event:new" para todos os clientes conectados à Global room
    broadcastFn("event:new", event);
  });

  eventEmitterConfigured = true;
  console.log("[BattleRoom] Event emitter configurado");
}

// Cores dos jogadores (até 8)
const PLAYER_COLORS = [
  "#e63946",
  "#457b9d",
  "#2a9d8f",
  "#f4a261",
  "#9b59b6",
  "#1abc9c",
  "#e74c3c",
  "#3498db",
];

interface BattleRoomOptions {
  userId: string;
  kingdomId: string;
  maxPlayers?: number;
  vsBot?: boolean;
  restoreBattleId?: string; // ID da batalha para restaurar do banco
}

interface JoinOptions {
  userId: string;
  kingdomId: string;
}

export class BattleRoom extends Room<BattleSessionState> {
  maxClients = 8;

  private turnTimer: Delayed | null = null;
  private lobbyPhase: boolean = true;
  private readyPlayers = new Set<string>();
  private disconnectedPlayers = new Map<
    string,
    { timeout: Delayed; data: any }
  >();
  private persistenceTimer: Delayed | null = null;
  private allDisconnectedSince: number | null = null;
  private rematchRequests = new Set<string>();
  private restoredFromDb = false;

  /** Gerenciador de QTEs ativos */
  private qteManager: QTEManager | null = null;

  async onCreate(options: BattleRoomOptions) {
    this.autoDispose = true;
    console.log(`[BattleRoom] Criando sala: ${this.roomId}`);
    console.log(
      `[BattleRoom] Options recebidas:`,
      JSON.stringify(options, null, 2)
    );

    // Configurar event emitter (apenas uma vez)
    configureEventEmitter((event: string, data: any) =>
      this.broadcast(event, data)
    );

    // Verificar se é uma restauração de batalha do banco
    if (options.restoreBattleId) {
      const restored = await this.restoreFromDatabase(options.restoreBattleId);
      if (restored) {
        console.log(
          `[BattleRoom] Batalha ${options.restoreBattleId} restaurada do banco`
        );
        this.restoredFromDb = true;
        this.lobbyPhase = false;
        // Registrar handlers e sair
        this.registerMessageHandlers();
        return;
      }
      console.warn(
        `[BattleRoom] Falha ao restaurar batalha ${options.restoreBattleId}, criando nova`
      );
    }

    // Inicializar estado
    this.setState(new BattleSessionState());
    this.state.battleId = this.roomId;
    this.state.lobbyId = this.roomId;
    this.state.status = "WAITING";
    this.state.maxPlayers = Math.min(8, Math.max(2, options.maxPlayers || 2));

    // Configurar metadata para listagem
    this.setMetadata({
      hostUserId: options.userId,
      maxPlayers: this.state.maxPlayers,
      playerCount: 0,
      players: [] as string[],
      playerKingdoms: {} as Record<string, string>, // userId -> kingdomId
      vsBot: options.vsBot || false,
      status: "WAITING",
    });

    // Registrar handlers de mensagens
    this.registerMessageHandlers();

    // Se é contra BOT, marcar flag
    if (options.vsBot) {
      this.metadata.vsBot = true;
    }
  }

  /**
   * Restaura uma batalha do banco de dados
   */
  private async restoreFromDatabase(battleId: string): Promise<boolean> {
    try {
      const persistedBattle = await loadBattle(battleId);
      if (!persistedBattle) {
        return false;
      }

      // Inicializar estado
      this.setState(new BattleSessionState());
      this.state.battleId = battleId;
      this.state.lobbyId = persistedBattle.lobbyId || battleId;
      this.state.status = "ACTIVE";
      this.state.round = persistedBattle.round;
      this.state.gridWidth = persistedBattle.gridWidth;
      this.state.gridHeight = persistedBattle.gridHeight;
      this.state.maxPlayers = persistedBattle.maxPlayers;
      this.state.currentTurnIndex = persistedBattle.currentTurnIndex;

      // Restaurar actionOrder
      persistedBattle.actionOrder.forEach((id) => {
        this.state.actionOrder.push(id);
      });

      // Restaurar config
      if (!this.state.config) {
        this.state.config = new BattleConfigSchema();
      }
      if (!this.state.config.map) {
        this.state.config.map = new BattleMapConfigSchema();
      }
      this.state.config.map.terrainType = persistedBattle.terrainType;

      // Restaurar obstáculos (BattleSessionState.obstacles é ArraySchema)
      for (const obs of persistedBattle.obstacles) {
        const obstacle = new BattleObstacleSchema();
        obstacle.id = obs.id;
        obstacle.posX = obs.posX;
        obstacle.posY = obs.posY;
        obstacle.type = obs.type;
        obstacle.hp = obs.hp;
        obstacle.maxHp = obs.maxHp;
        obstacle.destroyed = obs.destroyed ?? false;
        this.state.obstacles.push(obstacle);
      }

      // Restaurar jogadores
      for (let i = 0; i < persistedBattle.playerIds.length; i++) {
        const player = new BattlePlayerSchema();
        player.oderId = persistedBattle.playerIds[i];
        player.kingdomId = persistedBattle.kingdomIds[i] || "";
        player.playerIndex = i;
        player.playerColor =
          persistedBattle.playerColors[i] || PLAYER_COLORS[i];
        player.isConnected = false; // Será true quando reconectar
        player.isBot = player.oderId.startsWith("bot_");

        // Buscar nome do reino
        const kingdom = await prisma.kingdom.findUnique({
          where: { id: player.kingdomId },
          include: { owner: true },
        });
        player.kingdomName = kingdom?.name || "Reino";
        player.username = kingdom?.owner?.username || "Player";

        this.state.players.push(player);
      }

      // Restaurar unidades
      for (const unit of persistedBattle.units) {
        const battleUnit = new BattleUnitSchema();
        battleUnit.id = unit.id;
        battleUnit.sourceUnitId = unit.sourceUnitId || "";
        battleUnit.ownerId = unit.ownerId || "";
        battleUnit.ownerKingdomId = unit.ownerKingdomId || "";
        battleUnit.name = unit.name;
        battleUnit.avatar = unit.avatar || "";
        battleUnit.category = unit.category;
        battleUnit.troopSlot = unit.troopSlot ?? -1;
        battleUnit.level = unit.level;
        battleUnit.race = unit.race || "";
        battleUnit.classCode = unit.classCode || "";
        battleUnit.combat = unit.combat;
        battleUnit.speed = unit.speed;
        battleUnit.focus = unit.focus;
        battleUnit.resistance = unit.resistance;
        battleUnit.will = unit.will;
        battleUnit.vitality = unit.vitality;
        battleUnit.damageReduction = unit.damageReduction;
        battleUnit.maxHp = unit.maxHp;
        battleUnit.currentHp = unit.currentHp;
        battleUnit.maxMana = unit.maxMana;
        battleUnit.currentMana = unit.currentMana;
        battleUnit.posX = unit.posX;
        battleUnit.posY = unit.posY;
        battleUnit.movesLeft = unit.movesLeft;
        battleUnit.actionsLeft = unit.actionsLeft;
        battleUnit.attacksLeftThisTurn = unit.attacksLeftThisTurn;
        battleUnit.isAlive = unit.isAlive;
        battleUnit.actionMarks = unit.actionMarks;
        battleUnit.physicalProtection = unit.physicalProtection;
        battleUnit.maxPhysicalProtection = unit.maxPhysicalProtection;
        battleUnit.magicalProtection = unit.magicalProtection;
        battleUnit.maxMagicalProtection = unit.maxMagicalProtection;
        battleUnit.hasStartedAction = unit.hasStartedAction;
        battleUnit.grabbedByUnitId = unit.grabbedByUnitId || "";
        battleUnit.isAIControlled = unit.isAIControlled;
        battleUnit.aiBehavior = unit.aiBehavior || "AGGRESSIVE";
        battleUnit.size = unit.size;
        battleUnit.visionRange = unit.visionRange;

        // Restaurar arrays
        unit.features.forEach((f) => battleUnit.features.push(f));
        unit.equipment.forEach((e) => battleUnit.equipment.push(e));
        unit.spells.forEach((s) => battleUnit.spells.push(s));
        unit.conditions.forEach((c) => battleUnit.conditions.push(c));

        // Restaurar cooldowns
        Object.entries(unit.unitCooldowns).forEach(([key, value]) => {
          battleUnit.unitCooldowns.set(key, value);
        });

        this.state.units.set(battleUnit.id, battleUnit);
      }

      // Atualizar metadata
      this.setMetadata({
        hostUserId: persistedBattle.playerIds[0],
        maxPlayers: persistedBattle.maxPlayers,
        playerCount: persistedBattle.playerIds.length,
        players: persistedBattle.playerIds,
        vsBot: persistedBattle.playerIds.some((id) => id.startsWith("bot_")),
        status: "BATTLING",
      });

      // Deletar do banco (já está na memória agora)
      await deleteBattle(battleId);

      console.log(
        `[BattleRoom] Restauração completa: ${persistedBattle.units.length} unidades, ${persistedBattle.obstacles.length} obstáculos`
      );

      return true;
    } catch (error) {
      console.error(`[BattleRoom] Erro ao restaurar batalha:`, error);
      return false;
    }
  }

  async onJoin(client: Client, options: JoinOptions) {
    console.log(
      `[BattleRoom] ${client.sessionId} entrou na sala ${this.roomId}`
    );

    const { userId, kingdomId } = options;

    // Verificar se ainda está em fase de lobby
    if (!this.lobbyPhase && this.state.status !== "WAITING") {
      // Tentar reconectar jogador desconectado (via disconnectedPlayers map)
      const disconnected = this.disconnectedPlayers.get(userId);
      if (disconnected) {
        disconnected.timeout.clear();
        this.disconnectedPlayers.delete(userId);

        // Atualizar player como conectado
        const player = this.state.getPlayer(userId);
        if (player) {
          player.isConnected = true;
          client.userData = { userId, kingdomId };
        }

        // Cancelar persistência pendente
        this.cancelPersistence();

        console.log(
          `[BattleRoom] Jogador ${userId} reconectado via disconnectedPlayers`
        );
        client.send("battle:reconnected", { success: true });
        return;
      }

      // Tentar reconectar jogador que já existe no state (refresh de página)
      const existingPlayer = this.state.getPlayer(userId);
      if (existingPlayer) {
        existingPlayer.isConnected = true;
        client.userData = { userId, kingdomId };

        // Cancelar persistência pendente
        this.cancelPersistence();

        console.log(
          `[BattleRoom] Jogador ${userId} reconectado (já existe no state)`
        );
        client.send("battle:reconnected", { success: true });
        return;
      }

      throw new Error("Batalha já iniciada");
    }

    // Verificar se já está no lobby (em fase de lobby, pode reconectar também)
    const existingPlayer = this.state.getPlayer(userId);
    if (existingPlayer) {
      // Se já existe, apenas reconectar
      existingPlayer.isConnected = true;
      client.userData = { userId, kingdomId };

      console.log(`[BattleRoom] Jogador ${userId} reconectado ao lobby`);
      client.send("lobby:reconnected", {
        lobbyId: this.roomId,
        playerIndex: existingPlayer.playerIndex,
        players: this.getPlayersInfo(),
      });
      return;
    }

    // Verificar limite de jogadores
    if (this.state.players.length >= this.state.maxPlayers) {
      throw new Error("Lobby cheio");
    }

    // Buscar dados do reino
    const kingdom = await prisma.kingdom.findUnique({
      where: { id: kingdomId },
      include: { regent: true, owner: true },
    });

    if (!kingdom) {
      throw new Error("Reino não encontrado");
    }

    if (kingdom.ownerId !== userId) {
      throw new Error("Este reino não pertence a você");
    }

    if (!kingdom.regent) {
      throw new Error("Reino sem Regente definido");
    }

    // Criar jogador
    const playerIndex = this.state.players.length;
    const player = new BattlePlayerSchema();
    player.oderId = userId;
    player.kingdomId = kingdomId;
    player.kingdomName = kingdom.name;
    player.username = kingdom.owner?.username || "Unknown";
    player.playerIndex = playerIndex;
    player.playerColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
    player.isConnected = true;
    player.isBot = false;

    this.state.players.push(player);

    // Atualizar metadata com mapeamento de kingdomIds
    const playerKingdoms: Record<string, string> = {};
    this.state.players.forEach((p: BattlePlayerSchema) => {
      playerKingdoms[p.oderId] = p.kingdomId;
    });

    this.setMetadata({
      ...this.metadata,
      playerCount: this.state.players.length,
      players: this.state.players.map((p: BattlePlayerSchema) => p.oderId),
      playerKingdoms,
      status:
        this.state.players.length >= this.state.maxPlayers
          ? "READY"
          : "WAITING",
    });

    // Associar client ao userId
    client.userData = { userId, kingdomId };

    // Notificar o cliente que entrou
    client.send("lobby:joined", {
      lobbyId: this.roomId,
      playerIndex,
      players: this.getPlayersInfo(),
    });

    // Broadcast para outros jogadores
    this.broadcast(
      "lobby:player_joined",
      {
        player: {
          oderId: userId,
          username: player.username,
          kingdomName: player.kingdomName,
          playerIndex,
        },
        totalPlayers: this.state.players.length,
        maxPlayers: this.state.maxPlayers,
      },
      { except: client }
    );

    // Se vsBot, adicionar bot e iniciar batalha
    console.log(
      `[BattleRoom] vsBot check: vsBot=${this.metadata.vsBot}, players=${this.state.players.length}`
    );
    if (this.metadata.vsBot && this.state.players.length === 1) {
      console.log(`[BattleRoom] Iniciando fluxo vsBot...`);
      await this.addBotPlayer();
      console.log(
        `[BattleRoom] Bot adicionado, players agora: ${this.state.players.length}`
      );
      await this.startBattle();
      console.log(
        `[BattleRoom] startBattle() concluído, status: ${this.state.status}`
      );
      return; // Sair aqui - batalha já iniciou
    }

    // Se lobby cheio, pode iniciar (apenas se ainda não estiver em batalha)
    if (
      this.state.players.length >= this.state.maxPlayers &&
      this.state.status === "WAITING"
    ) {
      this.state.status = "READY";
    }
  }

  async onLeave(client: Client, consented: boolean) {
    const userData = client.userData as
      | { userId: string; kingdomId: string }
      | undefined;
    if (!userData) return;

    const { userId } = userData;
    console.log(
      `[BattleRoom] ${userId} saiu da sala (consented: ${consented})`
    );

    // Se ainda em fase de lobby
    if (this.lobbyPhase) {
      // Remover jogador do lobby
      const playerIndex = this.state.players.findIndex(
        (p: BattlePlayerSchema) => p.oderId === userId
      );
      if (playerIndex !== -1) {
        this.state.players.splice(playerIndex, 1);

        // Reindexar jogadores restantes
        this.state.players.forEach((p: BattlePlayerSchema, idx: number) => {
          p.playerIndex = idx;
          p.playerColor = PLAYER_COLORS[idx % PLAYER_COLORS.length];
        });

        this.setMetadata({
          ...this.metadata,
          playerCount: this.state.players.length,
          players: this.state.players.map((p: BattlePlayerSchema) => p.oderId),
          status: "WAITING",
        });

        this.broadcast("lobby:player_left", { userId });
      }
      return;
    }

    // Se a batalha já terminou, não precisa fazer mais nada
    if (this.state.status === "ENDED" || this.state.winnerId) {
      console.log(
        `[BattleRoom] ${userId} saiu após fim da batalha - ignorando surrender`
      );
      return;
    }

    // Em batalha - marcar como desconectado
    const player = this.state.getPlayer(userId);
    if (player) {
      player.isConnected = false;

      // Se não foi intencional, dar tempo para reconectar
      if (!consented) {
        try {
          await this.allowReconnection(client, 60); // 60 segundos para reconectar
          player.isConnected = true;
        } catch {
          // Jogador não reconectou - surrender automático
          this.handleSurrender(userId);
        }
      } else {
        // Saída intencional = surrender
        this.handleSurrender(userId);
      }
    }

    // Verificar se todos os jogadores humanos desconectaram
    this.checkAllDisconnected();
  }

  /**
   * Verifica se todos os jogadores humanos estão desconectados
   * Se sim, persiste a batalha no banco de dados
   */
  private checkAllDisconnected() {
    if (!this.lobbyPhase && this.state.status === "ACTIVE") {
      const humanPlayers = this.state.players.filter(
        (p: BattlePlayerSchema) => !p.isBot
      );
      const allDisconnected = humanPlayers.every(
        (p: BattlePlayerSchema) => !p.isConnected
      );

      if (allDisconnected && humanPlayers.length > 0) {
        this.allDisconnectedSince = Date.now();
        console.log(
          `[BattleRoom] Todos os jogadores desconectaram. Persistindo batalha em 10s...`
        );

        // Aguardar 10 segundos antes de persistir (para permitir reconexão rápida)
        this.persistenceTimer = this.clock.setTimeout(async () => {
          await this.persistBattleToDb();
        }, 10000);
      }
    }
  }

  /**
   * Cancela a persistência se algum jogador reconectar
   */
  private cancelPersistence() {
    if (this.persistenceTimer) {
      this.persistenceTimer.clear();
      this.persistenceTimer = null;
      this.allDisconnectedSince = null;
      console.log(`[BattleRoom] Persistência cancelada - jogador reconectou`);
    }
  }

  /**
   * Persiste a batalha no banco de dados
   */
  private async persistBattleToDb() {
    if (this.state.status !== "ACTIVE") {
      console.log(`[BattleRoom] Não persistindo - batalha não está ativa`);
      return;
    }

    try {
      const playerIds = this.state.players.map(
        (p: BattlePlayerSchema) => p.oderId
      );
      const kingdomIds = this.state.players.map(
        (p: BattlePlayerSchema) => p.kingdomId
      );
      const playerColors = this.state.players.map(
        (p: BattlePlayerSchema) => p.playerColor
      );

      await saveBattleSession(
        this.roomId,
        this.state,
        playerIds,
        kingdomIds,
        playerColors
      );

      console.log(
        `[BattleRoom] Batalha ${this.roomId} persistida no banco de dados`
      );
    } catch (error) {
      console.error(`[BattleRoom] Erro ao persistir batalha:`, error);
    }
  }

  async onDispose() {
    console.log(`[BattleRoom] Sala ${this.roomId} sendo destruída`);

    // Limpar timers
    if (this.turnTimer) {
      this.turnTimer.clear();
      this.turnTimer = null;
    }

    if (this.persistenceTimer) {
      this.persistenceTimer.clear();
      this.persistenceTimer = null;
    }

    // Se a batalha estava ativa e não terminada, persistir no banco
    if (
      !this.lobbyPhase &&
      this.state.status === "ACTIVE" &&
      !this.state.winnerId
    ) {
      console.log(
        `[BattleRoom] Batalha ativa não finalizada. Persistindo antes de destruir...`
      );
      await this.persistBattleToDb();
    }
  }

  // =========================================
  // Message Handlers
  // =========================================

  private registerMessageHandlers() {
    // Lobby handlers
    this.onMessage("lobby:ready", (client, _message) => {
      const userData = client.userData as { userId: string } | undefined;
      if (!userData) return;

      this.readyPlayers.add(userData.userId);
      this.broadcast("lobby:player_ready", { userId: userData.userId });

      // Verificar se todos estão prontos
      if (this.readyPlayers.size >= this.state.players.length) {
        this.startBattle();
      }
    });

    this.onMessage("lobby:start", async (client, _message) => {
      const userData = client.userData as { userId: string } | undefined;
      if (!userData) return;

      // Apenas host pode iniciar
      if (this.state.players[0]?.oderId !== userData.userId) {
        client.send("error", { message: "Apenas o host pode iniciar" });
        return;
      }

      if (this.state.players.length < 2) {
        client.send("error", { message: "Mínimo de 2 jogadores" });
        return;
      }

      await this.startBattle();
    });

    // Battle handlers
    this.onMessage("battle:begin_action", (client, { unitId }) => {
      this.handleBeginAction(client, unitId);
    });

    this.onMessage("battle:move", (client, { unitId, toX, toY }) => {
      this.handleMove(client, unitId, toX, toY);
    });

    this.onMessage(
      "battle:attack",
      (client, { attackerId, targetId, targetObstacleId, targetPosition }) => {
        this.handleAttack(
          client,
          attackerId,
          targetId,
          targetObstacleId,
          targetPosition
        );
      }
    );

    this.onMessage("battle:end_action", (client, { unitId }) => {
      this.handleEndAction(client, unitId);
    });

    this.onMessage(
      "battle:execute_action",
      (client, { actionName, unitId, params }) => {
        this.handleExecuteAction(client, actionName, unitId, params);
      }
    );

    // Handler para respostas de QTE
    this.onMessage("qte:response", (client, response: QTEResponse) => {
      const userData = client.userData as { userId: string } | undefined;
      if (!userData) return;
      this.handleQTEResponse(client, response);
    });

    this.onMessage("battle:surrender", (client, _message) => {
      const userData = client.userData as { userId: string } | undefined;
      if (!userData) return;
      this.handleSurrender(userData.userId);
    });

    this.onMessage("battle:request_rematch", (client, _message) => {
      const userData = client.userData as { userId: string } | undefined;
      if (!userData) return;
      this.handleRematchRequest(userData.userId);
    });

    // Event subscription handlers (para UI de logs)
    this.onMessage(
      "event:subscribe",
      (
        client,
        { context, contextId }: { context: string; contextId: string }
      ) => {
        // Por enquanto, apenas confirmar a inscrição
        // Os logs são enviados via state.logs
        client.send("event:subscribed", {
          context,
          contextId,
          events: Array.from(this.state.logs || []),
        });
      }
    );

    this.onMessage("event:unsubscribe", (_client, _message) => {
      // Nada a fazer - os logs são sincronizados via state
    });

    // Command handler para comandos de chat de batalha
    this.onMessage("battle:command", (client, payload: CommandPayload) => {
      const userData = client.userData as { userId: string } | undefined;
      if (!userData) {
        client.send("battle:command:response", {
          commandCode: payload.commandCode,
          result: { success: false, message: "Usuário não autenticado" },
        });
        return;
      }

      this.handleBattleCommand(client, payload, userData.userId);
    });
  }

  // =========================================
  // Battle Logic
  // =========================================

  private async startBattle() {
    console.log(`[BattleRoom] ========== START BATTLE ==========`);
    console.log(`[BattleRoom] Room: ${this.roomId}`);
    console.log(`[BattleRoom] Players: ${this.state.players.length}`);

    this.lobbyPhase = false;
    this.state.status = "ACTIVE";
    console.log(`[BattleRoom] Status setado para: ${this.state.status}`);

    // Gerar configuração do mapa
    const terrainType = getRandomTerrain();
    const territorySize = getRandomBattleSize();
    const { width, height } = getGridDimensions(territorySize);

    this.state.gridWidth = width;
    this.state.gridHeight = height;

    // Configurar mapa
    this.state.config.map.terrainType = terrainType;
    this.state.config.map.territorySize = territorySize;
    this.state.config.weather = "CLEAR";
    this.state.config.timeOfDay = 12;

    // Gerar obstáculos
    const obstacleCount = getObstacleCount(territorySize);
    this.generateObstacles(obstacleCount);

    // Criar unidades para cada jogador
    await this.createBattleUnits();

    // Inicializar QTE Manager
    this.initializeQTEManager();

    // Definir ordem de ação
    this.calculateActionOrder();

    // Iniciar timer de turno
    this.state.turnTimer = TURN_CONFIG.timerSeconds;
    this.startTurnTimer();

    // Atualizar metadata
    this.setMetadata({
      ...this.metadata,
      status: "BATTLING",
    });

    // Broadcast início da batalha
    this.broadcast("battle:started", {
      battleId: this.state.battleId,
      gridWidth: this.state.gridWidth,
      gridHeight: this.state.gridHeight,
      config: this.serializeConfig(),
    });
  }

  private generateObstacles(count: number) {
    const usedPositions = new Set<string>();

    // Reservar posições de spawn
    this.state.players.forEach((_, idx) => {
      const spawnX = idx === 0 ? 1 : this.state.gridWidth - 2;
      for (let y = 0; y < Math.min(3, this.state.gridHeight); y++) {
        usedPositions.add(`${spawnX},${y}`);
        usedPositions.add(`${spawnX + 1},${y}`);
      }
    });

    // Pegar o terreno atual para gerar tipos de obstáculos apropriados
    const terrainType = (this.state.config?.map?.terrainType ||
      "PLAINS") as Parameters<typeof getRandomObstacleType>[0];

    for (let i = 0; i < count; i++) {
      let attempts = 0;
      while (attempts < 50) {
        const x = Math.floor(Math.random() * this.state.gridWidth);
        const y = Math.floor(Math.random() * this.state.gridHeight);
        const key = `${x},${y}`;

        if (!usedPositions.has(key)) {
          usedPositions.add(key);

          const obstacle = new BattleObstacleSchema();
          obstacle.id = `obs_${i}`;
          obstacle.posX = x;
          obstacle.posY = y;
          // Usar novo sistema de tipos 2.5D
          obstacle.type = getRandomObstacleType(terrainType);
          obstacle.hp = 5;
          obstacle.maxHp = 5;
          obstacle.destroyed = false;

          this.state.obstacles.push(obstacle);
          break;
        }
        attempts++;
      }
    }
  }

  private async createBattleUnits() {
    for (const player of this.state.players) {
      if (player.isBot) {
        // Criar unidades de bot (simplificado)
        await this.createBotUnits(player);
        continue;
      }

      // Buscar unidades do reino
      const kingdom = await prisma.kingdom.findUnique({
        where: { id: player.kingdomId },
        include: {
          regent: true,
        },
      });

      if (!kingdom) continue;

      const units = await createBattleUnitsForBattle(
        {
          ...kingdom,
        },
        player.oderId,
        player.playerIndex,
        this.state.gridWidth,
        this.state.gridHeight
      );

      units.forEach((unit) => {
        const schema = BattleUnitSchema.fromBattleUnit(unit);
        this.state.units.set(unit.id, schema);
        this.state.actionOrder.push(unit.id);
      });
    }
  }

  private async createBotUnits(botPlayer: BattlePlayerSchema) {
    console.log(
      `[BattleRoom] 🤖 createBotUnits chamado para player:`,
      botPlayer.oderId
    );

    // Selecionar um template de reino aleatório para o bot
    const randomTemplate =
      KINGDOM_TEMPLATES[Math.floor(Math.random() * KINGDOM_TEMPLATES.length)];
    const resolvedTemplate = resolveKingdomTemplate(randomTemplate);

    if (!resolvedTemplate) {
      console.error(
        `[BattleRoom] ❌ Falha ao resolver template ${randomTemplate.id}`
      );
      return;
    }

    console.log(
      `[BattleRoom] 🤖 Bot usando template: ${resolvedTemplate.name} (${resolvedTemplate.race})`
    );

    // Atualizar dados do bot player com informações do template
    botPlayer.kingdomName = `🤖 ${resolvedTemplate.name}`;

    // Criar unidades do bot a partir do template
    const botKingdom = {
      id: botPlayer.kingdomId,
      name: resolvedTemplate.name,
      race: resolvedTemplate.race,
    };

    const dbUnits = createBotUnitsFromTemplate(
      randomTemplate,
      botPlayer.oderId,
      botKingdom
    );

    if (dbUnits.length === 0) {
      console.error(`[BattleRoom] ❌ Nenhuma unidade criada para o bot`);
      return;
    }

    // Determinar posição inicial (lado direito do mapa, como player 1)
    const startX = this.state.gridWidth - 2;
    const startY = Math.floor(this.state.gridHeight / 2);

    // Converter DBUnits em BattleUnits
    dbUnits.forEach((dbUnit, index) => {
      const position = {
        x: startX,
        y: startY + index,
      };

      const battleUnit = createBattleUnit(
        dbUnit,
        botPlayer.oderId,
        botKingdom,
        position,
        "battle"
      );

      // Marcar como controlado por IA
      battleUnit.isAIControlled = true;

      // Converter para Schema e adicionar ao state
      const schema = BattleUnitSchema.fromBattleUnit(battleUnit);
      this.state.units.set(battleUnit.id, schema);
      this.state.actionOrder.push(battleUnit.id);

      console.log(`[BattleRoom] 🤖 Bot unit criado:`, {
        id: battleUnit.id,
        name: battleUnit.name,
        race: battleUnit.race,
        combat: battleUnit.combat,
        speed: battleUnit.speed,
        maxHp: battleUnit.maxHp,
        spells: battleUnit.spells,
        features: battleUnit.features,
        isAIControlled: battleUnit.isAIControlled,
        posX: position.x,
        posY: position.y,
      });
    });

    console.log(
      `[BattleRoom] 🤖 Total de unidades bot criadas: ${dbUnits.length}`
    );
  }

  private calculateActionOrder() {
    // Ordenar por speed (maior primeiro)
    const unitIds = Array.from(this.state.actionOrder).filter(
      (id): id is string => id !== undefined
    );
    unitIds.sort((a, b) => {
      const unitA = this.state.units.get(a);
      const unitB = this.state.units.get(b);
      if (!unitA || !unitB) return 0;
      return unitB.speed - unitA.speed;
    });

    this.state.actionOrder.clear();
    unitIds.forEach((id) => this.state.actionOrder.push(id));

    // Definir primeira unidade como ativa
    if (this.state.actionOrder.length > 0) {
      this.state.currentTurnIndex = 0;
      const firstUnitId = this.state.actionOrder[0];
      if (firstUnitId) {
        this.state.activeUnitId = firstUnitId;
        const unit = this.state.units.get(firstUnitId);
        if (unit) {
          this.state.currentPlayerId = unit.ownerId || "";
          // Inicializar turno da primeira unidade
          unit.movesLeft = unit.speed;
          unit.actionsLeft = 1;
          unit.attacksLeftThisTurn = 1;
          unit.hasStartedAction = false;

          // Se a primeira unidade é de IA, executar turno da IA
          if (unit.isAIControlled) {
            console.log(
              `[BattleRoom] 🤖 Primeira unidade é IA: ${unit.name}, iniciando turno da IA`
            );
            this.executeAITurn(unit);
          }
        }
      }
    }
  }

  private startTurnTimer() {
    if (this.turnTimer) {
      this.turnTimer.clear();
    }

    this.turnTimer = this.clock.setInterval(() => {
      if (this.state.status !== "ACTIVE") {
        this.turnTimer?.clear();
        return;
      }

      this.state.turnTimer--;

      if (this.state.turnTimer <= 0) {
        this.advanceToNextUnit();
      }
    }, 1000);
  }

  private advanceToNextUnit() {
    console.log(`[BattleRoom] advanceToNextUnit chamado`);

    // Encontrar próxima unidade viva
    let nextIndex =
      (this.state.currentTurnIndex + 1) % this.state.actionOrder.length;
    let attempts = 0;

    while (attempts < this.state.actionOrder.length) {
      const unitId = this.state.actionOrder[nextIndex];
      if (!unitId) {
        nextIndex = (nextIndex + 1) % this.state.actionOrder.length;
        attempts++;
        continue;
      }
      const unit = this.state.units.get(unitId);

      if (unit && unit.isAlive) {
        this.state.currentTurnIndex = nextIndex;
        this.state.activeUnitId = unitId;
        this.state.currentPlayerId = unit.ownerId;
        this.state.turnTimer = TURN_CONFIG.timerSeconds;

        // Resetar ações da unidade
        unit.hasStartedAction = false;
        unit.movesLeft = unit.speed;
        unit.actionsLeft = 1;
        unit.attacksLeftThisTurn = 1;

        // Verificar se completou uma rodada
        if (nextIndex === 0) {
          this.state.round++;
          this.processRoundEnd();
        }

        console.log(
          `[BattleRoom] Turno para: ${unit.name} (isAIControlled: ${unit.isAIControlled})`
        );

        this.broadcast("battle:turn_changed", {
          activeUnitId: unitId,
          round: this.state.round,
          turnTimer: this.state.turnTimer,
        });

        // Se é unidade de IA, executar turno
        if (unit.isAIControlled) {
          console.log(
            `[BattleRoom] 🤖 Unidade de IA detectada, executando turno`
          );
          this.executeAITurn(unit);
        }

        return;
      }

      nextIndex = (nextIndex + 1) % this.state.actionOrder.length;
      attempts++;
    }

    // Todas as unidades mortas - fim de jogo
    this.checkBattleEnd();
  }

  private processRoundEnd() {
    // Processar efeitos de fim de rodada para cada unidade
    this.state.units.forEach((unit) => {
      if (!unit.isAlive) return;

      // Reduzir cooldowns
      unit.unitCooldowns.forEach((value, key) => {
        if (value > 0) {
          unit.unitCooldowns.set(key, value - 1);
        }
      });

      // Processar condições temporárias
      // (implementação detalhada seria feita aqui)
    });

    this.broadcast("battle:round_ended", { round: this.state.round - 1 });
  }

  private executeAITurn(unit: BattleUnitSchema) {
    console.log(
      `[BattleRoom] 🤖 executeAITurn iniciado para: ${unit.name} (${unit.id})`
    );

    // IA simplificada - mover em direção ao inimigo mais próximo e atacar
    setTimeout(() => {
      console.log(`[BattleRoom] 🤖 IA processando turno de: ${unit.name}`);

      // Encontrar inimigo mais próximo
      let closestEnemy: BattleUnitSchema | undefined = undefined;
      let closestDist = Infinity;

      this.state.units.forEach((other) => {
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
        this.advanceToNextUnit();
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

        if (this.isValidPosition(newX, newY)) {
          const fromX = unit.posX;
          const fromY = unit.posY;
          unit.posX = newX;
          unit.posY = newY;
          unit.movesLeft--;

          console.log(
            `[BattleRoom] 🤖 IA: ${unit.name} moveu de (${fromX},${fromY}) para (${newX},${newY})`
          );

          this.broadcast("battle:unit_moved", {
            unitId: unit.id,
            fromX,
            fromY,
            toX: newX,
            toY: newY,
            movesLeft: unit.movesLeft,
          });
        } else {
          console.log(
            `[BattleRoom] 🤖 IA: Posição (${newX},${newY}) inválida, não moveu`
          );
        }
      }

      // Atacar se adjacente e tem recurso para atacar
      const newDist =
        Math.abs(enemy.posX - unit.posX) + Math.abs(enemy.posY - unit.posY);
      if (newDist <= 1 && this.canAttack(unit)) {
        console.log(`[BattleRoom] 🤖 IA: ${unit.name} atacando ${enemy.name}`);
        // IA ataca sem QTE (modificadores padrão)
        this.executeAttackAndBroadcast(unit, enemy, {
          dodged: false,
          attackerDamageModifier: 1.0,
          defenderDamageModifier: 1.0,
        });
      } else {
        console.log(
          `[BattleRoom] 🤖 IA: Distância ${newDist}, ataques restantes: ${unit.attacksLeftThisTurn}, ações: ${unit.actionsLeft}, não atacou`
        );
      }

      // Fim do turno da IA
      console.log(`[BattleRoom] 🤖 IA: ${unit.name} finalizando turno`);
      this.advanceToNextUnit();
    }, 1000);
  }

  private isValidPosition(x: number, y: number): boolean {
    // Verificar limites do grid
    if (
      x < 0 ||
      x >= this.state.gridWidth ||
      y < 0 ||
      y >= this.state.gridHeight
    ) {
      return false;
    }

    // Verificar obstáculos
    for (const obs of this.state.obstacles) {
      if (!obs.destroyed && obs.posX === x && obs.posY === y) {
        return false;
      }
    }

    // Verificar outras unidades
    let occupied = false;
    this.state.units.forEach((unit) => {
      if (unit.isAlive && unit.posX === x && unit.posY === y) {
        occupied = true;
      }
    });

    return !occupied;
  }

  /**
   * Verifica se a unidade tem recursos para atacar (sem consumir)
   */
  private canAttack(attacker: BattleUnitSchema): boolean {
    return attacker.attacksLeftThisTurn > 0 || attacker.actionsLeft > 0;
  }

  /**
   * Consome recurso de ataque (para casos especiais como ataque no ar)
   * Nota: Para ataques normais, o executor faz isso automaticamente
   */
  private consumeAttackResourceSimple(attacker: BattleUnitSchema): void {
    if (attacker.attacksLeftThisTurn > 0) {
      attacker.attacksLeftThisTurn--;
    } else if (attacker.actionsLeft > 0) {
      attacker.actionsLeft--;
    }
  }

  /**
   * Sincroniza resultado do ataque de volta para os schemas Colyseus
   */
  private syncAttackResultToSchemas(
    attackerSchema: BattleUnitSchema,
    targetSchema: BattleUnitSchema,
    attackerUnit: BattleUnit,
    targetUnit: BattleUnit,
    allUnits: BattleUnit[],
    result: AttackActionResult
  ) {
    // Sincronizar recursos de ataque consumidos pelo executor
    attackerSchema.actionsLeft = attackerUnit.actionsLeft;
    attackerSchema.attacksLeftThisTurn = attackerUnit.attacksLeftThisTurn;

    // Sincronizar condições do atacante
    attackerSchema.conditions.clear();
    attackerUnit.conditions.forEach((c) => attackerSchema.conditions.push(c));

    // Sincronizar alvo
    targetSchema.currentHp = targetUnit.currentHp;
    targetSchema.physicalProtection = targetUnit.physicalProtection;
    targetSchema.magicalProtection = targetUnit.magicalProtection;
    targetSchema.isAlive = targetUnit.isAlive;
    targetSchema.conditions.clear();
    targetUnit.conditions.forEach((c) => targetSchema.conditions.push(c));

    // Se houve transferência para Eidolon, sincronizar Eidolon
    if (result.damageTransferredToEidolon) {
      // Eidolon é identificado por category SUMMON e condição EIDOLON_GROWTH
      const eidolon = allUnits.find(
        (u) =>
          u.ownerId === targetUnit.ownerId &&
          u.category === "SUMMON" &&
          u.conditions.includes("EIDOLON_GROWTH")
      );
      if (eidolon) {
        const eidolonSchema = this.state.units.get(eidolon.id);
        if (eidolonSchema) {
          eidolonSchema.currentHp = eidolon.currentHp;
          eidolonSchema.isAlive = eidolon.isAlive;
        }
      }
    }

    // Sincronizar summons mortos
    if (result.killedSummonIds && result.killedSummonIds.length > 0) {
      for (const summonId of result.killedSummonIds) {
        const summonSchema = this.state.units.get(summonId);
        if (summonSchema) {
          summonSchema.isAlive = false;
          summonSchema.currentHp = 0;
        }
      }
    }
  }

  /**
   * Executa ataque em obstáculo usando o executor centralizado
   */
  private performObstacleAttack(
    attacker: BattleUnitSchema,
    obstacle: BattleObstacleSchema
  ) {
    // Converter para BattleUnit e BattleObstacle
    const attackerUnit = this.schemaUnitToBattleUnit(attacker);
    const obstacleData = {
      id: obstacle.id,
      posX: obstacle.posX,
      posY: obstacle.posY,
      type: obstacle.type as import("../../../../../../shared/config").ObstacleType,
      hp: obstacle.hp,
      destroyed: obstacle.destroyed,
    };

    // Usar o executor para atacar o obstáculo
    const result = executeAttack(
      attackerUnit,
      null,
      [],
      { code: "ATTACK" } as any,
      "FISICO",
      obstacleData,
      this.state.battleId
    );

    if (!result.success) {
      console.error("[BattleRoom] performObstacleAttack falhou:", result.error);
      return;
    }

    // Sincronizar recursos de ataque consumidos pelo executor
    attacker.actionsLeft = attackerUnit.actionsLeft;
    attacker.attacksLeftThisTurn = attackerUnit.attacksLeftThisTurn;

    // Sincronizar condições do atacante
    attacker.conditions.clear();
    attackerUnit.conditions.forEach((c) => attacker.conditions.push(c));

    // Sincronizar obstáculo
    obstacle.hp = result.targetHpAfter ?? obstacle.hp;
    obstacle.destroyed = result.obstacleDestroyed ?? false;

    // Broadcast resultado
    this.broadcast("battle:obstacle_attacked", {
      attackerId: attacker.id,
      obstacleId: obstacle.id,
      damage: result.finalDamage,
      destroyed: obstacle.destroyed,
    });

    // Criar evento de ataque a obstáculo
    createAndEmitEvent({
      context: "BATTLE",
      scope: "GLOBAL",
      category: "COMBAT",
      severity: "INFO",
      battleId: this.roomId,
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

  /**
   * Converte todas as unidades para BattleUnit
   */
  private getAllUnitsAsBattleUnits(): BattleUnit[] {
    const units: BattleUnit[] = [];
    this.state.units.forEach((schema) => {
      units.push(this.schemaUnitToBattleUnit(schema));
    });
    return units;
  }

  // =========================================
  // Message Handler Implementations
  // =========================================

  private handleBeginAction(client: Client, unitId: string) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const unit = this.state.units.get(unitId);
    if (!unit) {
      client.send("error", { message: "Unidade não encontrada" });
      return;
    }

    if (unit.ownerId !== userData.userId) {
      client.send("error", { message: "Esta unidade não é sua" });
      return;
    }

    if (this.state.activeUnitId !== unitId) {
      client.send("error", { message: "Não é o turno desta unidade" });
      return;
    }

    unit.hasStartedAction = true;

    this.broadcast("battle:action_started", { unitId });
  }

  private handleMove(client: Client, unitId: string, toX: number, toY: number) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const unit = this.state.units.get(unitId);
    if (!unit) {
      client.send("error", { message: "Unidade não encontrada" });
      return;
    }

    if (unit.ownerId !== userData.userId) {
      client.send("error", { message: "Esta unidade não é sua" });
      return;
    }

    // Calcular distância
    const distance = Math.abs(toX - unit.posX) + Math.abs(toY - unit.posY);

    if (distance > unit.movesLeft) {
      client.send("error", { message: "Movimento insuficiente" });
      return;
    }

    if (!this.isValidPosition(toX, toY)) {
      client.send("error", { message: "Posição inválida" });
      return;
    }

    const fromX = unit.posX;
    const fromY = unit.posY;

    unit.posX = toX;
    unit.posY = toY;
    unit.movesLeft -= distance;

    this.broadcast("battle:unit_moved", {
      unitId,
      fromX,
      fromY,
      toX,
      toY,
      movesLeft: unit.movesLeft,
    });

    // Criar evento de movimento
    createAndEmitEvent({
      context: "BATTLE",
      scope: "GLOBAL",
      category: "COMBAT",
      severity: "INFO",
      battleId: this.roomId,
      sourceUserId: unit.ownerId,
      message: `${unit.name} se moveu de (${fromX}, ${fromY}) para (${toX}, ${toY})`,
      code: "UNIT_MOVED",
      data: {
        fromPosition: { x: fromX, y: fromY },
        toPosition: { x: toX, y: toY },
        distance,
        movesLeft: unit.movesLeft,
      },
      actorId: unit.id,
      actorName: unit.name,
    }).catch((err) =>
      console.error("[BattleRoom] Erro ao criar evento de movimento:", err)
    );
  }

  private handleAttack(
    client: Client,
    attackerId: string,
    targetId?: string,
    targetObstacleId?: string,
    targetPosition?: { x: number; y: number }
  ) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const attacker = this.state.units.get(attackerId);
    if (!attacker) {
      client.send("error", { message: "Atacante não encontrado" });
      return;
    }

    if (attacker.ownerId !== userData.userId) {
      client.send("error", { message: "Esta unidade não é sua" });
      return;
    }

    // Verificar se tem recursos para atacar (ação ou ataques extras)
    if (!this.canAttack(attacker)) {
      client.send("error", { message: "Sem ataques ou ações restantes" });
      return;
    }

    if (targetId) {
      const target = this.state.units.get(targetId);
      if (!target) {
        client.send("error", { message: "Alvo não encontrado" });
        return;
      }

      // Verificar alcance usando isWithinRange (considera 8 direções)
      if (
        !isWithinRange(
          attacker.posX,
          attacker.posY,
          target.posX,
          target.posY,
          1
        )
      ) {
        client.send("error", { message: "Alvo fora de alcance" });
        return;
      }

      // Iniciar QTE de ataque em vez de atacar diretamente
      this.startAttackQTE(client, attacker, target);
    } else if (targetObstacleId) {
      // Atacar obstáculo usando o executor
      const obstacle = this.state.obstacles.find(
        (o) => o.id === targetObstacleId
      );
      if (!obstacle) {
        client.send("error", { message: "Obstáculo não encontrado" });
        return;
      }

      // Verificar alcance usando isWithinRange (considera 8 direções)
      if (
        !isWithinRange(
          attacker.posX,
          attacker.posY,
          obstacle.posX,
          obstacle.posY,
          1
        )
      ) {
        client.send("error", { message: "Obstáculo fora de alcance" });
        return;
      }

      // Usar o executor para atacar o obstáculo
      this.performObstacleAttack(attacker, obstacle);
    } else if (targetPosition) {
      // Ataque direcional - verificar se há unidade ou obstáculo na posição
      // Attack range base é 1 (melee), considera 8 direções (diagonais)
      const baseAttackRange = 1;
      if (
        !isWithinRange(
          attacker.posX,
          attacker.posY,
          targetPosition.x,
          targetPosition.y,
          baseAttackRange
        )
      ) {
        client.send("error", { message: "Posição fora de alcance" });
        return;
      }

      // Verificar se há uma unidade na posição
      const unitAtPosition = Array.from(this.state.units.values()).find(
        (u) =>
          u.posX === targetPosition.x &&
          u.posY === targetPosition.y &&
          u.isAlive
      );

      if (unitAtPosition) {
        // Atacar a unidade encontrada
        this.handleAttack(client, attackerId, unitAtPosition.id);
        return;
      }

      // Verificar se há um obstáculo na posição
      const obstacleAtPosition = Array.from(this.state.obstacles.values()).find(
        (o) =>
          o.posX === targetPosition.x &&
          o.posY === targetPosition.y &&
          !o.destroyed
      );

      if (obstacleAtPosition) {
        // Atacar o obstáculo encontrado
        this.handleAttack(client, attackerId, undefined, obstacleAtPosition.id);
        return;
      }

      // Nenhum alvo na posição - ataque no ar (miss)
      // Consumir recurso de ataque
      this.consumeAttackResourceSimple(attacker);
      attacker.hasStartedAction = true;

      // Notificar que o ataque foi no ar (miss)
      this.broadcast("battle:attack_missed", {
        attackerId,
        targetPosition,
        message: "O ataque não atingiu nenhum alvo!",
        actionsLeft: attacker.actionsLeft,
        attacksLeftThisTurn: attacker.attacksLeftThisTurn,
      });

      // Criar evento de miss
      createAndEmitEvent({
        context: "BATTLE",
        scope: "GLOBAL",
        category: "COMBAT",
        severity: "INFO",
        battleId: this.roomId,
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
  }

  private handleEndAction(client: Client, unitId: string) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const unit = this.state.units.get(unitId);
    if (!unit || unit.ownerId !== userData.userId) {
      return;
    }

    if (this.state.activeUnitId !== unitId) {
      return;
    }

    this.advanceToNextUnit();
  }

  private handleExecuteAction(
    client: Client,
    actionName: string,
    unitId: string,
    params?: Record<string, unknown>
  ) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const unit = this.state.units.get(unitId);
    if (!unit || unit.ownerId !== userData.userId) {
      client.send("error", { message: "Ação inválida" });
      return;
    }

    // Handler unificado para abilities (use_ability)
    if (actionName === "use_ability") {
      const abilityCode = params?.abilityCode as string;
      if (!abilityCode) {
        client.send("error", { message: "abilityCode é obrigatório" });
        return;
      }

      // ATTACK usa o handler separado (tem QTE e ataque a obstáculos)
      if (abilityCode === "ATTACK") {
        this.handleAttack(
          client,
          unitId,
          params?.targetUnitId as string | undefined,
          undefined,
          params?.targetPosition as { x: number; y: number } | undefined
        );
        return;
      }

      // Buscar definição da ability
      const ability = findAbilityByCode(abilityCode);
      if (!ability) {
        client.send("error", {
          message: `Ability não encontrada: ${abilityCode}`,
        });
        return;
      }

      // Verificar se é o turno ativo da unidade
      if (this.state.activeUnitId !== unitId) {
        client.send("error", { message: "Não é o turno desta unidade" });
        return;
      }

      // Converter unidades do state para array de BattleUnit
      const allUnits: BattleUnit[] = Array.from(this.state.units.values()).map(
        (u) => this.schemaUnitToBattleUnit(u)
      );
      const casterUnit = this.schemaUnitToBattleUnit(unit);

      // Resolver alvo (targetUnitId ou targetPosition)
      let target: BattleUnit | { x: number; y: number } | null = null;

      if (params?.targetUnitId) {
        const targetSchema = this.state.units.get(
          params.targetUnitId as string
        );
        if (targetSchema) {
          target = this.schemaUnitToBattleUnit(targetSchema);
        }
      } else if (params?.targetPosition) {
        target = params.targetPosition as { x: number; y: number };
      }

      // Contexto de execução
      const obstacleArray = Array.from(this.state.obstacles).filter(
        (o): o is NonNullable<typeof o> => o != null
      );
      const context = {
        obstacles: obstacleArray.map((o) => ({
          x: o.posX,
          y: o.posY,
          type: o.type || "default",
        })),
        gridWidth: this.state.gridWidth,
        gridHeight: this.state.gridHeight,
        targetPosition: params?.targetPosition as
          | { x: number; y: number }
          | undefined,
      };

      // Executar a ability via sistema unificado
      const result = executeSkill(
        casterUnit,
        abilityCode,
        target as BattleUnit | null,
        allUnits,
        true, // isBattle = true (cooldowns dobrados)
        context
      );

      if (!result.success) {
        client.send("error", {
          message: result.error || "Falha ao executar ability",
        });
        return;
      }

      // Sincronizar mudanças de volta para o schema
      this.syncUnitFromResult(unit, casterUnit, result);

      // Se houve alvo e mudanças nele, sincronizar também
      if (target && "id" in target && result.targetHpAfter !== undefined) {
        const targetSchema = this.state.units.get(target.id);
        if (targetSchema) {
          const targetUnit = allUnits.find((u) => u.id === target.id);
          if (targetUnit) {
            this.syncUnitFromResult(targetSchema, targetUnit, result);
          }
        }
      }

      // Broadcast de sucesso
      this.broadcast("battle:skill_used", {
        casterUnitId: unitId,
        skillCode: abilityCode,
        targetUnitId: params?.targetUnitId,
        targetPosition: params?.targetPosition,
        result,
      });

      // Criar evento de log
      createAndEmitEvent({
        context: "BATTLE",
        scope: "GLOBAL",
        category: "SKILL",
        severity: "INFO",
        battleId: this.roomId,
        sourceUserId: unit.ownerId,
        message: `${unit.name} usou ${ability.name}`,
        code: "ABILITY_USED",
        actorId: unitId,
        actorName: unit.name,
        targetId: params?.targetUnitId as string | undefined,
        targetName: params?.targetUnitId
          ? this.state.units.get(params.targetUnitId as string)?.name
          : undefined,
      }).catch((err) =>
        console.error("[BattleRoom] Erro ao criar evento de ability:", err)
      );

      return;
    }

    // Fallback para outras ações não reconhecidas
    client.send("error", { message: `Ação desconhecida: ${actionName}` });
  }

  /**
   * Sincroniza mudanças do resultado da execução de volta para o schema Colyseus
   */
  private syncUnitFromResult(
    schema: BattleUnitSchema,
    unit: BattleUnit,
    result: {
      casterActionsLeft?: number;
      targetHpAfter?: number;
      targetDefeated?: boolean;
    }
  ) {
    // Sincronizar ações restantes
    if (result.casterActionsLeft !== undefined) {
      schema.actionsLeft = result.casterActionsLeft;
    }

    // Sincronizar HP
    schema.currentHp = unit.currentHp;
    schema.currentMana = unit.currentMana;

    // Sincronizar cooldowns
    if (unit.unitCooldowns) {
      for (const [code, value] of Object.entries(unit.unitCooldowns)) {
        schema.unitCooldowns.set(code, value);
      }
    }

    // Sincronizar condições
    schema.conditions.clear();
    for (const cond of unit.conditions) {
      schema.conditions.push(cond);
    }

    // Verificar morte
    if (unit.currentHp <= 0 && schema.isAlive) {
      schema.isAlive = false;
      processUnitDeath(
        unit,
        Array.from(this.state.units.values()).map((u) =>
          this.schemaUnitToBattleUnit(u)
        )
      );
    }
  }

  /**
   * Handler para comandos de batalha (ex: /spawn, /godmode)
   */
  private handleBattleCommand(
    client: Client,
    payload: CommandPayload,
    userId: string
  ) {
    const { commandCode, args, selectedUnitId } = payload;

    // Verificar se a batalha está ativa
    if (this.state.status !== "ACTIVE") {
      client.send("battle:command:response", {
        commandCode,
        result: {
          success: false,
          message: "Comandos só podem ser executados durante uma batalha ativa",
        },
      });
      return;
    }

    // Buscar unidade selecionada se fornecida
    let selectedUnit = null;
    if (selectedUnitId) {
      selectedUnit = this.state.units.get(selectedUnitId) || null;
    }

    // Criar contexto de execução
    const context = {
      battleState: this.state,
      userId,
      selectedUnit,
      gridWidth: this.state.gridWidth,
      gridHeight: this.state.gridHeight,
    };

    // Executar comando
    const result = handleCommand(payload, context);

    // Enviar resposta ao cliente
    client.send("battle:command:response", {
      commandCode,
      result,
    });

    // Se sucesso, fazer broadcast de feedback para todos
    if (result.success) {
      this.broadcast("battle:command:executed", {
        commandCode,
        userId,
        message: result.message,
      });
    }
  }

  private handleSurrender(userId: string) {
    const player = this.state.getPlayer(userId);
    if (!player || player.surrendered) return;

    player.surrendered = true;

    // Matar todas as unidades do jogador
    this.state.units.forEach((unit) => {
      if (unit.ownerId === userId) {
        unit.isAlive = false;
        unit.currentHp = 0;
      }
    });

    this.broadcast("battle:player_surrendered", { userId });

    this.checkBattleEnd();
  }

  private handleRematchRequest(userId: string) {
    if (this.state.status !== "ENDED") return;

    this.rematchRequests.add(userId);
    this.state.rematchRequests.push(userId);

    this.broadcast("battle:rematch_requested", { userId });

    // Se todos pediram rematch, criar nova batalha
    const alivePlayers = this.state.players.filter((p) => !p.surrendered);
    if (
      this.rematchRequests.size >= alivePlayers.length &&
      alivePlayers.length >= 2
    ) {
      this.broadcast("battle:rematch_starting", {});
      // Reset e reiniciar
      this.resetForRematch();
    }
  }

  private resetForRematch() {
    // Limpar estado
    this.state.units.clear();
    this.state.obstacles.clear();
    this.state.actionOrder.clear();
    this.state.logs.clear();
    this.state.rematchRequests.clear();
    this.rematchRequests.clear();

    // Resetar jogadores
    this.state.players.forEach((p) => {
      p.surrendered = false;
    });

    // Resetar estado da batalha
    this.state.status = "ACTIVE";
    this.state.round = 1;
    this.state.currentTurnIndex = 0;
    this.state.activeUnitId = "";
    this.state.winnerId = "";
    this.state.winReason = "";

    // Reiniciar batalha
    this.startBattle();
  }

  private checkBattleEnd() {
    // Contar jogadores com unidades vivas
    const playersAlive: string[] = [];

    this.state.players.forEach((player) => {
      if (player.surrendered) return;

      if (this.state.playerHasAliveUnits(player.oderId)) {
        playersAlive.push(player.oderId);
      }
    });

    // Se só resta um jogador, ele vence
    if (playersAlive.length <= 1) {
      this.state.status = "ENDED";

      if (playersAlive.length === 1) {
        this.state.winnerId = playersAlive[0];
        this.state.winReason = "Todas as unidades inimigas foram derrotadas";
      } else {
        this.state.winReason = "Empate - todos foram derrotados";
      }

      // Parar timer
      if (this.turnTimer) {
        this.turnTimer.clear();
      }

      // Marcar batalha como terminada no banco (se foi persistida antes)
      markBattleEnded(
        this.roomId,
        this.state.winnerId || undefined,
        this.state.winReason || undefined
      ).catch((err) =>
        console.error("[BattleRoom] Erro ao marcar batalha como ENDED:", err)
      );

      this.broadcast("battle:ended", {
        winnerId: this.state.winnerId,
        winReason: this.state.winReason,
      });
    }
  }

  // =========================================
  // Helper Methods
  // =========================================

  private async addBotPlayer() {
    console.log(`[BattleRoom] addBotPlayer() chamado`);
    const botPlayer = new BattlePlayerSchema();
    botPlayer.oderId = `bot_${Date.now()}`;
    botPlayer.kingdomId = `bot_kingdom_${Date.now()}`;
    botPlayer.kingdomName = "Reino do Bot";
    botPlayer.username = "Bot";
    botPlayer.playerIndex = this.state.players.length;
    botPlayer.playerColor =
      PLAYER_COLORS[botPlayer.playerIndex % PLAYER_COLORS.length];
    botPlayer.isConnected = true;
    botPlayer.isBot = true;

    this.state.players.push(botPlayer);
  }

  private getPlayersInfo() {
    return this.state.players.map((p) => ({
      oderId: p.oderId,
      username: p.username,
      kingdomName: p.kingdomName,
      playerIndex: p.playerIndex,
      playerColor: p.playerColor,
      isBot: p.isBot,
    }));
  }

  private serializeConfig() {
    return {
      map: {
        terrainType: this.state.config.map.terrainType,
        territorySize: this.state.config.map.territorySize,
        obstacles: Array.from(this.state.obstacles)
          .filter((o): o is NonNullable<typeof o> => o !== undefined)
          .map((o) => ({
            id: o.id,
            posX: o.posX,
            posY: o.posY,
            emoji: o.emoji,
            hp: o.hp,
            maxHp: o.maxHp,
          })),
      },
      weather: this.state.config.weather,
      timeOfDay: this.state.config.timeOfDay,
    };
  }

  // =========================================
  // QTE (Quick Time Event) System
  // =========================================

  /**
   * Inicializa o gerenciador de QTE para esta batalha
   * Usa this.clock.currentTime como fonte de verdade para sincronização
   */
  private initializeQTEManager() {
    // Funções de callback para o QTE Manager
    const broadcastFn = (event: string, data: unknown) => {
      this.broadcast(event, data);
    };

    const sendToClientFn = (userId: string, event: string, data: unknown) => {
      this.clients.forEach((client) => {
        const userData = client.userData as { userId: string } | undefined;
        if (userData?.userId === userId) {
          client.send(event, data);
        }
      });
    };

    // Função para obter o tempo do servidor (clock do Colyseus)
    const getServerTime = () => this.clock.currentTime;

    this.qteManager = new QTEManager(
      broadcastFn,
      sendToClientFn,
      getServerTime
    );

    // Atualizar estado inicial
    this.updateQTEManagerUnits();
  }

  /**
   * Converte um BattleUnitSchema para BattleUnit (tipos simples)
   */
  private schemaUnitToBattleUnit(schema: BattleUnitSchema): BattleUnit {
    return {
      id: schema.id,
      sourceUnitId: schema.sourceUnitId,
      ownerId: schema.ownerId,
      ownerKingdomId: schema.ownerKingdomId,
      name: schema.name,
      avatar: schema.avatar,
      category: schema.category,
      troopSlot: schema.troopSlot,
      level: schema.level,
      race: schema.race,
      classCode: schema.classCode,
      features: Array.from(schema.features).filter(
        (f): f is string => f !== undefined
      ),
      equipment: Array.from(schema.equipment).filter(
        (e): e is string => e !== undefined
      ),
      combat: schema.combat,
      speed: schema.speed,
      focus: schema.focus,
      resistance: schema.resistance,
      will: schema.will,
      vitality: schema.vitality,
      damageReduction: schema.damageReduction,
      currentHp: schema.currentHp,
      maxHp: schema.maxHp,
      currentMana: schema.currentMana,
      maxMana: schema.maxMana,
      posX: schema.posX,
      posY: schema.posY,
      movesLeft: schema.movesLeft,
      actionsLeft: schema.actionsLeft,
      attacksLeftThisTurn: schema.attacksLeftThisTurn,
      isAlive: schema.isAlive,
      actionMarks: schema.actionMarks,
      physicalProtection: schema.physicalProtection,
      maxPhysicalProtection: schema.maxPhysicalProtection,
      magicalProtection: schema.magicalProtection,
      maxMagicalProtection: schema.maxMagicalProtection,
      conditions: Array.from(schema.conditions).filter(
        (c): c is string => c !== undefined
      ),
      spells: Array.from(schema.spells).filter(
        (s): s is string => s !== undefined
      ),
      hasStartedAction: schema.hasStartedAction,
      grabbedByUnitId: schema.grabbedByUnitId || undefined,
      size: schema.size as BattleUnit["size"],
      visionRange: schema.visionRange,
      unitCooldowns: Object.fromEntries(schema.unitCooldowns.entries()),
      isAIControlled: schema.isAIControlled,
      aiBehavior: schema.aiBehavior as BattleUnit["aiBehavior"],
    };
  }

  /**
   * Inicia um QTE de ataque
   * REFATORADO: Usa prepareAttackContext do executor
   */
  private startAttackQTE(
    client: Client,
    attacker: BattleUnitSchema,
    target: BattleUnitSchema
  ) {
    // Converter para BattleUnit
    const attackerUnit = this.schemaUnitToBattleUnit(attacker);
    const targetUnit = this.schemaUnitToBattleUnit(target);

    // Usar executor para preparar contexto de ataque
    const attackContext = prepareAttackContext(attackerUnit);

    if (!attackContext.canAttack) {
      client.send("error", { message: attackContext.blockReason });
      return;
    }

    if (!this.qteManager) {
      // Fallback: se QTE não está disponível, atacar diretamente
      console.warn(
        "[BattleRoom] QTE Manager não inicializado, atacando diretamente"
      );
      this.executeAttackAndBroadcast(attacker, target, {
        dodged: false,
        attackerDamageModifier: 1.0,
        defenderDamageModifier: 1.0,
      });
      return;
    }

    // Atualizar unidades no QTE Manager
    this.updateQTEManagerUnits();

    // Iniciar o fluxo de QTE com callback de conclusão
    this.qteManager.initiateAttack(
      attackerUnit,
      targetUnit,
      this.state.battleId,
      attackContext.baseDamage,
      attackContext.isMagicAttack,
      (result) => {
        // Callback quando o QTE completa
        this.handleQTECombatComplete(attacker.id, target.id, result);
      }
    );
  }

  /**
   * Callback chamado quando um combate QTE completa
   * REFATORADO: Delega toda lógica para executeAttackFromQTEResult
   */
  private handleQTECombatComplete(
    attackerId: string,
    targetId: string,
    result: import("../../../../qte").QTECombatResult
  ) {
    const attacker = this.state.units.get(attackerId);
    const target = this.state.units.get(targetId);

    if (!attacker || !target) return;

    // Converter resultado do QTE para o formato do executor
    const qteResult: QTEResultForExecutor = {
      dodged: result.dodged,
      attackerDamageModifier: result.attackerDamageModifier,
      defenderDamageModifier: result.defenderDamageModifier,
      newDefenderPosition: result.newDefenderPosition,
      defenderGrade: result.defenderQTE?.grade,
    };

    // Executar ataque e broadcast
    this.executeAttackAndBroadcast(attacker, target, qteResult, {
      attackerQTE: result.attackerQTE,
      defenderQTE: result.defenderQTE,
    });
  }

  /**
   * Executa ataque usando o executor e faz broadcast dos resultados
   * Método unificado para atacar com ou sem QTE
   */
  private executeAttackAndBroadcast(
    attacker: BattleUnitSchema,
    target: BattleUnitSchema,
    qteResult: QTEResultForExecutor,
    qteData?: { attackerQTE?: unknown; defenderQTE?: unknown }
  ) {
    // Converter schemas para BattleUnits
    const allUnits = this.getAllUnitsAsBattleUnits();
    const attackerUnit = allUnits.find((u) => u.id === attacker.id);
    const targetUnit = allUnits.find((u) => u.id === target.id);

    if (!attackerUnit || !targetUnit) {
      console.error(
        "[BattleRoom] executeAttackAndBroadcast: Unidade não encontrada"
      );
      return;
    }

    // Executar ataque usando o executor centralizado
    const result = executeAttackFromQTEResult(
      attackerUnit,
      targetUnit,
      allUnits,
      qteResult,
      this.state.battleId
    );

    if (!result.success) {
      console.error(
        "[BattleRoom] executeAttackAndBroadcast falhou:",
        result.error
      );
      return;
    }

    // Sincronizar mudanças de volta para os schemas
    this.syncAttackResultToSchemas(
      attacker,
      target,
      attackerUnit,
      targetUnit,
      allUnits,
      result
    );

    // Broadcast apropriado baseado no resultado
    if (result.dodged) {
      // Esquiva - broadcast específico
      if (result.newDefenderPosition) {
        this.broadcast("battle:unit_dodged", {
          unitId: target.id,
          fromX: target.posX,
          fromY: target.posY,
          toX: result.newDefenderPosition.x,
          toY: result.newDefenderPosition.y,
        });
        // Sincronizar posição no schema
        target.posX = result.newDefenderPosition.x;
        target.posY = result.newDefenderPosition.y;
      }

      if (result.perfectDodgeBuff) {
        this.broadcast("battle:condition_applied", {
          unitId: target.id,
          conditionId: result.perfectDodgeBuff,
        });
      }

      this.broadcast("battle:attack_dodged", {
        attackerId: attacker.id,
        targetId: target.id,
        attackerQTE: qteData?.attackerQTE,
        defenderQTE: qteData?.defenderQTE,
      });

      // Criar evento de esquiva
      const perfeitaMsg = result.perfectDodgeBuff
        ? " com esquiva PERFEITA!"
        : "";
      createAndEmitEvent({
        context: "BATTLE",
        scope: "GLOBAL",
        category: "COMBAT",
        severity: "INFO",
        battleId: this.roomId,
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
    } else {
      // Ataque acertou - broadcast de dano
      this.broadcast("battle:unit_attacked", {
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

      // Criar evento de ataque
      const damageMsg = result.damageTransferredToEidolon
        ? `(transferido para Eidolon)`
        : `causando ${result.finalDamage} de dano`;
      createAndEmitEvent({
        context: "BATTLE",
        scope: "GLOBAL",
        category: "COMBAT",
        severity: "WARNING",
        battleId: this.roomId,
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
        this.checkBattleEnd();
      }
    }
  }

  /**
   * Processa a resposta de um QTE
   */
  private handleQTEResponse(client: Client, response: QTEResponse) {
    if (!this.qteManager) {
      client.send("error", { message: "QTE não está ativo" });
      return;
    }

    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    // Verificar se o jogador é o dono da unidade que deve responder
    const unit = this.state.units.get(response.unitId);
    if (!unit || unit.ownerId !== userData.userId) {
      client.send("error", { message: "Não é sua vez de responder ao QTE" });
      return;
    }

    // Processar a resposta
    this.qteManager.processResponse(response);
  }

  /**
   * Atualiza as unidades no QTE Manager com o estado atual
   */
  private updateQTEManagerUnits() {
    if (!this.qteManager) return;

    const units: BattleUnit[] = [];
    this.state.units.forEach((schemaUnit) => {
      units.push(this.schemaUnitToBattleUnit(schemaUnit));
    });

    const obstacles = Array.from(this.state.obstacles)
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

    this.qteManager.updateBattleState(
      units,
      obstacles as any,
      this.state.gridWidth,
      this.state.gridHeight
    );
  }
}

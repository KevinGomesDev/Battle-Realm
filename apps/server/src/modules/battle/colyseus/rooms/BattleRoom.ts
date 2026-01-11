// BattleRoom.ts - Room principal para Battle (Lobby + Battle)
// Versão modularizada - delega lógica para handlers em ./battle/

import { Room, Client } from "@colyseus/core";
import {
  BattleSessionState,
  BattlePlayerSchema,
  BattleUnitSchema,
} from "../schemas";
import {
  createAndEmitEvent,
  getBattleEventsFromCache,
  registerBattleBroadcast,
  unregisterBattleBroadcast,
} from "../../../match/services/event.service";
import { markBattleEnded } from "../../../match/services/battle-persistence.service";
import { persistBattle } from "../../../../workers";
import type { CommandPayload } from "@boundless/shared/types/commands.types";

// Importar handlers modulares
import {
  // Types
  type BattleRoomOptions,
  type JoinOptions,
  type UserData,
  type DisconnectedPlayer,
  PLAYER_COLORS,
  getUserData,

  // Utils
  isValidPosition,
  schemaUnitToBattleUnit,
  getAllUnitsAsBattleUnits,

  // Persistence
  restoreFromDatabase,

  // Units
  createBattleUnits,

  // Turn
  calculateActionOrder,
  advanceToNextUnit,
  processRoundEnd,

  // Battle Timer
  BattleTimerManager,

  // AI
  executeAITurn,

  // Movement
  handleMove,

  // Action
  handleBeginAction,
  handleEndAction,
  handleAbility,
  handleBattleCommand,

  // Surrender
  handleSurrender,
  handleRematchRequest,
  resetForRematch,

  // Lobby
  handleLobbyReady,
  handleLobbyStart,
  handleJoin,
  handleLobbyLeave,

  // Setup
  startBattle,
} from "./battle";

export class BattleRoom extends Room<BattleSessionState> {
  maxClients = 8;

  // Estado interno
  private battleTimerManager: BattleTimerManager | null = null;
  private lobbyPhase: boolean = true;
  private readyPlayers = new Set<string>();
  private disconnectedPlayers = new Map<string, DisconnectedPlayer>();
  private rematchRequests = new Set<string>();
  private restoredFromDb = false;
  private fromArena: boolean = false;

  // =========================================
  // Lifecycle
  // =========================================

  async onCreate(options: BattleRoomOptions) {
    this.autoDispose = true;

    // Registrar broadcast para eventos desta batalha
    registerBattleBroadcast(this.roomId, (event: string, data: any) =>
      this.broadcast(event, data)
    );

    // Restauração de batalha
    if (options.restoreBattleId) {
      this.setState(new BattleSessionState());
      const restored = await restoreFromDatabase(
        options.restoreBattleId,
        this.state,
        (meta) => this.setMetadata(meta)
      );
      if (restored) {
        this.restoredFromDb = true;
        this.lobbyPhase = false;
        this.registerMessageHandlers();

        // Iniciar timer após restauração se houver unidade ativa
        if (this.state.activeUnitId && this.state.status === "ACTIVE") {
          this.startTurnTimerInternal();
        }
        return;
      }
      console.warn(`[BattleRoom] Falha ao restaurar, criando nova`);
    }

    // Salvar flag fromArena
    this.fromArena = options.fromArena || false;

    // Inicializar estado
    this.setState(new BattleSessionState());
    this.state.battleId = this.roomId;
    this.state.lobbyId = this.roomId;
    this.state.status = "WAITING";
    this.state.maxPlayers = Math.min(8, Math.max(2, options.maxPlayers || 2));

    this.setMetadata({
      hostUserId: options.userId,
      maxPlayers: this.state.maxPlayers,
      playerCount: 0,
      players: [] as string[],
      playerKingdoms: {} as Record<string, string>,
      status: "WAITING",
    });

    this.registerMessageHandlers();
  }

  async onJoin(client: Client, options: JoinOptions) {
    await handleJoin(
      client,
      options,
      this.state,
      this.roomId,
      this.metadata,
      () => this.lobbyPhase,
      this.disconnectedPlayers,
      this.broadcast.bind(this),
      this.setMetadata.bind(this),
      () => {}, // cancelPersistence não é mais necessário (worker cuida disso)
      () => this.startBattleInternal(),
      this.fromArena
    );
  }

  async onLeave(client: Client, consented: boolean) {
    const userData = getUserData(client);
    if (!userData) return;

    const { userId } = userData;

    if (this.lobbyPhase) {
      handleLobbyLeave(
        userId,
        this.state,
        this.metadata,
        this.broadcast.bind(this),
        this.setMetadata.bind(this)
      );
      return;
    }

    if (this.state.status === "ENDED" || this.state.winnerId) {
      return;
    }

    const player = this.state.getPlayer(userId);
    if (player) {
      player.isConnected = false;

      if (!consented) {
        try {
          await this.allowReconnection(client, 60);
          player.isConnected = true;
        } catch {
          // Verificar se o jogador já reconectou via outro client antes de render
          const currentPlayer = this.state.getPlayer(userId);
          if (currentPlayer && !currentPlayer.isConnected) {
            handleSurrender(userId, this.state, this.broadcast.bind(this), () =>
              this.forceCheckBattleEndInternal()
            );
          } else {
          }
        }
      } else {
        handleSurrender(userId, this.state, this.broadcast.bind(this), () =>
          this.forceCheckBattleEndInternal()
        );
      }
    }
    // Persistência é tratada pelo worker centralizado
  }

  async onDispose() {
    // Remover registro do broadcast de eventos
    unregisterBattleBroadcast(this.roomId);

    if (this.battleTimerManager) {
      this.battleTimerManager.stop();
      this.battleTimerManager = null;
    }

    // Persistir batalha ativa antes de destruir a sala
    if (
      this.state.status === "ACTIVE" &&
      !this.state.winnerId &&
      this.state.units.size > 0
    ) {
      try {
        await persistBattle(this.roomId, this.state);
      } catch (error) {
        console.error(
          `[BattleRoom] Erro ao persistir batalha no onDispose:`,
          error
        );
      }
    }
  }

  // =========================================
  // Message Handlers
  // =========================================

  private registerMessageHandlers() {
    // Lobby
    this.onMessage("lobby:ready", (client) => {
      handleLobbyReady(
        client,
        this.state,
        this.readyPlayers,
        this.broadcast.bind(this),
        () => this.startBattleInternal()
      );
    });

    this.onMessage("lobby:start", async (client) => {
      await handleLobbyStart(client, this.state, () =>
        this.startBattleInternal()
      );
    });

    // Battle actions
    this.onMessage("battle:begin_action", (client, { unitId }) => {
      handleBeginAction(client, unitId, this.state, this.broadcast.bind(this));
    });

    this.onMessage("battle:move", (client, { unitId, toX, toY }) => {
      handleMove(
        client,
        unitId,
        toX,
        toY,
        this.state,
        this.roomId,
        this.broadcast.bind(this)
      );
    });

    this.onMessage("battle:end_action", (client, { unitId }) => {
      handleEndAction(client, unitId, this.state, () =>
        this.advanceToNextUnitInternal()
      );
    });

    // PONTO ÚNICO: Todas as abilities passam por aqui
    this.onMessage(
      "battle:use_ability",
      (client, { unitId, abilityCode, targetPosition, targetUnitId }) => {
        handleAbility(
          client,
          unitId,
          abilityCode,
          this.state,
          this.roomId,
          this.broadcast.bind(this),
          targetPosition,
          targetUnitId
        );
      }
    );

    // Surrender/Rematch
    this.onMessage("battle:surrender", (client) => {
      const userData = getUserData(client);
      if (!userData) return;
      handleSurrender(
        userData.userId,
        this.state,
        this.broadcast.bind(this),
        () => this.forceCheckBattleEndInternal()
      );
    });

    this.onMessage("battle:request_rematch", (client) => {
      const userData = getUserData(client);
      if (!userData) return;
      handleRematchRequest(
        userData.userId,
        this.state,
        this.rematchRequests,
        this.broadcast.bind(this),
        () => this.resetForRematchInternal()
      );
    });

    // Events
    this.onMessage("event:subscribe", (client, { context, contextId }) => {
      // Buscar eventos do cache (GameEvent[]) em vez dos logs do schema
      const battleId = contextId || this.state.battleId;
      const events = getBattleEventsFromCache(battleId);

      client.send("event:subscribed", {
        success: true,
        context,
        contextId: battleId,
        events,
      });
    });

    this.onMessage("event:unsubscribe", () => {});

    // Hotbar update - Salva a configuração de hotbar de uma unidade
    this.onMessage(
      "battle:update_hotbar",
      async (client, { unitId, hotbar }) => {
        const userData = getUserData(client);
        if (!userData) return;

        // Verificar se a unidade pertence ao jogador
        const unit = this.state.units.get(unitId);
        if (!unit || unit.ownerId !== userData.userId) {
          console.warn(
            `[BattleRoom] Tentativa de atualizar hotbar de unidade alheia: ${unitId}`
          );
          return;
        }

        // Atualizar hotbar no schema
        unit.hotbar = JSON.stringify(hotbar);

        // Persistir no banco se tiver sourceUnitId (unidade original)
        if (unit.sourceUnitId) {
          try {
            const { prisma } = await import("../../../../lib/prisma");
            await prisma.unit.update({
              where: { id: unit.sourceUnitId },
              data: { hotbar: JSON.stringify(hotbar) },
            });
          } catch (err) {
            console.error(`[BattleRoom] Erro ao persistir hotbar: ${err}`);
          }
        }
      }
    );

    // Commands
    this.onMessage("battle:command", (client, payload: CommandPayload) => {
      const userData = getUserData(client);
      if (!userData) {
        client.send("battle:command:response", {
          commandCode: payload.commandCode,
          result: { success: false, message: "Usuário não autenticado" },
        });
        return;
      }
      handleBattleCommand(
        client,
        payload,
        userData.userId,
        this.state,
        this.broadcast.bind(this)
      );
    });
  }

  // =========================================
  // Internal Methods (delegam para handlers)
  // =========================================

  private async startBattleInternal(): Promise<void> {
    await startBattle(
      this.state,
      this.roomId,
      this.metadata,
      this.broadcast.bind(this),
      this.setMetadata.bind(this),
      (v) => {
        this.lobbyPhase = v;
      },
      () => this.createBattleUnitsInternal(),
      () => this.calculateActionOrderInternal(),
      () => this.startTurnTimerInternal()
    );
    // Persistência é tratada pelo worker centralizado
  }

  private async createBattleUnitsInternal(): Promise<void> {
    await createBattleUnits(this.state);
  }

  private calculateActionOrderInternal(): void {
    calculateActionOrder(this.state, (unit) =>
      this.executeAITurnInternal(unit)
    );
  }

  private startTurnTimerInternal(): void {
    // Criar o manager do timer se ainda não existe
    if (!this.battleTimerManager) {
      this.battleTimerManager = new BattleTimerManager({
        state: this.state,
        roomId: this.roomId,
        clock: this.clock,
        broadcast: this.broadcast.bind(this),
        onTimeExpired: () => this.advanceToNextUnitInternal(),
        onBattleEnd: (winnerId, reason) => {
          markBattleEnded(this.roomId, winnerId, reason).catch((err) =>
            console.error(
              "[BattleRoom] Erro ao marcar batalha como ENDED:",
              err
            )
          );
        },
      });
    }
    // Iniciar o timer
    this.battleTimerManager.start();
  }

  private advanceToNextUnitInternal(): void {
    advanceToNextUnit(
      this.state,
      this.broadcast.bind(this),
      () => processRoundEnd(this.state, this.broadcast.bind(this)),
      (unit) => this.executeAITurnInternal(unit),
      () => this.forceCheckBattleEndInternal()
    );
  }

  /**
   * Força uma verificação imediata de fim de batalha
   * Usado após ações que podem causar morte (ex: quando não há mais unidades vivas na actionOrder)
   */
  private forceCheckBattleEndInternal(): void {
    if (this.battleTimerManager) {
      this.battleTimerManager.forceCheckBattleEnd();
    }
  }

  private executeAITurnInternal(unit: BattleUnitSchema): void {
    executeAITurn(
      this.state,
      unit,
      this.broadcast.bind(this),
      (x, y) => isValidPosition(this.state, x, y),
      () => this.advanceToNextUnitInternal(),
      this.roomId
    );
  }

  private resetForRematchInternal(): void {
    resetForRematch(this.state, this.rematchRequests, () =>
      this.startBattleInternal()
    );
  }
}

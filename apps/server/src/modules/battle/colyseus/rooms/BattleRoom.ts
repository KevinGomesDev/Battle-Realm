// BattleRoom.ts - Room principal para Battle (Lobby + Battle)
// Versão modularizada - delega lógica para handlers em ./battle/

import { Room, Client } from "@colyseus/core";
import {
  BattleSessionState,
  BattlePlayerSchema,
  BattleUnitSchema,
} from "../schemas";
import { QTEManager, type QTECombatResult } from "../../../../qte";
import {
  createAndEmitEvent,
  setEventEmitter,
} from "../../../match/services/event.service";
import { markBattleEnded } from "../../../match/services/battle-persistence.service";
import { persistBattle } from "../../../../workers";
import type { QTEResponse } from "@boundless/shared/qte";
import type { CommandPayload } from "@boundless/shared/types/commands.types";
import type { QTEResultForExecutor } from "../../../abilities/executors/types";

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

  // QTE
  initializeQTEManager,
  updateQTEManagerUnits,
  startAttackQTE,
  handleQTEResponse,
  executeAttackAndBroadcast,

  // Movement
  handleMove,

  // Action
  handleBeginAction,
  handleEndAction,
  handleExecuteAction,
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

// Configurar o callback de emissão de eventos uma vez
let eventEmitterConfigured = false;
function configureEventEmitter(
  broadcastFn: (event: string, data: any) => void
) {
  if (eventEmitterConfigured) return;

  setEventEmitter((event) => {
    broadcastFn("event:new", event);
  });

  eventEmitterConfigured = true;
  console.log("[BattleRoom] Event emitter configurado");
}

export class BattleRoom extends Room<BattleSessionState> {
  maxClients = 8;

  // Estado interno
  private battleTimerManager: BattleTimerManager | null = null;
  private lobbyPhase: boolean = true;
  private readyPlayers = new Set<string>();
  private disconnectedPlayers = new Map<string, DisconnectedPlayer>();
  private rematchRequests = new Set<string>();
  private restoredFromDb = false;
  private qteManager: QTEManager | null = null;
  private fromArena: boolean = false;

  // =========================================
  // Lifecycle
  // =========================================

  async onCreate(options: BattleRoomOptions) {
    this.autoDispose = true;
    console.log(`[BattleRoom] Criando sala: ${this.roomId}`);
    console.log(
      `[BattleRoom] Options recebidas:`,
      JSON.stringify(options, null, 2)
    );

    configureEventEmitter((event: string, data: any) =>
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
        console.log(
          `[BattleRoom] Batalha ${options.restoreBattleId} restaurada`
        );
        this.restoredFromDb = true;
        this.lobbyPhase = false;
        this.registerMessageHandlers();

        // Inicializar QTE Manager após restauração
        this.initQTEInternal();
        console.log(`[BattleRoom] QTE Manager inicializado após restauração`);

        // Iniciar timer após restauração se houver unidade ativa
        if (this.state.activeUnitId && this.state.status === "ACTIVE") {
          console.log(
            `[BattleRoom] Iniciando timer após restauração. activeUnitId=${this.state.activeUnitId}, turnTimer=${this.state.turnTimer}`
          );
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

    console.log(`[BattleRoom] Estado inicializado em onCreate:`, {
      battleId: this.state.battleId,
      status: this.state.status,
      maxPlayers: this.state.maxPlayers,
      gridWidth: this.state.gridWidth,
      gridHeight: this.state.gridHeight,
    });

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
    console.log(`[BattleRoom] ${userId} saiu (consented: ${consented})`);

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
      console.log(`[BattleRoom] ${userId} saiu após fim - ignorando`);
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
            console.log(
              `[BattleRoom] ${userId} não reconectou a tempo, rendição automática`
            );
            handleSurrender(userId, this.state, this.broadcast.bind(this), () =>
              this.forceCheckBattleEndInternal()
            );
          } else {
            console.log(
              `[BattleRoom] ${userId} já reconectou via novo client, ignorando timeout`
            );
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
    console.log(`[BattleRoom] Sala ${this.roomId} sendo destruída`);

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
        console.log(
          `[BattleRoom] Batalha ${this.roomId} persistida no onDispose`
        );
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

    // FLUXO UNIFICADO: Todas as abilities (incluindo ATTACK) passam por aqui
    this.onMessage(
      "battle:execute_action",
      (client, { actionName, unitId, params }) => {
        handleExecuteAction(
          client,
          actionName,
          unitId,
          this.state,
          this.roomId,
          this.broadcast.bind(this),
          (c, attackerId, targetId) => {
            // Callback para iniciar QTE quando ATTACK retornar requiresQTE: true
            const attacker = this.state.units.get(attackerId);
            const target = this.state.units.get(targetId);
            if (attacker && target) {
              this.startAttackQTEInternal(c, attacker, target);
            }
          },
          this.qteManager,
          params
        );
      }
    );

    // QTE
    this.onMessage("qte:response", (client, response: QTEResponse) => {
      handleQTEResponse(client, response, this.state, this.qteManager);
    });

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
      client.send("event:subscribed", {
        context,
        contextId,
        events: Array.from(this.state.logs || []),
      });
    });

    this.onMessage("event:unsubscribe", () => {});

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
      () => this.initQTEInternal(),
      () => this.calculateActionOrderInternal(),
      () => this.startTurnTimerInternal()
    );
    // Persistência é tratada pelo worker centralizado
  }

  private async createBattleUnitsInternal(): Promise<void> {
    await createBattleUnits(this.state);
  }

  private initQTEInternal(): void {
    this.qteManager = initializeQTEManager(
      this.state,
      this.broadcast.bind(this),
      this.clients,
      this.clock
    );
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
      (attacker, target, qteResult) =>
        this.executeAttackInternal(attacker, target, qteResult),
      () => this.advanceToNextUnitInternal()
    );
  }

  private startAttackQTEInternal(
    client: Client,
    attacker: BattleUnitSchema,
    target: BattleUnitSchema
  ): void {
    startAttackQTE(
      client,
      attacker,
      target,
      this.state,
      this.qteManager,
      (attackerId, targetId, result) =>
        this.handleQTEComplete(attackerId, targetId, result),
      (a, t, qte) => this.executeAttackInternal(a, t, qte)
    );
  }

  private handleQTEComplete(
    attackerId: string,
    targetId: string,
    result: QTECombatResult
  ): void {
    const attacker = this.state.units.get(attackerId);
    const target = this.state.units.get(targetId);
    if (!attacker || !target) return;

    const qteResult: QTEResultForExecutor = {
      dodged: result.dodged,
      attackerDamageModifier: result.attackerDamageModifier,
      defenderDamageModifier: result.defenderDamageModifier,
      newDefenderPosition: result.newDefenderPosition,
      defenderGrade: result.defenderQTE?.grade,
    };

    this.executeAttackInternal(attacker, target, qteResult, {
      attackerQTE: result.attackerQTE,
      defenderQTE: result.defenderQTE,
    });
  }

  private executeAttackInternal(
    attacker: BattleUnitSchema,
    target: BattleUnitSchema,
    qteResult: QTEResultForExecutor,
    qteData?: { attackerQTE?: unknown; defenderQTE?: unknown }
  ): void {
    executeAttackAndBroadcast(
      attacker,
      target,
      qteResult,
      this.state,
      this.roomId,
      this.broadcast.bind(this),
      qteData
    );
    // O timer vai verificar fim de batalha a cada segundo
    // Não é mais necessário chamar checkBattleEnd aqui
  }

  private resetForRematchInternal(): void {
    resetForRematch(this.state, this.rematchRequests, () =>
      this.startBattleInternal()
    );
  }
}

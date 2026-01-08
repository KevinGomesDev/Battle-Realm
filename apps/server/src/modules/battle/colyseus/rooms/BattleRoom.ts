// BattleRoom.ts - Room principal para Battle (Lobby + Battle)
// Versão modularizada - delega lógica para handlers em ./battle/

import { Room, Client, Delayed } from "@colyseus/core";
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
  persistBattleToDb,

  // Units
  createBattleUnits,
  createBotUnits,
  addBotPlayer,

  // Turn
  calculateActionOrder,
  startTurnTimer,
  advanceToNextUnit,
  processRoundEnd,
  checkBattleEnd,

  // AI
  executeAITurn,

  // QTE
  initializeQTEManager,
  updateQTEManagerUnits,
  startAttackQTE,
  handleQTEResponse,
  executeAttackAndBroadcast,

  // Combat
  handleAttack,

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
  private turnTimer: Delayed | null = null;
  private lobbyPhase: boolean = true;
  private readyPlayers = new Set<string>();
  private disconnectedPlayers = new Map<string, DisconnectedPlayer>();
  private persistenceTimer: Delayed | null = null;
  private allDisconnectedSince: number | null = null;
  private rematchRequests = new Set<string>();
  private restoredFromDb = false;
  private qteManager: QTEManager | null = null;

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
        return;
      }
      console.warn(`[BattleRoom] Falha ao restaurar, criando nova`);
    }

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
      vsBot: options.vsBot || false,
      status: "WAITING",
    });

    this.registerMessageHandlers();

    if (options.vsBot) {
      this.metadata.vsBot = true;
    }
  }

  async onJoin(client: Client, options: JoinOptions) {
    await handleJoin(
      client,
      options,
      this.state,
      this.roomId,
      this.metadata,
      this.lobbyPhase,
      this.disconnectedPlayers,
      this.broadcast.bind(this),
      this.setMetadata.bind(this),
      () => this.cancelPersistence(),
      () => this.addBotPlayerInternal(),
      () => this.startBattleInternal(),
      this.metadata.vsBot
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
          handleSurrender(userId, this.state, this.broadcast.bind(this), () =>
            this.checkBattleEndInternal()
          );
        }
      } else {
        handleSurrender(userId, this.state, this.broadcast.bind(this), () =>
          this.checkBattleEndInternal()
        );
      }
    }

    this.checkAllDisconnected();
  }

  async onDispose() {
    console.log(`[BattleRoom] Sala ${this.roomId} sendo destruída`);

    if (this.turnTimer) {
      this.turnTimer.clear();
      this.turnTimer = null;
    }

    if (this.persistenceTimer) {
      this.persistenceTimer.clear();
      this.persistenceTimer = null;
    }

    if (
      !this.lobbyPhase &&
      this.state.status === "ACTIVE" &&
      !this.state.winnerId
    ) {
      console.log(`[BattleRoom] Persistindo antes de destruir...`);
      await persistBattleToDb(this.roomId, this.state);
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

    this.onMessage(
      "battle:attack",
      (client, { attackerId, targetId, targetObstacleId, targetPosition }) => {
        handleAttack(
          client,
          attackerId,
          this.state,
          this.roomId,
          this.broadcast.bind(this),
          (c, a, t) => this.startAttackQTEInternal(c, a, t),
          targetId,
          targetObstacleId,
          targetPosition
        );
      }
    );

    this.onMessage("battle:end_action", (client, { unitId }) => {
      handleEndAction(client, unitId, this.state, () =>
        this.advanceToNextUnitInternal()
      );
    });

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
          (c, uid, tid, tpos) => {
            handleAttack(
              c,
              uid,
              this.state,
              this.roomId,
              this.broadcast.bind(this),
              (cl, a, t) => this.startAttackQTEInternal(cl, a, t),
              tid,
              undefined,
              tpos
            );
          },
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
        () => this.checkBattleEndInternal()
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
  }

  private async createBattleUnitsInternal(): Promise<void> {
    await createBattleUnits(this.state, (botPlayer) =>
      createBotUnits(this.state, botPlayer)
    );
  }

  private addBotPlayerInternal(): void {
    addBotPlayer(this.state);
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
    startTurnTimer(
      this.state,
      this.clock,
      this.turnTimer,
      (timer) => {
        this.turnTimer = timer;
      },
      () => this.advanceToNextUnitInternal()
    );
  }

  private advanceToNextUnitInternal(): void {
    advanceToNextUnit(
      this.state,
      this.broadcast.bind(this),
      () => processRoundEnd(this.state, this.broadcast.bind(this)),
      (unit) => this.executeAITurnInternal(unit),
      () => this.checkBattleEndInternal()
    );
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
      () => this.checkBattleEndInternal(),
      qteData
    );
  }

  private checkBattleEndInternal(): void {
    checkBattleEnd(
      this.state,
      this.roomId,
      this.turnTimer,
      this.broadcast.bind(this),
      (winnerId, reason) => {
        markBattleEnded(this.roomId, winnerId, reason).catch((err) =>
          console.error("[BattleRoom] Erro ao marcar batalha como ENDED:", err)
        );
      }
    );
  }

  private resetForRematchInternal(): void {
    resetForRematch(this.state, this.rematchRequests, () =>
      this.startBattleInternal()
    );
  }

  private cancelPersistence(): void {
    if (this.persistenceTimer) {
      this.persistenceTimer.clear();
      this.persistenceTimer = null;
      this.allDisconnectedSince = null;
      console.log(`[BattleRoom] Persistência cancelada - jogador reconectou`);
    }
  }

  private checkAllDisconnected(): void {
    if (!this.lobbyPhase && this.state.status === "ACTIVE") {
      const humanPlayers = this.state.players.filter(
        (p: BattlePlayerSchema) => !p.isBot
      );
      const allDisconnected = humanPlayers.every(
        (p: BattlePlayerSchema) => !p.isConnected
      );

      if (allDisconnected && humanPlayers.length > 0) {
        this.allDisconnectedSince = Date.now();
        console.log(`[BattleRoom] Todos desconectaram. Persistindo em 10s...`);

        this.persistenceTimer = this.clock.setTimeout(async () => {
          await persistBattleToDb(this.roomId, this.state);
        }, 10000);
      }
    }
  }
}

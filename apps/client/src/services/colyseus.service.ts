// client/src/services/colyseus.service.ts
// Serviço principal de conexão Colyseus

import { Client, Room } from "colyseus.js";
import { Schema } from "@colyseus/schema";
import type {
  BattleUnit,
  BattleObstacle,
} from "@boundless/shared/types/battle.types";
import type { BattlePlayer } from "@boundless/shared/types/session.types";

// Re-exportar tipos do shared para compatibilidade
export type BattleUnitState = BattleUnit;
export type BattlePlayerState = BattlePlayer;

// Usa BattleObstacle do shared com campos required para Colyseus state
export interface BattleObstacleState extends BattleObstacle {
  hp: number;
  maxHp: number;
  destroyed: boolean;
  size: import("@boundless/shared/config").ObstacleSize;
}

export interface BattleSessionState {
  battleId: string;
  lobbyId: string;
  matchId: string;
  isbattle: boolean;
  maxPlayers: number;
  status: string;
  round: number;
  currentTurnIndex: number;
  activeUnitId: string;
  selectedUnitId: string; // Unidade selecionada (ainda pode mudar)
  currentPlayerId: string; // ID do jogador que controla o turno atual
  unitLocked: boolean; // Se true, a unidade está travada (não pode mudar seleção)
  turnTimer: number;
  gridWidth: number;
  gridHeight: number;
  players: BattlePlayerState[]; // ArraySchema no servidor
  actionOrder: string[];
  units: Map<string, BattleUnitState>;
  obstacles: BattleObstacleState[];
  winnerId: string;
  winReason: string;
  rematchRequests: string[];
}

export interface GlobalRoomState {
  connectedPlayers: number;
  activeLobbies: number;
  activeBattles: number;
  availableLobbies: any[];
}

export interface MatchPlayerState {
  oderId: string;
  odername: string;
  kingdomId: string;
  kingdomName: string;
  playerIndex: number;
  playerColor: string;
  capitalTerritoryId: string;
  isReady: boolean;
  hasFinishedCurrentTurn: boolean;
}

export interface TerritoryState {
  id: string;
  name: string;
  index: number;
  x: number;
  y: number;
  terrain: string;
  ownerId: string;
  ownerColor: string;
  isCapital: boolean;
  structures: string[];
}

export interface MatchState {
  matchId: string;
  hostUserId: string;
  maxPlayers: number;
  status: string;
  currentRound: number;
  currentTurn: string;
  activePlayerIds: string[];
  players: Map<string, MatchPlayerState>;
  territories: Map<string, TerritoryState>;
  winnerId: string;
  winReason: string;
}

// Extended Match State Data for context (includes additional fields)
export interface MatchStateData {
  matchId: string;
  status: string;
  phase: string;
  currentTurn: number;
  maxTurns: number;
  turnTimer: number;
  turnTimeLimit: number;
  activePlayerId: string | null;
  mapWidth: number;
  mapHeight: number;
  winnerId: string | null;
  winReason: string | null;
  players: Map<
    string,
    {
      odataId: string;
      odataUserId: string;
      username: string;
      kingdomId: string;
      kingdomName: string;
      color: string;
      isReady: boolean;
      hasFinishedTurn: boolean;
      gold: number;
      mana: number;
      influence: number;
      victoryPoints: number;
    }
  >;
  territories: Map<
    string,
    {
      id: string;
      hexId: string;
      name: string;
      ownerId: string | null;
      terrainType: string;
      resourceType: string | null;
      hasCapital: boolean;
      hasStructure: boolean;
      structureType: string | null;
      armyStrength: number;
    }
  >;
  activeCrisis: {
    id: string;
    name: string;
    description: string;
    severity: string;
    effects: string[];
  } | null;
}

type RoomType = "global" | "battle" | "match";

/**
 * Serializa um objeto Colyseus Schema para um objeto JavaScript puro
 * Necessário porque spread operator não funciona corretamente com Schema
 */
function serializeSchemaObject<T>(schemaObj: T): T {
  if (!schemaObj || typeof schemaObj !== "object") return schemaObj;

  // Se tem método toJSON, usar ele (alguns Colyseus Schemas têm isso)
  if (typeof (schemaObj as any).toJSON === "function") {
    return (schemaObj as any).toJSON();
  }

  // Copiar manualmente todas as propriedades
  const result: any = {};
  for (const key of Object.keys(schemaObj)) {
    const value = (schemaObj as any)[key];
    if (value === undefined || typeof value === "function") continue;

    // Para ArraySchema ou arrays regulares, converter para array JS
    if (
      Array.isArray(value) ||
      (value &&
        typeof value.forEach === "function" &&
        typeof value.length === "number")
    ) {
      const arr: any[] = [];
      value.forEach((item: any) => {
        if (item && typeof item === "object") {
          arr.push(serializeSchemaObject(item));
        } else {
          arr.push(item);
        }
      });
      result[key] = arr;
    }
    // Para MapSchema ou objetos Map
    else if (
      value &&
      typeof value.forEach === "function" &&
      typeof value.get === "function"
    ) {
      const obj: Record<string, any> = {};
      value.forEach((v: any, k: string) => {
        if (v && typeof v === "object") {
          obj[k] = serializeSchemaObject(v);
        } else {
          obj[k] = v;
        }
      });
      result[key] = obj;
    }
    // Para outros objetos com toJSON
    else if (
      value &&
      typeof value === "object" &&
      typeof value.toJSON === "function"
    ) {
      result[key] = value.toJSON();
    }
    // Valores primitivos
    else {
      result[key] = value;
    }
  }
  return result as T;
}

class ColyseusService {
  private client: Client | null = null;
  private globalRoom: Room<GlobalRoomState> | null = null;
  private BattleRoom: Room<BattleSessionState> | null = null;
  private matchRoom: Room<MatchState> | null = null;
  private arenaRoom: Room | null = null;

  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;
  private connectionId: string | null = null;

  // Controle de conexão simultânea para rooms
  private arenaJoinPromise: Promise<Room> | null = null;

  // Heartbeat (tic-tac) system
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastPongTimestamp: number = 0;
  private heartbeatTimeoutMs = 10000; // 10 segundos sem resposta = reconectar
  private heartbeatIntervalMs = 5000; // Envia ping a cada 5 segundos
  private pendingPing = false;

  /**
   * Gera um ID único para a conexão
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Conecta ao servidor Colyseus (com garantia de conexão única)
   */
  async connect(url: string = "ws://localhost:3000"): Promise<void> {
    // Se já está conectado e a conexão está ativa, não faz nada
    if (this.isConnected()) {
      return;
    }

    // Se já há uma conexão em andamento, aguarda ela terminar
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Se está conectando (flag), aguarda
    if (this.isConnecting) {
      // Aguarda até não estar mais conectando
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        // Timeout de 10 segundos
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 10000);
      });
      // Se conectou durante a espera, retorna
      if (this.isConnected()) return;
    }

    // Inicia nova conexão
    this.connectionPromise = this._doConnect(url);

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Executa a conexão real (método interno)
   */
  private async _doConnect(url: string): Promise<void> {
    this.isConnecting = true;
    const thisConnectionId = this.generateConnectionId();
    this.connectionId = thisConnectionId;

    try {
      // Limpar conexões anteriores
      if (this.globalRoom) {
        try {
          await this.globalRoom.leave(false);
        } catch {
          // Ignora erros ao sair
        }
        this.globalRoom = null;
      }

      this.client = new Client(url);

      // Conectar automaticamente à room global
      this.globalRoom = await this.client.joinOrCreate<GlobalRoomState>(
        "global"
      );

      // Verificar se esta ainda é a conexão atual
      if (this.connectionId !== thisConnectionId) {
        await this.globalRoom.leave(false);
        return;
      }

      this.setupGlobalRoomListeners();

      // Reautenticar automaticamente se houver token salvo
      const savedToken = localStorage.getItem("auth_token");
      if (savedToken) {
        this.globalRoom.send("auth:validate", { token: savedToken });
      }

      this.reconnectAttempts = 0;
      this.isConnecting = false;

      // Inicia heartbeat (tic-tac)
      this.startHeartbeat();

      this.emit("connected", { roomId: this.globalRoom.id });
    } catch (error) {
      this.isConnecting = false;
      console.error("[Colyseus] ❌ Erro ao conectar:", error);

      // Só tenta reconectar se esta ainda é a conexão atual
      if (
        this.connectionId === thisConnectionId &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        this.reconnectAttempts++;
        await new Promise((resolve) =>
          setTimeout(resolve, 2000 * this.reconnectAttempts)
        );
        return this._doConnect(url);
      } else {
        this.emit("connection_failed", { error });
        throw error;
      }
    }
  }

  /**
   * Desconecta de todas as rooms
   */
  async disconnect(): Promise<void> {
    // Para heartbeat
    this.stopHeartbeat();

    // Invalidar connectionId para cancelar conexões em andamento
    this.connectionId = null;
    this.connectionPromise = null;
    this.isConnecting = false;

    if (this.BattleRoom) {
      await this.BattleRoom.leave();
      this.BattleRoom = null;
    }

    if (this.matchRoom) {
      await this.matchRoom.leave();
      this.matchRoom = null;
    }

    if (this.globalRoom) {
      await this.globalRoom.leave();
      this.globalRoom = null;
    }

    this.client = null;
    this.listeners.clear();
    this.reconnectAttempts = 0;
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    if (!this.globalRoom) return false;
    // Verifica se a conexão WebSocket ainda está ativa
    try {
      return (
        this.globalRoom.connection?.isOpen === true ||
        (this.globalRoom as any).connection?.ws?.readyState === 1
      );
    } catch {
      return false;
    }
  }

  // =========================================
  // Heartbeat (Tic-Tac) System
  // =========================================

  /**
   * Inicia o sistema de heartbeat para detectar quedas de conexão
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Limpa qualquer heartbeat anterior
    this.lastPongTimestamp = Date.now();
    this.pendingPing = false;

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  /**
   * Para o sistema de heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.pendingPing = false;
  }

  /**
   * Envia um ping e verifica se a última resposta está dentro do timeout
   */
  private sendHeartbeat(): void {
    const now = Date.now();

    // Verifica se a room ainda existe e está conectada
    if (!this.globalRoom || !this.isConnected()) {
      console.warn("[Colyseus] ⚠️ Heartbeat detectou room desconectada");
      this.handleHeartbeatTimeout();
      return;
    }

    // Verifica se passou muito tempo desde o último pong
    if (now - this.lastPongTimestamp > this.heartbeatTimeoutMs) {
      console.warn(
        `[Colyseus] ⚠️ Heartbeat timeout (${
          now - this.lastPongTimestamp
        }ms sem resposta)`
      );
      this.handleHeartbeatTimeout();
      return;
    }

    // Verifica se há ping pendente sem resposta (possível conexão zombie)
    if (this.pendingPing) {
      const pendingTime =
        now - (this.lastPongTimestamp + this.heartbeatIntervalMs);
      if (pendingTime > this.heartbeatTimeoutMs) {
        console.warn(
          `[Colyseus] ⚠️ Ping pendente há muito tempo (${pendingTime}ms)`
        );
        this.handleHeartbeatTimeout();
        return;
      }
    }

    // Envia ping
    try {
      this.pendingPing = true;
      this.globalRoom.send("ping", { timestamp: now });
    } catch (error) {
      console.error("[Colyseus] ❌ Erro ao enviar ping:", error);
      this.handleHeartbeatTimeout();
    }
  }

  /**
   * Processa a resposta pong do servidor
   */
  private handlePong(data: { timestamp: number }): void {
    this.lastPongTimestamp = Date.now();
    this.pendingPing = false;
    const latency = Date.now() - (data.timestamp ?? Date.now());
    this.emit("heartbeat:pong", { latency, timestamp: this.lastPongTimestamp });
  }

  /**
   * Lida com timeout do heartbeat (força reconexão)
   */
  private handleHeartbeatTimeout(): void {
    console.error("[Colyseus] ❌ Conexão perdida detectada via heartbeat");
    this.stopHeartbeat();
    this.emit("heartbeat:timeout", {});

    // Força reconexão
    this.forceReconnect();
  }

  /**
   * Força reconexão após perda de heartbeat
   */
  private async forceReconnect(): Promise<void> {

    // Emitir evento de reconexão (para UI mostrar overlay)
    this.emit("reconnecting", { attempt: 1 });

    // Limpa estado atual sem chamar disconnect completo
    if (this.globalRoom) {
      try {
        await this.globalRoom.leave(false);
      } catch {
        // Ignora erros ao sair
      }
      this.globalRoom = null;
    }

    this.client = null;
    this.connectionPromise = null;
    this.isConnecting = false;

    // Tenta reconectar com retry
    let attempts = 0;
    const maxAttempts = 10;
    const baseDelay = 1000;

    while (attempts < maxAttempts) {
      attempts++;
      // Emite número de tentativa atualizado para o UI
      this.emit("reconnecting", { attempt: attempts });

      try {
        await this.connect();

        // Conexão bem sucedida - emitir evento de reconexão completa
        this.emit("reconnected", {});
        return;
      } catch (error) {
        console.warn(`[Colyseus] ⚠️ Tentativa ${attempts} falhou:`, error);

        if (attempts < maxAttempts) {
          // Aguarda com backoff exponencial (max 10 segundos)
          const delay = Math.min(
            baseDelay * Math.pow(1.5, attempts - 1),
            10000
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error("[Colyseus] ❌ Falha ao reconectar após todas as tentativas");
    this.emit("reconnect_failed", { attempts: maxAttempts });
  }

  // =========================================
  // Room Global
  // =========================================

  private setupGlobalRoomListeners(): void {
    if (!this.globalRoom) return;

    this.globalRoom.onStateChange((state: GlobalRoomState) => {
      this.emit("global:state_changed", state);
    });

    this.globalRoom.onMessage(
      "*",
      (type: string | number | Schema, message: unknown) => {
        // Trata pong separadamente para o heartbeat
        if (type === "pong") {
          this.handlePong(message as { timestamp: number });
          return;
        }
        this.emit(`global:${type}`, message);
        this.emit(type as string, message);
      }
    );

    this.globalRoom.onLeave((code: number) => {
      this.stopHeartbeat(); // Para heartbeat ao sair
      this.globalRoom = null; // Limpar referência
      this.emit("disconnected", { code });

      // Códigos que indicam desconexão inesperada e devem tentar reconexão
      // 1000 = fechamento normal, 1001 = going away, 4000+ = aplicação
      // Outros códigos (1006 = abnormal closure, etc) são desconexões inesperadas
      const unexpectedCodes = [1006, 1011, 1012, 1013, 1014, 1015];
      if (unexpectedCodes.includes(code) || (code >= 1002 && code <= 1005)) {
        this.forceReconnect();
      }
    });

    this.globalRoom.onError((code: number, message?: string) => {
      console.error(`[Colyseus] Erro na room global: ${code} - ${message}`);
      this.emit("error", { code, message });
    });
  }

  /**
   * Envia mensagem para a room global
   */
  sendToGlobal(type: string, message?: unknown): void {
    if (!this.globalRoom || !this.isConnected()) {
      console.warn(
        "[Colyseus] Room global não conectada, tentando reconectar..."
      );
      // Tenta reconectar automaticamente
      this.connect()
        .then(() => {
          if (this.globalRoom && this.isConnected()) {
            this.globalRoom.send(type, message);
          }
        })
        .catch(console.error);
      return;
    }
    this.globalRoom.send(type, message);
  }

  /**
   * Obtém o estado da room global
   */
  getGlobalState(): GlobalRoomState | null {
    return this.globalRoom?.state ?? null;
  }

  // =========================================
  // Battle Room
  // =========================================

  /**
   * Cria um novo lobby de Batalha
   */
  async createBattleLobby(options: {
    kingdomId: string;
    maxPlayers?: number;
    restoreBattleId?: string; // ID da batalha para restaurar do banco
  }): Promise<Room<BattleSessionState>> {
    if (!this.client) {
      throw new Error("Não conectado ao servidor");
    }

    // Sair de batalha anterior se existir
    if (this.BattleRoom) {
      await this.BattleRoom.leave();
    }

    const token = localStorage.getItem("auth_token");
    const userData = localStorage.getItem("auth_user");
    const user = userData ? JSON.parse(userData) : null;

    const createOptions = {
      userId: user?.id,
      kingdomId: options.kingdomId,
      maxPlayers: options.maxPlayers || 2,
      restoreBattleId: options.restoreBattleId,
      token,
    };

    this.BattleRoom = await this.client.create<BattleSessionState>(
      "battle",
      createOptions
    );

    this.setupBattleRoomListeners();

    return this.BattleRoom;
  }

  /**
   * Restaura uma batalha pausada do banco de dados
   */
  async restoreBattle(
    battleId: string,
    kingdomId: string
  ): Promise<Room<BattleSessionState>> {
    return this.createBattleLobby({
      kingdomId,
      restoreBattleId: battleId,
    });
  }

  /**
   * Entra em um lobby de Batalha existente
   */
  async joinBattleLobby(
    roomId: string,
    kingdomId: string
  ): Promise<Room<BattleSessionState>> {
    if (!this.client) {
      throw new Error("Não conectado ao servidor");
    }

    if (this.BattleRoom) {
      await this.BattleRoom.leave();
      this.BattleRoom = null;
      // Pequena espera para garantir cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const userData = localStorage.getItem("auth_user");
    const user = userData ? JSON.parse(userData) : null;

    this.BattleRoom = await this.client.joinById<BattleSessionState>(roomId, {
      userId: user?.id,
      kingdomId,
    });

    this.setupBattleRoomListeners();

    return this.BattleRoom;
  }

  /**
   * Sai do lobby/sessão de batalha
   */
  async leaveBattle(): Promise<void> {
    if (this.BattleRoom) {
      await this.BattleRoom.leave();
      this.BattleRoom = null;
    }
  }

  private setupBattleRoomListeners() {
    if (!this.BattleRoom) return;

    this.BattleRoom.onStateChange((state: BattleSessionState) => {
      // Só emite se o estado tiver dados válidos (battleId preenchido)
      // Isso evita emitir estado vazio durante sincronização inicial
      if (state.battleId) {
        this.emit("battle:state_changed", state);
      } else {
      }
    });

    // Listener para mudanças em players (lobby)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.BattleRoom.state as any).players?.onAdd?.(() => {
      // Quando um player é adicionado, re-emitir o estado completo
      if (this.BattleRoom?.state) {
        this.emit("battle:state_changed", this.BattleRoom.state);
      }
    });

    // Listener específico para mudanças em unidades
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.BattleRoom.state as any).units?.onAdd?.(
      (unit: BattleUnitState, key: string) => {
        this.emit("battle:unit_added", { unit, id: key });
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.BattleRoom.state as any).units?.onChange?.(
      (unit: BattleUnitState, key: string) => {
        this.emit("battle:unit_changed", { unit, id: key });
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.BattleRoom.state as any).units?.onRemove?.(
      (unit: BattleUnitState, key: string) => {
        this.emit("battle:unit_removed", { unit, id: key });
      }
    );

    this.BattleRoom.onMessage(
      "*",
      (type: string | number | Schema, message: unknown) => {
        this.emit(`battle:${type}`, message);
      }
    );

    this.BattleRoom.onLeave((code: number) => {
      this.emit("battle:left", { code });
      this.BattleRoom = null;
    });

    this.BattleRoom.onError((code: number, message?: string) => {
      console.error(`[Colyseus] Erro na battle: ${code} - ${message}`);
      this.emit("battle:error", { code, message });
    });

    // Emitir estado atual imediatamente se já existir
    // Isso garante que estados já sincronizados sejam propagados
    if (this.BattleRoom.state) {
      // Usar setTimeout para garantir que os listeners do battleStore já estejam registrados
      setTimeout(() => {
        if (this.BattleRoom?.state) {
          this.emit("battle:state_changed", this.BattleRoom.state);
        }
      }, 0);

      // Se o estado inicial não estiver completo, fazer polling até estar
      if (
        !this.BattleRoom.state.status ||
        this.BattleRoom.state.status === "WAITING" ||
        this.BattleRoom.state.status === "READY"
      ) {
        const pollInterval = setInterval(() => {
          if (!this.BattleRoom?.state) {
            clearInterval(pollInterval);
            return;
          }
          if (this.BattleRoom.state.status === "ACTIVE") {
            this.emit("battle:state_changed", this.BattleRoom.state);
            clearInterval(pollInterval);
          }
        }, 50);
        // Limpar após 5 segundos para evitar leak
        setTimeout(() => clearInterval(pollInterval), 5000);
      }
    }
  }

  /**
   * Envia mensagem para a battle room
   */
  sendToBattle(type: string, message?: unknown): void {
    if (!this.BattleRoom) {
      console.warn("[Colyseus] Battle room não conectada");
      return;
    }
    this.BattleRoom.send(type, message);
  }

  /**
   * Obtém o estado da batalha
   */
  getBattleState(): BattleSessionState | null {
    if (!this.BattleRoom?.state) return null;
    return this.BattleRoom.state;
  }

  /**
   * Obtém a room da batalha atual
   */
  getBattleRoom(): Room<BattleSessionState> | null {
    return this.BattleRoom;
  }

  /**
   * Verifica se está em uma batalha
   */
  isInBattle(): boolean {
    return this.BattleRoom !== null;
  }

  // =========================================
  // Match Room
  // =========================================

  /**
   * Cria uma nova partida
   */
  async createMatch(options: {
    kingdomId: string;
    maxPlayers?: number;
  }): Promise<Room<MatchState>> {
    if (!this.client) {
      throw new Error("Não conectado ao servidor");
    }

    if (this.matchRoom) {
      await this.matchRoom.leave();
    }

    const userData = localStorage.getItem("auth_user");
    const user = userData ? JSON.parse(userData) : null;

    this.matchRoom = await this.client.create<MatchState>("match", {
      userId: user?.id,
      kingdomId: options.kingdomId,
      maxPlayers: options.maxPlayers || 4,
    });

    this.setupMatchRoomListeners();

    return this.matchRoom;
  }

  /**
   * Entra em uma partida existente
   */
  async joinMatch(
    roomId: string,
    kingdomId: string
  ): Promise<Room<MatchState>> {
    if (!this.client) {
      throw new Error("Não conectado ao servidor");
    }

    if (this.matchRoom) {
      await this.matchRoom.leave();
    }

    const userData = localStorage.getItem("auth_user");
    const user = userData ? JSON.parse(userData) : null;

    this.matchRoom = await this.client.joinById<MatchState>(roomId, {
      userId: user?.id,
      kingdomId,
    });

    this.setupMatchRoomListeners();

    return this.matchRoom;
  }

  /**
   * Sai da partida
   */
  async leaveMatch(): Promise<void> {
    if (this.matchRoom) {
      await this.matchRoom.leave();
      this.matchRoom = null;
    }
  }

  private setupMatchRoomListeners(): void {
    if (!this.matchRoom) return;

    this.matchRoom.onStateChange((state: MatchState) => {
      this.emit("match:state_changed", state);
    });

    this.matchRoom.onMessage(
      "*",
      (type: string | number | Schema, message: unknown) => {
        this.emit(`match:${type}`, message);
      }
    );

    this.matchRoom.onLeave((code: number) => {
      this.emit("match:left", { code });
      this.matchRoom = null;
    });

    this.matchRoom.onError((code: number, message?: string) => {
      console.error(`[Colyseus] Erro no match: ${code} - ${message}`);
      this.emit("match:error", { code, message });
    });
  }

  /**
   * Envia mensagem para a match room
   */
  sendToMatch(type: string, message?: unknown): void {
    if (!this.matchRoom) {
      console.warn("[Colyseus] Match room não conectada");
      return;
    }
    this.matchRoom.send(type, message);
  }

  /**
   * Obtém o estado do match
   */
  getMatchState(): MatchState | null {
    return this.matchRoom?.state ?? null;
  }

  /**
   * Obtém a room do match atual
   */
  getMatchRoom(): Room<MatchState> | null {
    return this.matchRoom;
  }

  /**
   * Verifica se está em um match
   */
  isInMatch(): boolean {
    return this.matchRoom !== null;
  }

  // =========================================
  // Arena Room (Sistema de Desafios)
  // =========================================

  /**
   * Entra na arena para receber/enviar desafios
   */
  async joinArena(userId: string, username: string): Promise<Room> {
    if (!this.client) throw new Error("Client não conectado");

    if (this.arenaRoom) {
      return this.arenaRoom;
    }

    this.arenaRoom = await this.client.joinOrCreate("arena", {
      userId,
      username,
    });

    // Configurar listeners de mensagens
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.arenaRoom.onMessage("*", (type: any, message: unknown) => {
      this.emit(String(type), message);
    });

    this.arenaRoom.onLeave(() => {
      this.arenaRoom = null;
    });
    return this.arenaRoom;
  }

  /**
   * Sai da arena
   */
  leaveArena(): void {
    if (this.arenaRoom) {
      this.arenaRoom.leave();
      this.arenaRoom = null;
    }
  }

  /**
   * Envia mensagem para a arena
   */
  sendToArena(type: string, message?: unknown): void {
    if (!this.arenaRoom) {
      console.warn("[Colyseus] Arena não conectada");
      return;
    }
    this.arenaRoom.send(type, message);
  }

  /**
   * Verifica se está na arena
   */
  isInArena(): boolean {
    return this.arenaRoom !== null;
  }

  /**
   * Obtém a room da arena
   */
  getArenaRoom(): Room | null {
    return this.arenaRoom;
  }

  // =========================================
  // Event System
  // =========================================

  /**
   * Registra listener para um evento
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove listener de um evento
   */
  off(event: string, callback?: Function): void {
    if (!callback) {
      this.listeners.delete(event);
      return;
    }

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emite um evento local
   */
  emit(event: string, data?: unknown): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (error) {
          console.error(`[Colyseus] Erro no listener ${event}:`, error);
        }
      });
    }
  }

  /**
   * Emite um evento público (para forçar sincronização de estado)
   */
  emitEvent(event: string, data?: unknown): void {
    this.emit(event, data);
  }

  // =========================================
  // Utility Methods
  // =========================================

  /**
   * Lista rooms disponíveis de um tipo
   */
  async listRooms(roomType: RoomType): Promise<any[]> {
    if (!this.client) {
      throw new Error("Não conectado ao servidor");
    }

    const rooms = await this.client.getAvailableRooms(roomType);
    return rooms;
  }

  /**
   * Obtém informações de debug
   */
  getDebugInfo() {
    return {
      connected: this.isConnected(),
      globalRoomId: this.globalRoom?.id ?? null,
      BattleRoomId: this.BattleRoom?.id ?? null,
      matchRoomId: this.matchRoom?.id ?? null,
      listenersCount: this.listeners.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // =========================================
  // Request/Response Pattern (async emit)
  // =========================================

  /**
   * Envia mensagem e aguarda resposta (padrão request/response)
   * @param type - Tipo da mensagem a enviar
   * @param message - Dados da mensagem
   * @param responseEvent - Evento de resposta esperado (padrão: `${type}:response`)
   * @param timeout - Timeout em ms (padrão: 10000)
   */
  async sendAndWait<T = unknown>(
    type: string,
    message?: unknown,
    responseEvent?: string,
    timeout: number = 10000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const eventName = responseEvent || `${type}:response`;
      let timeoutId: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.off(eventName, successHandler);
        this.off("error", errorHandler);
      };

      const successHandler = (data: T) => {
        cleanup();
        resolve(data);
      };

      const errorHandler = (error: { message?: string; error?: string }) => {
        cleanup();
        reject(new Error(error.message || error.error || "Request failed"));
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for ${eventName}`));
      }, timeout);

      this.on(eventName, successHandler);
      this.on("error", errorHandler);

      this.sendToGlobal(type, message);
    });
  }

  /**
   * Envia para battle e aguarda resposta
   */
  async sendToBattleAndWait<T = unknown>(
    type: string,
    message?: unknown,
    responseEvent?: string,
    timeout: number = 10000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const eventName = responseEvent || `battle:${type}:response`;
      let timeoutId: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.off(eventName, successHandler);
        this.off("battle:error", errorHandler);
      };

      const successHandler = (data: T) => {
        cleanup();
        resolve(data);
      };

      const errorHandler = (error: { message?: string; error?: string }) => {
        cleanup();
        reject(new Error(error.message || error.error || "Request failed"));
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for ${eventName}`));
      }, timeout);

      this.on(eventName, successHandler);
      this.on("battle:error", errorHandler);

      this.sendToBattle(type, message);
    });
  }

  /**
   * Envia para match e aguarda resposta
   */
  async sendToMatchAndWait<T = unknown>(
    type: string,
    message?: unknown,
    responseEvent?: string,
    timeout: number = 10000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const eventName = responseEvent || `match:${type}:response`;
      let timeoutId: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.off(eventName, successHandler);
        this.off("match:error", errorHandler);
      };

      const successHandler = (data: T) => {
        cleanup();
        resolve(data);
      };

      const errorHandler = (error: { message?: string; error?: string }) => {
        cleanup();
        reject(new Error(error.message || error.error || "Request failed"));
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for ${eventName}`));
      }, timeout);

      this.on(eventName, successHandler);
      this.on("match:error", errorHandler);

      this.sendToMatch(type, message);
    });
  }

  /**
   * Envia mensagem e aguarda resposta com eventos separados de sucesso e erro
   * @param emitEvent - Evento a ser emitido
   * @param data - Dados a enviar
   * @param successEvent - Evento de sucesso
   * @param errorEvent - Evento de erro
   * @param timeout - Timeout em ms
   */
  async waitForResponse<T = unknown>(
    emitEvent: string,
    data: unknown,
    successEvent: string,
    errorEvent: string,
    timeout: number = 10000
  ): Promise<T> {
    // Garante que está conectado antes de enviar
    if (!this.isConnected()) {
      await this.connect();
      // Pequena espera para garantir que a conexão está estável
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (!this.isConnected()) {
      throw new Error("Não foi possível conectar ao servidor");
    }

    return new Promise<T>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      let resolved = false;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        this.off(successEvent, successHandler);
        this.off(errorEvent, errorHandler);
      };

      const successHandler = (responseData: T) => {
        cleanup();
        resolve(responseData);
      };

      const errorHandler = (error: { message?: string; error?: string }) => {
        cleanup();
        reject(new Error(error.message || error.error || "Request failed"));
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for ${successEvent}`));
      }, timeout);

      // IMPORTANTE: Registrar listeners ANTES de enviar a mensagem
      this.on(successEvent, successHandler);
      this.on(errorEvent, errorHandler);

      // Envia diretamente já que verificamos conexão acima
      if (this.globalRoom) {
        this.globalRoom.send(emitEvent, data);
      } else {
        cleanup();
        reject(new Error("Room global não disponível"));
      }
    });
  }
}

// Singleton
export const colyseusService = new ColyseusService();

// Exportar função de serialização para uso em stores
export { serializeSchemaObject };

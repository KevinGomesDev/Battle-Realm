// client/src/services/colyseus.service.ts
// Serviço principal de conexão Colyseus

import { Client, Room } from "colyseus.js";
import { Schema } from "@colyseus/schema";

// Tipos para state das rooms (espelhados do servidor)
export interface BattleUnitState {
  id: string;
  sourceUnitId: string;
  ownerId: string;
  ownerKingdomId: string;
  name: string;
  avatar: string;
  category: string;
  troopSlot: number;
  level: number;
  race: string;
  classCode: string;
  features: string[];
  equipment: string[];
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
  damageReduction: number;
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
  posX: number;
  posY: number;
  movesLeft: number;
  actionsLeft: number;
  attacksLeftThisTurn: number;
  isAlive: boolean;
  actionMarks: number;
  physicalProtection: number;
  maxPhysicalProtection: number;
  magicalProtection: number;
  maxMagicalProtection: number;
  conditions: string[];
  spells: string[];
  hasStartedAction: boolean;
  grabbedByUnitId: string;
  size: string;
  visionRange: number;
  isAIControlled: boolean;
  aiBehavior: string;
}

export interface BattlePlayerState {
  oderId: string;
  kingdomId: string;
  kingdomName: string;
  username: string;
  playerIndex: number;
  playerColor: string;
  isConnected: boolean;
  isBot: boolean;
  surrendered: boolean;
}

export interface BattleObstacleState {
  id: string;
  posX: number;
  posY: number;
  emoji: string;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export interface ArenaBattleState {
  battleId: string;
  lobbyId: string;
  matchId: string;
  isArena: boolean;
  maxPlayers: number;
  status: string;
  round: number;
  currentTurnIndex: number;
  activeUnitId: string;
  currentPlayerId: string; // ID do jogador que controla a unidade ativa
  turnTimer: number;
  gridWidth: number;
  gridHeight: number;
  players: Map<number, BattlePlayerState>;
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

type RoomType = "global" | "arena" | "match";

class ColyseusService {
  private client: Client | null = null;
  private globalRoom: Room<GlobalRoomState> | null = null;
  private arenaRoom: Room<ArenaBattleState> | null = null;
  private matchRoom: Room<MatchState> | null = null;

  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;
  private connectionId: string | null = null;

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
      console.log("[Colyseus] Já conectado, reutilizando conexão");
      return;
    }

    // Se já há uma conexão em andamento, aguarda ela terminar
    if (this.connectionPromise) {
      console.log("[Colyseus] Conexão em andamento, aguardando...");
      return this.connectionPromise;
    }

    // Se está conectando (flag), aguarda
    if (this.isConnecting) {
      console.log("[Colyseus] Flag isConnecting ativa, aguardando...");
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

    console.log(`[Colyseus] Iniciando conexão ${thisConnectionId}`);

    try {
      // Limpar conexões anteriores
      if (this.globalRoom) {
        console.log("[Colyseus] Limpando room global anterior");
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
        console.log(
          `[Colyseus] Conexão ${thisConnectionId} foi substituída, saindo`
        );
        await this.globalRoom.leave(false);
        return;
      }

      console.log(
        `[Colyseus] ✅ Conectado à room global: ${this.globalRoom.id} (${thisConnectionId})`
      );

      this.setupGlobalRoomListeners();

      this.reconnectAttempts = 0;
      this.isConnecting = false;

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
        console.log(
          `[Colyseus] Tentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
        );
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
    // Invalidar connectionId para cancelar conexões em andamento
    this.connectionId = null;
    this.connectionPromise = null;
    this.isConnecting = false;

    if (this.arenaRoom) {
      await this.arenaRoom.leave();
      this.arenaRoom = null;
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

    console.log("[Colyseus] Desconectado");
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
        this.emit(`global:${type}`, message);
        this.emit(type as string, message);
      }
    );

    this.globalRoom.onLeave((code: number) => {
      console.log(`[Colyseus] Saiu da room global (code: ${code})`);
      this.globalRoom = null; // Limpar referência
      this.emit("disconnected", { code });
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
  // Arena Room
  // =========================================

  /**
   * Cria um novo lobby de arena
   */
  async createArenaLobby(options: {
    kingdomId: string;
    maxPlayers?: number;
    vsBot?: boolean;
  }): Promise<Room<ArenaBattleState>> {
    if (!this.client) {
      throw new Error("Não conectado ao servidor");
    }

    // Sair de arena anterior se existir
    if (this.arenaRoom) {
      await this.arenaRoom.leave();
    }

    const token = localStorage.getItem("auth_token");
    const userData = localStorage.getItem("auth_user");
    const user = userData ? JSON.parse(userData) : null;

    const createOptions = {
      userId: user?.id,
      kingdomId: options.kingdomId,
      maxPlayers: options.maxPlayers || 2,
      vsBot: options.vsBot === true,
      token,
    };

    console.log(`[Colyseus] Criando arena com options:`, createOptions);

    this.arenaRoom = await this.client.create<ArenaBattleState>(
      "arena",
      createOptions
    );

    this.setupArenaRoomListeners();

    console.log(`[Colyseus] Arena lobby criado: ${this.arenaRoom.id}`);

    return this.arenaRoom;
  }

  /**
   * Entra em um lobby de arena existente
   */
  async joinArenaLobby(
    roomId: string,
    kingdomId: string
  ): Promise<Room<ArenaBattleState>> {
    if (!this.client) {
      throw new Error("Não conectado ao servidor");
    }

    if (this.arenaRoom) {
      await this.arenaRoom.leave();
    }

    const userData = localStorage.getItem("auth_user");
    const user = userData ? JSON.parse(userData) : null;

    this.arenaRoom = await this.client.joinById<ArenaBattleState>(roomId, {
      userId: user?.id,
      kingdomId,
    });

    this.setupArenaRoomListeners();

    console.log(`[Colyseus] Entrou no arena lobby: ${this.arenaRoom.id}`);

    return this.arenaRoom;
  }

  /**
   * Sai do lobby/batalha de arena
   */
  async leaveArena(): Promise<void> {
    if (this.arenaRoom) {
      await this.arenaRoom.leave();
      this.arenaRoom = null;
      console.log("[Colyseus] Saiu da arena");
    }
  }

  private setupArenaRoomListeners() {
    if (!this.arenaRoom) return;

    this.arenaRoom.onStateChange((state: ArenaBattleState) => {
      this.emit("arena:state_changed", state);
    });

    // Emitir estado inicial imediatamente (para capturar estado que já mudou)
    // Isso é necessário porque em vsBot a batalha já iniciou antes do listener ser registrado
    if (this.arenaRoom.state) {
      this.emit("arena:state_changed", this.arenaRoom.state);
    }

    // Listener específico para mudanças em unidades
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.arenaRoom.state as any).units?.onAdd?.(
      (unit: BattleUnitState, key: string) => {
        this.emit("arena:unit_added", { unit, id: key });
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.arenaRoom.state as any).units?.onChange?.(
      (unit: BattleUnitState, key: string) => {
        this.emit("arena:unit_changed", { unit, id: key });
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.arenaRoom.state as any).units?.onRemove?.(
      (unit: BattleUnitState, key: string) => {
        this.emit("arena:unit_removed", { unit, id: key });
      }
    );

    this.arenaRoom.onMessage(
      "*",
      (type: string | number | Schema, message: unknown) => {
        this.emit(`arena:${type}`, message);
      }
    );

    this.arenaRoom.onLeave((code: number) => {
      console.log(`[Colyseus] Saiu da arena (code: ${code})`);
      this.emit("arena:left", { code });
      this.arenaRoom = null;
    });

    this.arenaRoom.onError((code: number, message?: string) => {
      console.error(`[Colyseus] Erro na arena: ${code} - ${message}`);
      this.emit("arena:error", { code, message });
    });
  }

  /**
   * Envia mensagem para a arena room
   */
  sendToArena(type: string, message?: unknown): void {
    if (!this.arenaRoom) {
      console.warn("[Colyseus] Arena room não conectada");
      return;
    }
    this.arenaRoom.send(type, message);
  }

  /**
   * Obtém o estado da arena
   */
  getArenaState(): ArenaBattleState | null {
    return this.arenaRoom?.state ?? null;
  }

  /**
   * Verifica se está em uma arena
   */
  isInArena(): boolean {
    return this.arenaRoom !== null;
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

    console.log(`[Colyseus] Match criado: ${this.matchRoom.id}`);

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

    console.log(`[Colyseus] Entrou no match: ${this.matchRoom.id}`);

    return this.matchRoom;
  }

  /**
   * Sai da partida
   */
  async leaveMatch(): Promise<void> {
    if (this.matchRoom) {
      await this.matchRoom.leave();
      this.matchRoom = null;
      console.log("[Colyseus] Saiu do match");
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
      console.log(`[Colyseus] Saiu do match (code: ${code})`);
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
   * Verifica se está em um match
   */
  isInMatch(): boolean {
    return this.matchRoom !== null;
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
  private emit(event: string, data?: any): void {
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
      arenaRoomId: this.arenaRoom?.id ?? null,
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
   * Envia para arena e aguarda resposta
   */
  async sendToArenaAndWait<T = unknown>(
    type: string,
    message?: unknown,
    responseEvent?: string,
    timeout: number = 10000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const eventName = responseEvent || `arena:${type}:response`;
      let timeoutId: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.off(eventName, successHandler);
        this.off("arena:error", errorHandler);
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
      this.on("arena:error", errorHandler);

      this.sendToArena(type, message);
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

      const cleanup = () => {
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

// server/src/colyseus/rooms/MatchRoom.ts
// Room para partidas estratégicas no mapa

import { Room, Client, Delayed } from "@colyseus/core";
import {
  MatchState,
  MatchPlayerSchema,
  TerritorySchema,
  CrisisStateSchema,
  PlayerResources,
} from "../schemas";
import { prisma } from "../../../../lib/prisma";
import { MapGenerator, GeneratedTerritory } from "../../../map/MapGenerator";
import { CRISIS_DEFINITIONS } from "@boundless/shared/data/crisis.data";
import type { CrisisType } from "@boundless/shared/types/match.types";
import { pauseMatch } from "../../services/battle-persistence.service";

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

const TURN_TYPES = [
  "ADMINISTRACAO",
  "EXERCITOS",
  "MOVIMENTACAO",
  "CRISE",
  "ACAO",
  "BATALHA",
] as const;

interface MatchRoomOptions {
  userId: string;
  kingdomId: string;
  maxPlayers?: number;
}

interface JoinOptions {
  userId: string;
  kingdomId: string;
}

export class MatchRoom extends Room<MatchState> {
  maxClients = 8;

  private turnTimer: Delayed | null = null;
  private inPreparation = true;
  private readyPlayers = new Set<string>();
  private persistenceTimer: Delayed | null = null;

  async onCreate(options: MatchRoomOptions) {
    this.autoDispose = true;

    this.setState(new MatchState());
    this.state.matchId = this.roomId;
    this.state.hostUserId = options.userId;
    this.state.maxPlayers = Math.min(8, Math.max(2, options.maxPlayers || 4));
    this.state.status = "WAITING";

    this.setMetadata({
      hostUserId: options.userId,
      maxPlayers: this.state.maxPlayers,
      playerCount: 0,
      players: [] as string[],
      status: "WAITING",
    });

    this.registerMessageHandlers();
  }

  async onJoin(client: Client, options: JoinOptions) {
    const { userId, kingdomId } = options;

    // Verificar se o jogador já existe (reconexão)
    const existingPlayer = this.state.getPlayer(userId);
    if (existingPlayer) {
      // Permitir reconexão em qualquer status da partida
      client.userData = { userId, kingdomId };

      // Cancelar persistência pendente
      this.cancelPersistence();

      client.send("match:reconnected", {
        matchId: this.roomId,
        playerIndex: existingPlayer.playerIndex,
        players: this.getPlayersInfo(),
      });
      return;
    }

    // Se a partida já iniciou e o jogador não existe, não permitir
    if (
      this.state.status !== "WAITING" &&
      this.state.status !== "PREPARATION"
    ) {
      throw new Error("Partida já iniciada");
    }

    if (this.state.players.size >= this.state.maxPlayers) {
      throw new Error("Partida cheia");
    }

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
      throw new Error("Reino sem Regente");
    }

    const playerIndex = this.state.players.size;
    const player = new MatchPlayerSchema();
    player.oderId = userId;
    player.odername = kingdom.owner?.username || "Unknown";
    player.kingdomId = kingdomId;
    player.kingdomName = kingdom.name;
    player.playerIndex = playerIndex;
    player.playerColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
    player.isReady = false;
    player.hasFinishedCurrentTurn = false;
    player.raceMetadata = kingdom.race || "";

    this.state.players.set(userId, player);

    client.userData = { userId, kingdomId };

    this.setMetadata({
      ...this.metadata,
      playerCount: this.state.players.size,
      players: Array.from(this.state.players.keys()),
    });

    client.send("match:joined", {
      matchId: this.roomId,
      playerIndex,
      players: this.getPlayersInfo(),
    });

    this.broadcast(
      "match:player_joined",
      {
        player: {
          userId,
          username: player.odername,
          kingdomName: player.kingdomName,
          playerIndex,
        },
        totalPlayers: this.state.players.size,
      },
      { except: client }
    );

    if (this.state.players.size >= this.state.maxPlayers) {
      this.startPreparation();
    }
  }

  async onLeave(client: Client, consented: boolean) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const { userId } = userData;

    if (this.state.status === "WAITING") {
      this.state.players.delete(userId);

      this.setMetadata({
        ...this.metadata,
        playerCount: this.state.players.size,
        players: Array.from(this.state.players.keys()),
      });

      this.broadcast("match:player_left", { userId });
    } else if (!consented) {
      try {
        await this.allowReconnection(client, 120);
      } catch {
        this.handlePlayerDisconnect(userId);
      }
    }

    // Verificar se todos os jogadores desconectaram
    this.checkAllDisconnected();
  }

  /**
   * Verifica se todos os jogadores humanos desconectaram
   */
  private checkAllDisconnected() {
    if (this.state.status === "ACTIVE" || this.state.status === "PREPARATION") {
      // Para Match, verificamos se não há nenhum client conectado
      if (this.clients.length === 0) {

        this.persistenceTimer = this.clock.setTimeout(async () => {
          await this.pauseMatchToDb();
        }, 30000);
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
    }
  }

  /**
   * Pausa a partida no banco de dados
   */
  private async pauseMatchToDb() {
    try {
      await pauseMatch(this.roomId);
    } catch (error) {
      console.error(`[MatchRoom] Erro ao pausar partida:`, error);
    }
  }

  async onDispose() {

    if (this.turnTimer) {
      this.turnTimer.clear();
    }

    if (this.persistenceTimer) {
      this.persistenceTimer.clear();
    }

    // Se a partida estava ativa, pausar no banco
    if (this.state.status === "ACTIVE" || this.state.status === "PREPARATION") {
      await this.pauseMatchToDb();
    }
  }

  private registerMessageHandlers() {
    // Preparação
    this.onMessage("match:ready", (client, _message) => {
      this.handlePlayerReady(client);
    });

    this.onMessage("match:select_capital", (client, { territoryId }) => {
      this.handleSelectCapital(client, territoryId);
    });

    // Turnos
    this.onMessage("turn:finish", (client, _message) => {
      this.handleFinishTurn(client);
    });

    this.onMessage("turn:get_resources", (client, _message) => {
      this.handleGetResources(client);
    });

    // Construção
    this.onMessage(
      "territory:build",
      (client, { territoryId, structureCode }) => {
        this.handleBuild(client, territoryId, structureCode);
      }
    );

    // Unidades
    this.onMessage("unit:move", (client, { unitId, toTerritoryId }) => {
      this.handleUnitMove(client, unitId, toTerritoryId);
    });

    this.onMessage("unit:recruit", (client, { territoryId, unitType }) => {
      this.handleRecruit(client, territoryId, unitType);
    });

    // Crise
    this.onMessage("crisis:investigate", (client, { territoryId }) => {
      this.handleInvestigateCrisis(client, territoryId);
    });
  }

  // =========================================
  // Game Flow
  // =========================================

  private async startPreparation() {

    this.state.status = "PREPARATION";
    this.inPreparation = true;

    await this.generateMap();
    await this.generateCrisis();

    this.setMetadata({
      ...this.metadata,
      status: "PREPARATION",
    });

    this.broadcast("match:preparation_started", {
      territories: this.getTerritoriesInfo(),
      players: this.getPlayersInfo(),
    });
  }

  private async generateMap() {
    const mapSize = 25;
    const generator = new MapGenerator(5, 5);
    const territories = generator.generate();

    territories.forEach((t: GeneratedTerritory, idx: number) => {
      const territory = new TerritorySchema();
      territory.id = `territory_${idx}`;
      territory.name = `Território ${idx + 1}`;
      territory.index = idx;
      territory.x = t.center?.x ?? idx % 5;
      territory.y = t.center?.y ?? Math.floor(idx / 5);
      territory.terrain = t.terrain || "PLAINS";
      territory.ownerId = "";
      territory.ownerColor = "";
      territory.isCapital = false;
      territory.isRevealed = false;

      this.state.territories.set(territory.id, territory);
    });

    this.state.mapWidth = 5;
    this.state.mapHeight = 5;
  }

  private async generateCrisis() {
    const crisisTypes = Object.keys(CRISIS_DEFINITIONS) as CrisisType[];
    const selectedType =
      crisisTypes[Math.floor(Math.random() * crisisTypes.length)];
    const definition = CRISIS_DEFINITIONS[selectedType];

    this.state.crisisState.crisisType = selectedType;
    this.state.crisisState.isActive = false;
    this.state.crisisState.hp = definition.stats.vitality;
    this.state.crisisState.maxHp = definition.stats.maxVitality;
    this.state.crisisState.attack = definition.stats.combat;
    this.state.crisisState.defense = definition.stats.resistance;

    // Sortear territórios com intel
    const intelIndices = new Set<number>();
    while (intelIndices.size < 3) {
      intelIndices.add(Math.floor(Math.random() * 25));
    }

    intelIndices.forEach((idx) => {
      this.state.crisisState.intelTerritoryIndices.push(idx);
    });
  }

  private handlePlayerReady(client: Client) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const player = this.state.getPlayer(userData.userId);
    if (!player) return;

    player.isReady = true;
    this.readyPlayers.add(userData.userId);

    this.broadcast("match:player_ready", { userId: userData.userId });

    if (this.readyPlayers.size >= this.state.players.size) {
      this.startGame();
    }
  }

  private handleSelectCapital(client: Client, territoryId: string) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    if (this.state.status !== "PREPARATION") return;

    const player = this.state.getPlayer(userData.userId);
    if (!player) return;

    const territory = this.state.getTerritory(territoryId);
    if (!territory) {
      client.send("error", { message: "Território não encontrado" });
      return;
    }

    if (territory.ownerId && territory.ownerId !== userData.userId) {
      client.send("error", { message: "Território já ocupado" });
      return;
    }

    // Remover capital anterior se existir
    if (player.capitalTerritoryId) {
      const oldCapital = this.state.getTerritory(player.capitalTerritoryId);
      if (oldCapital && oldCapital.ownerId === userData.userId) {
        oldCapital.isCapital = false;
        if (
          !this.state
            .getPlayerTerritories(userData.userId)
            .some((t) => t.id !== oldCapital.id)
        ) {
          oldCapital.ownerId = "";
          oldCapital.ownerColor = "";
        }
      }
    }

    // Definir nova capital
    territory.ownerId = userData.userId;
    territory.ownerColor = player.playerColor;
    territory.isCapital = true;
    territory.isRevealed = true;
    player.capitalTerritoryId = territoryId;

    this.broadcast("match:capital_selected", {
      userId: userData.userId,
      territoryId,
    });
  }

  private startGame() {

    this.state.status = "ACTIVE";
    this.inPreparation = false;
    this.state.currentRound = 1;
    this.state.currentTurn = "ADMINISTRACAO";

    // Definir todos os jogadores como ativos no turno
    this.state.activePlayerIds.clear();
    this.state.players.forEach((player) => {
      this.state.activePlayerIds.push(player.oderId);
      player.hasFinishedCurrentTurn = false;
    });

    this.setMetadata({
      ...this.metadata,
      status: "ACTIVE",
    });

    this.broadcast("match:started", {
      round: this.state.currentRound,
      turn: this.state.currentTurn,
    });
  }

  private handleFinishTurn(client: Client) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const player = this.state.getPlayer(userData.userId);
    if (!player) return;

    player.hasFinishedCurrentTurn = true;

    this.broadcast("match:player_finished_turn", { userId: userData.userId });

    if (this.state.allPlayersFinishedTurn()) {
      this.advanceToNextTurn();
    }
  }

  private advanceToNextTurn() {
    const currentTurnIndex = TURN_TYPES.indexOf(this.state.currentTurn as any);
    const nextTurnIndex = (currentTurnIndex + 1) % TURN_TYPES.length;

    if (nextTurnIndex === 0) {
      this.state.currentRound++;
    }

    this.state.currentTurn = TURN_TYPES[nextTurnIndex];
    this.state.resetPlayerTurnStatus();

    this.broadcast("match:turn_changed", {
      round: this.state.currentRound,
      turn: this.state.currentTurn,
    });

    // Processar turno de crise se for o turno
    if (this.state.currentTurn === "CRISE") {
      this.processCrisisTurn();
    }
  }

  private processCrisisTurn() {
    if (!this.state.crisisState.isActive) {
      // Chance de ativar a crise (aumenta com rounds)
      const activationChance = Math.min(0.1 * this.state.currentRound, 0.5);
      if (Math.random() < activationChance) {
        this.state.crisisState.isActive = true;

        this.broadcast("match:crisis_activated", {
          type: this.state.crisisState.crisisType,
        });
      }
    } else {
      // Crise já ativa - fazer ação
      this.broadcast("match:crisis_action", {
        type: this.state.crisisState.crisisType,
        message: "A crise avança!",
      });
    }
  }

  // =========================================
  // Resource Handlers
  // =========================================

  private handleGetResources(client: Client) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const player = this.state.getPlayer(userData.userId);
    if (!player) return;

    client.send("turn:resources", {
      ore: player.resources.ore,
      supplies: player.resources.supplies,
      arcane: player.resources.arcane,
      experience: player.resources.experience,
      devotion: player.resources.devotion,
    });
  }

  // =========================================
  // Construction Handlers
  // =========================================

  private handleBuild(
    client: Client,
    territoryId: string,
    structureCode: string
  ) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const player = this.state.getPlayer(userData.userId);
    if (!player) return;

    const territory = this.state.getTerritory(territoryId);
    if (!territory) {
      client.send("error", { message: "Território não encontrado" });
      return;
    }

    if (territory.ownerId !== userData.userId) {
      client.send("error", { message: "Território não é seu" });
      return;
    }

    // TODO: Verificar custos e requisitos
    territory.structures.push(structureCode);

    this.broadcast("territory:built", {
      territoryId,
      structureCode,
      userId: userData.userId,
    });
  }

  // =========================================
  // Unit Handlers
  // =========================================

  private handleUnitMove(
    client: Client,
    unitId: string,
    toTerritoryId: string
  ) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    // TODO: Implementar movimento de unidades
    this.broadcast("unit:moved", {
      unitId,
      toTerritoryId,
      userId: userData.userId,
    });
  }

  private handleRecruit(client: Client, territoryId: string, unitType: string) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    // TODO: Implementar recrutamento
    this.broadcast("unit:recruited", {
      territoryId,
      unitType,
      userId: userData.userId,
    });
  }

  // =========================================
  // Crisis Handlers
  // =========================================

  private handleInvestigateCrisis(client: Client, territoryId: string) {
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const territory = this.state.getTerritory(territoryId);
    if (!territory || territory.ownerId !== userData.userId) {
      client.send("error", { message: "Não pode investigar este território" });
      return;
    }

    // Verificar se tem intel
    const territoryIndex = parseInt(territoryId.replace("territory_", ""));
    const hasIntel =
      this.state.crisisState.intelTerritoryIndices.includes(territoryIndex);

    if (hasIntel) {
      // Revelar informação da crise
      const crisisType = this.state.crisisState.crisisType;
      if (!this.state.crisisState.revealedSpecials.includes(crisisType)) {
        this.state.crisisState.revealedSpecials.push(crisisType);
      }

      client.send("crisis:intel_found", {
        territoryId,
        crisisType,
        hint: `A ameaça é: ${crisisType}`,
      });
    } else {
      client.send("crisis:no_intel", {
        territoryId,
        message: "Nenhuma informação encontrada",
      });
    }

    territory.hasIntel = false; // Consumir intel
  }

  // =========================================
  // Disconnect Handler
  // =========================================

  private handlePlayerDisconnect(userId: string) {
    const player = this.state.getPlayer(userId);
    if (!player) return;

    // Em partidas estratégicas, desconexão pode pausar o jogo
    // ou dar vitória aos outros jogadores
    this.broadcast("match:player_disconnected", {
      userId,
      message: "Jogador desconectou",
    });

    // Se só resta 1 jogador, ele vence
    const connectedPlayers = Array.from(this.clients)
      .map((c) => (c.userData as { userId: string } | undefined)?.userId)
      .filter(Boolean);

    if (connectedPlayers.length <= 1 && this.state.status === "ACTIVE") {
      this.state.status = "FINISHED";
      this.state.winnerId = connectedPlayers[0] || "";
      this.state.winReason = "Único jogador restante";

      this.broadcast("match:ended", {
        winnerId: this.state.winnerId,
        reason: this.state.winReason,
      });
    }
  }

  // =========================================
  // Helpers
  // =========================================

  private getPlayersInfo() {
    const players: any[] = [];
    this.state.players.forEach((p) => {
      players.push({
        userId: p.oderId,
        username: p.odername,
        kingdomName: p.kingdomName,
        playerIndex: p.playerIndex,
        playerColor: p.playerColor,
        isReady: p.isReady,
        capitalTerritoryId: p.capitalTerritoryId,
      });
    });
    return players;
  }

  private getTerritoriesInfo() {
    const territories: any[] = [];
    this.state.territories.forEach((t) => {
      territories.push({
        id: t.id,
        name: t.name,
        index: t.index,
        x: t.x,
        y: t.y,
        terrain: t.terrain,
        ownerId: t.ownerId,
        ownerColor: t.ownerColor,
        isCapital: t.isCapital,
        structures: Array.from(t.structures),
      });
    });
    return territories;
  }
}

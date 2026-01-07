// server/src/colyseus/rooms/ArenaRoom.ts
// Room principal para Arena (Lobby + Battle)

import { Room, Client, Delayed } from "@colyseus/core";
import { prisma } from "../../lib/prisma";
import {
  ArenaBattleState,
  BattlePlayerSchema,
  BattleUnitSchema,
  BattleObstacleSchema,
  ArenaConfigSchema,
  BattleMapConfigSchema,
} from "../schemas";
import { createBattleUnitsForArena } from "../../utils/battle-unit.factory";
import {
  TURN_CONFIG,
  GRID_CONFIG,
  getGridDimensions,
  getRandomTerrain,
  getRandomTerritorySize,
  getObstacleCount,
  getRandomObstacleType,
  type ObstacleType,
} from "../../../../shared/config/global.config";
import type { BattleUnit } from "../../../../shared/types/battle.types";

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

interface ArenaRoomOptions {
  userId: string;
  kingdomId: string;
  maxPlayers?: number;
  vsBot?: boolean;
}

interface JoinOptions {
  userId: string;
  kingdomId: string;
}

export class ArenaRoom extends Room<ArenaBattleState> {
  maxClients = 8;

  private turnTimer: Delayed | null = null;
  private lobbyPhase: boolean = true;
  private readyPlayers = new Set<string>();
  private disconnectedPlayers = new Map<
    string,
    { timeout: Delayed; data: any }
  >();
  private rematchRequests = new Set<string>();

  async onCreate(options: ArenaRoomOptions) {
    this.autoDispose = true;
    console.log(`[ArenaRoom] Criando sala: ${this.roomId}`);
    console.log(
      `[ArenaRoom] Options recebidas:`,
      JSON.stringify(options, null, 2)
    );

    // Inicializar estado
    this.setState(new ArenaBattleState());
    this.state.battleId = this.roomId;
    this.state.lobbyId = this.roomId;
    this.state.status = "WAITING";
    this.state.maxPlayers = Math.min(8, Math.max(2, options.maxPlayers || 2));

    // Configurar metadata para listagem
    this.setMetadata({
      hostUserId: options.userId,
      maxPlayers: this.state.maxPlayers,
      playerCount: 0,
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

  async onJoin(client: Client, options: JoinOptions) {
    console.log(
      `[ArenaRoom] ${client.sessionId} entrou na sala ${this.roomId}`
    );

    const { userId, kingdomId } = options;

    // Verificar se ainda está em fase de lobby
    if (!this.lobbyPhase && this.state.status !== "WAITING") {
      // Tentar reconectar jogador desconectado
      const disconnected = this.disconnectedPlayers.get(userId);
      if (disconnected) {
        disconnected.timeout.clear();
        this.disconnectedPlayers.delete(userId);

        // Atualizar player como conectado
        const player = this.state.getPlayer(userId);
        if (player) {
          player.isConnected = true;
        }

        client.send("battle:reconnected", { success: true });
        return;
      }

      throw new Error("Batalha já iniciada");
    }

    // Verificar se já está no lobby
    if (this.state.getPlayer(userId)) {
      throw new Error("Você já está neste lobby");
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

    // Atualizar metadata
    this.setMetadata({
      ...this.metadata,
      playerCount: this.state.players.length,
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
      `[ArenaRoom] vsBot check: vsBot=${this.metadata.vsBot}, players=${this.state.players.length}`
    );
    if (this.metadata.vsBot && this.state.players.length === 1) {
      console.log(`[ArenaRoom] Iniciando fluxo vsBot...`);
      await this.addBotPlayer();
      console.log(
        `[ArenaRoom] Bot adicionado, players agora: ${this.state.players.length}`
      );
      await this.startBattle();
      console.log(
        `[ArenaRoom] startBattle() concluído, status: ${this.state.status}`
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
    console.log(`[ArenaRoom] ${userId} saiu da sala (consented: ${consented})`);

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
          status: "WAITING",
        });

        this.broadcast("lobby:player_left", { userId });
      }
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
  }

  onDispose() {
    console.log(`[ArenaRoom] Sala ${this.roomId} sendo destruída`);

    // Limpar timer
    if (this.turnTimer) {
      this.turnTimer.clear();
      this.turnTimer = null;
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
      (client, { attackerId, targetId, targetObstacleId }) => {
        this.handleAttack(client, attackerId, targetId, targetObstacleId);
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

    this.onMessage(
      "battle:cast_spell",
      (client, { unitId, spellCode, targetId, targetPosition }) => {
        this.handleCastSpell(
          client,
          unitId,
          spellCode,
          targetId,
          targetPosition
        );
      }
    );

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
  }

  // =========================================
  // Battle Logic
  // =========================================

  private async startBattle() {
    console.log(`[ArenaRoom] ========== START BATTLE ==========`);
    console.log(`[ArenaRoom] Room: ${this.roomId}`);
    console.log(`[ArenaRoom] Players: ${this.state.players.length}`);

    this.lobbyPhase = false;
    this.state.status = "ACTIVE";
    console.log(`[ArenaRoom] Status setado para: ${this.state.status}`);

    // Gerar configuração do mapa
    const terrainType = getRandomTerrain();
    const territorySize = getRandomTerritorySize();
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
          troopTemplates: true,
        },
      });

      if (!kingdom) continue;

      const units = await createBattleUnitsForArena(
        kingdom,
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
    // Implementação simplificada para bots
    // Na versão completa, usar createBotKingdom e createBattleUnitsForArena
    const botUnit = new BattleUnitSchema();
    botUnit.id = `bot_unit_${Date.now()}`;
    botUnit.sourceUnitId = "bot";
    botUnit.ownerId = botPlayer.oderId;
    botUnit.ownerKingdomId = botPlayer.kingdomId;
    botUnit.name = "Bot Warrior";
    botUnit.category = "REGENT";
    botUnit.level = 1;
    botUnit.race = "HUMAN";
    botUnit.combat = 10;
    botUnit.speed = 5;
    botUnit.focus = 5;
    botUnit.resistance = 5;
    botUnit.will = 5;
    botUnit.vitality = 20;
    botUnit.currentHp = 20;
    botUnit.maxHp = 20;
    botUnit.posX = this.state.gridWidth - 2;
    botUnit.posY = 1;
    botUnit.movesLeft = 5;
    botUnit.actionsLeft = 1;
    botUnit.attacksLeftThisTurn = 1;
    botUnit.isAIControlled = true;

    this.state.units.set(botUnit.id, botUnit);
    this.state.actionOrder.push(botUnit.id);
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
      const firstUnit = this.state.actionOrder[0];
      if (firstUnit) {
        this.state.activeUnitId = firstUnit;
        const unit = this.state.units.get(firstUnit);
        this.state.currentPlayerId = unit?.ownerId || "";
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

        this.broadcast("battle:turn_changed", {
          activeUnitId: unitId,
          round: this.state.round,
          turnTimer: this.state.turnTimer,
        });

        // Se é unidade de IA, executar turno
        if (unit.isAIControlled) {
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
    // IA simplificada - mover em direção ao inimigo mais próximo e atacar
    setTimeout(() => {
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
        this.advanceToNextUnit();
        return;
      }

      const enemy = closestEnemy as BattleUnitSchema;

      // Mover em direção ao inimigo
      const dx = Math.sign(enemy.posX - unit.posX);
      const dy = Math.sign(enemy.posY - unit.posY);

      if (unit.movesLeft > 0 && closestDist > 1) {
        const newX = unit.posX + dx;
        const newY = unit.posY + dy;

        if (this.isValidPosition(newX, newY)) {
          unit.posX = newX;
          unit.posY = newY;
          unit.movesLeft--;

          this.broadcast("battle:unit_moved", {
            unitId: unit.id,
            fromX: unit.posX - dx,
            fromY: unit.posY - dy,
            toX: newX,
            toY: newY,
            movesLeft: unit.movesLeft,
          });
        }
      }

      // Atacar se adjacente
      const newDist =
        Math.abs(enemy.posX - unit.posX) + Math.abs(enemy.posY - unit.posY);
      if (newDist <= 1 && unit.attacksLeftThisTurn > 0) {
        this.performAttack(unit, enemy);
      }

      // Fim do turno da IA
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

  private performAttack(attacker: BattleUnitSchema, target: BattleUnitSchema) {
    const damage = Math.max(1, attacker.combat - target.damageReduction);

    target.currentHp -= damage;
    attacker.attacksLeftThisTurn--;

    if (target.currentHp <= 0) {
      target.currentHp = 0;
      target.isAlive = false;
    }

    this.broadcast("battle:unit_attacked", {
      attackerId: attacker.id,
      targetId: target.id,
      damage,
      targetHpAfter: target.currentHp,
      targetDefeated: !target.isAlive,
    });

    if (!target.isAlive) {
      this.checkBattleEnd();
    }
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
  }

  private handleAttack(
    client: Client,
    attackerId: string,
    targetId?: string,
    targetObstacleId?: string
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

    if (attacker.attacksLeftThisTurn <= 0) {
      client.send("error", { message: "Sem ataques restantes" });
      return;
    }

    if (targetId) {
      const target = this.state.units.get(targetId);
      if (!target) {
        client.send("error", { message: "Alvo não encontrado" });
        return;
      }

      // Verificar alcance (adjacente)
      const distance =
        Math.abs(target.posX - attacker.posX) +
        Math.abs(target.posY - attacker.posY);
      if (distance > 1) {
        client.send("error", { message: "Alvo fora de alcance" });
        return;
      }

      this.performAttack(attacker, target);
    } else if (targetObstacleId) {
      // Atacar obstáculo
      const obstacle = this.state.obstacles.find(
        (o) => o.id === targetObstacleId
      );
      if (!obstacle) {
        client.send("error", { message: "Obstáculo não encontrado" });
        return;
      }

      const distance =
        Math.abs(obstacle.posX - attacker.posX) +
        Math.abs(obstacle.posY - attacker.posY);
      if (distance > 1) {
        client.send("error", { message: "Obstáculo fora de alcance" });
        return;
      }

      obstacle.hp -= attacker.combat;
      attacker.attacksLeftThisTurn--;

      if (obstacle.hp <= 0) {
        obstacle.destroyed = true;
      }

      this.broadcast("battle:obstacle_attacked", {
        attackerId,
        obstacleId: targetObstacleId,
        damage: attacker.combat,
        destroyed: obstacle.destroyed,
      });
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
    // Implementação de ações especiais (skills)
    // Delegar para sistema de skills existente
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const unit = this.state.units.get(unitId);
    if (!unit || unit.ownerId !== userData.userId) {
      client.send("error", { message: "Ação inválida" });
      return;
    }

    // TODO: Integrar com sistema de skills existente
    this.broadcast("battle:action_executed", {
      actionName,
      unitId,
      params,
      success: true,
    });
  }

  private handleCastSpell(
    client: Client,
    unitId: string,
    spellCode: string,
    targetId?: string,
    targetPosition?: { x: number; y: number }
  ) {
    // Implementação de magias
    const userData = client.userData as { userId: string } | undefined;
    if (!userData) return;

    const unit = this.state.units.get(unitId);
    if (!unit || unit.ownerId !== userData.userId) {
      client.send("error", { message: "Não pode lançar magia" });
      return;
    }

    // TODO: Integrar com sistema de spells existente
    this.broadcast("battle:spell_cast", {
      unitId,
      spellCode,
      targetId,
      targetPosition,
      success: true,
    });
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
    console.log(`[ArenaRoom] addBotPlayer() chamado`);
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
}

// server/src/colyseus/schemas/battle.schema.ts
// Schemas para battle: Lobby e Battle states

import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { BattleUnitSchema } from "./battle-unit.schema";
import {
  BattleObstacleSchema,
  BattleConfigSchema,
  BattleLogEntry,
} from "../../../../colyseus/schemas/common.schema";
import { GRID_CONFIG } from "@boundless/shared/config";

/**
 * Jogador em um lobby de batalha
 */
export class BattleLobbyPlayerSchema extends Schema {
  @type("string") oderId: string = "";
  @type("string") socketId: string = "";
  @type("string") kingdomId: string = "";
  @type("string") username: string = "";
  @type("string") kingdomName: string = "";
  @type("number") playerIndex: number = 0;
  @type("boolean") isReady: boolean = false;
  @type("boolean") isBot: boolean = false;
}

/**
 * Estado do lobby de Batalha
 */
export class BattleLobbyState extends Schema {
  @type("string") lobbyId: string = "";
  @type("string") hostUserId: string = "";
  @type("number") maxPlayers: number = 2;
  @type("string") status: string = "WAITING"; // WAITING | READY | BATTLING | ENDED
  @type("boolean") vsBot: boolean = false;
  @type("number") createdAt: number = Date.now();

  @type([BattleLobbyPlayerSchema]) players =
    new ArraySchema<BattleLobbyPlayerSchema>();
}

/**
 * Jogador em uma batalha
 */
export class BattlePlayerSchema extends Schema {
  @type("string") oderId: string = "";
  @type("string") kingdomId: string = "";
  @type("string") kingdomName: string = "";
  @type("string") username: string = "";
  @type("number") playerIndex: number = 0;
  @type("string") playerColor: string = "#e63946";
  @type("boolean") isConnected: boolean = true;
  @type("boolean") isBot: boolean = false;
  @type("boolean") surrendered: boolean = false;
}

/**
 * Estado completo de uma batalha
 */
export class BattleSessionState extends Schema {
  @type("string") battleId: string = "";
  @type("string") lobbyId: string = "";
  @type("string") matchId: string = "";
  @type("boolean") isBattle: boolean = true;
  @type("number") maxPlayers: number = 2;

  // Status da batalha
  @type("string") status: string = "ACTIVE"; // ACTIVE | PAUSED | ENDED
  @type("number") round: number = 1;
  @type("number") currentTurnIndex: number = 0;
  @type("string") activeUnitId: string = ""; // Unidade que "travou" (fez ação/movimento)
  @type("string") selectedUnitId: string = ""; // Unidade selecionada (ainda pode mudar)
  @type("string") currentPlayerId: string = ""; // ID do jogador que controla o turno atual
  @type("boolean") unitLocked: boolean = false; // Se true, a unidade está travada (não pode mudar seleção)
  @type("number") turnTimer: number = 60;

  // Grid (valores padrão de GRID_CONFIG.defaultSize = MEDIUM)
  @type("number") gridWidth: number =
    GRID_CONFIG.territorySizes[GRID_CONFIG.defaultSize].width;
  @type("number") gridHeight: number =
    GRID_CONFIG.territorySizes[GRID_CONFIG.defaultSize].height;

  // Jogadores
  @type([BattlePlayerSchema]) players = new ArraySchema<BattlePlayerSchema>();

  // Ordem de ação (IDs das unidades)
  @type(["string"]) actionOrder = new ArraySchema<string>();

  // Unidades
  @type({ map: BattleUnitSchema }) units = new MapSchema<BattleUnitSchema>();

  // Obstáculos
  @type([BattleObstacleSchema]) obstacles =
    new ArraySchema<BattleObstacleSchema>();

  // Configuração
  @type(BattleConfigSchema) config = new BattleConfigSchema();

  // Logs de batalha (últimos 50)
  @type([BattleLogEntry]) logs = new ArraySchema<BattleLogEntry>();

  // Ransom (resgate)
  @type("number") ransomPrice: number = 0;
  @type("string") ransomResource: string = "ore";

  // Resultado (preenchido quando status = ENDED)
  @type("string") winnerId: string = "";
  @type("string") winReason: string = "";

  // Rematch
  @type(["string"]) rematchRequests = new ArraySchema<string>();

  /**
   * Adiciona um log de batalha (mantém últimos 50)
   */
  addLog(entry: Partial<BattleLogEntry>): void {
    const log = new BattleLogEntry();
    log.timestamp = Date.now();
    log.type = entry.type || "INFO";
    log.message = entry.message || "";
    log.actorId = entry.actorId || "";
    log.targetId = entry.targetId || "";
    log.value = entry.value || 0;

    this.logs.push(log);

    // Manter apenas últimos 50 logs
    while (this.logs.length > 50) {
      this.logs.shift();
    }
  }

  /**
   * Obtém uma unidade pelo ID
   */
  getUnit(unitId: string): BattleUnitSchema | undefined {
    return this.units.get(unitId);
  }

  /**
   * Obtém todas as unidades de um jogador
   */
  getPlayerUnits(userId: string): BattleUnitSchema[] {
    const result: BattleUnitSchema[] = [];
    this.units.forEach((unit: BattleUnitSchema) => {
      if (unit.ownerId === userId) {
        result.push(unit);
      }
    });
    return result;
  }

  /**
   * Obtém unidades vivas
   */
  getAliveUnits(): BattleUnitSchema[] {
    const result: BattleUnitSchema[] = [];
    this.units.forEach((unit: BattleUnitSchema) => {
      if (unit.isAlive) {
        result.push(unit);
      }
    });
    return result;
  }

  /**
   * Obtém a unidade ativa atual
   */
  getActiveUnit(): BattleUnitSchema | undefined {
    if (!this.activeUnitId) return undefined;
    return this.units.get(this.activeUnitId);
  }

  /**
   * Verifica se um jogador tem unidades vivas
   */
  playerHasAliveUnits(userId: string): boolean {
    let hasAlive = false;
    this.units.forEach((unit: BattleUnitSchema) => {
      if (unit.ownerId === userId && unit.isAlive) {
        hasAlive = true;
      }
    });
    return hasAlive;
  }

  /**
   * Obtém jogador pelo userId
   */
  getPlayer(userId: string): BattlePlayerSchema | undefined {
    return this.players.find((p: BattlePlayerSchema) => p.oderId === userId);
  }

  /**
   * Obtém jogador pelo índice
   */
  getPlayerByIndex(index: number): BattlePlayerSchema | undefined {
    return this.players.find(
      (p: BattlePlayerSchema) => p.playerIndex === index
    );
  }
}

/**
 * Estado de uma room "global" para funcionalidades que não são de batalha
 * Ex: lobby list, chat global, etc.
 */
export class GlobalRoomState extends Schema {
  @type("number") connectedPlayers: number = 0;
  @type("number") activeLobbies: number = 0;
  @type("number") activeBattles: number = 0;

  // Lista de lobbies disponíveis para join
  @type([BattleLobbyState]) availableLobbies =
    new ArraySchema<BattleLobbyState>();
}

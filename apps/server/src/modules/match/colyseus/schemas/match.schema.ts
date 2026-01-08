// server/src/colyseus/schemas/match.schema.ts
// Schemas para Match (partidas estratégicas do mapa)

import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { PlayerResources } from "../../../../colyseus/schemas/common.schema";

/**
 * Território no mapa
 */
export class TerritorySchema extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("number") index: number = 0;
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") terrain: string = "PLAINS";
  @type("string") ownerId: string = "";
  @type("string") ownerColor: string = "";
  @type("boolean") isCapital: boolean = false;
  @type("boolean") hasIntel: boolean = false;
  @type("boolean") isRevealed: boolean = false;
  @type(["string"]) structures = new ArraySchema<string>();
  @type(["string"]) unitIds = new ArraySchema<string>();
}

/**
 * Reino/Jogador em uma partida
 */
export class MatchPlayerSchema extends Schema {
  @type("string") oderId: string = "";
  @type("string") odername: string = "";
  @type("string") kingdomId: string = "";
  @type("string") kingdomName: string = "";
  @type("number") playerIndex: number = 0;
  @type("string") playerColor: string = "#e63946";
  @type("string") capitalTerritoryId: string = "";
  @type("boolean") isReady: boolean = false;
  @type("boolean") hasFinishedCurrentTurn: boolean = false;
  @type("number") locationIndex: number = -1;
  @type("string") raceMetadata: string = "";
  @type("string") inventory: string = "{}";
  @type(PlayerResources) resources = new PlayerResources();
}

/**
 * Estado da Crise
 */
export class CrisisStateSchema extends Schema {
  @type("string") crisisType: string = "";
  @type("boolean") isActive: boolean = false;
  @type("number") hp: number = 0;
  @type("number") maxHp: number = 0;
  @type("number") attack: number = 0;
  @type("number") defense: number = 0;
  @type("number") positionIndex: number = -1;
  @type(["number"]) intelTerritoryIndices = new ArraySchema<number>();
  @type(["string"]) revealedSpecials = new ArraySchema<string>();
  @type("string") extraData: string = "{}";
}

/**
 * Estado completo de uma partida estratégica
 */
export class MatchState extends Schema {
  @type("string") matchId: string = "";
  @type("string") hostUserId: string = "";
  @type("number") maxPlayers: number = 4;
  @type("string") status: string = "WAITING"; // WAITING | PREPARATION | ACTIVE | FINISHED

  // Turnos e rounds
  @type("number") currentRound: number = 0;
  @type("string") currentTurn: string = "ADMINISTRACAO";
  @type(["string"]) activePlayerIds = new ArraySchema<string>();

  // Timer
  @type("number") turnTimer: number = 0;
  @type("boolean") timerPaused: boolean = false;

  // Jogadores
  @type({ map: MatchPlayerSchema }) players =
    new MapSchema<MatchPlayerSchema>();

  // Mapa - territórios
  @type({ map: TerritorySchema }) territories =
    new MapSchema<TerritorySchema>();

  // Grid do mapa
  @type("number") mapWidth: number = 5;
  @type("number") mapHeight: number = 5;

  // Crise
  @type(CrisisStateSchema) crisisState = new CrisisStateSchema();

  // Timestamps
  @type("number") createdAt: number = Date.now();
  @type("number") updatedAt: number = Date.now();

  // Vencedor (quando status = FINISHED)
  @type("string") winnerId: string = "";
  @type("string") winReason: string = "";

  /**
   * Obtém um jogador pelo userId
   */
  getPlayer(userId: string): MatchPlayerSchema | undefined {
    return this.players.get(userId);
  }

  /**
   * Obtém território pelo ID
   */
  getTerritory(territoryId: string): TerritorySchema | undefined {
    return this.territories.get(territoryId);
  }

  /**
   * Obtém territórios de um jogador
   */
  getPlayerTerritories(userId: string): TerritorySchema[] {
    const result: TerritorySchema[] = [];
    this.territories.forEach((territory: TerritorySchema) => {
      if (territory.ownerId === userId) {
        result.push(territory);
      }
    });
    return result;
  }

  /**
   * Verifica se todos os jogadores terminaram o turno atual
   */
  allPlayersFinishedTurn(): boolean {
    let allFinished = true;
    this.players.forEach((player: MatchPlayerSchema) => {
      if (!player.hasFinishedCurrentTurn) {
        allFinished = false;
      }
    });
    return allFinished;
  }

  /**
   * Reseta o status de turno de todos os jogadores
   */
  resetPlayerTurnStatus(): void {
    this.players.forEach((player: MatchPlayerSchema) => {
      player.hasFinishedCurrentTurn = false;
    });
  }
}

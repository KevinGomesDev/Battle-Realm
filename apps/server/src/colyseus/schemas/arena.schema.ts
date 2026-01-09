// server/src/colyseus/schemas/arena.schema.ts
// Schemas Colyseus para o Sistema de Arena

import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

/**
 * Informações do reino para exibição no desafio
 */
export class ChallengeKingdomSchema extends Schema {
  @type("string") kingdomId: string = "";
  @type("string") kingdomName: string = "";
  @type("string") userId: string = "";
  @type("string") username: string = "";
  @type("number") power: number = 0;
  @type("number") unitCount: number = 0;
}

/**
 * Estado de um desafio
 */
export class ChallengeSchema extends Schema {
  @type("string") challengeId: string = "";
  @type("string") type: string = "DIRECT"; // DIRECT | OPEN
  @type("string") status: string = "PENDING";

  @type(ChallengeKingdomSchema) challenger = new ChallengeKingdomSchema();
  @type(ChallengeKingdomSchema) challenged: ChallengeKingdomSchema | null =
    null;

  @type("number") createdAt: number = 0;
  @type("number") expiresAt: number = 0;
  @type("number") countdownSeconds: number = 0;
  @type("string") battleId: string = "";
}

/**
 * Estado global da Arena (gerenciado pelo ArenaRoom)
 */
export class ArenaState extends Schema {
  /** Todos os desafios ativos (pendentes ou em countdown) */
  @type({ map: ChallengeSchema }) challenges = new MapSchema<ChallengeSchema>();

  /** IDs dos usuários online disponíveis para desafio */
  @type(["string"]) onlineUsers = new ArraySchema<string>();
}

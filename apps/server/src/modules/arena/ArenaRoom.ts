// server/src/modules/arena/ArenaRoom.ts
// Sala Colyseus para Sistema de Arena (Desafios)

import { Room, Client } from "@colyseus/core";
import {
  ArenaState,
  ChallengeSchema,
  ChallengeKingdomSchema,
} from "../../colyseus/schemas";
import { prisma } from "../../lib/prisma";
import { ARENA_MESSAGES } from "@boundless/shared/types/arena.types";
import type {
  Challenge,
  ChallengeKingdomInfo,
  CreateDirectChallengePayload,
  CreateOpenChallengePayload,
  AcceptChallengePayload,
  DeclineChallengePayload,
  CancelChallengePayload,
} from "@boundless/shared/types/arena.types";
import { matchMaker } from "@colyseus/core";

// ============================================
// Constants
// ============================================

const DIRECT_CHALLENGE_TIMEOUT_MS = 30_000; // 30 segundos para aceitar desafio direto
const OPEN_CHALLENGE_TIMEOUT_MS = 300_000; // 5 minutos para desafio aberto
const BATTLE_COUNTDOWN_SECONDS = 5; // Countdown antes da batalha iniciar
const CLEANUP_INTERVAL_MS = 5_000; // Intervalo para limpar desafios expirados

// ============================================
// Types
// ============================================

interface ArenaClient extends Client {
  userId?: string;
  username?: string;
}

// ============================================
// ArenaRoom
// ============================================

export class ArenaRoom extends Room<ArenaState> {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private countdownIntervals: Map<string, NodeJS.Timeout> = new Map();

  // ============================================
  // Lifecycle
  // ============================================

  onCreate() {
    this.autoDispose = false; // Manter arena sempre ativa (singleton)
    this.setState(new ArenaState());
    this.maxClients = 1000; // Muitos clientes podem estar na arena

    this.setupMessageHandlers();
    this.startCleanupInterval();

    console.log("[ArenaRoom] ⚔️ Arena criada");
  }

  async onJoin(
    client: ArenaClient,
    options: { userId: string; username: string }
  ) {
    client.userId = options.userId;
    client.username = options.username;

    // Adicionar à lista de online
    if (!this.state.onlineUsers.includes(options.userId)) {
      this.state.onlineUsers.push(options.userId);
    }

    console.log(`[ArenaRoom] 👤 ${options.username} entrou na arena`);

    // Enviar desafios pendentes para este usuário
    await this.sendPendingChallenges(client);
  }

  onLeave(client: ArenaClient) {
    if (client.userId) {
      const idx = this.state.onlineUsers.indexOf(client.userId);
      if (idx !== -1) {
        this.state.onlineUsers.splice(idx, 1);
      }

      // Cancelar desafios pendentes deste usuário
      this.cancelUserChallenges(client.userId);

      console.log(`[ArenaRoom] 👤 ${client.username} saiu da arena`);
    }
  }

  onDispose() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.countdownIntervals.forEach((interval) => clearInterval(interval));
    this.countdownIntervals.clear();

    console.log("[ArenaRoom] Arena encerrada");
  }

  // ============================================
  // Message Handlers
  // ============================================

  private setupMessageHandlers() {
    // Criar desafio direto
    this.onMessage(
      ARENA_MESSAGES.CREATE_DIRECT,
      async (client: ArenaClient, payload: CreateDirectChallengePayload) => {
        await this.handleCreateDirectChallenge(client, payload);
      }
    );

    // Criar desafio aberto
    this.onMessage(
      ARENA_MESSAGES.CREATE_OPEN,
      async (client: ArenaClient, payload: CreateOpenChallengePayload) => {
        await this.handleCreateOpenChallenge(client, payload);
      }
    );

    // Aceitar desafio
    this.onMessage(
      ARENA_MESSAGES.ACCEPT,
      async (client: ArenaClient, payload: AcceptChallengePayload) => {
        await this.handleAcceptChallenge(client, payload);
      }
    );

    // Recusar desafio
    this.onMessage(
      ARENA_MESSAGES.DECLINE,
      (client: ArenaClient, payload: DeclineChallengePayload) => {
        this.handleDeclineChallenge(client, payload);
      }
    );

    // Cancelar desafio
    this.onMessage(
      ARENA_MESSAGES.CANCEL,
      (client: ArenaClient, payload: CancelChallengePayload) => {
        this.handleCancelChallenge(client, payload);
      }
    );

    // Listar desafios abertos
    this.onMessage(ARENA_MESSAGES.LIST_OPEN, (client: ArenaClient) => {
      this.handleListOpenChallenges(client);
    });

    // Listar oponentes
    this.onMessage(
      ARENA_MESSAGES.LIST_OPPONENTS,
      async (client: ArenaClient) => {
        await this.handleListOpponents(client);
      }
    );
  }

  // ============================================
  // Challenge Handlers
  // ============================================

  private async handleCreateDirectChallenge(
    client: ArenaClient,
    payload: CreateDirectChallengePayload
  ) {
    try {
      const { challengerKingdomId, targetUserId, targetKingdomId } = payload;

      // Buscar informações do reino desafiante
      const challengerInfo = await this.getKingdomInfo(challengerKingdomId);
      if (!challengerInfo) {
        client.send(ARENA_MESSAGES.ERROR, { error: "Reino não encontrado" });
        return;
      }

      // Buscar informações do reino desafiado
      const challengedInfo = await this.getKingdomInfo(targetKingdomId);
      if (!challengedInfo) {
        client.send(ARENA_MESSAGES.ERROR, {
          error: "Reino alvo não encontrado",
        });
        return;
      }

      // Verificar se o alvo está online
      if (!this.state.onlineUsers.includes(targetUserId)) {
        client.send(ARENA_MESSAGES.ERROR, { error: "Jogador não está online" });
        return;
      }

      // Criar o desafio
      const challenge = this.createChallengeSchema(
        "DIRECT",
        challengerInfo,
        challengedInfo,
        DIRECT_CHALLENGE_TIMEOUT_MS
      );

      this.state.challenges.set(challenge.challengeId, challenge);

      // Notificar o desafiante
      client.send(ARENA_MESSAGES.CHALLENGE_CREATED, {
        success: true,
        challenge: this.schemaToChallenge(challenge),
      });

      // Notificar o desafiado
      const targetClient = this.findClientByUserId(targetUserId);
      if (targetClient) {
        targetClient.send(ARENA_MESSAGES.CHALLENGE_RECEIVED, {
          challenge: this.schemaToChallenge(challenge),
        });
      }

      console.log(
        `[ArenaRoom] ⚔️ Desafio direto: ${challengerInfo.username} → ${challengedInfo.username}`
      );
    } catch (error) {
      console.error("[ArenaRoom] Erro ao criar desafio direto:", error);
      client.send(ARENA_MESSAGES.ERROR, { error: "Erro ao criar desafio" });
    }
  }

  private async handleCreateOpenChallenge(
    client: ArenaClient,
    payload: CreateOpenChallengePayload
  ) {
    try {
      const { challengerKingdomId } = payload;

      const challengerInfo = await this.getKingdomInfo(challengerKingdomId);
      if (!challengerInfo) {
        client.send(ARENA_MESSAGES.ERROR, { error: "Reino não encontrado" });
        return;
      }

      const challenge = this.createChallengeSchema(
        "OPEN",
        challengerInfo,
        null,
        OPEN_CHALLENGE_TIMEOUT_MS
      );

      this.state.challenges.set(challenge.challengeId, challenge);

      // Notificar o desafiante
      client.send(ARENA_MESSAGES.CHALLENGE_CREATED, {
        success: true,
        challenge: this.schemaToChallenge(challenge),
      });

      // Broadcast para todos na arena
      this.broadcast(ARENA_MESSAGES.OPEN_CHALLENGES_LIST, {
        challenges: this.getOpenChallenges(),
      });

      console.log(
        `[ArenaRoom] 📢 Desafio aberto criado: ${challengerInfo.username}`
      );
    } catch (error) {
      console.error("[ArenaRoom] Erro ao criar desafio aberto:", error);
      client.send(ARENA_MESSAGES.ERROR, { error: "Erro ao criar desafio" });
    }
  }

  private async handleAcceptChallenge(
    client: ArenaClient,
    payload: AcceptChallengePayload
  ) {
    const { challengeId, kingdomId } = payload;

    const challenge = this.state.challenges.get(challengeId);
    if (!challenge) {
      client.send(ARENA_MESSAGES.ERROR, { error: "Desafio não encontrado" });
      return;
    }

    if (challenge.status !== "PENDING") {
      client.send(ARENA_MESSAGES.ERROR, {
        error: "Desafio não está mais disponível",
      });
      return;
    }

    // Se for desafio aberto, preencher o challenged
    if (challenge.type === "OPEN") {
      const acceptorInfo = await this.getKingdomInfo(kingdomId);
      if (!acceptorInfo) {
        client.send(ARENA_MESSAGES.ERROR, { error: "Reino não encontrado" });
        return;
      }
      challenge.challenged = this.createKingdomSchema(acceptorInfo);
    }

    challenge.status = "ACCEPTED";
    challenge.countdownSeconds = BATTLE_COUNTDOWN_SECONDS;

    // Notificar ambos os jogadores
    const challengerClient = this.findClientByUserId(
      challenge.challenger.userId
    );
    const challengedClient = client;

    const notification = {
      challenge: this.schemaToChallenge(challenge),
      countdown: BATTLE_COUNTDOWN_SECONDS,
    };

    challengerClient?.send(ARENA_MESSAGES.CHALLENGE_ACCEPTED, notification);
    challengedClient.send(ARENA_MESSAGES.CHALLENGE_ACCEPTED, notification);

    // Iniciar countdown
    this.startBattleCountdown(challenge);

    console.log(
      `[ArenaRoom] ✅ Desafio aceito: ${challenge.challenger.username} vs ${challenge.challenged?.username}`
    );
  }

  private handleDeclineChallenge(
    client: ArenaClient,
    payload: DeclineChallengePayload
  ) {
    const { challengeId } = payload;

    const challenge = this.state.challenges.get(challengeId);
    if (!challenge) return;

    challenge.status = "DECLINED";

    // Notificar o desafiante
    const challengerClient = this.findClientByUserId(
      challenge.challenger.userId
    );
    challengerClient?.send(ARENA_MESSAGES.CHALLENGE_DECLINED, {
      challengeId,
      declinedBy: client.username || "Desconhecido",
    });

    // Remover desafio
    this.state.challenges.delete(challengeId);

    console.log(`[ArenaRoom] ❌ Desafio recusado: ${challengeId}`);
  }

  private handleCancelChallenge(
    client: ArenaClient,
    payload: CancelChallengePayload
  ) {
    const { challengeId } = payload;

    const challenge = this.state.challenges.get(challengeId);
    if (!challenge) return;

    // Só o desafiante pode cancelar
    if (challenge.challenger.userId !== client.userId) {
      client.send(ARENA_MESSAGES.ERROR, {
        error: "Apenas o desafiante pode cancelar",
      });
      return;
    }

    challenge.status = "CANCELLED";

    // Notificar o desafiado (se houver)
    if (challenge.challenged) {
      const challengedClient = this.findClientByUserId(
        challenge.challenged.userId
      );
      challengedClient?.send(ARENA_MESSAGES.CHALLENGE_CANCELLED, {
        challengeId,
      });
    }

    // Parar countdown se existir
    const interval = this.countdownIntervals.get(challengeId);
    if (interval) {
      clearInterval(interval);
      this.countdownIntervals.delete(challengeId);
    }

    this.state.challenges.delete(challengeId);

    console.log(`[ArenaRoom] 🚫 Desafio cancelado: ${challengeId}`);
  }

  private handleListOpenChallenges(client: ArenaClient) {
    client.send(ARENA_MESSAGES.OPEN_CHALLENGES_LIST, {
      challenges: this.getOpenChallenges(),
    });
  }

  private async handleListOpponents(client: ArenaClient) {
    try {
      const opponents: ChallengeKingdomInfo[] = [];

      for (const userId of this.state.onlineUsers) {
        if (userId === client.userId) continue;

        // Buscar reinos do usuário
        const kingdoms = await prisma.kingdom.findMany({
          where: { ownerId: userId },
          include: {
            owner: { select: { username: true } },
            troopTemplates: true,
          },
        });

        for (const kingdom of kingdoms) {
          const power = kingdom.troopTemplates.reduce((sum: number, unit) => {
            return (
              sum +
              (unit.combat || 0) +
              (unit.vitality || 0) +
              (unit.speed || 0) +
              (unit.focus || 0) +
              (unit.resistance || 0) +
              (unit.will || 0)
            );
          }, 0);

          opponents.push({
            kingdomId: kingdom.id,
            kingdomName: kingdom.name,
            userId: kingdom.ownerId,
            username: kingdom.owner.username,
            power,
            unitCount: kingdom.troopTemplates.length,
          });
        }
      }

      client.send(ARENA_MESSAGES.OPPONENTS_LIST, { opponents });
    } catch (error) {
      console.error("[ArenaRoom] Erro ao listar oponentes:", error);
      client.send(ARENA_MESSAGES.OPPONENTS_LIST, { opponents: [] });
    }
  }

  // ============================================
  // Battle Countdown
  // ============================================

  private startBattleCountdown(challenge: ChallengeSchema) {
    let secondsLeft = BATTLE_COUNTDOWN_SECONDS;

    const interval = setInterval(async () => {
      secondsLeft--;
      challenge.countdownSeconds = secondsLeft;

      // Broadcast countdown tick
      const challengerClient = this.findClientByUserId(
        challenge.challenger.userId
      );
      const challengedClient = challenge.challenged
        ? this.findClientByUserId(challenge.challenged.userId)
        : null;

      const tick = {
        challengeId: challenge.challengeId,
        countdown: secondsLeft,
      };
      challengerClient?.send(ARENA_MESSAGES.COUNTDOWN_TICK, tick);
      challengedClient?.send(ARENA_MESSAGES.COUNTDOWN_TICK, tick);

      if (secondsLeft <= 0) {
        clearInterval(interval);
        this.countdownIntervals.delete(challenge.challengeId);

        // Criar batalha
        await this.startBattle(challenge);
      }
    }, 1000);

    this.countdownIntervals.set(challenge.challengeId, interval);
  }

  private async startBattle(challenge: ChallengeSchema) {
    try {
      challenge.status = "BATTLE_STARTED";

      // Criar sala de batalha via matchmaker
      const battleRoom = await matchMaker.createRoom("battle", {
        challengerKingdomId: challenge.challenger.kingdomId,
        challengedKingdomId: challenge.challenged?.kingdomId,
        fromArena: true,
      });

      challenge.battleId = battleRoom.roomId;

      // Notificar ambos para entrar na batalha
      const notification = {
        challengeId: challenge.challengeId,
        battleId: battleRoom.roomId,
        battleRoomId: battleRoom.roomId,
        challengerKingdomId: challenge.challenger.kingdomId,
        challengedKingdomId: challenge.challenged?.kingdomId || "",
      };

      const challengerClient = this.findClientByUserId(
        challenge.challenger.userId
      );
      const challengedClient = challenge.challenged
        ? this.findClientByUserId(challenge.challenged.userId)
        : null;

      challengerClient?.send(ARENA_MESSAGES.BATTLE_STARTING, notification);
      challengedClient?.send(ARENA_MESSAGES.BATTLE_STARTING, notification);

      console.log(`[ArenaRoom] ⚔️ Batalha iniciada: ${battleRoom.roomId}`);

      // Remover desafio após um tempo
      setTimeout(() => {
        this.state.challenges.delete(challenge.challengeId);
      }, 5000);
    } catch (error) {
      console.error("[ArenaRoom] Erro ao iniciar batalha:", error);
    }
  }

  // ============================================
  // Helpers
  // ============================================

  private async getKingdomInfo(
    kingdomId: string
  ): Promise<ChallengeKingdomInfo | null> {
    const kingdom = await prisma.kingdom.findUnique({
      where: { id: kingdomId },
      include: {
        owner: { select: { id: true, username: true } },
        troopTemplates: true,
      },
    });

    if (!kingdom) return null;

    const power = kingdom.troopTemplates.reduce((sum: number, unit) => {
      return (
        sum +
        (unit.combat || 0) +
        (unit.vitality || 0) +
        (unit.speed || 0) +
        (unit.focus || 0) +
        (unit.resistance || 0) +
        (unit.will || 0)
      );
    }, 0);

    return {
      kingdomId: kingdom.id,
      kingdomName: kingdom.name,
      userId: kingdom.owner.id,
      username: kingdom.owner.username,
      power,
      unitCount: kingdom.troopTemplates.length,
    };
  }

  private createChallengeSchema(
    type: "DIRECT" | "OPEN",
    challenger: ChallengeKingdomInfo,
    challenged: ChallengeKingdomInfo | null,
    timeoutMs: number
  ): ChallengeSchema {
    const schema = new ChallengeSchema();
    schema.challengeId = `challenge_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    schema.type = type;
    schema.status = "PENDING";
    schema.challenger = this.createKingdomSchema(challenger);
    schema.challenged = challenged
      ? this.createKingdomSchema(challenged)
      : null;
    schema.createdAt = Date.now();
    schema.expiresAt = Date.now() + timeoutMs;
    return schema;
  }

  private createKingdomSchema(
    info: ChallengeKingdomInfo
  ): ChallengeKingdomSchema {
    const schema = new ChallengeKingdomSchema();
    schema.kingdomId = info.kingdomId;
    schema.kingdomName = info.kingdomName;
    schema.userId = info.userId;
    schema.username = info.username;
    schema.power = info.power;
    schema.unitCount = info.unitCount;
    return schema;
  }

  private schemaToChallenge(schema: ChallengeSchema): Challenge {
    return {
      challengeId: schema.challengeId,
      type: schema.type as "DIRECT" | "OPEN",
      status: schema.status as any,
      challenger: {
        kingdomId: schema.challenger.kingdomId,
        kingdomName: schema.challenger.kingdomName,
        userId: schema.challenger.userId,
        username: schema.challenger.username,
        power: schema.challenger.power,
        unitCount: schema.challenger.unitCount,
      },
      challenged: schema.challenged
        ? {
            kingdomId: schema.challenged.kingdomId,
            kingdomName: schema.challenged.kingdomName,
            userId: schema.challenged.userId,
            username: schema.challenged.username,
            power: schema.challenged.power,
            unitCount: schema.challenged.unitCount,
          }
        : null,
      createdAt: schema.createdAt,
      expiresAt: schema.expiresAt,
      countdownSeconds: schema.countdownSeconds,
      battleId: schema.battleId || undefined,
    };
  }

  private findClientByUserId(userId: string): ArenaClient | undefined {
    return Array.from(this.clients).find(
      (c: ArenaClient) => c.userId === userId
    );
  }

  private getOpenChallenges(): Challenge[] {
    const challenges: Challenge[] = [];
    this.state.challenges.forEach((schema) => {
      if (schema.type === "OPEN" && schema.status === "PENDING") {
        challenges.push(this.schemaToChallenge(schema));
      }
    });
    return challenges;
  }

  private cancelUserChallenges(userId: string) {
    const toRemove: string[] = [];

    this.state.challenges.forEach((challenge, id) => {
      if (
        challenge.challenger.userId === userId &&
        challenge.status === "PENDING"
      ) {
        challenge.status = "CANCELLED";
        toRemove.push(id);

        // Notificar desafiado
        if (challenge.challenged) {
          const client = this.findClientByUserId(challenge.challenged.userId);
          client?.send(ARENA_MESSAGES.CHALLENGE_CANCELLED, { challengeId: id });
        }
      }
    });

    toRemove.forEach((id) => this.state.challenges.delete(id));
  }

  private async sendPendingChallenges(client: ArenaClient) {
    if (!client.userId) return;

    const incoming: Challenge[] = [];

    this.state.challenges.forEach((schema) => {
      if (schema.status === "PENDING") {
        // Desafios diretos para este usuário
        if (
          schema.type === "DIRECT" &&
          schema.challenged?.userId === client.userId
        ) {
          incoming.push(this.schemaToChallenge(schema));
        }
      }
    });

    if (incoming.length > 0) {
      for (const challenge of incoming) {
        client.send(ARENA_MESSAGES.CHALLENGE_RECEIVED, { challenge });
      }
    }

    // Enviar lista de desafios abertos
    this.handleListOpenChallenges(client);
  }

  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const toRemove: string[] = [];

      this.state.challenges.forEach((challenge, id) => {
        if (challenge.status === "PENDING" && now > challenge.expiresAt) {
          challenge.status = "EXPIRED";
          toRemove.push(id);

          // Notificar
          const challengerClient = this.findClientByUserId(
            challenge.challenger.userId
          );
          challengerClient?.send(ARENA_MESSAGES.CHALLENGE_EXPIRED, {
            challengeId: id,
          });

          if (challenge.challenged) {
            const challengedClient = this.findClientByUserId(
              challenge.challenged.userId
            );
            challengedClient?.send(ARENA_MESSAGES.CHALLENGE_EXPIRED, {
              challengeId: id,
            });
          }
        }
      });

      toRemove.forEach((id) => this.state.challenges.delete(id));

      if (toRemove.length > 0) {
        // Atualizar lista de desafios abertos
        this.broadcast(ARENA_MESSAGES.OPEN_CHALLENGES_LIST, {
          challenges: this.getOpenChallenges(),
        });
      }
    }, CLEANUP_INTERVAL_MS);
  }
}

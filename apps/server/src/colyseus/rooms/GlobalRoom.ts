// server/src/colyseus/rooms/GlobalRoom.ts
// Room global - Orquestrador de handlers modulares
// Funcionalidades: Auth, Kingdom, Lobby, Chat, Session, Ranking, Stats

import { Room, Client } from "@colyseus/core";
import { GlobalRoomState } from "../schemas";

// Handlers modulares
import {
  // Types
  AuthenticatedClient,
  HandlerContext,
  // Auth
  handleLogin,
  handleRegister,
  handleLogout,
  handleValidateToken,
  // Kingdom
  handleListKingdoms,
  handleCreateKingdom,
  handleGetKingdom,
  handleGetKingdomDetails,
  handleListKingdomTemplates,
  handleGetKingdomTemplate,
  handleGetRaces,
  handleGetAlignments,
  handleGetTroopPassives,
  handleUpdateKingdomDescription,
  // Lobby
  handleListLobbies,
  handleListMatches,
  handleListBattleLobbies,
  handleCreateLobby,
  // Chat
  handleChatMessage,
  handleLoadChatHistory,
  // Session
  handleCheckSession,
  // Ranking
  handleGetRanking,
  // Stats
  updateStats,
} from "./global";

interface JoinOptions {
  token?: string;
}

export class GlobalRoom extends Room<GlobalRoomState> {
  maxClients = 1000;

  private authenticatedClients = new Map<string, AuthenticatedClient>();
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Retorna contexto para os handlers
   */
  private getContext(): HandlerContext {
    return {
      room: this,
      authenticatedClients: this.authenticatedClients,
    };
  }

  async onCreate(_options: any) {
    this.autoDispose = false;
    console.log("[GlobalRoom] Room global criada");

    this.setState(new GlobalRoomState());

    // Registrar handlers de mensagens
    this.registerMessageHandlers();

    // Atualizar estatísticas periodicamente
    this.refreshInterval = setInterval(() => {
      updateStats(this.state);
    }, 5000);

    // Atualizar stats inicial
    await updateStats(this.state);
  }

  async onJoin(client: Client, options: JoinOptions) {
    console.log(`[GlobalRoom] Cliente conectou: ${client.sessionId}`);

    this.state.connectedPlayers++;

    // Tentar autenticar se token fornecido
    if (options.token) {
      await handleValidateToken(client, options.token, this.getContext());
    }
  }

  onLeave(client: Client, _consented: boolean) {
    console.log(`[GlobalRoom] Cliente saiu: ${client.sessionId}`);

    this.state.connectedPlayers--;
    this.authenticatedClients.delete(client.sessionId);
  }

  onDispose() {
    console.log("[GlobalRoom] Room global sendo destruída");

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  // =========================================
  // Message Handlers Registration
  // =========================================

  private registerMessageHandlers() {
    const ctx = this.getContext();

    // ===== AUTH =====
    this.onMessage("auth:login", async (client, { username, password }) => {
      await handleLogin(client, username, password, ctx);
    });

    this.onMessage(
      "auth:register",
      async (client, { username, email, password }) => {
        await handleRegister(client, username, email, password, ctx);
      }
    );

    this.onMessage("auth:validate", async (client, { token }) => {
      await handleValidateToken(client, token, ctx);
    });

    this.onMessage("auth:logout", (client) => {
      handleLogout(client, ctx);
    });

    // ===== LOBBY =====
    this.onMessage("lobby:list", async (client) => {
      await handleListLobbies(client);
    });

    this.onMessage("lobby:create", async (client, options) => {
      await handleCreateLobby(client, options);
    });

    // ===== KINGDOM =====
    this.onMessage("kingdom:list", async (client) => {
      await handleListKingdoms(client);
    });

    this.onMessage("kingdom:create", async (client, data) => {
      await handleCreateKingdom(client, data);
    });

    this.onMessage("kingdom:get", async (client, { kingdomId }) => {
      await handleGetKingdom(client, kingdomId);
    });

    this.onMessage("kingdom:get_details", async (client, { kingdomId }) => {
      await handleGetKingdomDetails(client, kingdomId);
    });

    this.onMessage("kingdom:list_templates", async (client) => {
      await handleListKingdomTemplates(client);
    });

    this.onMessage("kingdom:get_template", async (client, { templateId }) => {
      await handleGetKingdomTemplate(client, templateId);
    });

    this.onMessage("kingdom:get_races", async (client) => {
      await handleGetRaces(client);
    });

    this.onMessage("kingdom:get_alignments", async (client) => {
      await handleGetAlignments(client);
    });

    this.onMessage("kingdom:get_troop_passives", async (client) => {
      await handleGetTroopPassives(client);
    });

    this.onMessage(
      "kingdom:update_description",
      async (client, { kingdomId, description }) => {
        await handleUpdateKingdomDescription(client, kingdomId, description);
      }
    );

    // ===== CHAT =====
    this.onMessage("chat:send", (client, { message }) => {
      handleChatMessage(client, message, this);
    });

    this.onMessage(
      "chat:load_history",
      async (client, { context, contextId }) => {
        await handleLoadChatHistory(client, context, contextId);
      }
    );

    // ===== SESSION =====
    this.onMessage("session:check", async (client) => {
      await handleCheckSession(client);
    });

    // ===== RANKING =====
    this.onMessage("ranking:get", async (client, { type, limit }) => {
      await handleGetRanking(client, type, limit);
    });

    // ===== MATCH =====
    this.onMessage("match:list", async (client) => {
      await handleListMatches(client);
    });

    // ===== BATTLE LOBBIES =====
    this.onMessage("battle:list_lobbies", async (client) => {
      await handleListBattleLobbies(client);
    });
  }
}

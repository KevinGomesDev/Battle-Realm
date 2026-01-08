// server/src/colyseus/rooms/GlobalRoom.ts
// Room global para funcionalidades não relacionadas a batalha
// - Listagem de lobbies disponíveis
// - Chat global
// - Status do servidor
// - Autenticação

import { Room, Client } from "@colyseus/core";
import {
  GlobalRoomState,
  BattleLobbyState,
  BattleLobbyPlayerSchema,
} from "../schemas";
import { prisma } from "../../lib/prisma";
import { verifyToken } from "../../lib/auth";
import { matchMaker } from "@colyseus/core";
import {
  findActiveBattleForUser,
  findActiveMatchForUser,
} from "../../modules/match/services/battle-persistence.service";

// Imports para Kingdom
import { KINGDOM_TEMPLATES } from "../../../../shared/data/Templates/KingdomTemplates";
import { RACE_DEFINITIONS } from "../../../../shared/data/Templates/RacesTemplates";
import { ALIGNMENT_DEFINITIONS } from "../../../../shared/data/alignments.data";

interface JoinOptions {
  token?: string;
}

interface AuthenticatedClient extends Client {
  userData: {
    userId: string;
    username: string;
    authenticated: boolean;
  };
}

export class GlobalRoom extends Room<GlobalRoomState> {
  maxClients = 1000; // Room global pode ter muitos clientes

  private authenticatedClients = new Map<string, AuthenticatedClient>();
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  async onCreate(_options: any) {
    this.autoDispose = false; // Nunca destruir a room global
    console.log("[GlobalRoom] Room global criada");

    this.setState(new GlobalRoomState());

    // Registrar handlers de mensagens
    this.registerMessageHandlers();

    // Atualizar estatísticas periodicamente
    this.refreshInterval = setInterval(() => {
      this.updateStats();
    }, 5000);

    // Atualizar stats inicial
    await this.updateStats();
  }

  async onJoin(client: Client, options: JoinOptions) {
    console.log(`[GlobalRoom] Cliente conectou: ${client.sessionId}`);

    this.state.connectedPlayers++;

    // Tentar autenticar se token fornecido
    if (options.token) {
      await this.authenticateClient(client, options.token);
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
  // Message Handlers
  // =========================================

  private registerMessageHandlers() {
    // Autenticação
    this.onMessage("auth:login", async (client, { username, password }) => {
      await this.handleLogin(client, username, password);
    });

    this.onMessage(
      "auth:register",
      async (client, { username, email, password }) => {
        await this.handleRegister(client, username, email, password);
      }
    );

    this.onMessage("auth:validate", async (client, { token }) => {
      await this.authenticateClient(client, token);
    });

    this.onMessage("auth:logout", (client, _message) => {
      this.handleLogout(client);
    });

    // Lobbies
    this.onMessage("lobby:list", async (client, _message) => {
      await this.handleListLobbies(client);
    });

    this.onMessage("lobby:create", async (client, options) => {
      await this.handleCreateLobby(client, options);
    });

    // Kingdom
    this.onMessage("kingdom:list", async (client, _message) => {
      await this.handleListKingdoms(client);
    });

    this.onMessage("kingdom:create", async (client, data) => {
      await this.handleCreateKingdom(client, data);
    });

    this.onMessage("kingdom:get", async (client, { kingdomId }) => {
      await this.handleGetKingdom(client, kingdomId);
    });

    this.onMessage("kingdom:get_details", async (client, { kingdomId }) => {
      await this.handleGetKingdomDetails(client, kingdomId);
    });

    this.onMessage("kingdom:list_templates", async (client, _message) => {
      await this.handleListKingdomTemplates(client);
    });

    this.onMessage("kingdom:get_template", async (client, { templateId }) => {
      await this.handleGetKingdomTemplate(client, templateId);
    });

    this.onMessage(
      "kingdom:create_from_template",
      async (client, { templateId }) => {
        await this.handleCreateKingdomFromTemplate(client, templateId);
      }
    );

    this.onMessage("kingdom:get_races", async (client, _message) => {
      await this.handleGetRaces(client);
    });

    this.onMessage("kingdom:get_alignments", async (client, _message) => {
      await this.handleGetAlignments(client);
    });

    this.onMessage("kingdom:get_troop_passives", async (client, _message) => {
      await this.handleGetTroopPassives(client);
    });

    this.onMessage(
      "kingdom:set_troop_templates",
      async (client, { kingdomId, templates }) => {
        await this.handleSetTroopTemplates(client, kingdomId, templates);
      }
    );

    this.onMessage(
      "kingdom:update_description",
      async (client, { kingdomId, description }) => {
        await this.handleUpdateKingdomDescription(
          client,
          kingdomId,
          description
        );
      }
    );

    // Chat global
    this.onMessage("chat:send", (client, { message }) => {
      this.handleChatMessage(client, message);
    });

    this.onMessage(
      "chat:load_history",
      async (client, { context, contextId }) => {
        await this.handleLoadChatHistory(client, context, contextId);
      }
    );

    // Session
    this.onMessage("session:check", async (client, _message) => {
      await this.handleCheckSession(client);
    });

    // Ranking
    this.onMessage("ranking:get", async (client, { type, limit }) => {
      await this.handleGetRanking(client, type, limit);
    });

    // Match listing (partidas estratégicas)
    this.onMessage("match:list", async (client, _message) => {
      await this.handleListMatches(client);
    });

    // Battle lobbies listing
    this.onMessage("battle:list_lobbies", async (client, _message) => {
      await this.handleListbattleLobbies(client);
    });
  }

  // =========================================
  // Auth Handlers
  // =========================================

  private async authenticateClient(client: Client, token: string) {
    try {
      const decoded = verifyToken(token);
      if (!decoded || typeof decoded !== "object" || !decoded.userId) {
        client.send("auth:error", { message: "Token inválido" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        client.send("auth:error", { message: "Usuário não encontrado" });
        return;
      }

      client.userData = {
        userId: user.id,
        username: user.username,
        authenticated: true,
      };

      this.authenticatedClients.set(
        client.sessionId,
        client as AuthenticatedClient
      );

      client.send("auth:validated", {
        userId: user.id,
        username: user.username,
      });
    } catch (error) {
      client.send("auth:error", { message: "Falha na autenticação" });
    }
  }

  private async handleLogin(
    client: Client,
    username: string,
    password: string
  ) {
    try {
      // Buscar por username ou email
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username }, { email: username }],
        },
      });

      if (!user) {
        client.send("auth:error", { message: "Usuário não encontrado" });
        return;
      }

      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(password, user.password);

      if (!valid) {
        client.send("auth:error", { message: "Senha incorreta" });
        return;
      }

      const jwt = await import("jsonwebtoken");
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "7d" }
      );

      client.userData = {
        userId: user.id,
        username: user.username,
        authenticated: true,
      };

      this.authenticatedClients.set(
        client.sessionId,
        client as AuthenticatedClient
      );

      client.send("auth:success", {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (error) {
      client.send("auth:error", { message: "Erro no login" });
    }
  }

  private async handleRegister(
    client: Client,
    username: string,
    email: string,
    password: string
  ) {
    try {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { username }],
        },
      });

      if (existing) {
        client.send("auth:error", {
          message:
            existing.email === email
              ? "Email já cadastrado"
              : "Username já em uso",
        });
        return;
      }

      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
        },
      });

      const jwt = await import("jsonwebtoken");
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "7d" }
      );

      client.userData = {
        userId: user.id,
        username: user.username,
        authenticated: true,
      };

      this.authenticatedClients.set(
        client.sessionId,
        client as AuthenticatedClient
      );

      client.send("auth:success", {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (error) {
      client.send("auth:error", { message: "Erro no registro" });
    }
  }

  private handleLogout(client: Client) {
    client.userData = {
      userId: "",
      username: "",
      authenticated: false,
    };
    this.authenticatedClients.delete(client.sessionId);
    client.send("auth:logged_out", {});
  }

  // =========================================
  // Lobby Handlers
  // =========================================

  private async handleListLobbies(client: Client) {
    try {
      const rooms = await matchMaker.query({ name: "battle" });

      const lobbies = rooms
        .filter((room) => room.metadata?.status === "WAITING")
        .map((room) => ({
          lobbyId: room.roomId,
          hostUserId: room.metadata?.hostUserId,
          maxPlayers: room.metadata?.maxPlayers || 2,
          playerCount: room.clients || 0,
          vsBot: room.metadata?.vsBot || false,
        }));

      client.send("lobby:list", { lobbies });
    } catch (error) {
      client.send("error", { message: "Erro ao listar lobbies" });
    }
  }

  private async handleListMatches(client: Client) {
    try {
      const rooms = await matchMaker.query({ name: "match" });

      const matches = rooms
        .filter(
          (room) =>
            room.metadata?.status === "WAITING" ||
            room.metadata?.status === "OPEN"
        )
        .map((room) => ({
          matchId: room.roomId,
          hostId: room.metadata?.hostUserId || room.metadata?.hostId,
          hostName: room.metadata?.hostName || "Host",
          mapId: room.metadata?.mapId || "",
          playerCount: room.clients || 0,
          maxPlayers: room.metadata?.maxPlayers || 2,
          status: room.metadata?.status || "WAITING",
        }));

      client.send("match:list_result", matches);
    } catch (error) {
      client.send("match:error", { message: "Erro ao listar partidas" });
    }
  }

  private async handleListbattleLobbies(client: Client) {
    try {
      const rooms = await matchMaker.query({ name: "battle" });

      const lobbies = rooms
        .filter((room) => room.metadata?.status === "WAITING")
        .map((room) => ({
          lobbyId: room.roomId,
          hostUserId: room.metadata?.hostUserId,
          hostName: room.metadata?.hostName || "Host",
          maxPlayers: room.metadata?.maxPlayers || 2,
          playerCount: room.clients || 0,
          vsBot: room.metadata?.vsBot || false,
          status: room.metadata?.status || "WAITING",
        }));

      client.send("battle:lobbies_list", lobbies);
    } catch (error) {
      client.send("battle:error", {
        message: "Erro ao listar lobbies de batalha",
      });
    }
  }

  private async handleCreateLobby(
    client: Client,
    options: { kingdomId: string; maxPlayers?: number; vsBot?: boolean }
  ) {
    const userData = client.userData as
      | { userId: string; authenticated: boolean }
      | undefined;

    if (!userData?.authenticated) {
      client.send("error", { message: "Não autenticado" });
      return;
    }

    try {
      // Criar room de battle
      const room = await matchMaker.createRoom("battle", {
        userId: userData.userId,
        kingdomId: options.kingdomId,
        maxPlayers: options.maxPlayers || 2,
        vsBot: options.vsBot || false,
      });

      client.send("lobby:created", {
        roomId: room.roomId,
        ...options,
      });
    } catch (error: any) {
      client.send("error", { message: error.message || "Erro ao criar lobby" });
    }
  }

  // =========================================
  // Kingdom Handlers
  // =========================================

  private async handleListKingdoms(client: Client) {
    const userData = client.userData as
      | { userId: string; authenticated: boolean }
      | undefined;

    if (!userData?.authenticated) {
      client.send("error", { message: "Não autenticado" });
      return;
    }

    try {
      const kingdoms = await prisma.kingdom.findMany({
        where: { ownerId: userData.userId },
        include: {
          regent: {
            select: { id: true, name: true, level: true },
          },
        },
      });

      // Retornar diretamente o array para kingdom:list_success
      client.send(
        "kingdom:list_success",
        kingdoms.map((k) => ({
          id: k.id,
          name: k.name,
          description: k.description,
          regent: k.regent
            ? {
                id: k.regent.id,
                name: k.regent.name,
                level: k.regent.level,
              }
            : null,
          createdAt: k.createdAt,
        }))
      );
    } catch (error) {
      client.send("kingdom:error", {
        message: "Erro ao listar reinos",
        code: "INTERNAL_ERROR",
      });
    }
  }

  private async handleCreateKingdom(client: Client, data: any) {
    const userData = client.userData as
      | { userId: string; authenticated: boolean }
      | undefined;

    if (!userData?.authenticated) {
      client.send("error", { message: "Não autenticado" });
      return;
    }

    // Criar reino (lógica simplificada - a completa está em kingdom.handler.ts)
    client.send("kingdom:created", {
      message: "Use o sistema legado por enquanto",
    });
  }

  private async handleGetKingdom(client: Client, kingdomId: string) {
    try {
      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
        include: {
          regent: true,
          troopTemplates: true,
          owner: {
            select: { id: true, username: true },
          },
        },
      });

      if (!kingdom) {
        client.send("error", { message: "Reino não encontrado" });
        return;
      }

      client.send("kingdom:data", { kingdom });
    } catch (error) {
      client.send("error", { message: "Erro ao buscar reino" });
    }
  }

  private async handleGetKingdomDetails(client: Client, kingdomId: string) {
    const userData = client.userData as
      | { userId: string; authenticated: boolean }
      | undefined;

    if (!userData?.authenticated) {
      client.send("kingdom:error", {
        message: "Não autenticado",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    try {
      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
        include: {
          regent: true,
          troopTemplates: true,
          owner: {
            select: { id: true, username: true },
          },
        },
      });

      if (!kingdom) {
        client.send("kingdom:error", {
          message: "Reino não encontrado",
          code: "NOT_FOUND",
        });
        return;
      }

      client.send("kingdom:details", kingdom);
    } catch (error) {
      client.send("kingdom:error", {
        message: "Erro ao buscar reino",
        code: "INTERNAL_ERROR",
      });
    }
  }

  private async handleListKingdomTemplates(client: Client) {
    try {
      const templates = KINGDOM_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description.substring(0, 200) + "...",
        alignment: t.alignment,
        race: t.race,
        regentCode: t.regentCode,
      }));

      client.send("kingdom:templates_list", { templates });
    } catch (error) {
      client.send("kingdom:error", {
        message: "Erro ao listar templates",
        code: "INTERNAL_ERROR",
      });
    }
  }

  private async handleGetKingdomTemplate(client: Client, templateId: string) {
    try {
      const template = KINGDOM_TEMPLATES.find((t) => t.id === templateId);

      if (!template) {
        client.send("kingdom:error", {
          message: "Template não encontrado",
          code: "NOT_FOUND",
        });
        return;
      }

      client.send("kingdom:template_details", { template });
    } catch (error) {
      client.send("kingdom:error", {
        message: "Erro ao buscar template",
        code: "INTERNAL_ERROR",
      });
    }
  }

  private async handleCreateKingdomFromTemplate(
    client: Client,
    templateId: string
  ) {
    const userData = client.userData as
      | { userId: string; authenticated: boolean }
      | undefined;

    if (!userData?.authenticated) {
      client.send("kingdom:error", {
        message: "Não autenticado",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    try {
      const template = KINGDOM_TEMPLATES.find((t) => t.id === templateId);

      if (!template) {
        client.send("kingdom:error", {
          message: "Template não encontrado",
          code: "NOT_FOUND",
        });
        return;
      }

      // Verificar se usuário já tem reino com este nome (para evitar duplicatas)
      const existing = await prisma.kingdom.findFirst({
        where: {
          ownerId: userData.userId,
          name: template.name,
        },
      });

      if (existing) {
        client.send("kingdom:error", {
          message: "Você já possui um reino com este nome",
          code: "DUPLICATE",
        });
        return;
      }

      // Criar o reino
      const kingdom = await prisma.kingdom.create({
        data: {
          name: template.name,
          description: template.description,
          alignment: template.alignment,
          race: template.race,
          ownerId: userData.userId,
        },
        include: {
          regent: true,
          troopTemplates: true,
          owner: {
            select: { id: true, username: true },
          },
        },
      });

      client.send("kingdom:created_from_template", {
        kingdom,
        message: `Reino ${template.name} criado com sucesso!`,
      });
    } catch (error) {
      console.error("[GlobalRoom] Erro ao criar reino do template:", error);
      client.send("kingdom:error", {
        message: "Erro ao criar reino",
        code: "INTERNAL_ERROR",
      });
    }
  }

  private async handleGetRaces(client: Client) {
    try {
      client.send("kingdom:races_data", RACE_DEFINITIONS);
    } catch (error) {
      client.send("kingdom:error", {
        message: "Erro ao buscar raças",
        code: "INTERNAL_ERROR",
      });
    }
  }

  private async handleGetAlignments(client: Client) {
    try {
      client.send("kingdom:alignments_data", ALIGNMENT_DEFINITIONS);
    } catch (error) {
      client.send("kingdom:error", {
        message: "Erro ao buscar alinhamentos",
        code: "INTERNAL_ERROR",
      });
    }
  }

  private async handleGetTroopPassives(client: Client) {
    try {
      // TODO: Implementar quando houver passivas definidas
      client.send("kingdom:troop_passives_data", []);
    } catch (error) {
      client.send("kingdom:error", {
        message: "Erro ao buscar passivas",
        code: "INTERNAL_ERROR",
      });
    }
  }

  private async handleSetTroopTemplates(
    client: Client,
    kingdomId: string,
    templates: any[]
  ) {
    const userData = client.userData as
      | { userId: string; authenticated: boolean }
      | undefined;

    if (!userData?.authenticated) {
      client.send("kingdom:error", {
        message: "Não autenticado",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    try {
      // Verificar se o reino pertence ao usuário
      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
      });

      if (!kingdom || kingdom.ownerId !== userData.userId) {
        client.send("kingdom:error", {
          message: "Reino não encontrado ou não autorizado",
          code: "NOT_FOUND",
        });
        return;
      }

      // Deletar templates existentes
      await prisma.troopTemplate.deleteMany({
        where: { kingdomId },
      });

      // Criar novos templates (usando campos do schema TroopTemplate)
      for (let i = 0; i < templates.length; i++) {
        const template = templates[i];
        await prisma.troopTemplate.create({
          data: {
            kingdomId,
            slotIndex: i,
            name: template.name,
            description: template.description || null,
            avatar: template.avatar || null,
            passiveId: template.passiveId || "NONE",
            resourceType: template.resourceType || "minerio",
            combat: template.combat || 2,
            speed: template.speed || 2,
            focus: template.focus || 2,
            resistance: template.resistance || 2,
            will: template.will || 0,
            vitality: template.vitality || 2,
          },
        });
      }

      // Buscar reino atualizado
      const updatedKingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
        include: {
          regent: true,
          troopTemplates: true,
          owner: {
            select: { id: true, username: true },
          },
        },
      });

      client.send("kingdom:set_troop_templates_success", updatedKingdom);
    } catch (error) {
      console.error("[GlobalRoom] Erro ao definir templates:", error);
      client.send("kingdom:error", {
        message: "Erro ao definir templates",
        code: "INTERNAL_ERROR",
      });
    }
  }

  private async handleUpdateKingdomDescription(
    client: Client,
    kingdomId: string,
    description: string
  ) {
    const userData = client.userData as
      | { userId: string; authenticated: boolean }
      | undefined;

    if (!userData?.authenticated) {
      client.send("kingdom:error", {
        message: "Não autenticado",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    try {
      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
      });

      if (!kingdom || kingdom.ownerId !== userData.userId) {
        client.send("kingdom:error", {
          message: "Reino não encontrado ou não autorizado",
          code: "NOT_FOUND",
        });
        return;
      }

      const updated = await prisma.kingdom.update({
        where: { id: kingdomId },
        data: { description },
      });

      client.send("kingdom:description_updated", { kingdom: updated });
    } catch (error) {
      client.send("kingdom:error", {
        message: "Erro ao atualizar descrição",
        code: "INTERNAL_ERROR",
      });
    }
  }

  // =========================================
  // Session Handlers
  // =========================================

  private async handleCheckSession(client: Client) {
    const userData = client.userData as
      | { userId: string; authenticated: boolean }
      | undefined;

    if (!userData?.authenticated) {
      client.send("session:none", {});
      return;
    }

    try {
      // 1. Verificar se está em alguma room de battle ativa (memória)
      const BattleRooms = await matchMaker.query({ name: "battle" });

      for (const room of BattleRooms) {
        if (room.metadata?.players?.includes(userData.userId)) {
          // Determinar se é lobby ou batalha baseado no status
          const isInBattle =
            room.metadata?.status === "BATTLING" ||
            room.metadata?.status === "BATTLE_ENDED";

          // Obter kingdomId do mapeamento na metadata
          const kingdomId =
            room.metadata?.playerKingdoms?.[userData.userId] || null;

          client.send("session:active", {
            type: isInBattle ? "BATTLE_SESSION" : "BATTLE_LOBBY",
            roomId: room.roomId,
            battleId: room.roomId,
            lobbyId: room.roomId,
            kingdomId, // Incluir kingdomId na resposta
            status: room.metadata?.status,
            source: "memory",
          });
          console.log(
            `[GlobalRoom] Sessão ativa encontrada para ${userData.userId}: Battle ${room.roomId} (${room.metadata?.status}) [memória]`
          );
          return;
        }
      }

      // 2. Verificar se está em match (partida estratégica) ativo (memória)
      const matchRooms = await matchMaker.query({ name: "match" });

      for (const room of matchRooms) {
        if (room.metadata?.players?.includes(userData.userId)) {
          // Obter kingdomId do mapeamento na metadata
          const kingdomId =
            room.metadata?.playerKingdoms?.[userData.userId] || null;

          client.send("session:active", {
            type: "MATCH",
            roomId: room.roomId,
            matchId: room.roomId,
            kingdomId, // Incluir kingdomId na resposta
            status: room.metadata?.status,
            source: "memory",
          });
          console.log(
            `[GlobalRoom] Sessão ativa encontrada para ${userData.userId}: Match ${room.roomId} (${room.metadata?.status}) [memória]`
          );
          return;
        }
      }

      // 3. Verificar se há batalha pausada no banco de dados
      const pausedBattle = await findActiveBattleForUser(userData.userId);
      if (pausedBattle) {
        // Encontrar o kingdomId do usuário na batalha pausada
        const playerIndex = pausedBattle.playerIds.indexOf(userData.userId);
        const kingdomId =
          playerIndex >= 0 ? pausedBattle.kingdomIds[playerIndex] : null;

        client.send("session:active", {
          type: "BATTLE_SESSION",
          roomId: pausedBattle.id,
          battleId: pausedBattle.id,
          lobbyId: pausedBattle.lobbyId,
          kingdomId, // Incluir kingdomId na resposta
          status: pausedBattle.status,
          source: "database",
          needsRestore: true,
        });
        console.log(
          `[GlobalRoom] Batalha pausada encontrada para ${userData.userId}: ${pausedBattle.id} [banco]`
        );
        return;
      }

      // 4. Verificar se há match pausado no banco de dados
      const pausedMatchId = await findActiveMatchForUser(userData.userId);
      if (pausedMatchId) {
        // Buscar status do match no banco
        const match = await prisma.match.findUnique({
          where: { id: pausedMatchId },
        });
        if (match && match.status !== "ENDED") {
          client.send("session:active", {
            type: "MATCH",
            roomId: pausedMatchId,
            matchId: pausedMatchId,
            status: match.status,
            source: "database",
            needsRestore: true,
          });
          console.log(
            `[GlobalRoom] Match pausado encontrado para ${userData.userId}: ${pausedMatchId} [banco]`
          );
          return;
        }
      }

      client.send("session:none", {});
    } catch (error) {
      console.error("[GlobalRoom] Erro ao verificar sessão:", error);
      client.send("session:none", {});
    }
  }

  // =========================================
  // Chat Handlers
  // =========================================

  private handleChatMessage(client: Client, message: string) {
    const userData = client.userData as
      | { userId: string; username: string; authenticated: boolean }
      | undefined;

    if (!userData?.authenticated) {
      client.send("error", { message: "Não autenticado" });
      return;
    }

    // Broadcast para todos os clientes
    this.broadcast("chat:message", {
      message: {
        id: `msg_${Date.now()}`,
        context: "GLOBAL",
        contextId: undefined,
        senderId: userData.userId,
        senderName: userData.username,
        message,
        timestamp: new Date(),
        unitId: undefined,
      },
    });
  }

  private async handleLoadChatHistory(
    client: Client,
    context: string,
    contextId?: string
  ) {
    const userData = client.userData as
      | { userId: string; username: string; authenticated: boolean }
      | undefined;

    if (!userData?.authenticated) {
      client.send("error", { message: "Não autenticado" });
      return;
    }

    // Por enquanto, retorna histórico vazio
    // TODO: Implementar persistência de mensagens no banco
    client.send("chat:load_history:response", {
      success: true,
      messages: [],
    });
  }

  // =========================================
  // Ranking Handlers
  // =========================================

  private async handleGetRanking(
    client: Client,
    type: string = "wins",
    limit: number = 10
  ) {
    try {
      // Buscar ranking baseado no tipo (battle wins por padrão)
      const users = await prisma.user.findMany({
        orderBy:
          type === "wins" ? { battleWins: "desc" } : { battleWins: "desc" },
        take: limit,
        select: {
          id: true,
          username: true,
          battleWins: true,
          battleLosses: true,
          matchWins: true,
          matchLosses: true,
        },
      });

      client.send("ranking:data", {
        type,
        entries: users.map((u, idx) => ({
          rank: idx + 1,
          userId: u.id,
          username: u.username,
          wins: u.battleWins + u.matchWins,
          losses: u.battleLosses + u.matchLosses,
          level: 1, // Level não existe mais, usar valor padrão
        })),
      });
    } catch (error) {
      client.send("error", { message: "Erro ao buscar ranking" });
    }
  }

  // =========================================
  // Stats
  // =========================================

  private async updateStats() {
    try {
      const BattleRooms = await matchMaker.query({ name: "battle" });
      const matchRooms = await matchMaker.query({ name: "match" });

      this.state.activeLobbies = BattleRooms.filter(
        (r) => r.metadata?.status === "WAITING"
      ).length;
      this.state.activeBattles =
        BattleRooms.filter((r) => r.metadata?.status === "BATTLING").length +
        matchRooms.length;

      // Atualizar lista de lobbies disponíveis
      this.state.availableLobbies.clear();

      for (const room of BattleRooms) {
        if (room.metadata?.status === "WAITING") {
          const lobby = new BattleLobbyState();
          lobby.lobbyId = room.roomId;
          lobby.hostUserId = room.metadata?.hostUserId || "";
          lobby.maxPlayers = room.metadata?.maxPlayers || 2;
          lobby.status = "WAITING";
          lobby.vsBot = room.metadata?.vsBot || false;

          this.state.availableLobbies.push(lobby);
        }
      }
    } catch (error) {
      console.error("[GlobalRoom] Erro ao atualizar stats:", error);
    }
  }
}

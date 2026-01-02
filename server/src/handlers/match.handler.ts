// src/handlers/match.handler.ts
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { CrisisState, CrisisType } from "../types";
import { CRISIS_DEFINITIONS } from "../data/crises";
import { TERRAIN_TYPES } from "../worldmap/data/terrains";
import { MapGenerator } from "../worldmap/generation/MapGenerator";
import {
  BUILDABLE_STRUCTURES,
  STRUCTURE_DEFINITIONS,
} from "../data/structures";
import {
  getAvailableStructures,
  getTerritoryConstructionInfo,
  buildStructureFree,
} from "../utils/construction.utils";
import { canJoinNewSession } from "../utils/session.utils";

const MAP_SIZE = 25; // Grid 5x5 de terra

/**
 * Gera uma crise secreta para a partida
 * - Tipo aleatório (KAIJU, WALKERS, AMORPHOUS)
 * - 3 territórios com intel da crise
 */
function generateSecretCrisis(): CrisisState {
  const types = Object.keys(CRISIS_DEFINITIONS) as CrisisType[];
  const selectedType = types[Math.floor(Math.random() * types.length)];
  const definition = CRISIS_DEFINITIONS[selectedType];

  // Sorteia 3 territórios para conter intel (apenas dos 25 de terra)
  const intelIndices = new Set<number>();
  while (intelIndices.size < 3) {
    intelIndices.add(Math.floor(Math.random() * MAP_SIZE));
  }

  return {
    type: selectedType,
    isActive: false,
    revealedSpecials: [],
    stats: { ...definition.stats },
    extraData: { ...definition.initialExtraData },
    intelTerritoryIndices: Array.from(intelIndices),
  };
}

// Cores dos jogadores por índice
const PLAYER_COLORS = [
  "#e63946", // Vermelho (Host)
  "#457b9d", // Azul (Guest)
  "#2a9d8f", // Verde (Player 3)
  "#f4a261", // Laranja (Player 4)
];

// Recursos iniciais (zerados até o turno de administração restaurar)
const INITIAL_RESOURCES = {
  ore: 0,
  supplies: 0,
  arcane: 0,
  experience: 0,
  devotion: 0,
};

/**
 * Formata dados de um jogador para enviar ao cliente
 */
function formatPlayerData(player: any) {
  return {
    id: player.id,
    userId: player.userId,
    username: player.user?.username || "Desconhecido",
    playerIndex: player.playerIndex,
    playerColor: player.playerColor,
    kingdomName: player.kingdom?.name || "Reino Oculto",
    capitalTerritoryId: player.capitalTerritoryId,
    isReady: player.isReady,
    resources: player.resources
      ? JSON.parse(player.resources)
      : INITIAL_RESOURCES,
  };
}

/**
 * Envia estado completo da partida para todos os jogadores
 *
 * O estado inclui:
 * - Status da partida (WAITING, PREPARATION, ACTIVE, FINISHED)
 * - Rodada e turno atuais
 * - Quem está jogando e quem já terminou seu turno
 * - Recursos de cada jogador
 * - Quem precisa agir agora (activePlayerIds)
 */
async function broadcastMatchState(io: Server, matchId: string) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        players: { include: { user: true, kingdom: true } },
      },
    });

    if (!match) return;
    // Determinar quem deve agir no turno atual
    let activePlayerIds: string[] = [];
    if (match.status === "ACTIVE") {
      activePlayerIds = match.players
        .filter((p) => {
          if (match.currentTurn === "ADMINISTRACAO") {
            return !p.hasFinishedAdminTurn;
          }
          return !p.hasPlayedTurn;
        })
        .map((p) => p.id);
    }

    const matchState = {
      matchId: match.id,
      status: match.status,
      currentRound: match.currentRound,
      currentTurn: match.currentTurn,
      activePlayerIds, // ← Quem precisa agir agora
      players: match.players.map((p) => ({
        ...formatPlayerData(p),
        hasFinishedCurrentTurn:
          match.currentTurn === "ADMINISTRACAO"
            ? p.hasFinishedAdminTurn
            : p.hasPlayedTurn,
      })),
      crisisState: match.crisisState ? JSON.parse(match.crisisState) : null,
      updatedAt: new Date(),
    };

    io.to(matchId).emit("match:state_updated", matchState);
  } catch (error) {
    console.error("[MATCH] Erro ao enviar estado da partida:", error);
  }
}

export const registerMatchHandlers = (io: Server, socket: Socket) => {
  // ============================================================
  // 1. LISTAR PARTIDAS ABERTAS
  // ============================================================
  socket.on("match:list_open", async () => {
    try {
      const matches = await prisma.match.findMany({
        where: { status: "WAITING" },
        include: {
          players: { include: { user: true, kingdom: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const publicData = matches.map((m) => ({
        id: m.id,
        hostUsername: m.players[0]?.user.username || "Desconhecido",
        hostKingdomName: m.players[0]?.kingdom.name || "Reino Oculto",
        playerCount: m.players.length,
        createdAt: m.createdAt,
      }));

      socket.emit("match:list_result", publicData);
    } catch (error) {
      console.error("[MATCH] Erro ao listar partidas:", error);
      socket.emit("error", { message: "Erro ao buscar partidas." });
    }
  });

  // ============================================================
  // 2. CRIAR PARTIDA (HOST)
  // ============================================================
  socket.on("match:create", async ({ userId, kingdomId }) => {
    try {
      // Verificar se usuário já está em uma sessão ativa
      const blockReason = await canJoinNewSession(userId);
      if (blockReason) {
        return socket.emit("error", { message: blockReason });
      }

      console.log(
        `[MATCH] Host ${userId} criando partida com Reino ${kingdomId}`
      );

      // Gerar crise secreta
      const crisisStateObj = generateSecretCrisis();
      const crisisStateJson = JSON.stringify(crisisStateObj);

      // Transação atômica: partida + jogador + mapa
      const matchId = await prisma.$transaction(async (tx) => {
        // Criar partida
        const match = await tx.match.create({
          data: {
            status: "WAITING",
            currentRound: 1,
            crisisState: crisisStateJson,
          },
        });

        // Adicionar host como jogador
        await tx.matchPlayer.create({
          data: {
            matchId: match.id,
            userId: userId,
            kingdomId: kingdomId,
            playerIndex: 0,
            playerColor: PLAYER_COLORS[0],
            isReady: false,
            resources: JSON.stringify(INITIAL_RESOURCES),
          },
        });

        // Gerar mapa procedural
        console.log("[MATCH] Gerando mapa grid 5x5...");
        const mapGen = new MapGenerator(2000, 1600);
        const territories = mapGen.generate();

        // Salvar territórios no banco
        for (const t of territories) {
          const terrainKey =
            Object.keys(TERRAIN_TYPES).find(
              (key) => TERRAIN_TYPES[key].name === t.terrain.name
            ) || "PLAINS";

          await tx.territory.create({
            data: {
              matchId: match.id,
              mapIndex: t.id,
              centerX: t.center.x,
              centerY: t.center.y,
              type: t.type,
              terrainType: terrainKey,
              polygonData: JSON.stringify(t.polygonPoints),
              size: t.size,
              areaSlots: t.areaSlots,
              usedSlots: 0,
              ownerId: null,
              isDisabled: false,
              hasCrisisIntel: crisisStateObj.intelTerritoryIndices.includes(
                t.id
              ),
            },
          });
        }

        console.log(
          `[MATCH] Partida criada: ${match.id} (Mapa: 25 terra + ${
            territories.length - 25
          } água)`
        );
        return match.id;
      });

      // Juntar socket à sala
      socket.join(matchId);
      socket.emit("match:created_success", { matchId });

      // Broadcast para todos os clientes sobre a nova partida disponível
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const kingdom = await prisma.kingdom.findUnique({
        where: { id: kingdomId },
      });
      io.emit("match:lobbies_updated", {
        action: "created",
        match: {
          id: matchId,
          hostUsername: user?.username || "Unknown",
          hostKingdomName: kingdom?.name || "Unknown",
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error("[MATCH] Erro ao criar partida:", error);
      socket.emit("error", { message: "Falha ao criar partida." });
    }
  });

  // ============================================================
  // 3. ENTRAR EM PARTIDA (GUEST)
  // ============================================================
  socket.on("match:join", async ({ matchId, userId, kingdomId }) => {
    try {
      // Verificar se usuário já está em uma sessão ativa
      const blockReason = await canJoinNewSession(userId);
      if (blockReason) {
        return socket.emit("error", { message: blockReason });
      }

      console.log(`[MATCH] Guest ${userId} entrando na partida ${matchId}`);

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          players: { include: { user: true, kingdom: true } },
          territories: true,
        },
      });

      // Validações
      if (!match)
        return socket.emit("error", { message: "Partida não encontrada." });
      if (match.status !== "WAITING")
        return socket.emit("error", { message: "Partida já começou." });
      if (match.players.length >= 2)
        return socket.emit("error", { message: "Sala cheia." });

      // Buscar territórios médios disponíveis para capitais
      const mediumLandTerritories = match.territories.filter(
        (t) => t.type === "LAND" && t.size === "MEDIUM" && !t.ownerId
      );

      if (mediumLandTerritories.length < 2) {
        return socket.emit("error", {
          message: "Mapa não tem territórios suficientes para capitais.",
        });
      }

      // Embaralhar e atribuir capitais
      const shuffled = mediumLandTerritories.sort(() => Math.random() - 0.5);
      const hostCapital = shuffled[0];
      const guestCapital = shuffled[1];
      const hostPlayer = match.players[0];

      // Transação: adicionar guest + atualizar capitais
      await prisma.$transaction([
        prisma.matchPlayer.create({
          data: {
            matchId,
            userId,
            kingdomId,
            playerIndex: 1,
            playerColor: PLAYER_COLORS[1],
            isReady: false,
            capitalTerritoryId: guestCapital.id,
            resources: JSON.stringify(INITIAL_RESOURCES),
          },
        }),

        prisma.matchPlayer.update({
          where: { id: hostPlayer.id },
          data: { capitalTerritoryId: hostCapital.id },
        }),

        prisma.territory.update({
          where: { id: hostCapital.id },
          data: { ownerId: hostPlayer.id, isCapital: true },
        }),

        prisma.territory.update({
          where: { id: guestCapital.id },
          data: { isCapital: true },
        }),

        prisma.match.update({
          where: { id: matchId },
          data: { status: "PREPARATION" },
        }),
      ]);

      // Atualizar proprietário do território do guest
      const guestPlayer = await prisma.matchPlayer.findFirst({
        where: { matchId, userId },
      });

      if (guestPlayer) {
        await prisma.territory.update({
          where: { id: guestCapital.id },
          data: { ownerId: guestPlayer.id },
        });
      }

      socket.join(matchId);

      // Buscar dados atualizados dos jogadores
      const updatedMatch = await prisma.match.findUnique({
        where: { id: matchId },
        include: { players: { include: { user: true, kingdom: true } } },
      });

      // Notificar todos os jogadores
      io.to(matchId).emit("match:preparation_started", {
        matchId,
        hostCapitalMapIndex: hostCapital.mapIndex,
        guestCapitalMapIndex: guestCapital.mapIndex,
        players: updatedMatch?.players.map(formatPlayerData) || [],
      });

      // Broadcast estado completo
      await broadcastMatchState(io, matchId);

      // Broadcast para atualizar lista de lobbies (remover da lista pois está cheio)
      io.emit("match:lobbies_updated", { action: "removed", matchId });

      console.log(`[MATCH] Fase de preparação iniciada: ${matchId}`);
    } catch (error) {
      console.error("[MATCH] Erro ao entrar na partida:", error);
      socket.emit("error", { message: "Erro ao entrar na partida." });
    }
  });

  // ============================================================
  // 4. OBTER DADOS ESTÁTICOS
  // ============================================================
  socket.on("game:get_terrains", () => {
    socket.emit("game:terrains_data", TERRAIN_TYPES);
  });

  // ============================================================
  // 5. CARREGAR MAPA
  // ============================================================
  socket.on("match:request_map", async ({ matchId } = {}) => {
    try {
      let match;

      if (matchId) {
        match = await prisma.match.findUnique({ where: { id: matchId } });
      } else {
        // Fallback: busca última partida ativa ou em preparação
        match = await prisma.match.findFirst({
          where: { status: { in: ["PREPARATION", "ACTIVE"] } },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!match) {
        return socket.emit("error", { message: "Nenhuma partida encontrada." });
      }

      // Buscar territórios e jogadores
      const territories = await prisma.territory.findMany({
        where: { matchId: match.id },
        orderBy: { mapIndex: "asc" },
      });

      const players = await prisma.matchPlayer.findMany({
        where: { matchId: match.id },
        include: { user: true, kingdom: true },
      });

      console.log(
        `[MATCH] Enviando mapa ${match.id} (${territories.length} territórios, ${players.length} jogadores)`
      );

      socket.emit("match:map_data", {
        matchId: match.id,
        status: match.status,
        territories: territories.map((t) => ({
          id: t.id,
          mapIndex: t.mapIndex,
          centerX: t.centerX,
          centerY: t.centerY,
          type: t.type,
          terrainType: t.terrainType,
          polygonData: t.polygonData,
          size: t.size,
          areaSlots: t.areaSlots,
          usedSlots: t.usedSlots,
          ownerId: t.ownerId,
          isCapital: t.isCapital,
          hasCrisisIntel: t.hasCrisisIntel,
          constructionCount: t.constructionCount,
          fortressCount: t.fortressCount,
          isDisabled: t.isDisabled,
        })),
        players: players.map(formatPlayerData),
      });
    } catch (error) {
      console.error("[MATCH] Erro ao carregar mapa:", error);
      socket.emit("error", { message: "Erro ao carregar mapa." });
    }
  });

  // ============================================================
  // 6. BUSCAR DADOS DA FASE DE PREPARAÇÃO
  // ============================================================
  socket.on("match:get_preparation_data", async ({ matchId, userId }) => {
    try {
      const player = await prisma.matchPlayer.findFirst({
        where: { matchId, userId },
        include: { kingdom: true, user: true },
      });

      if (!player) {
        return socket.emit("error", { message: "Jogador não encontrado." });
      }

      const capital = player.capitalTerritoryId
        ? await prisma.territory.findUnique({
            where: { id: player.capitalTerritoryId },
          })
        : null;

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { players: { include: { user: true, kingdom: true } } },
      });

      socket.emit("match:preparation_data", {
        playerId: player.id,
        playerIndex: player.playerIndex,
        playerColor: player.playerColor,
        username: player.user?.username,
        kingdomName: player.kingdom?.name,
        capital: capital
          ? {
              id: capital.id,
              mapIndex: capital.mapIndex,
              centerX: capital.centerX,
              centerY: capital.centerY,
              terrainType: capital.terrainType,
              size: capital.size,
            }
          : null,
        isReady: player.isReady,
        freeBuildingsRemaining: (() => {
          const freeUsed = (player as any).freeBuildingsUsed ?? 0;
          return Math.max(0, 3 - freeUsed);
        })(),
        allPlayers: match?.players.map(formatPlayerData) || [],
      });
    } catch (error) {
      console.error("[MATCH] Erro ao buscar dados de preparação:", error);
      socket.emit("error", { message: "Erro ao buscar dados." });
    }
  });

  // ============================================================
  // 7. ESTRUTURAS DISPONÍVEIS
  // ============================================================
  socket.on("game:get_structures", async (data: any, callback?: Function) => {
    try {
      const structures = BUILDABLE_STRUCTURES.map((s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        color: s.color,
        maxHp: s.maxHp,
        resourceGenerated: s.resourceGenerated,
        specialEffect: s.specialEffect,
      }));

      if (callback && typeof callback === "function") {
        callback({ success: true, structures });
      } else {
        socket.emit("game:structures_data", structures);
      }
    } catch (error) {
      console.error("[MATCH] Erro ao buscar estruturas:", error);
      if (callback && typeof callback === "function") {
        callback({ success: false, error: "Erro ao buscar estruturas." });
      } else {
        socket.emit("error", { message: "Erro ao buscar estruturas." });
      }
    }
  });

  // ============================================================
  // 9. CONSTRUÇÕES NA FASE DE PREPARAÇÃO (GRATUITAS)
  // ============================================================
  socket.on("preparation:list_available_structures", async () => {
    try {
      const structures = BUILDABLE_STRUCTURES.map((s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        color: s.color,
        maxHp: s.maxHp,
        resourceGenerated: s.resourceGenerated,
        specialEffect: s.specialEffect,
      }));
      socket.emit("preparation:available_structures", { structures });
    } catch (error) {
      console.error("[MATCH] Erro ao listar estruturas (preparação):", error);
      socket.emit("error", { message: "Erro ao listar estruturas." });
    }
  });

  socket.on(
    "preparation:get_territory_construction_info",
    async ({ territoryId }) => {
      try {
        const info = await getTerritoryConstructionInfo(territoryId);
        if (!info) {
          socket.emit("error", { message: "Território não encontrado" });
          return;
        }
        socket.emit("preparation:territory_construction_info", { info });
      } catch (error) {
        console.error(
          "[MATCH] Erro ao obter informações de construção (preparação):",
          error
        );
        socket.emit("error", {
          message: "Erro ao obter informações de construção",
        });
      }
    }
  );

  socket.on(
    "preparation:build_structure",
    async ({ matchId, playerId, territoryId, structureType }) => {
      try {
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match) {
          socket.emit("error", { message: "Partida não encontrada" });
          return;
        }
        if (match.status !== "PREPARATION") {
          socket.emit("error", {
            message: "Construções gratuitas apenas na Preparação",
          });
          return;
        }

        const player = await prisma.matchPlayer.findUnique({
          where: { id: playerId },
        });
        if (!player) {
          socket.emit("error", { message: "Jogador não encontrado" });
          return;
        }
        if ((player as any).freeBuildingsUsed >= 3) {
          socket.emit("preparation:build_failed", {
            message: "Limite de 3 construções gratuitas atingido",
          });
          return;
        }

        const result = await buildStructureFree(
          matchId,
          playerId,
          territoryId,
          structureType
        );
        if (result.success) {
          const freeUsed = (player as any).freeBuildingsUsed ?? 0;
          socket.emit("preparation:build_success", {
            message: result.message,
            structure: result.structure,
            freeBuildingsRemaining: Math.max(0, 3 - (freeUsed + 1)),
          });
          io.to(matchId).emit("structure:created", {
            structure: result.structure,
            playerId,
            territoryId,
          });
        } else {
          socket.emit("preparation:build_failed", { message: result.message });
        }
      } catch (error) {
        console.error("[MATCH] Erro ao construir (preparação):", error);
        socket.emit("error", { message: "Erro ao construir estrutura" });
      }
    }
  );

  // ============================================================
  // 8. DETALHES DE UMA ESTRUTURA
  // ============================================================
  socket.on("game:get_structure", async ({ structureId }) => {
    try {
      const structure = STRUCTURE_DEFINITIONS[structureId];
      if (structure) {
        socket.emit("game:structure_data", structure);
      } else {
        socket.emit("error", { message: "Estrutura não encontrada." });
      }
    } catch (error) {
      socket.emit("error", { message: "Erro ao buscar estrutura." });
    }
  });

  // ============================================================
  // 10. REQUISITAR ESTADO COMPLETO DA PARTIDA
  // ============================================================
  socket.on("match:request_state", async ({ matchId }) => {
    try {
      await broadcastMatchState(io, matchId);
    } catch (error) {
      console.error("[MATCH] Erro ao enviar estado:", error);
      socket.emit("error", { message: "Erro ao obter estado da partida." });
    }
  });

  // ============================================================
  // 11. MARCAR JOGADOR COMO PRONTO
  // ============================================================
  socket.on("match:player_ready", async ({ matchId, userId }) => {
    try {
      const player = await prisma.matchPlayer.findFirst({
        where: { matchId, userId },
      });
      if (!player) {
        socket.emit("error", { message: "Jogador não encontrado" });
        return;
      }

      // Exigir 3 construções gratuitas antes de ficar pronto
      if ((player as any).freeBuildingsUsed < 3) {
        socket.emit("error", {
          message:
            "Coloque 3 construções gratuitas na preparação antes de ficar pronto.",
        });
        return;
      }

      await prisma.matchPlayer.updateMany({
        where: { matchId, userId },
        data: { isReady: true },
      });

      const players = await prisma.matchPlayer.findMany({
        where: { matchId },
      });

      const allReady = players.every((p) => p.isReady);

      if (allReady) {
        // Iniciar jogo
        await prisma.match.update({
          where: { id: matchId },
          data: {
            status: "ACTIVE",
            currentRound: 1,
            currentTurn: "ADMINISTRACAO",
          },
        });

        // Restaurar recursos iniciais
        const { restoreAllPlayersResources } = await import(
          "../utils/turn.utils"
        );
        await restoreAllPlayersResources(matchId);

        io.to(matchId).emit("match:started", {
          matchId,
          round: 1,
          turn: "ADMINISTRACAO",
        });

        io.to(matchId).emit("turn:administration_started", {
          round: 1,
          turn: "ADMINISTRACAO",
          message: "Rodada 1 - Turno de Administração iniciado!",
        });

        // Broadcast estado completo
        await broadcastMatchState(io, matchId);

        console.log(`[MATCH] Jogo iniciado: ${matchId}`);
      } else {
        io.to(matchId).emit("match:player_ready_update", {
          userId,
          allReady: false,
        });

        // Broadcast estado para mostrar quem ficou pronto
        await broadcastMatchState(io, matchId);
      }
    } catch (error) {
      console.error("[MATCH] Erro ao marcar pronto:", error);
      socket.emit("error", { message: "Erro ao marcar como pronto." });
    }
  });

  // ============================================================
  // SAIR DA PARTIDA (ABANDONAR)
  // ============================================================
  socket.on("match:leave", async ({ matchId, userId }) => {
    try {
      console.log(`[MATCH] Usuário ${userId} saindo da partida ${matchId}`);

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { players: true },
      });

      if (!match) {
        return socket.emit("error", { message: "Partida não encontrada." });
      }

      const player = match.players.find((p) => p.userId === userId);
      if (!player) {
        return socket.emit("error", {
          message: "Você não está nesta partida.",
        });
      }

      // Se a partida está em WAITING, gerenciar lobby corretamente
      if (match.status === "WAITING") {
        const isHost = player.playerIndex === 0;
        const otherPlayers = match.players.filter((p) => p.userId !== userId);

        // Se era o único jogador (ou host sem outros jogadores), cancela a partida
        if (otherPlayers.length === 0) {
          await prisma.matchPlayer.delete({ where: { id: player.id } });
          await prisma.territory.deleteMany({ where: { matchId } });
          await prisma.match.delete({ where: { id: matchId } });

          socket.leave(matchId);
          socket.emit("match:left", {
            message: "Partida cancelada (você era o único jogador).",
          });

          // Notificar todos que o lobby foi removido
          io.emit("match:lobbies_updated", {
            action: "removed",
            matchId,
          });

          console.log(`[MATCH] Partida ${matchId} cancelada - lobby vazio`);
          return;
        }

        // Se host sai mas tem outros jogadores, passa o host para o próximo
        if (isHost) {
          const newHost = otherPlayers[0];

          // Atualizar o novo host para índice 0
          await prisma.matchPlayer.update({
            where: { id: newHost.id },
            data: {
              playerIndex: 0,
              playerColor: PLAYER_COLORS[0],
            },
          });

          // Remover o host antigo
          await prisma.matchPlayer.delete({ where: { id: player.id } });

          socket.leave(matchId);
          io.to(matchId).emit("match:host_changed", {
            newHostUserId: newHost.userId,
            message: "O host saiu. Você agora é o host.",
          });
          socket.emit("match:left", { message: "Você saiu da partida." });

          // Atualizar info do lobby com novo host
          const newHostUser = await prisma.user.findUnique({
            where: { id: newHost.userId },
          });
          const newHostKingdom = await prisma.kingdom.findUnique({
            where: { id: newHost.kingdomId },
          });

          io.emit("match:lobbies_updated", {
            action: "updated",
            match: {
              id: matchId,
              hostUsername: newHostUser?.username || "Unknown",
              hostKingdomName: newHostKingdom?.name || "Unknown",
              playerCount: otherPlayers.length,
              createdAt: match.createdAt,
            },
          });

          await broadcastMatchState(io, matchId);
          console.log(
            `[MATCH] Host ${userId} saiu. Novo host: ${newHost.userId}`
          );
          return;
        }

        // Guest sai normalmente
        await prisma.matchPlayer.delete({ where: { id: player.id } });

        socket.leave(matchId);
        io.to(matchId).emit("match:player_left", {
          userId,
          message: "Um jogador saiu da sala.",
        });
        socket.emit("match:left", { message: "Você saiu da partida." });
        await broadcastMatchState(io, matchId);

        console.log(`[MATCH] Jogador ${userId} saiu da partida ${matchId}`);
        return;
      }

      // Se a partida está ACTIVE ou PREPARATION, o jogador abandona (perde por W.O.)
      if (match.status === "ACTIVE" || match.status === "PREPARATION") {
        // Marcar partida como finalizada e o outro jogador como vencedor
        const otherPlayer = match.players.find((p) => p.userId !== userId);

        await prisma.match.update({
          where: { id: matchId },
          data: {
            status: "FINISHED",
          },
        });

        // Liberar territórios do jogador que abandonou
        await prisma.territory.updateMany({
          where: { matchId, ownerId: player.id },
          data: { ownerId: null, isCapital: false },
        });

        socket.leave(matchId);
        io.to(matchId).emit("match:player_abandoned", {
          abandonedUserId: userId,
          winnerUserId: otherPlayer?.userId,
          message: `Jogador abandonou a partida. ${
            otherPlayer ? "Vitória por W.O.!" : ""
          }`,
        });

        socket.emit("match:left", {
          message: "Você abandonou a partida. Derrota por W.O.",
        });

        console.log(
          `[MATCH] Usuário ${userId} abandonou partida ${matchId}. Vencedor: ${otherPlayer?.userId}`
        );
        return;
      }

      // Partida já finalizada
      socket.emit("error", { message: "Esta partida já foi finalizada." });
    } catch (error) {
      console.error("[MATCH] Erro ao sair da partida:", error);
      socket.emit("error", { message: "Erro ao sair da partida." });
    }
  });
};

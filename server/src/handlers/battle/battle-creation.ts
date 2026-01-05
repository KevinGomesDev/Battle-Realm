import { generateBattleMap } from "../../logic/battle-map";
import {
  BattleUnit,
  createMultiPlayerBattleUnits,
  createBotUnitsFromTemplate,
  determineActionOrder,
  getArenaBattleGridSize,
} from "../../utils/battle-unit.factory";
import type { ArenaConfig } from "../../../../shared/types/arena.types";
import type { Battle, BattleLobby } from "./battle-types";
import { generateId, getPlayerColors } from "./battle-types";
import { activeBattles, battleLobbies } from "./battle-state";
import {
  createBaseArenaConfig,
  saveBattleToDB,
  saveLobbyToDB,
} from "./battle-persistence";
import { startBattleTurnTimer } from "./battle-timer";
import { checkAndProcessBotTurn } from "./battle-bot";
import {
  KINGDOM_TEMPLATES,
  resolveKingdomTemplate,
} from "../../../../shared/data/kingdom-templates";
import { processEidolonSummonsOnBattleStart } from "../../logic/summon-logic";
import type {
  BattlePlayer,
  ArenaLobbyPlayer,
} from "../../../../shared/types/session.types";

// =============================================================================
// CONSTANTES DE BOT
// =============================================================================

export const BOT_USER_ID = "__BOT__";
export const BOT_KINGDOM_ID = "__BOT_KINGDOM__";

/**
 * Adiciona um jogador BOT ao lobby.
 * Usado quando vsBot=true na criação do lobby.
 */
export function addBotPlayerToLobby(lobby: BattleLobby): ArenaLobbyPlayer {
  const botPlayer: ArenaLobbyPlayer = {
    userId: BOT_USER_ID,
    socketId: "BOT",
    kingdomId: BOT_KINGDOM_ID,
    playerIndex: lobby.players.length,
    isReady: true,
  };
  lobby.players.push(botPlayer);
  return botPlayer;
}

/**
 * Cria um "kingdom virtual" para o BOT a partir de um template aleatório.
 * Usado para integrar o bot no fluxo normal de createAndStartBattle.
 */
export function createBotKingdom() {
  const randomTemplate =
    KINGDOM_TEMPLATES[Math.floor(Math.random() * KINGDOM_TEMPLATES.length)];

  const resolved = resolveKingdomTemplate(randomTemplate);
  const regentName = resolved?.regent.name || "Bot";

  return {
    id: BOT_KINGDOM_ID,
    name: `🤖 ${regentName}`,
    race: randomTemplate.race,
    regent: null, // Será criado via createBotUnitsFromTemplate
    _template: randomTemplate, // Guardar referência ao template
  };
}

interface CreateBattleParams {
  lobby: BattleLobby;
  kingdoms: any[]; // Array de kingdoms (com regent incluído)
  io: any;
}

export async function createAndStartBattle({
  lobby,
  kingdoms,
  io,
}: CreateBattleParams): Promise<Battle> {
  const lobbyId = lobby.lobbyId;
  const {
    width: gridWidth,
    height: gridHeight,
    territorySize,
  } = getArenaBattleGridSize();

  const battleId = generateId();

  console.log("[BATTLE_CREATION] Criando batalha...", {
    lobbyId,
    battleId,
    playersCount: lobby.players.length,
    players: lobby.players.map((p) => ({
      userId: p.userId,
      kingdomId: p.kingdomId,
    })),
    kingdomsReceived: kingdoms.map((k) => ({ id: k.id, name: k.name })),
  });

  // Montar estrutura de jogadores com suas unidades
  const battlePlayerInputs = lobby.players.map((player, index) => {
    // Verificar se é um jogador BOT
    if (player.userId === BOT_USER_ID) {
      const botKingdom = kingdoms.find((k) => k.id === BOT_KINGDOM_ID);
      const template = botKingdom?._template;
      console.log("[BATTLE_CREATION] Processando BOT player:", {
        botKingdomFound: !!botKingdom,
        templateFound: !!template,
        botKingdomId: botKingdom?.id,
      });
      if (!template) {
        throw new Error("Bot kingdom template not found");
      }
      // Criar unidades do BOT a partir do template
      const botUnits = createBotUnitsFromTemplate(template, BOT_USER_ID, {
        id: BOT_KINGDOM_ID,
        name: botKingdom.name,
        race: template.race,
      });
      console.log("[BATTLE_CREATION] BOT units criadas:", botUnits.length);
      return {
        userId: player.userId,
        kingdom: {
          id: BOT_KINGDOM_ID,
          name: botKingdom.name,
          race: template.race,
        },
        units: botUnits,
        playerIndex: index,
      };
    }

    // Jogador normal
    const kingdom = kingdoms.find((k) => k.id === player.kingdomId);
    console.log("[BATTLE_CREATION] Processando player normal:", {
      userId: player.userId,
      kingdomFound: !!kingdom,
      kingdomId: kingdom?.id,
      hasRegent: !!kingdom?.regent,
    });
    return {
      userId: player.userId,
      kingdom: { id: kingdom.id, name: kingdom.name, race: kingdom.race },
      units: kingdom.regent ? [kingdom.regent] : [],
      playerIndex: index,
    };
  });

  console.log("[BATTLE_CREATION] battlePlayerInputs:", {
    count: battlePlayerInputs.length,
    inputs: battlePlayerInputs.map((p) => ({
      userId: p.userId,
      kingdomId: p.kingdom.id,
      unitsCount: p.units.length,
    })),
  });

  const { units: allUnits, occupiedPositions } = createMultiPlayerBattleUnits(
    battlePlayerInputs,
    gridWidth,
    gridHeight,
    "arena"
  );

  console.log("[BATTLE_CREATION] Unidades criadas:", {
    totalUnits: allUnits.length,
    byOwner: allUnits.reduce((acc, u) => {
      acc[u.ownerId] = (acc[u.ownerId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  });

  // Determinar ordem de ação baseada na soma de speed
  const playerIds = lobby.players.map((p) => p.userId);
  const actionOrder = determineActionOrder(allUnits, playerIds);

  const mapConfig = generateBattleMap({
    gridWidth,
    gridHeight,
    territorySize,
    unitPositions: occupiedPositions,
  });

  // Processar invocações no início da batalha (ex: Eidolon)
  const summonedUnits = processEidolonSummonsOnBattleStart(
    allUnits,
    gridWidth,
    gridHeight,
    mapConfig.obstacles?.map((o) => ({ x: o.posX, y: o.posY })) || [],
    "arena"
  );

  // Adicionar unidades invocadas à lista
  for (const summon of summonedUnits) {
    allUnits.push(summon);
  }

  // Montar array de BattlePlayers
  const battlePlayers: BattlePlayer[] = lobby.players.map((player, index) => {
    const kingdom = kingdoms.find((k) => k.id === player.kingdomId);
    const colors = getPlayerColors(index);
    return {
      userId: player.userId,
      kingdomId: player.kingdomId,
      kingdomName: kingdom?.name || "Unknown",
      playerIndex: index,
      playerColor: colors.primary,
    };
  });

  // Configurar cores dos jogadores na arenaConfig
  const arenaConfig: ArenaConfig = {
    ...createBaseArenaConfig(),
    grid: { width: gridWidth, height: gridHeight },
    map: mapConfig,
  };

  const battle: Battle = {
    id: battleId,
    lobbyId,
    gridWidth,
    gridHeight,
    round: 1,
    currentTurnIndex: 0,
    status: "ACTIVE",
    turnTimer: 0,
    actionOrder,
    units: allUnits,
    createdAt: new Date(),
    config: arenaConfig,
    roundActionsCount: new Map<string, number>(playerIds.map((id) => [id, 0])),
    maxPlayers: lobby.maxPlayers,
    players: battlePlayers,
    isArena: true,
  };

  activeBattles.set(battleId, battle);
  lobby.status = "BATTLING";

  await saveBattleToDB(battle);
  await saveLobbyToDB(lobby);

  const battleEventData = {
    battleId,
    lobbyId,
    config: arenaConfig,
    units: allUnits,
    actionOrder,
    maxPlayers: lobby.maxPlayers,
    players: battlePlayers,
    kingdoms: battlePlayers.map((p) => ({
      id: p.kingdomId,
      name: p.kingdomName,
      ownerId: p.userId,
      playerIndex: p.playerIndex,
      playerColor: p.playerColor,
    })),
  };

  // Fazer todos os sockets da sala do lobby entrarem também na sala do battleId
  // Isso permite que o chat funcione usando battleId como contextId
  const socketsInLobby = await io.in(lobbyId).fetchSockets();
  for (const s of socketsInLobby) {
    s.join(battleId);
  }

  // Sempre emite o mesmo evento - o cliente trata igualmente
  io.to(lobbyId).emit("battle:battle_started", battleEventData);

  startBattleTurnTimer(battle);

  // Se é batalha contra BOT, verificar se é turno dele
  if (lobby.vsBot) {
    setTimeout(() => {
      checkAndProcessBotTurn(battle);
    }, 500); // Pequeno delay para garantir que cliente receba os eventos de início
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    `[ARENA] 🗺️  NOVA BATALHA INICIADA${lobby.vsBot ? " (vs BOT 🤖)" : ""}`
  );
  console.log("=".repeat(60));
  console.log(`[ARENA] ID da Batalha: ${battleId}`);
  console.log(`[ARENA] Lobby ID: ${lobbyId}`);
  console.log(`[ARENA] Jogadores: ${battlePlayers.length}/${lobby.maxPlayers}`);
  battlePlayers.forEach((player, idx) => {
    console.log(
      `[ARENA]   P${idx + 1}: ${player.kingdomName} (${player.userId})`
    );
  });
  console.log("-".repeat(60));
  console.log("[ARENA] 📐 GRID:");
  console.log(`[ARENA]   Tamanho do Território: ${territorySize}`);
  console.log(
    `[ARENA]   Dimensões: ${gridWidth}x${gridHeight} (${
      gridWidth * gridHeight
    } células)`
  );
  console.log("-".repeat(60));
  console.log("[ARENA] 🏞️  TERRENO:");
  console.log(
    `[ARENA]   Tipo: ${mapConfig.terrainName} ${mapConfig.terrainEmoji}`
  );
  console.log("-".repeat(60));
  console.log("[ARENA] 🪨 OBSTÁCULOS:");
  console.log(`[ARENA]   Quantidade: ${mapConfig.obstacles.length}`);
  if (mapConfig.obstacles.length > 0) {
    console.log(
      `[ARENA]   Posições: ${mapConfig.obstacles
        .map((o) => `(${o.posX},${o.posY})`)
        .join(", ")}`
    );
  }
  console.log("-".repeat(60));
  console.log("[ARENA] ⚔️  UNIDADES:");
  allUnits.forEach((unit, idx) => {
    const player = battlePlayers.find((p) => p.userId === unit.ownerId);
    const playerLabel = player ? `P${player.playerIndex + 1}` : "?";
    console.log(
      `[ARENA]   ${idx + 1}. [${playerLabel}] ${unit.name} - Pos: (${
        unit.posX
      },${unit.posY})`
    );
  });
  console.log("-".repeat(60));
  console.log("[ARENA] 🎲 ORDEM DE AÇÃO:");
  console.log(
    `[ARENA]   ${actionOrder
      .map((id, i) => {
        const player = battlePlayers.find((p) => p.userId === id);
        return `${i + 1}. ${player?.kingdomName || "Unknown"}`;
      })
      .join(" → ")}`
  );
  console.log("-".repeat(60));
  console.log("[ARENA] 👥 JOGADORES:");
  battlePlayers.forEach((player, idx) => {
    console.log(
      `[ARENA]   ${idx + 1}. ${player.kingdomName} (${player.userId})`
    );
  });
  console.log("=".repeat(60) + "\n");

  return battle;
}

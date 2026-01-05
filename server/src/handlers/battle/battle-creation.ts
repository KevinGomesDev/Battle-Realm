import { generateBattleMap } from "../../logic/battle-map";
import {
  BattleUnit,
  createBattleUnitsWithRandomPositions,
  createBotUnitsFromTemplate,
  determineActionOrder,
  getArenaBattleGridSize,
} from "../../utils/battle-unit.factory";
import type { ArenaConfig } from "../../../../shared/types/arena.types";
import type { Battle } from "./battle-types";
import type { BattleLobby } from "./battle-types";
import { generateId } from "./battle-types";
import { activeBattles, battleLobbies } from "./battle-state";
import {
  createBaseArenaConfig,
  saveBattleToDB,
  saveLobbyToDB,
} from "./battle-persistence";
import { startBattleTurnTimer } from "./battle-timer";
import { checkAndProcessBotTurn } from "./battle-bot";
import { KINGDOM_TEMPLATES } from "../../../../shared/data/kingdom-templates";
import { processEidolonSummonsOnBattleStart } from "../../logic/summon-logic";

interface CreateBattleParams {
  lobby: BattleLobby;
  hostKingdom: any;
  guestKingdom: any;
  io: any;
}

export async function createAndStartBattle({
  lobby,
  hostKingdom,
  guestKingdom,
  io,
}: CreateBattleParams): Promise<Battle> {
  const lobbyId = lobby.lobbyId;
  const {
    width: gridWidth,
    height: gridHeight,
    territorySize,
  } = getArenaBattleGridSize();

  const battleId = generateId();

  const { units: allUnits, occupiedPositions } =
    createBattleUnitsWithRandomPositions(
      hostKingdom.regent ? [hostKingdom.regent] : [],
      lobby.hostUserId,
      { id: hostKingdom.id, name: hostKingdom.name, race: hostKingdom.race },
      guestKingdom.regent ? [guestKingdom.regent] : [],
      lobby.guestUserId as string,
      { id: guestKingdom.id, name: guestKingdom.name, race: guestKingdom.race },
      gridWidth,
      gridHeight,
      "arena"
    );

  // Determinar ordem de ação baseada na soma de speed
  const actionOrder = determineActionOrder(
    allUnits,
    lobby.hostUserId,
    lobby.guestUserId as string
  );

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
    roundActionsCount: new Map<string, number>([
      [lobby.hostUserId, 0],
      [lobby.guestUserId as string, 0],
    ]),
    hostUserId: lobby.hostUserId,
    guestUserId: lobby.guestUserId as string,
    hostKingdomId: hostKingdom.id,
    guestKingdomId: guestKingdom.id,
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
    hostKingdom: {
      id: hostKingdom.id,
      name: hostKingdom.name,
      ownerId: lobby.hostUserId,
    },
    guestKingdom: {
      id: guestKingdom.id,
      name: guestKingdom.name,
      ownerId: lobby.guestUserId,
    },
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

  console.log("\n" + "=".repeat(60));
  console.log(`[ARENA] 🗺️  NOVA BATALHA INICIADA`);
  console.log("=".repeat(60));
  console.log(`[ARENA] ID da Batalha: ${battleId}`);
  console.log(`[ARENA] Lobby ID: ${lobbyId}`);
  console.log(`[ARENA] Host: ${hostKingdom.name} (${lobby.hostUserId})`);
  console.log(`[ARENA] Guest: ${guestKingdom.name} (${lobby.guestUserId})`);
  console.log("-".repeat(60));
  console.log("[ARENA] 📐 GRID:");
  console.log(`[ARENA]   Tamanho do Território: ${territorySize}`);
  console.log(
    `[ARENA]   Dimensões: ${gridWidth}x${gridHeight} (${
      gridWidth * gridHeight
    } células)`
  );
  console.log("-".repeat(60));
  console.log("[ARENA] �️  TERRENO:");
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
    const side = unit.ownerId === lobby.hostUserId ? "HOST" : "GUEST";
    console.log(
      `[ARENA]   ${idx + 1}. [${side}] ${unit.name} - Pos: (${unit.posX},${
        unit.posY
      })`
    );
  });
  console.log("-".repeat(60));
  console.log("[ARENA] 🎲 ORDEM DE AÇÃO:");
  console.log(
    `[ARENA]   ${actionOrder
      .map(
        (id, i) =>
          `${i + 1}. ${
            id === lobby.hostUserId ? hostKingdom.name : guestKingdom.name
          }`
      )
      .join(" → ")}`
  );
  console.log("=".repeat(60) + "\n");

  return battle;
}

// =============================================================================
// BATALHA CONTRA BOT
// =============================================================================

const BOT_USER_ID = "__BOT__";
const BOT_KINGDOM_ID = "__BOT_KINGDOM__";

interface CreateBotBattleParams {
  lobby: BattleLobby;
  hostKingdom: any;
  io: any;
}

/**
 * Cria e inicia uma batalha contra um BOT
 * Seleciona um template aleatório e cria um regente BOT com IA
 */
export async function createAndStartBotBattle({
  lobby,
  hostKingdom,
  io,
}: CreateBotBattleParams): Promise<Battle> {
  const lobbyId = lobby.lobbyId;
  const {
    width: gridWidth,
    height: gridHeight,
    territorySize,
  } = getArenaBattleGridSize();

  const battleId = generateId();

  // Selecionar um template aleatório para o BOT
  const randomTemplate =
    KINGDOM_TEMPLATES[Math.floor(Math.random() * KINGDOM_TEMPLATES.length)];

  // Criar unidades BOT a partir do template
  const botUnits = createBotUnitsFromTemplate(randomTemplate, BOT_USER_ID, {
    id: BOT_KINGDOM_ID,
    name: `🤖 ${randomTemplate.regent.name}`,
    race: randomTemplate.race,
  });

  // Criar unidades do jogador e do BOT com posições aleatórias
  const { units: allUnits, occupiedPositions } =
    createBattleUnitsWithRandomPositions(
      hostKingdom.regent ? [hostKingdom.regent] : [],
      lobby.hostUserId,
      { id: hostKingdom.id, name: hostKingdom.name, race: hostKingdom.race },
      botUnits,
      BOT_USER_ID,
      {
        id: BOT_KINGDOM_ID,
        name: `🤖 ${randomTemplate.regent.name}`,
        race: randomTemplate.race,
      },
      gridWidth,
      gridHeight,
      "arena"
    );

  // Determinar ordem de ação baseada na soma de speed
  const actionOrder = determineActionOrder(
    allUnits,
    lobby.hostUserId,
    BOT_USER_ID
  );

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

  const arenaConfig: ArenaConfig = {
    ...createBaseArenaConfig(),
    grid: { width: gridWidth, height: gridHeight },
    map: mapConfig,
  };

  // Atualizar o lobby com dados do BOT
  lobby.guestUserId = BOT_USER_ID;
  lobby.guestKingdomId = BOT_KINGDOM_ID;
  lobby.status = "BATTLING";
  lobby.vsBot = true;

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
    roundActionsCount: new Map<string, number>([
      [lobby.hostUserId, 0],
      [BOT_USER_ID, 0],
    ]),
    hostUserId: lobby.hostUserId,
    guestUserId: BOT_USER_ID,
    hostKingdomId: hostKingdom.id,
    guestKingdomId: BOT_KINGDOM_ID,
    isArena: true,
  };

  activeBattles.set(battleId, battle);

  await saveBattleToDB(battle);
  await saveLobbyToDB(lobby);

  startBattleTurnTimer(battle);

  // Verificar se é turno do BOT e processar automaticamente
  setTimeout(() => {
    checkAndProcessBotTurn(battle);
  }, 500); // Pequeno delay para garantir que cliente receba os eventos de início

  console.log("\n" + "=".repeat(60));
  console.log(`[ARENA] 🤖 NOVA BATALHA vs BOT INICIADA`);
  console.log("=".repeat(60));
  console.log(`[ARENA] ID da Batalha: ${battleId}`);
  console.log(`[ARENA] Lobby ID: ${lobbyId}`);
  console.log(`[ARENA] Host: ${hostKingdom.name} (${lobby.hostUserId})`);
  console.log(
    `[ARENA] BOT: ${randomTemplate.regent.name} (Template: ${randomTemplate.name})`
  );
  console.log("-".repeat(60));
  console.log("[ARENA] 📐 GRID:");
  console.log(`[ARENA]   Tamanho do Território: ${territorySize}`);
  console.log(
    `[ARENA]   Dimensões: ${gridWidth}x${gridHeight} (${
      gridWidth * gridHeight
    } células)`
  );
  console.log("-".repeat(60));
  console.log("[ARENA] ⚔️  UNIDADES:");
  allUnits.forEach((unit, idx) => {
    const side = unit.ownerId === lobby.hostUserId ? "HOST" : "BOT 🤖";
    console.log(
      `[ARENA]   ${idx + 1}. [${side}] ${unit.name} - Pos: (${unit.posX},${
        unit.posY
      })`
    );
  });
  console.log("=".repeat(60) + "\n");

  return battle;
}

// setup.handler.ts - Inicialização e geração de mapa/obstáculos
import type { Room } from "@colyseus/core";
import type { BattleSessionState, BattlePlayerSchema } from "../../schemas";
import { BattleObstacleSchema } from "../../schemas";
import {
  TURN_CONFIG,
  getGridDimensions,
  getRandomTerrain,
  getRandomBattleSize,
  getObstacleCount,
  getRandomObstacleType,
} from "@boundless/shared/config";
import { serializeConfig } from "./utils";
import { persistBattle } from "../../../../../workers/persistence.worker";

/**
 * Inicia a batalha
 */
export async function startBattle(
  state: BattleSessionState,
  roomId: string,
  metadata: Record<string, any>,
  broadcast: Room<BattleSessionState>["broadcast"],
  setMetadata: Room<BattleSessionState>["setMetadata"],
  setLobbyPhase: (value: boolean) => void,
  createBattleUnitsFn: () => Promise<void>,
  initQTEFn: () => void,
  calculateActionOrderFn: () => void,
  startTurnTimerFn: () => void
): Promise<void> {
  console.log(`[BattleRoom] ========== START BATTLE ==========`);
  console.log(`[BattleRoom] Room: ${roomId}`);
  console.log(`[BattleRoom] Players: ${state.players.length}`);

  setLobbyPhase(false);
  state.status = "ACTIVE";
  console.log(`[BattleRoom] Status setado para: ${state.status}`);

  // Gerar configuração do mapa
  const terrainType = getRandomTerrain();
  const territorySize = getRandomBattleSize();
  const { width, height } = getGridDimensions(territorySize);

  state.gridWidth = width;
  state.gridHeight = height;

  // Configurar mapa
  state.config.map.terrainType = terrainType;
  state.config.map.territorySize = territorySize;
  state.config.weather = "CLEAR";
  state.config.timeOfDay = 12;

  // Gerar obstáculos
  const obstacleCount = getObstacleCount(territorySize);
  generateObstacles(state, obstacleCount);

  // Criar unidades para cada jogador (ANTES de persistir para ter os dados completos)
  await createBattleUnitsFn();

  console.log(`[BattleRoom] Unidades criadas: ${state.units.size}`);

  // Inicializar QTE Manager
  initQTEFn();

  // Definir ordem de ação
  calculateActionOrderFn();

  console.log(`[BattleRoom] actionOrder: ${state.actionOrder.length} unidades`);

  // Iniciar timer de turno
  state.turnTimer = TURN_CONFIG.timerSeconds;
  startTurnTimerFn();

  // Persistir batalha COMPLETA no banco (igual ao worker de persistência)
  // Isso inclui todas as unidades, obstáculos, actionOrder, etc.
  // Usa status "ACTIVE" para criação inicial
  await persistBattle(roomId, state, "ACTIVE");
  console.log(
    `[BattleRoom] Batalha ${roomId} persistida completamente no banco de dados`
  );

  // Preparar lista de players para uso no metadata
  const playerIds = state.players.map((p: BattlePlayerSchema) => p.oderId);

  console.log(`[BattleRoom] Estado final antes de broadcast:`, {
    battleId: state.battleId,
    status: state.status,
    round: state.round,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    playersCount: state.players.length,
    unitsCount: state.units.size,
    obstaclesCount: state.obstacles.length,
    turnTimer: state.turnTimer,
    currentPlayerId: state.currentPlayerId,
    activeUnitId: state.activeUnitId,
    actionOrderLength: state.actionOrder.length,
    firstUnitInOrder: state.actionOrder.at(0),
  });

  // Preparar lista de players e kingdoms para metadata (reutilizando playerIds já definido)
  const playerKingdoms: Record<string, string> = {};
  state.players.forEach((p: BattlePlayerSchema) => {
    playerKingdoms[p.oderId] = p.kingdomId;
  });

  // Atualizar metadata - IMPORTANTE: manter players e playerKingdoms
  setMetadata({
    ...metadata,
    status: "BATTLING",
    players: playerIds,
    playerKingdoms,
  });

  console.log(`[BattleRoom] Metadata atualizado com players:`, playerIds);

  // Serializar estado completo para o broadcast
  const serializedState = {
    battleId: state.battleId,
    lobbyId: state.lobbyId,
    matchId: state.matchId,
    isBattle: state.isBattle,
    maxPlayers: state.maxPlayers,
    status: state.status,
    round: state.round,
    currentTurnIndex: state.currentTurnIndex,
    activeUnitId: state.activeUnitId,
    selectedUnitId: state.selectedUnitId,
    currentPlayerId: state.currentPlayerId,
    unitLocked: state.unitLocked,
    turnTimer: state.turnTimer,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    winnerId: "",
    winReason: "",
    rematchRequests: [] as string[],
    players: state.players.map((p) => ({
      oderId: p.oderId,
      kingdomId: p.kingdomId,
      kingdomName: p.kingdomName,
      username: p.username,
      playerIndex: p.playerIndex,
      playerColor: p.playerColor,
      isConnected: p.isConnected,
      surrendered: p.surrendered,
    })),
    actionOrder: Array.from(state.actionOrder),
    units: {} as Record<string, object>,
    obstacles: state.obstacles.map((o) => ({
      id: o.id,
      posX: o.posX,
      posY: o.posY,
      type: o.type,
      hp: o.hp,
      maxHp: o.maxHp,
      destroyed: o.destroyed,
    })),
    config: serializeConfig(state),
  };

  // Serializar unidades usando campos do BattleUnit (shared/types/battle.types.ts)
  state.units.forEach((unit, id) => {
    serializedState.units[id] = {
      id: unit.id,
      sourceUnitId: unit.sourceUnitId,
      name: unit.name,
      ownerId: unit.ownerId,
      ownerKingdomId: unit.ownerKingdomId,
      posX: unit.posX,
      posY: unit.posY,
      currentHp: unit.currentHp,
      maxHp: unit.maxHp,
      currentMana: unit.currentMana,
      maxMana: unit.maxMana,
      movesLeft: unit.movesLeft,
      actionsLeft: unit.actionsLeft,
      attacksLeftThisTurn: unit.attacksLeftThisTurn,
      combat: unit.combat,
      speed: unit.speed,
      focus: unit.focus,
      resistance: unit.resistance,
      will: unit.will,
      vitality: unit.vitality,
      damageReduction: unit.damageReduction,
      race: unit.race,
      classCode: unit.classCode,
      category: unit.category,
      level: unit.level,
      avatar: unit.avatar,
      features: Array.from(unit.features),
      equipment: Array.from(unit.equipment),
      hasStartedAction: unit.hasStartedAction,
      size: unit.size,
      spells: Array.from(unit.spells),
      conditions: Array.from(unit.conditions),
      isAlive: unit.isAlive,
      actionMarks: unit.actionMarks,
      physicalProtection: unit.physicalProtection,
      maxPhysicalProtection: unit.maxPhysicalProtection,
      magicalProtection: unit.magicalProtection,
      maxMagicalProtection: unit.maxMagicalProtection,
      visionRange: unit.visionRange,
      isAIControlled: unit.isAIControlled,
      aiBehavior: unit.aiBehavior,
      unitCooldowns: {},
    };

    // Converter MapSchema de cooldowns para objeto
    unit.unitCooldowns.forEach((value, key) => {
      (serializedState.units[id] as any).unitCooldowns[key] = value;
    });
  });

  // Broadcast início da batalha com estado completo
  broadcast("battle:started", serializedState);
}

/**
 * Gera obstáculos no mapa
 */
export function generateObstacles(
  state: BattleSessionState,
  count: number
): void {
  const usedPositions = new Set<string>();

  // Reservar posições de spawn
  state.players.forEach((_, idx) => {
    const spawnX = idx === 0 ? 1 : state.gridWidth - 2;
    for (let y = 0; y < Math.min(3, state.gridHeight); y++) {
      usedPositions.add(`${spawnX},${y}`);
      usedPositions.add(`${spawnX + 1},${y}`);
    }
  });

  const terrainType = (state.config?.map?.terrainType ||
    "PLAINS") as Parameters<typeof getRandomObstacleType>[0];

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    while (attempts < 50) {
      const x = Math.floor(Math.random() * state.gridWidth);
      const y = Math.floor(Math.random() * state.gridHeight);
      const key = `${x},${y}`;

      if (!usedPositions.has(key)) {
        usedPositions.add(key);

        const obstacle = new BattleObstacleSchema();
        obstacle.id = `obs_${i}`;
        obstacle.posX = x;
        obstacle.posY = y;
        obstacle.type = getRandomObstacleType(terrainType);
        obstacle.hp = 5;
        obstacle.maxHp = 5;
        obstacle.destroyed = false;

        state.obstacles.push(obstacle);
        break;
      }
      attempts++;
    }
  }
}

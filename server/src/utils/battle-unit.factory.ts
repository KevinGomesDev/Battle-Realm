// src/utils/battle-unit.factory.ts
// Factory para criação de BattleUnits - elimina duplicação de código

import { determineUnitActions } from "../logic/unit-actions";
import { findSkillByCode } from "../../../shared/data/skills.data";
import { getRacePassiveCondition } from "../../../shared/data/races";
import {
  PHYSICAL_PROTECTION_CONFIG,
  MAGICAL_PROTECTION_CONFIG,
  HP_CONFIG,
  getRandomArenaSize,
  getGridDimensions,
  calculateUnitVision,
  type UnitSize,
} from "../../../shared/config/global.config";
import type {
  TerritorySize,
  BattleUnit,
} from "../../../shared/types/battle.types";

// Re-exportar BattleUnit para compatibilidade com imports existentes
export type { BattleUnit } from "../../../shared/types/battle.types";

// Tipo para unidade do banco de dados (Nexus - fonte de verdade)
interface DBUnit {
  id: string;
  name: string | null;
  avatar: string | null;
  category: string;
  troopSlot: number | null;
  level: number;
  classCode: string | null;
  classFeatures: string | null; // Skills aprendidas (JSON array)
  equipment: string | null;
  spells: string | null; // Magias disponíveis (JSON array)
  conditions: string | null; // Condições permanentes (JSON array) - NOVO
  unitCooldowns: string | null; // Cooldowns entre batalhas (JSON object) - NOVO
  combat: number;
  speed: number;
  focus: number;
  armor: number;
  vitality: number;
  damageReduction: number | null;
  size?: UnitSize | null;
}

interface KingdomInfo {
  id: string;
  name: string;
  race: string;
}

interface Position {
  x: number;
  y: number;
}

// Gerar ID único
function generateUnitId(): string {
  return `unit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Cria uma BattleUnit a partir de uma unidade do banco de dados
 * O Unit é o Nexus (fonte de verdade) - BattleUnit é uma instância de batalha
 */
export function createBattleUnit(
  dbUnit: DBUnit,
  ownerId: string,
  kingdom: KingdomInfo,
  position: Position,
  battleType: "arena" | "match" = "arena"
): BattleUnit {
  // Parse classFeatures do JSON
  const classFeatures: string[] = JSON.parse(dbUnit.classFeatures || "[]");

  // Parse spells do JSON
  const spells: string[] = JSON.parse(dbUnit.spells || "[]");

  // Parse conditions permanentes do Unit (Nexus)
  const unitConditions: string[] = JSON.parse(dbUnit.conditions || "[]");

  // NOTA: Cooldowns NÃO passam entre batalhas - sempre iniciam zerados
  // O campo unitCooldowns do Unit é reservado para efeitos de longa duração (ex: skills com cooldown em turnos de partida)
  // Cooldowns de batalha são por batalha, não persistem

  // Determinar ações dinamicamente baseado nos stats e skills
  const unitActions = determineUnitActions(
    {
      combat: dbUnit.combat,
      speed: dbUnit.speed,
      focus: dbUnit.focus,
      armor: dbUnit.armor,
      vitality: dbUnit.vitality,
      category: dbUnit.category,
      classFeatures, // Passa skills aprendidas para adicionar ativas às ações
    },
    { battleType }
  );

  // Começar com as condições permanentes do Unit
  const initialConditions: string[] = [...unitConditions];

  // Adicionar condições de skills passivas (se ainda não estiverem)
  for (const skillCode of classFeatures) {
    const skill = findSkillByCode(skillCode);
    if (skill && skill.category === "PASSIVE" && skill.conditionApplied) {
      if (!initialConditions.includes(skill.conditionApplied)) {
        initialConditions.push(skill.conditionApplied);
      }
    }
  }

  // Aplicar condição racial (passiva de raça)
  const raceCondition = getRacePassiveCondition(kingdom.race);
  if (raceCondition && !initialConditions.includes(raceCondition)) {
    initialConditions.push(raceCondition);
  }

  return {
    id: generateUnitId(),
    sourceUnitId: dbUnit.id,
    ownerId,
    ownerKingdomId: kingdom.id,
    name: dbUnit.name || `${kingdom.name} ${dbUnit.category}`,
    avatar: dbUnit.avatar ?? undefined,
    category: dbUnit.category,
    troopSlot: dbUnit.troopSlot ?? undefined,
    level: dbUnit.level,
    race: kingdom.race,
    classCode: dbUnit.classCode ?? undefined,
    classFeatures, // Já foi parseado acima
    equipment: JSON.parse(dbUnit.equipment || "[]"),
    combat: dbUnit.combat,
    speed: dbUnit.speed,
    focus: dbUnit.focus,
    armor: dbUnit.armor,
    vitality: dbUnit.vitality,
    damageReduction: dbUnit.damageReduction || 0,
    currentHp: dbUnit.vitality * HP_CONFIG.multiplier,
    maxHp: dbUnit.vitality * HP_CONFIG.multiplier,
    posX: position.x,
    posY: position.y,
    movesLeft: 0,
    actionsLeft: 1,
    attacksLeftThisTurn: 0, // Ataques disponíveis (setado ao usar ação de ataque)
    isAlive: true,
    actionMarks: 0,
    // Proteção Física = Armor * PHYSICAL_PROTECTION_CONFIG.multiplier
    physicalProtection:
      (dbUnit.armor || 0) * PHYSICAL_PROTECTION_CONFIG.multiplier,
    maxPhysicalProtection:
      (dbUnit.armor || 0) * PHYSICAL_PROTECTION_CONFIG.multiplier,
    // Proteção Mágica = Focus * MAGICAL_PROTECTION_CONFIG.multiplier
    magicalProtection:
      (dbUnit.focus || 0) * MAGICAL_PROTECTION_CONFIG.multiplier,
    maxMagicalProtection:
      (dbUnit.focus || 0) * MAGICAL_PROTECTION_CONFIG.multiplier,
    conditions: initialConditions, // Condições do Unit + passivas de skills/raça
    spells, // Lista de spells da unidade (copiada do DB)
    hasStartedAction: false,
    actions: unitActions,
    // Tamanho da unidade (default: NORMAL 1x1)
    size: dbUnit.size || "NORMAL",
    // Alcance de visão = max(10, focus)
    visionRange: calculateUnitVision(dbUnit.focus),
    // Cooldowns de skills/spells sempre iniciam zerados (não passam entre batalhas)
    unitCooldowns: {},
    // Summons e Monsters são controlados por IA
    isAIControlled:
      dbUnit.category === "SUMMON" || dbUnit.category === "MONSTER",
  };
}

/**
 * Cria múltiplas BattleUnits para um lado da batalha
 * @param units - Array de unidades do banco de dados
 * @param ownerId - ID do dono das unidades
 * @param kingdom - Informações do reino
 * @param startPosition - Posição inicial
 * @param spread - Direção de espalhamento ("horizontal" ou "vertical")
 * @param battleType - Tipo de batalha ("arena" ou "match")
 */
export function createBattleUnitsForSide(
  units: DBUnit[],
  ownerId: string,
  kingdom: KingdomInfo,
  startPosition: Position,
  spread: "horizontal" | "vertical" = "horizontal",
  battleType: "arena" | "match" = "arena"
): BattleUnit[] {
  return units.map((unit, index) => {
    const position =
      spread === "horizontal"
        ? { x: startPosition.x + index, y: startPosition.y }
        : { x: startPosition.x, y: startPosition.y + index };

    return createBattleUnit(unit, ownerId, kingdom, position, battleType);
  });
}

/**
 * Gera uma posição aleatória dentro do grid, evitando posições ocupadas
 */
function getRandomPosition(
  gridWidth: number,
  gridHeight: number,
  occupiedPositions: Set<string>
): Position {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const x = Math.floor(Math.random() * gridWidth);
    const y = Math.floor(Math.random() * gridHeight);
    const key = `${x},${y}`;

    if (!occupiedPositions.has(key)) {
      return { x, y };
    }
    attempts++;
  }

  // Fallback: encontrar primeira posição livre
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const key = `${x},${y}`;
      if (!occupiedPositions.has(key)) {
        return { x, y };
      }
    }
  }

  // Último fallback (não deveria acontecer)
  return { x: 0, y: 0 };
}

/**
 * Cria unidades de batalha para ambos os lados com posicionamento aleatório
 * @param hostUnits - Unidades do host
 * @param hostOwnerId - ID do host
 * @param hostKingdom - Informações do reino do host
 * @param guestUnits - Unidades do guest
 * @param guestOwnerId - ID do guest
 * @param guestKingdom - Informações do reino do guest
 * @param gridWidth - Largura do grid
 * @param gridHeight - Altura do grid
 * @param battleType - Tipo de batalha ("arena" ou "match")
 * @returns Objeto com unidades e posições ocupadas
 */
export function createBattleUnitsWithRandomPositions(
  hostUnits: DBUnit[],
  hostOwnerId: string,
  hostKingdom: KingdomInfo,
  guestUnits: DBUnit[],
  guestOwnerId: string,
  guestKingdom: KingdomInfo,
  gridWidth: number,
  gridHeight: number,
  battleType: "arena" | "match" = "arena"
): { units: BattleUnit[]; occupiedPositions: Position[] } {
  const occupiedSet = new Set<string>();
  const allUnits: BattleUnit[] = [];
  const occupiedPositions: Position[] = [];

  // Criar unidades do host com posições aleatórias
  for (const dbUnit of hostUnits) {
    const position = getRandomPosition(gridWidth, gridHeight, occupiedSet);
    occupiedSet.add(`${position.x},${position.y}`);
    occupiedPositions.push(position);

    const battleUnit = createBattleUnit(
      dbUnit,
      hostOwnerId,
      hostKingdom,
      position,
      battleType
    );
    allUnits.push(battleUnit);
  }

  // Criar unidades do guest com posições aleatórias
  for (const dbUnit of guestUnits) {
    const position = getRandomPosition(gridWidth, gridHeight, occupiedSet);
    occupiedSet.add(`${position.x},${position.y}`);
    occupiedPositions.push(position);

    const battleUnit = createBattleUnit(
      dbUnit,
      guestOwnerId,
      guestKingdom,
      position,
      battleType
    );
    allUnits.push(battleUnit);
  }

  return { units: allUnits, occupiedPositions };
}

/**
 * Obtém o tamanho do grid baseado no território (para Arena, sorteia)
 */
export function getArenaBattleGridSize(): {
  width: number;
  height: number;
  territorySize: TerritorySize;
} {
  const territorySize = getRandomArenaSize();
  const dimensions = getGridDimensions(territorySize);
  return {
    width: dimensions.width,
    height: dimensions.height,
    territorySize: territorySize as TerritorySize,
  };
}

/**
 * Calcula a iniciativa total de um jogador (soma de speed de todas as suas unidades)
 */
export function calculatePlayerInitiative(
  units: BattleUnit[],
  playerId: string
): number {
  return units
    .filter((u) => u.ownerId === playerId && u.isAlive)
    .reduce((sum, u) => sum + u.speed, 0);
}

/**
 * Determina a ordem de ação dos jogadores baseada na soma de speed das unidades
 * Jogador com maior total de speed age primeiro
 */
export function determineActionOrder(
  units: BattleUnit[],
  hostUserId: string,
  guestUserId: string
): string[] {
  if (units.length === 0) {
    return [hostUserId, guestUserId];
  }

  const hostInitiative = calculatePlayerInitiative(units, hostUserId);
  const guestInitiative = calculatePlayerInitiative(units, guestUserId);

  // Em caso de empate, host vai primeiro
  return hostInitiative >= guestInitiative
    ? [hostUserId, guestUserId]
    : [guestUserId, hostUserId];
}

// =============================================================================
// BOT UNITS FROM TEMPLATE
// =============================================================================

import type { KingdomTemplateDefinition } from "../../../shared/data/kingdom-templates";

/**
 * Cria unidades de BOT a partir de um template de reino
 * Retorna apenas o Regente como unidade BOT (para batalha 1v1)
 */
export function createBotUnitsFromTemplate(
  template: KingdomTemplateDefinition,
  botUserId: string,
  botKingdom: KingdomInfo
): DBUnit[] {
  const regent = template.regent;

  // Criar um DBUnit fake a partir do template do regente
  const regentUnit: DBUnit = {
    id: `bot_regent_${Date.now()}`,
    name: `🤖 ${regent.name}`,
    avatar: regent.avatar || "1",
    category: "REGENT",
    troopSlot: null,
    level: 1,
    classCode: null, // BOT não tem classe específica
    classFeatures: regent.initialSkillId
      ? JSON.stringify([regent.initialSkillId])
      : "[]",
    equipment: "[]",
    spells: "[]",
    conditions: "[]",
    unitCooldowns: "{}",
    combat: regent.combat,
    speed: regent.speed,
    focus: regent.focus,
    armor: regent.armor,
    vitality: regent.vitality,
    damageReduction: null,
    size: "NORMAL",
  };

  return [regentUnit];
}

// =============================================================================
// SINCRONIZAÇÃO: BattleUnit → Unit (após batalha)
// =============================================================================

/**
 * Interface para dados que devem ser sincronizados de volta ao Unit
 * Apenas campos que podem mudar durante uma batalha/partida e persistem
 * NOTA: unitCooldowns NÃO são sincronizados - cooldowns são por batalha
 */
export interface UnitSyncData {
  sourceUnitId: string;
  // Estado de vida
  currentHp: number;
  isAlive: boolean;
  // Condições permanentes (filtra as temporárias)
  conditions: string[];
  // Spells (podem ser adicionadas/removidas durante batalha)
  spells: string[];
  // Stats que podem mudar (level up, buffs permanentes)
  level: number;
  // Equipment pode mudar (loot, perda)
  equipment: string[];
}

/**
 * Extrai os dados que devem ser sincronizados do BattleUnit para o Unit
 * Filtra condições temporárias, mantendo apenas as permanentes
 */
export function extractSyncData(battleUnit: BattleUnit): UnitSyncData {
  // Filtrar apenas condições permanentes (não temporárias de batalha)
  // Condições temporárias têm expiry !== "permanent"
  // Como não temos acesso direto à definição aqui, confiamos que
  // condições de raça e skills passivas já estão no Unit
  // Outras condições adicionadas durante partida são mantidas
  const permanentConditions = battleUnit.conditions.filter((condCode) => {
    // Condições de passivas de skills são recalculadas ao criar BattleUnit
    // Então não precisamos sincronizar de volta
    // Aqui mantemos apenas condições "extras" que foram adicionadas
    return true; // Por enquanto, sincroniza todas (a ser refinado)
  });

  return {
    sourceUnitId: battleUnit.sourceUnitId,
    currentHp: battleUnit.currentHp,
    isAlive: battleUnit.isAlive,
    conditions: permanentConditions,
    // NOTA: unitCooldowns NÃO são sincronizados - cooldowns são por batalha
    spells: battleUnit.spells,
    level: battleUnit.level,
    equipment: battleUnit.equipment,
  };
}

/**
 * Gera os dados para atualizar o Unit no banco de dados
 * Retorna objeto pronto para usar com prisma.unit.update()
 * NOTA: unitCooldowns NÃO são sincronizados - cooldowns são por batalha
 */
export function getSyncUpdateData(syncData: UnitSyncData): {
  currentHp: number;
  isAlive: boolean;
  conditions: string;
  spells: string;
  level: number;
  equipment: string;
} {
  return {
    currentHp: syncData.currentHp,
    isAlive: syncData.isAlive,
    conditions: JSON.stringify(syncData.conditions),
    spells: JSON.stringify(syncData.spells),
    level: syncData.level,
    equipment: JSON.stringify(syncData.equipment),
  };
}

/**
 * Extrai dados de sincronização de múltiplas BattleUnits
 * Útil para sincronizar todas as unidades de uma batalha de uma vez
 */
export function extractAllSyncData(battleUnits: BattleUnit[]): UnitSyncData[] {
  return battleUnits
    .filter((unit) => unit.sourceUnitId) // Só unidades que vieram do banco
    .map((unit) => extractSyncData(unit));
}

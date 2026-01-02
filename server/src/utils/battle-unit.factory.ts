// src/utils/battle-unit.factory.ts
// Factory para criação de BattleUnits - elimina duplicação de código

import { determineUnitActions } from "../logic/unit-actions";
import { findSkillByCode } from "../data/skills.data";
import {
  PHYSICAL_PROTECTION_CONFIG,
  MAGICAL_PROTECTION_CONFIG,
  HP_CONFIG,
  getRandomArenaSize,
  getGridDimensions,
  calculateUnitVision,
  type UnitSize,
} from "../../../shared/config/global.config";
import type { TerritorySize } from "../../../shared/types/battle.types";

// Tipo para unidade do banco de dados
interface DBUnit {
  id: string;
  name: string | null;
  avatar: string | null; // Nome do arquivo sprite
  category: string;
  troopSlot: number | null;
  level: number;
  classCode: string | null;
  classFeatures: string | null;
  equipment: string | null;
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
  damageReduction: number | null;
  size?: UnitSize | null; // Tamanho da unidade
}

// Tipo para BattleUnit
export interface BattleUnit {
  id: string;
  sourceUnitId: string;
  ownerId: string;
  ownerKingdomId: string;
  name: string;
  avatar?: string; // Nome do arquivo sprite
  category: string;
  troopSlot?: number;
  level: number;
  classCode?: string;
  classFeatures: string[];
  equipment: string[];
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
  damageReduction: number;
  currentHp: number;
  maxHp: number;
  posX: number;
  posY: number;
  movesLeft: number;
  actionsLeft: number;
  attacksLeftThisTurn: number; // Ataques restantes neste turno (para extraAttacks)
  isAlive: boolean;
  actionMarks: number;
  physicalProtection: number;
  maxPhysicalProtection: number;
  magicalProtection: number;
  maxMagicalProtection: number;
  conditions: string[];
  hasStartedAction: boolean;
  actions: string[];
  grabbedByUnitId?: string;
  // Tamanho da unidade (células ocupadas) - default NORMAL (1x1)
  size: UnitSize;
  // Alcance de visão calculado (max(10, focus))
  visionRange: number;
  // Cooldowns de skills: skillCode -> rodadas restantes
  skillCooldowns: Record<string, number>;
}

interface KingdomInfo {
  id: string;
  name: string;
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

  // Determinar ações dinamicamente baseado nos stats e skills
  const unitActions = determineUnitActions(
    {
      combat: dbUnit.combat,
      acuity: dbUnit.acuity,
      focus: dbUnit.focus,
      armor: dbUnit.armor,
      vitality: dbUnit.vitality,
      category: dbUnit.category,
      classFeatures, // Passa skills aprendidas para adicionar ativas às ações
    },
    { battleType }
  );

  // Coletar condições iniciais de skills passivas
  const initialConditions: string[] = [];
  for (const skillCode of classFeatures) {
    const skill = findSkillByCode(skillCode);
    if (skill && skill.category === "PASSIVE" && skill.conditionApplied) {
      // Adicionar condição permanente da passiva
      if (!initialConditions.includes(skill.conditionApplied)) {
        initialConditions.push(skill.conditionApplied);
      }
    }
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
    classCode: dbUnit.classCode ?? undefined,
    classFeatures, // Já foi parseado acima
    equipment: JSON.parse(dbUnit.equipment || "[]"),
    combat: dbUnit.combat,
    acuity: dbUnit.acuity,
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
    conditions: initialConditions, // Condições iniciais de passivas
    hasStartedAction: false,
    actions: unitActions,
    // Tamanho da unidade (default: NORMAL 1x1)
    size: dbUnit.size || "NORMAL",
    // Alcance de visão = max(10, focus)
    visionRange: calculateUnitVision(dbUnit.focus),
    // Cooldowns de skills inicializam vazios
    skillCooldowns: {},
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
 * Calcula a iniciativa total de um jogador (soma de Acuity de todas as suas unidades)
 */
export function calculatePlayerInitiative(
  units: BattleUnit[],
  playerId: string
): number {
  return units
    .filter((u) => u.ownerId === playerId && u.isAlive)
    .reduce((sum, u) => sum + u.acuity, 0);
}

/**
 * Determina a ordem de ação dos jogadores baseada na soma de Acuity das unidades
 * Jogador com maior total de Acuity age primeiro
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

/**
 * Configuração de sprites disponíveis para unidades no grid de batalha
 * Cada sprite é um sheet 192x192 (6x6 grid de frames 32x32)
 * Todos os sprites seguem o padrão de ID: [1].png, [2].png, etc.
 */

export interface SpriteConfig {
  src: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  idleFrames: number;
  idleRow: number;
  frameSpeed: number;
}

// Total de sprites disponíveis (contagem de arquivos [n].png na pasta Characters)
export const TOTAL_SPRITES = 46;

// IDs de sprites que são personagens humanoides (para uso em avatares)
// Exclui: [1] Anvil, [4] Bear, [5] Bird, [7] Boar, [8] Bunny, [11] Deer1, [12] Deer2, [14] Fox, [45] Wolf
export const CHARACTER_SPRITE_IDS: string[] = [
  "[2].png", // ArcherMan
  "[3].png", // ArchMage
  "[6].png", // Blacksmith
  "[9].png", // CavalierMan
  "[10].png", // CrossBowMan
  "[13].png", // EarthWarrior
  "[15].png", // Gatherer
  "[16].png", // GraveDigger
  "[17].png", // HalberdMan
  "[18].png", // HorseMan
  "[19].png", // Hunter
  "[20].png", // IceSwordswoman
  "[21].png", // KingMan
  "[22].png", // LightningWarrior
  "[23].png", // Lumberjack
  "[24].png", // Mage
  "[25].png", // Merchant
  "[26].png", // Miner
  "[27].png", // NobleMan
  "[28].png", // NobleWoman
  "[29].png", // Nun
  "[30].png", // OldMan
  "[31].png", // OldWoman
  "[32].png", // Peasant
  "[33].png", // PrinceMan
  "[34].png", // Princess
  "[35].png", // Queen
  "[36].png", // ShieldMan
  "[37].png", // SpearMan
  "[38].png", // SuspiciousMerchant
  "[39].png", // SwordMan
  "[40].png", // Thief
  "[41].png", // VillagerMan
  "[42].png", // VillagerWoman
  "[43].png", // WaterSpearwoman
  "[44].png", // WindWarrior
  "[46].png", // Worker
];

// Lista de todos os IDs de sprites disponíveis (incluindo animais/itens)
export const SPRITE_IDS: string[] = Array.from(
  { length: TOTAL_SPRITES },
  (_, i) => `[${i + 1}].png`
);

// Configuração padrão para todos os sprites (mesmo layout 192x192)
const DEFAULT_SPRITE_CONFIG: Omit<SpriteConfig, "src"> = {
  frameWidth: 32,
  frameHeight: 32,
  columns: 6,
  rows: 6,
  idleFrames: 4,
  idleRow: 0,
  frameSpeed: 200,
};

// Gerar SPRITE_SHEETS dinamicamente para todos os IDs
export const SPRITE_SHEETS: Record<string, SpriteConfig> = SPRITE_IDS.reduce(
  (acc, id) => {
    acc[id] = {
      ...DEFAULT_SPRITE_CONFIG,
      src: `/sprites/Characters/${id}`,
    };
    return acc;
  },
  {} as Record<string, SpriteConfig>
);

// Sprite padrão quando o tipo não é encontrado (primeiro sprite)
export const DEFAULT_SPRITE: SpriteConfig = SPRITE_SHEETS["[1].png"];

// Mapeamento de classCode para ID de sprite
const CLASS_CODE_TO_SPRITE: Record<string, string> = {
  WARRIOR: "[3].png",
  CLERIC: "[1].png",
  WIZARD: "[9].png",
};

/**
 * Obtém a configuração de sprite para um avatar ou classCode
 * @param spriteIdentifier - ID do sprite (ex: "[1].png") ou classCode (ex: "WARRIOR")
 * @returns Configuração do sprite ou sprite padrão
 */
export function getSpriteConfig(spriteIdentifier?: string): SpriteConfig {
  if (!spriteIdentifier) return DEFAULT_SPRITE;

  // Se é um ID de sprite válido ([n].png)
  if (SPRITE_SHEETS[spriteIdentifier]) {
    return SPRITE_SHEETS[spriteIdentifier];
  }

  // Se é um classCode, converte para sprite ID
  if (CLASS_CODE_TO_SPRITE[spriteIdentifier]) {
    const spriteId = CLASS_CODE_TO_SPRITE[spriteIdentifier];
    return SPRITE_SHEETS[spriteId] || DEFAULT_SPRITE;
  }

  return DEFAULT_SPRITE;
}

/**
 * Verifica se um ID de sprite é válido
 */
export function isValidSpriteId(id?: string): boolean {
  if (!id) return false;
  return SPRITE_IDS.includes(id);
}

/**
 * Obtém um sprite ID aleatório
 */
export function getRandomSpriteId(): string {
  const index = Math.floor(Math.random() * SPRITE_IDS.length);
  return SPRITE_IDS[index];
}

// Direções possíveis para o sprite (baseado no movimento)
export type SpriteDirection = "right" | "left" | "up" | "down";

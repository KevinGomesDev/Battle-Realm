// shared/types/character.types.ts
// Tipos para o sistema de criação de personagem pixel art

// =============================================================================
// TIPOS BASE
// =============================================================================

/** Cor em formato hex */
export type HexColor = string;

/** Posição de um pixel no grid */
export interface PixelPosition {
  x: number;
  y: number;
}

/** Um pixel individual com cor */
export interface Pixel extends PixelPosition {
  color: HexColor;
}

// =============================================================================
// PARTES DO CORPO
// =============================================================================

/** Tipos de partes do corpo customizáveis */
export type BodyPartType =
  | "body"
  | "head"
  | "hair"
  | "eyes"
  | "mouth"
  | "facial_hair"
  | "shirt"
  | "pants"
  | "shoes"
  | "accessory"
  | "weapon";

/** Definição de uma parte do corpo em pixels */
export interface BodyPartDefinition {
  id: string;
  name: string;
  type: BodyPartType;
  /** Pixels que compõem essa parte (posição relativa ao grid) */
  pixels: Pixel[];
  /** Layer de renderização (maior = mais à frente) */
  zIndex: number;
}

// =============================================================================
// OPÇÕES DE CUSTOMIZAÇÃO
// =============================================================================

/** Opção de estilo para uma parte do corpo */
export interface StyleOption {
  id: string;
  name: string;
  type: BodyPartType;
  /** Pixels que definem o formato (cores serão aplicadas depois) */
  shape: PixelPosition[];
  /** Cor padrão (pode ser sobrescrita) */
  defaultColor: HexColor;
  /** Se aceita múltiplas cores */
  multiColor?: boolean;
  /** Cores secundárias para partes multi-cor */
  secondaryPositions?: PixelPosition[];
}

/** Posição onde a arma é carregada */
export type WeaponPosition = "hand" | "back" | "waist";

/** Tipo de arma */
export type WeaponType =
  | "sword"
  | "axe"
  | "spear"
  | "bow"
  | "staff"
  | "shield"
  | "dagger";

/** Opção de arma com posições variadas */
export interface WeaponStyleOption {
  id: string;
  name: string;
  type: "weapon";
  weaponType: WeaponType;
  /** Shapes para cada posição (mão, costas, cintura) */
  shapes: Record<WeaponPosition, PixelPosition[]>;
  /** Cor padrão do metal/madeira */
  defaultColor: HexColor;
  /** Posições secundárias para detalhes (cabo, gema, etc) */
  secondaryPositions?: Record<WeaponPosition, PixelPosition[]>;
  /** Cor secundária padrão */
  defaultSecondaryColor?: HexColor;
}

/** Paleta de cores disponíveis */
export interface ColorPalette {
  id: string;
  name: string;
  type: "skin" | "hair" | "clothing" | "accessory" | "eyes" | "weapon";
  colors: HexColor[];
}

// =============================================================================
// TIPOS DE CORPO
// =============================================================================

/** Tipo de corpo do personagem */
export type BodyType = "slim" | "normal" | "athletic" | "heavy";

/** Definição de variação de corpo */
export interface BodyTypeDefinition {
  id: BodyType;
  name: string;
  description: string;
  /** Modificadores de posição para cada parte do corpo */
  headShape: PixelPosition[];
  bodyShape: PixelPosition[];
  armsShape: PixelPosition[];
  handsShape: PixelPosition[];
  legsShape: PixelPosition[];
}

// =============================================================================
// POSES E ANIMAÇÕES
// =============================================================================

/** Poses disponíveis para o personagem */
export type CharacterPose =
  | "idle"
  | "walk_1"
  | "walk_2"
  | "attack"
  | "hurt"
  | "dead";

/**
 * Direção que o personagem está olhando (8 direções)
 * Usa notação de pontos cardeais:
 * - N (Norte/Cima), S (Sul/Baixo), E (Leste/Direita), W (Oeste/Esquerda)
 * - NE, SE, SW, NW para diagonais
 */
export type CharacterDirection =
  | "n" // Norte (cima/costas)
  | "ne" // Nordeste (diagonal cima-direita)
  | "e" // Leste (direita)
  | "se" // Sudeste (diagonal baixo-direita)
  | "s" // Sul (baixo/frente)
  | "sw" // Sudoeste (diagonal baixo-esquerda)
  | "w" // Oeste (esquerda)
  | "nw"; // Noroeste (diagonal cima-esquerda)

/** Ordem das direções para rotação (sentido horário) */
export const DIRECTION_ORDER: CharacterDirection[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

/** Labels amigáveis para cada direção */
export const DIRECTION_LABELS: Record<CharacterDirection, string> = {
  n: "Norte",
  ne: "Nordeste",
  e: "Leste",
  se: "Sudeste",
  s: "Sul",
  sw: "Sudoeste",
  w: "Oeste",
  nw: "Noroeste",
};

/** Ícones/setas para cada direção */
export const DIRECTION_ARROWS: Record<CharacterDirection, string> = {
  n: "↑",
  ne: "↗",
  e: "→",
  se: "↘",
  s: "↓",
  sw: "↙",
  w: "←",
  nw: "↖",
};

/** Rotaciona a direção no sentido horário */
export const rotateDirectionCW = (
  dir: CharacterDirection
): CharacterDirection => {
  const idx = DIRECTION_ORDER.indexOf(dir);
  return DIRECTION_ORDER[(idx + 1) % 8];
};

/** Rotaciona a direção no sentido anti-horário */
export const rotateDirectionCCW = (
  dir: CharacterDirection
): CharacterDirection => {
  const idx = DIRECTION_ORDER.indexOf(dir);
  return DIRECTION_ORDER[(idx + 7) % 8]; // +7 é o mesmo que -1 em módulo 8
};

/** Definição de uma pose */
export interface PoseDefinition {
  id: CharacterPose;
  name: string;
  /** Modificadores de posição para braços/mãos nesta pose */
  armsShape: PixelPosition[];
  handsShape: PixelPosition[];
  /** Offset do corpo (para animação de balanço) */
  bodyOffset?: { x: number; y: number };
  /** Offset das pernas */
  legsOffset?: { x: number; y: number };
}

// =============================================================================
// CONFIGURAÇÃO DO PERSONAGEM
// =============================================================================

/** Configuração de aparência base (não muda durante o jogo) */
export interface CharacterAppearance {
  /** Tipo de corpo */
  bodyType: BodyType;
  /** Cor da pele */
  skinColor: HexColor;
  /** Cor dos olhos */
  eyeColor: HexColor;
  /** Estilo do cabelo */
  hairStyle: string;
  /** Cor do cabelo */
  hairColor: HexColor;
  /** Estilo da barba/facial hair (opcional) */
  facialHairStyle?: string;
  /** Cor da barba */
  facialHairColor?: HexColor;
}

/** Configuração de equipamento (pode mudar durante o jogo) */
export interface CharacterEquipment {
  /** Estilo da camisa/armadura */
  shirtStyle: string;
  /** Cor da camisa */
  shirtColor: HexColor;
  /** Cor secundária da camisa */
  shirtSecondaryColor?: HexColor;
  /** Estilo da calça */
  pantsStyle: string;
  /** Cor da calça */
  pantsColor: HexColor;
  /** Estilo dos sapatos */
  shoesStyle: string;
  /** Cor dos sapatos */
  shoesColor: HexColor;
  /** Acessório de cabeça (opcional) */
  accessoryStyle?: string;
  /** Cor do acessório */
  accessoryColor?: HexColor;
  /** Arma equipada (opcional) */
  weaponStyle?: string;
  /** Cor da arma */
  weaponColor?: HexColor;
  /** Cor secundária da arma (cabo, detalhes) */
  weaponSecondaryColor?: HexColor;
  /** Posição da arma */
  weaponPosition?: WeaponPosition;
}

/** Configuração completa de um personagem (para salvar no banco) */
export interface CharacterConfig {
  // === Aparência (imutável) ===
  /** Tipo de corpo */
  bodyType: BodyType;
  /** Cor da pele */
  skinColor: HexColor;
  /** Cor dos olhos */
  eyeColor: HexColor;
  /** Estilo do cabelo */
  hairStyle: string;
  /** Cor do cabelo */
  hairColor: HexColor;
  /** Estilo da barba/facial hair (opcional) */
  facialHairStyle?: string;
  /** Cor da barba */
  facialHairColor?: HexColor;

  // === Equipamento ===
  /** Estilo da camisa */
  shirtStyle: string;
  /** Cor da camisa */
  shirtColor: HexColor;
  /** Cor secundária da camisa */
  shirtSecondaryColor?: HexColor;
  /** Estilo da calça */
  pantsStyle: string;
  /** Cor da calça */
  pantsColor: HexColor;
  /** Estilo dos sapatos */
  shoesStyle: string;
  /** Cor dos sapatos */
  shoesColor: HexColor;
  /** Acessório (opcional) */
  accessoryStyle?: string;
  /** Cor do acessório */
  accessoryColor?: HexColor;

  // === Arma ===
  /** Arma equipada (opcional) */
  weaponStyle?: string;
  /** Cor da arma */
  weaponColor?: HexColor;
  /** Cor secundária da arma */
  weaponSecondaryColor?: HexColor;
  /** Posição da arma (mão, costas, cintura) */
  weaponPosition?: WeaponPosition;
}

/** Configuração padrão para novo personagem */
export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  // Aparência
  bodyType: "normal",
  skinColor: "#e0ac69",
  eyeColor: "#4a4a4a",
  hairStyle: "short",
  hairColor: "#4a3728",
  // Equipamento
  shirtStyle: "basic",
  shirtColor: "#3b82f6",
  pantsStyle: "basic",
  pantsColor: "#4b5563",
  shoesStyle: "basic",
  shoesColor: "#78350f",
};

// =============================================================================
// UTILITÁRIOS
// =============================================================================

/** Extrai apenas a aparência de um CharacterConfig */
export const extractAppearance = (
  config: CharacterConfig
): CharacterAppearance => ({
  bodyType: config.bodyType,
  skinColor: config.skinColor,
  eyeColor: config.eyeColor,
  hairStyle: config.hairStyle,
  hairColor: config.hairColor,
  facialHairStyle: config.facialHairStyle,
  facialHairColor: config.facialHairColor,
});

/** Extrai apenas o equipamento de um CharacterConfig */
export const extractEquipment = (
  config: CharacterConfig
): CharacterEquipment => ({
  shirtStyle: config.shirtStyle,
  shirtColor: config.shirtColor,
  shirtSecondaryColor: config.shirtSecondaryColor,
  pantsStyle: config.pantsStyle,
  pantsColor: config.pantsColor,
  shoesStyle: config.shoesStyle,
  shoesColor: config.shoesColor,
  accessoryStyle: config.accessoryStyle,
  accessoryColor: config.accessoryColor,
  weaponStyle: config.weaponStyle,
  weaponColor: config.weaponColor,
  weaponSecondaryColor: config.weaponSecondaryColor,
  weaponPosition: config.weaponPosition,
});

// =============================================================================
// DIMENSÕES DO GRID
// =============================================================================

/** Configuração do grid do personagem */
export const CHARACTER_GRID = {
  /** Largura em pixels */
  width: 16,
  /** Altura em pixels */
  height: 24,
  /** Tamanho de cada pixel no SVG final */
  pixelSize: 8,
} as const;

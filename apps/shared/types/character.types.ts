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
  | "accessory";

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

/** Paleta de cores disponíveis */
export interface ColorPalette {
  id: string;
  name: string;
  type: "skin" | "hair" | "clothing" | "accessory" | "eyes";
  colors: HexColor[];
}

// =============================================================================
// CONFIGURAÇÃO DO PERSONAGEM
// =============================================================================

/** Configuração completa de um personagem */
export interface CharacterConfig {
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
}

/** Configuração padrão para novo personagem */
export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  skinColor: "#e0ac69",
  eyeColor: "#4a4a4a",
  hairStyle: "short",
  hairColor: "#4a3728",
  shirtStyle: "basic",
  shirtColor: "#3b82f6",
  pantsStyle: "basic",
  pantsColor: "#4b5563",
  shoesStyle: "basic",
  shoesColor: "#78350f",
};

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

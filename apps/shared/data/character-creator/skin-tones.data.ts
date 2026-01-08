// shared/data/character-creator/skin-tones.data.ts
// Tons de pele disponíveis para o criador de personagem

import { ColorPalette } from "../../types/character.types";

export const SKIN_PALETTES: ColorPalette = {
  id: "skin",
  name: "Tons de Pele",
  type: "skin",
  colors: [
    "#ffe0bd", // Muito claro
    "#ffcd94", // Claro
    "#e0ac69", // Médio claro
    "#c68642", // Médio
    "#8d5524", // Médio escuro
    "#6b4423", // Escuro
    "#4a3219", // Muito escuro
    "#2d1f12", // Ébano
  ],
};

export const SKIN_SHADOW_MAP: Record<string, string> = {
  "#ffe0bd": "#e6c9a8",
  "#ffcd94": "#e0b87f",
  "#e0ac69": "#c9985c",
  "#c68642": "#a87038",
  "#8d5524": "#734620",
  "#6b4423": "#573619",
  "#4a3219": "#3a2813",
  "#2d1f12": "#22170d",
};

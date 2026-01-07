// shared/data/character-creator/clothing-colors.data.ts
// Cores de roupas disponíveis para o criador de personagem

import type { ColorPalette } from "../../types/character.types";

export const CLOTHING_PALETTES: ColorPalette = {
  id: "clothing",
  name: "Cores de Roupas",
  type: "clothing",
  colors: [
    "#1f2937", // Cinza escuro
    "#4b5563", // Cinza
    "#9ca3af", // Cinza claro
    "#f3f4f6", // Branco
    "#0a0a0a", // Preto
    "#991b1b", // Vermelho escuro
    "#ef4444", // Vermelho
    "#f97316", // Laranja
    "#eab308", // Amarelo
    "#22c55e", // Verde
    "#14b8a6", // Teal
    "#3b82f6", // Azul
    "#1d4ed8", // Azul escuro
    "#7c3aed", // Roxo
    "#ec4899", // Rosa
    "#78350f", // Marrom escuro
    "#a16207", // Marrom
    "#d4a574", // Bege
  ],
};

export const SHOE_PALETTES: ColorPalette = {
  id: "shoes",
  name: "Cores de Calçados",
  type: "clothing",
  colors: [
    "#0a0a0a", // Preto
    "#1f2937", // Cinza escuro
    "#4b5563", // Cinza
    "#78350f", // Marrom escuro
    "#92400e", // Marrom
    "#a16207", // Marrom claro
    "#991b1b", // Vermelho escuro
    "#1d4ed8", // Azul escuro
    "#f3f4f6", // Branco
  ],
};

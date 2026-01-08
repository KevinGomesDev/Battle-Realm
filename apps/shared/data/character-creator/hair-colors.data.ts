// shared/data/character-creator/hair-colors.data.ts
// Cores de cabelo disponíveis para o criador de personagem

import { ColorPalette } from "../../types/character.types";

export const HAIR_PALETTES: ColorPalette = {
  id: "hair",
  name: "Cores de Cabelo",
  type: "hair",
  colors: [
    "#0a0a0a", // Preto
    "#4a3728", // Castanho escuro
    "#7a5230", // Castanho
    "#a67c52", // Castanho claro
    "#d4a574", // Loiro escuro
    "#f5d5a8", // Loiro
    "#e8e8e8", // Grisalho/Branco
    "#c41e3a", // Vermelho
    "#ff6b35", // Laranja/Ruivo
    "#7c3aed", // Roxo fantasia
    "#06b6d4", // Ciano fantasia
    "#22c55e", // Verde fantasia
    "#ec4899", // Rosa fantasia
    "#3b82f6", // Azul fantasia
  ],
};

// shared/data/character-creator/shoes-styles.data.ts
// Estilos de calçados disponíveis

import type { StyleOption, PixelPosition } from "../../types/character.types";

const pos = (positions: [number, number][]): PixelPosition[] =>
  positions.map(([x, y]) => ({ x, y }));

export const SHOES_STYLES: StyleOption[] = [
  {
    id: "basic",
    name: "Botas",
    type: "shoes",
    shape: pos([
      [6, 19],
      [7, 19],
      [8, 19],
      [9, 19],
      [5, 20],
      [6, 20],
      [7, 20],
      [8, 20],
      [9, 20],
      [10, 20],
    ]),
    defaultColor: "#78350f",
  },
  {
    id: "sandals",
    name: "Sandálias",
    type: "shoes",
    shape: pos([
      [6, 20],
      [7, 20],
      [8, 20],
      [9, 20],
    ]),
    defaultColor: "#a16207",
  },
  {
    id: "armored",
    name: "Botas de Armadura",
    type: "shoes",
    shape: pos([
      [5, 18],
      [10, 18],
      [5, 19],
      [6, 19],
      [7, 19],
      [8, 19],
      [9, 19],
      [10, 19],
      [4, 20],
      [5, 20],
      [6, 20],
      [7, 20],
      [8, 20],
      [9, 20],
      [10, 20],
      [11, 20],
    ]),
    defaultColor: "#4b5563",
  },
  {
    id: "pointy",
    name: "Botas Pontiagudas",
    type: "shoes",
    shape: pos([
      [6, 19],
      [7, 19],
      [8, 19],
      [9, 19],
      [5, 20],
      [6, 20],
      [7, 20],
      [8, 20],
      [9, 20],
      [10, 20],
      [4, 20],
      [11, 20],
    ]),
    defaultColor: "#78350f",
  },
  {
    id: "barefoot",
    name: "Descalço",
    type: "shoes",
    shape: [],
    defaultColor: "#e0ac69",
  },
];

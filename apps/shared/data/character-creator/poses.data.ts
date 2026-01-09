// shared/data/character-creator/poses.data.ts
// Definições de poses para animação do personagem

import type {
  PoseDefinition,
  PixelPosition,
} from "../../types/character.types";

const pos = (positions: [number, number][]): PixelPosition[] =>
  positions.map(([x, y]) => ({ x, y }));

/**
 * Poses disponíveis para o personagem.
 * Cada pose modifica a posição dos braços e mãos.
 * O corpo e cabeça permanecem fixos (apenas offset para balanço).
 */
export const POSES: PoseDefinition[] = [
  {
    id: "idle",
    name: "Parado",
    armsShape: pos([
      // Braço esquerdo (padrão)
      [5, 10],
      [4, 11],
      [4, 12],
      // Braço direito (padrão)
      [10, 10],
      [11, 11],
      [11, 12],
    ]),
    handsShape: pos([
      [4, 13],
      [11, 13],
    ]),
  },
  {
    id: "walk_1",
    name: "Andando 1",
    armsShape: pos([
      // Braço esquerdo (para frente)
      [5, 10],
      [5, 11],
      [5, 12],
      // Braço direito (para trás)
      [10, 10],
      [10, 11],
      [10, 12],
    ]),
    handsShape: pos([
      [5, 13],
      [10, 13],
    ]),
    bodyOffset: { x: 0, y: 0 },
    legsOffset: { x: 0, y: 0 },
  },
  {
    id: "walk_2",
    name: "Andando 2",
    armsShape: pos([
      // Braço esquerdo (para trás)
      [5, 10],
      [4, 11],
      [3, 12],
      // Braço direito (para frente)
      [10, 10],
      [11, 11],
      [12, 12],
    ]),
    handsShape: pos([
      [3, 13],
      [12, 13],
    ]),
    bodyOffset: { x: 0, y: -1 },
    legsOffset: { x: 0, y: 0 },
  },
  {
    id: "attack",
    name: "Atacando",
    armsShape: pos([
      // Braço esquerdo (guarda)
      [5, 10],
      [4, 10],
      [3, 10],
      // Braço direito (estendido para ataque)
      [10, 10],
      [11, 10],
      [12, 10],
    ]),
    handsShape: pos([
      [2, 10],
      [13, 10],
    ]),
    bodyOffset: { x: 1, y: 0 },
  },
  {
    id: "hurt",
    name: "Ferido",
    armsShape: pos([
      // Braços recolhidos
      [5, 10],
      [5, 11],
      [6, 12],
      [10, 10],
      [10, 11],
      [9, 12],
    ]),
    handsShape: pos([
      [6, 12],
      [9, 12],
    ]),
    bodyOffset: { x: -1, y: 0 },
  },
  {
    id: "dead",
    name: "Morto",
    armsShape: pos([
      // Braços espalhados (caído)
      [4, 11],
      [3, 11],
      [2, 11],
      [11, 11],
      [12, 11],
      [13, 11],
    ]),
    handsShape: pos([
      [1, 11],
      [14, 11],
    ]),
    bodyOffset: { x: 0, y: 2 },
    legsOffset: { x: 0, y: 2 },
  },
];

/** Retorna a pose pelo ID */
export const getPoseById = (id: string): PoseDefinition | undefined =>
  POSES.find((pose) => pose.id === id);

/** Pose padrão (idle) */
export const DEFAULT_POSE = POSES[0];

// shared/data/archetypes.ts
// Definições de arquétipos de classe e suas propriedades

import type { PlayerResources } from "../types/match.types";

export type ClassArchetype =
  | "MAGICA"
  | "MECANICA"
  | "FISICA"
  | "ESPIRITUAL"
  | "CAOTICA";

// Mapeamento de troopa e seus recursos
export type TroopCategory =
  | "DEFENSOR"
  | "EMBOSCADOR"
  | "ATACANTE"
  | "CONJURADOR";

export const TROOP_RESOURCE_MAP: Record<TroopCategory, keyof PlayerResources> =
  {
    DEFENSOR: "ore",
    EMBOSCADOR: "supplies",
    ATACANTE: "experience",
    CONJURADOR: "arcane",
  };

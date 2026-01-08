// shared/data/Templates/SummonsTemplates.ts
// Templates raw de todas as invocações (summons) do jogo

import type { SummonTemplate } from "../../types/units.types";

// =============================================================================
// EIDOLON (Invocador)
// =============================================================================

/**
 * Eidolon - Invocação do Invocador
 *
 * - Começa fraco (3 em todos stats)
 * - Ganha +1 em TODOS atributos ao matar uma unidade (permanente na partida)
 * - Se morrer, perde todos os acúmulos e volta aos stats base
 */
export const EIDOLON: SummonTemplate = {
  code: "EIDOLON",
  name: "Eidolon",
  description:
    "Espírito guardião do Invocador. Fica mais forte a cada morte que causa, mas perde tudo se morrer.",
  summoner: "SUMMONER",
  combat: 3,
  speed: 3,
  focus: 3,
  resistance: 3,
  will: 1,
  vitality: 3,
  damageReduction: 0,
  category: "SUMMON",
  avatar: undefined,
  actionCodes: ["ATTACK", "DASH", "DODGE"],
  passiveCode: "EIDOLON_GROWTH",
  aiBehavior: "AGGRESSIVE",
  metadata: {
    growthPerKill: 1,
    resetsOnDeath: true,
  },
};

// =============================================================================
// ARRAY CONSOLIDADO DE TODOS OS SUMMONS
// =============================================================================

export const SUMMON_TEMPLATES: SummonTemplate[] = [EIDOLON];

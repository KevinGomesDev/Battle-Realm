// shared/data/Templates/KingdomTemplates.ts
// Templates raw de todos os reinos pré-definidos

import type { KingdomTemplateDefinition } from "../../types/units.types";
import type { TroopTemplateDefinition } from "./TroopTemplates";
import {
  VALDORIA_TROOPS,
  NYXRATH_TROOPS,
  ASHENVALE_TROOPS,
} from "./TroopTemplates";

// ============================================
// REINO 1: IMPÉRIO SOLAR DE VALDORIA
// Um reino humano nobre focado em cavalaria e fé
// ============================================
export const VALDORIA: KingdomTemplateDefinition = {
  id: "template_valdoria",
  name: "Império Solar de Valdoria",
  description: `Erguido sobre as ruínas da antiga civilização élfica, o Império Solar de Valdoria é um bastião de ordem e luz nas terras do norte. Fundado há 500 anos pelo Primeiro Imperador Aldric, o reino é governado por uma linhagem de regentes abençoados pelo Sol Eterno.

Os valdorianos acreditam que foram escolhidos para trazer civilização e justiça ao mundo. Seus exércitos marcham sob estandartes dourados, e seus templários são temidos por demônios e mortos-vivos em todos os cantos do continente.

A capital Solenheim é conhecida como "A Cidade das Mil Torres", onde a Grande Catedral do Amanhecer brilha com luz própria mesmo nas noites mais escuras.`,
  alignment: "BOM",
  race: "HUMANOIDE",
  regentCode: "REGENT_SERAPHINA",
  troopTemplates: VALDORIA_TROOPS,
};

// ============================================
// REINO 2: CLÃS DAS SOMBRAS DE NYXRATH
// Uma nação de assassinos e necromantes nas trevas
// ============================================
export const NYXRATH: KingdomTemplateDefinition = {
  id: "template_nyxrath",
  name: "Clãs das Sombras de Nyxrath",
  description: `Nas profundezas das Montanhas Mortas, onde a luz do sol nunca alcança, os Clãs de Nyxrath prosperam nas sombras. Fundados por elfos exilados que abraçaram os poderes proibidos, eles se transformaram ao longo dos milênios em algo... diferente.

Nyxrath não é um reino no sentido tradicional — é uma confederação de clãs assassinos, necromantes e comerciantes de segredos. Eles não conquistam terras; eles infiltram, corrompem e controlam das sombras.

A capital Véu Negro é uma cidade esculpida no interior de uma montanha, iluminada apenas por fungos bioluminescentes e cristais de alma capturada. Dizem que suas ruas são patrulhadas pelos mortos, e que os vivos são minoria.`,
  alignment: "MAL",
  race: "MORTO_VIVO",
  regentCode: "REGENT_MALACHAR",
  troopTemplates: NYXRATH_TROOPS,
};

// ============================================
// REINO 3: CONFEDERAÇÃO DRACÔNICA DE ASHENVALE
// Dragões e seus servos em harmonia elemental
// ============================================
export const ASHENVALE: KingdomTemplateDefinition = {
  id: "template_ashenvale",
  name: "Confederação Dracônica de Ashenvale",
  description: `Nas montanhas vulcânicas do leste, onde rios de lava encontram florestas eternas, os dragões de Ashenvale governam há 10.000 anos. Este não é um reino de conquista — é um santuário onde as raças dracônicas vivem em equilíbrio com a natureza primordial.

A Confederação é governada por um conselho de Anciões Dracônicos, cada um representando um elemento: Fogo, Gelo, Raio, Veneno e Terra. Juntos, eles mantêm o equilíbrio que impede o mundo de ser consumido pelo caos elemental.

O Ninho das Eras é uma cidade impossível — construída nas encostas de vulcões adormecidos, com torres que tocam as nuvens e cavernas que descem até o coração do mundo. Humanos e outras raças menores vivem lá como servos respeitados dos dragões.`,
  alignment: "NEUTRO",
  race: "DRAGAO",
  regentCode: "REGENT_IGNATHARAX",
  troopTemplates: ASHENVALE_TROOPS,
};

// =============================================================================
// ARRAY CONSOLIDADO DE TODOS OS REINOS
// =============================================================================

export const KINGDOM_TEMPLATES: KingdomTemplateDefinition[] = [
  VALDORIA,
  NYXRATH,
  ASHENVALE,
];

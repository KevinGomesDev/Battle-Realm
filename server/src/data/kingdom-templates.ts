// src/data/kingdom-templates.ts
// Templates de Reinos pré-definidos com Regente e Exércitos

import { Alignment, Race } from "@prisma/client";

export interface TroopTemplateDefinition {
  slotIndex: number;
  name: string;
  description?: string;
  passiveId: string;
  resourceType: string;
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
}

export interface RegentDefinition {
  name: string;
  description?: string;
  classCode: string; // Código da classe (ex: "WARRIOR", "CLERIC")
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
}

export interface KingdomTemplateDefinition {
  id: string;
  name: string;
  capitalName: string;
  description: string;
  alignment: Alignment;
  race: Race;
  raceMetadata?: string;
  regent: RegentDefinition;
  troopTemplates: TroopTemplateDefinition[];
}

// ============================================
// REINO 1: IMPÉRIO SOLAR DE VALDORIA
// Um reino humano nobre focado em cavalaria e fé
// ============================================
const VALDORIA: KingdomTemplateDefinition = {
  id: "template_valdoria",
  name: "Império Solar de Valdoria",
  capitalName: "Solenheim",
  description: `Erguido sobre as ruínas da antiga civilização élfica, o Império Solar de Valdoria é um bastião de ordem e luz nas terras do norte. Fundado há 500 anos pelo Primeiro Imperador Aldric, o reino é governado por uma linhagem de regentes abençoados pelo Sol Eterno.

Os valdorianos acreditam que foram escolhidos para trazer civilização e justiça ao mundo. Seus exércitos marcham sob estandartes dourados, e seus templários são temidos por demônios e mortos-vivos em todos os cantos do continente.

A capital Solenheim é conhecida como "A Cidade das Mil Torres", onde a Grande Catedral do Amanhecer brilha com luz própria mesmo nas noites mais escuras.`,
  alignment: "BOM",
  race: "HUMANOIDE",
  regent: {
    name: "Imperatriz Seraphina III",
    description: `Terceira de seu nome, Seraphina ascendeu ao trono aos 19 anos após a morte misteriosa de seu pai durante a Batalha do Eclipse. Agora com 32 anos, ela é conhecida tanto por sua compaixão quanto por sua fúria em batalha.

Dizem que ela foi tocada pelo próprio Sol Eterno quando criança, e que seu olho esquerdo brilha com luz dourada quando usa seus poderes divinos. Empunha a lendária Lança do Amanhecer, forjada com fragmentos de uma estrela caída.

Seraphina jurou erradicar a corrupção que se espalha pelas terras selvagens, mesmo que isso custe sua própria vida.`,
    classCode: "CLERIC", // Usa Cleric por ser uma guerreira divina
    combat: 6,
    acuity: 4,
    focus: 6,
    armor: 5,
    vitality: 7,
  },
  troopTemplates: [
    {
      slotIndex: 0,
      name: "Cavaleiros do Amanhecer",
      description:
        "A elite montada de Valdoria. Cada cavaleiro passa por 10 anos de treinamento e deve completar uma peregrinação ao Pico Solar antes de receber sua armadura dourada. São implacáveis contra as forças das trevas.",
      passiveId: "charge",
      resourceType: "minerio",
      combat: 4,
      acuity: 2,
      focus: 1,
      armor: 2,
      vitality: 1,
    },
    {
      slotIndex: 1,
      name: "Templários Solares",
      description:
        "Guerreiros-sacerdotes que canalizam o poder do Sol Eterno. Seus escudos são abençoados para repelir magia negra, e suas espadas queimam com fogo sagrado.",
      passiveId: "shield_wall",
      resourceType: "devocao",
      combat: 2,
      acuity: 1,
      focus: 3,
      armor: 3,
      vitality: 1,
    },
    {
      slotIndex: 2,
      name: "Arqueiros de Solenheim",
      description:
        "Treinados desde a infância nas torres da capital, estes arqueiros são capazes de acertar um alvo a 300 metros. Suas flechas são abençoadas por clérigos antes de cada batalha.",
      passiveId: "first_strike",
      resourceType: "suprimentos",
      combat: 3,
      acuity: 4,
      focus: 1,
      armor: 1,
      vitality: 1,
    },
    {
      slotIndex: 3,
      name: "Milícia Imperial",
      description:
        "Cidadãos comuns que servem o Império em tempos de guerra. O que lhes falta em habilidade, compensam em números e devoção fervorosa à Imperatriz.",
      passiveId: "expendable",
      resourceType: "suprimentos",
      combat: 2,
      acuity: 2,
      focus: 1,
      armor: 2,
      vitality: 3,
    },
    {
      slotIndex: 4,
      name: "Clérigos de Batalha",
      description:
        "Sacerdotes que abandonaram os templos para curar feridos no campo de batalha. Carregam relíquias sagradas que podem fechar feridas e banir espíritos malignos.",
      passiveId: "healer",
      resourceType: "devocao",
      combat: 1,
      acuity: 2,
      focus: 5,
      armor: 1,
      vitality: 1,
    },
  ],
};

// ============================================
// REINO 2: CLÃS DAS SOMBRAS DE NYXRATH
// Uma nação de assassinos e necromantes nas trevas
// ============================================
const NYXRATH: KingdomTemplateDefinition = {
  id: "template_nyxrath",
  name: "Clãs das Sombras de Nyxrath",
  capitalName: "Véu Negro",
  description: `Nas profundezas das Montanhas Mortas, onde a luz do sol nunca alcança, os Clãs de Nyxrath prosperam nas sombras. Fundados por elfos exilados que abraçaram os poderes proibidos, eles se transformaram ao longo dos milênios em algo... diferente.

Nyxrath não é um reino no sentido tradicional — é uma confederação de clãs assassinos, necromantes e comerciantes de segredos. Eles não conquistam terras; eles infiltram, corrompem e controlam das sombras.

A capital Véu Negro é uma cidade esculpida no interior de uma montanha, iluminada apenas por fungos bioluminescentes e cristais de alma capturada. Dizem que suas ruas são patrulhadas pelos mortos, e que os vivos são minoria.`,
  alignment: "MAL",
  race: "MORTO_VIVO",
  regent: {
    name: "Archlich Malachar, O Eterno",
    description: `Malachar foi um arquimago élfico há 2.000 anos, obcecado em desvendar os segredos da imortalidade. Após sacrificar sua própria família em um ritual proibido, ele ascendeu como o primeiro Lich de Nyxrath.

Seu corpo é uma carcaça ressecada envolta em mantos de escuridão pura. Onde seus olhos deveriam estar, apenas chamas verdes e frias queimam com conhecimento acumulado de eras. Ele carrega o Grimório Vazio, um livro que consome as almas de seus inimigos.

Malachar não busca poder — ele já o tem. O que ele deseja é conhecimento absoluto, e está disposto a destruir mundos para obtê-lo.`,
    classCode: "WIZARD", // Mago especializado em necromancia
    combat: 2,
    acuity: 5,
    focus: 9,
    armor: 3,
    vitality: 9,
  },
  troopTemplates: [
    {
      slotIndex: 0,
      name: "Lâminas Silenciosas",
      description:
        "Assassinos de elite que treinam desde crianças nas artes da morte invisível. Dizem que suas sombras se movem independentemente, e que podem matar um homem antes que ele perceba que está morto.",
      passiveId: "assassin",
      resourceType: "suprimentos",
      combat: 4,
      acuity: 4,
      focus: 1,
      armor: 0,
      vitality: 1,
    },
    {
      slotIndex: 1,
      name: "Esqueletos Blindados",
      description:
        "Os ossos de guerreiros caídos, reanimados e vestidos com armaduras forjadas em forjas alimentadas por almas. Não sentem dor, não sentem medo, e nunca param até que seus ossos virem pó.",
      passiveId: "undying",
      resourceType: "arcana",
      combat: 2,
      acuity: 1,
      focus: 1,
      armor: 4,
      vitality: 2,
    },
    {
      slotIndex: 2,
      name: "Espectros de Guerra",
      description:
        "Fantasmas de generais e campeões mortos, amarrados ao serviço eterno de Nyxrath. Podem atravessar paredes e drenar a vida dos vivos com seu toque gelado.",
      passiveId: "ethereal",
      resourceType: "arcana",
      combat: 3,
      acuity: 3,
      focus: 2,
      armor: 0,
      vitality: 2,
    },
    {
      slotIndex: 3,
      name: "Cultistas do Véu",
      description:
        "Fanáticos que veneram Malachar como um deus. Praticam rituais de sangue para canalizar magia negra, e muitos voluntariamente se transformam em mortos-vivos.",
      passiveId: "blood_magic",
      resourceType: "devocao",
      combat: 1,
      acuity: 2,
      focus: 4,
      armor: 1,
      vitality: 2,
    },
    {
      slotIndex: 4,
      name: "Abominações de Carne",
      description:
        "Construtos grotescos feitos de partes de centenas de corpos. Cada um é único em sua monstruosidade, costurado e animado por magia profana. São usados como tanques de guerra vivos.",
      passiveId: "regeneration",
      resourceType: "arcana",
      combat: 3,
      acuity: 0,
      focus: 1,
      armor: 2,
      vitality: 4,
    },
  ],
};

// ============================================
// REINO 3: CONFEDERAÇÃO DRACÔNICA DE ASHENVALE
// Dragões e seus servos em harmonia elemental
// ============================================
const ASHENVALE: KingdomTemplateDefinition = {
  id: "template_ashenvale",
  name: "Confederação Dracônica de Ashenvale",
  capitalName: "Ninho das Eras",
  description: `Nas montanhas vulcânicas do leste, onde rios de lava encontram florestas eternas, os dragões de Ashenvale governam há 10.000 anos. Este não é um reino de conquista — é um santuário onde as raças dracônicas vivem em equilíbrio com a natureza primordial.

A Confederação é governada por um conselho de Anciões Dracônicos, cada um representando um elemento: Fogo, Gelo, Raio, Veneno e Terra. Juntos, eles mantêm o equilíbrio que impede o mundo de ser consumido pelo caos elemental.

O Ninho das Eras é uma cidade impossível — construída nas encostas de vulcões adormecidos, com torres que tocam as nuvens e cavernas que descem até o coração do mundo. Humanos e outras raças menores vivem lá como servos respeitados dos dragões.`,
  alignment: "NEUTRO",
  race: "DRAGAO",
  regent: {
    name: "Ignatharax, O Primordial",
    description: `Ignatharax é um dos Cinco Anciões, um dragão vermelho de proporções titânicas que dormiu por 500 anos antes de despertar na última década. Ele é o guardião do Fogo Eterno, a chama primordial que arde no coração do mundo.

Com escamas que brilham como metal derretido e olhos que são brasas de pura energia, Ignatharax é tanto uma força da natureza quanto um ser senciente. Sua voz é o rugido de vulcões, e seu sopro pode derreter montanhas.

Diferente de muitos dragões vermelhos, Ignatharax não é movido por ganância ou raiva. Ele vê o mundo com a perspectiva de eras, e protege Ashenvale porque sabe que o equilíbrio é a única coisa que impede a extinção de todas as coisas.`,
    classCode: "BARBARIAN", // Força bruta primordial
    combat: 8,
    acuity: 4,
    focus: 5,
    armor: 6,
    vitality: 12,
  },
  troopTemplates: [
    {
      slotIndex: 0,
      name: "Dragonetes de Fogo",
      description:
        "Jovens dragões que ainda não atingiram maturidade plena, mas são ferozes em batalha. Seu fogo é temperamental e explosivo, perfeito para causar caos nas linhas inimigas.",
      passiveId: "fire_breath",
      resourceType: "arcana",
      combat: 4,
      acuity: 3,
      focus: 2,
      armor: 1,
      vitality: 0,
    },
    {
      slotIndex: 1,
      name: "Kobolds Juramentados",
      description:
        "Pequenas criaturas reptilianas que servem os dragões com devoção fanática. São excelentes mineradores e trapaceiros, preparando emboscadas e armadilhas para os inimigos de seus mestres.",
      passiveId: "ambush",
      resourceType: "minerio",
      combat: 2,
      acuity: 3,
      focus: 2,
      armor: 1,
      vitality: 2,
    },
    {
      slotIndex: 2,
      name: "Draconatos de Guerra",
      description:
        "Humanos transformados pelo sangue dracônico em guerreiros híbridos. Com escamas, garras e um sopro elemental menor, são a infantaria pesada da Confederação.",
      passiveId: "elemental_resistance",
      resourceType: "experiencia",
      combat: 3,
      acuity: 2,
      focus: 1,
      armor: 3,
      vitality: 1,
    },
    {
      slotIndex: 3,
      name: "Xamãs da Chama Viva",
      description:
        "Místicos que canalizam o poder dos vulcões de Ashenvale. Podem invocar espíritos elementais e curar aliados com o calor regenerativo do magma.",
      passiveId: "summon_elemental",
      resourceType: "devocao",
      combat: 1,
      acuity: 2,
      focus: 5,
      armor: 1,
      vitality: 1,
    },
    {
      slotIndex: 4,
      name: "Wyrms Subterrâneos",
      description:
        "Dragões serpentinos que vivem nas profundezas. Podem atravessar rocha sólida e emergir sob os pés dos inimigos. Seu ácido derrete armaduras como manteiga.",
      passiveId: "burrow",
      resourceType: "minerio",
      combat: 3,
      acuity: 2,
      focus: 1,
      armor: 2,
      vitality: 2,
    },
  ],
};

// ============================================
// EXPORTAÇÃO
// ============================================

export const KINGDOM_TEMPLATES: KingdomTemplateDefinition[] = [
  VALDORIA,
  NYXRATH,
  ASHENVALE,
];

export function getKingdomTemplateById(
  id: string
): KingdomTemplateDefinition | undefined {
  return KINGDOM_TEMPLATES.find((t) => t.id === id);
}

export function getAllKingdomTemplates(): KingdomTemplateDefinition[] {
  return KINGDOM_TEMPLATES;
}

// Versão resumida para listagem (sem descrições completas)
export function getKingdomTemplatesSummary() {
  return KINGDOM_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    capitalName: t.capitalName,
    alignment: t.alignment,
    race: t.race,
    regentName: t.regent.name,
    troopCount: t.troopTemplates.length,
  }));
}

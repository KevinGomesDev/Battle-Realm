// shared/data/Templates/TroopTemplates.ts
// Templates raw de definição de tropas dentro de reinos

import type { TroopTemplateData } from "../../types/units.types";

// Re-exporta TroopTemplateData com nome alternativo para compatibilidade
export type TroopTemplateDefinition = TroopTemplateData;

// =============================================================================
// TROPAS DE VALDORIA (Império Solar)
// =============================================================================

export const VALDORIA_TROOPS: TroopTemplateDefinition[] = [
  {
    slotIndex: 0,
    name: "Cavaleiros do Amanhecer",
    description:
      "A elite montada de Valdoria. Cada cavaleiro passa por 10 anos de treinamento e deve completar uma peregrinação ao Pico Solar antes de receber sua armadura dourada. São implacáveis contra as forças das trevas.",
    avatar: "2",
    passiveId: "INVESTIDA",
    resourceType: "ore",
    combat: 4,
    speed: 2,
    focus: 1,
    resistance: 2,
    will: 0,
    vitality: 1,
  },
  {
    slotIndex: 1,
    name: "Templários Solares",
    description:
      "Guerreiros-sacerdotes que canalizam o poder do Sol Eterno. Seus escudos são abençoados para repelir magia negra, e suas espadas queimam com fogo sagrado.",
    avatar: "3",
    passiveId: "ESCUDO_PROTETOR",
    resourceType: "devotion",
    combat: 2,
    speed: 1,
    focus: 3,
    resistance: 3,
    will: 0,
    vitality: 1,
  },
  {
    slotIndex: 2,
    name: "Arqueiros de Solenheim",
    description:
      "Treinados desde a infância nas torres da capital, estes arqueiros são capazes de acertar um alvo a 300 metros. Suas flechas são abençoadas por clérigos antes de cada batalha.",
    avatar: "4",
    passiveId: "EMBOSCADA",
    resourceType: "supplies",
    combat: 3,
    speed: 4,
    focus: 1,
    resistance: 1,
    will: 0,
    vitality: 1,
  },
  {
    slotIndex: 3,
    name: "Milícia Imperial",
    description:
      "Cidadãos comuns que servem o Império em tempos de guerra. O que lhes falta em habilidade, compensam em números e devoção fervorosa à Imperatriz.",
    avatar: "5",
    passiveId: "FURTIVIDADE",
    resourceType: "supplies",
    combat: 2,
    speed: 2,
    focus: 1,
    resistance: 2,
    will: 0,
    vitality: 3,
  },
  {
    slotIndex: 4,
    name: "Clérigos de Batalha",
    description:
      "Sacerdotes que abandonaram os templos para curar feridos no campo de batalha. Carregam relíquias sagradas que podem fechar feridas e banir espíritos malignos.",
    avatar: "6",
    passiveId: "ESCUDO_PROTETOR",
    resourceType: "devotion",
    combat: 1,
    speed: 2,
    focus: 5,
    resistance: 1,
    will: 0,
    vitality: 1,
  },
];

// =============================================================================
// TROPAS DE NYXRATH (Clãs das Sombras)
// =============================================================================

export const NYXRATH_TROOPS: TroopTemplateDefinition[] = [
  {
    slotIndex: 0,
    name: "Lâminas Silenciosas",
    description:
      "Assassinos de elite que treinam desde crianças nas artes da morte invisível. Dizem que suas sombras se movem independentemente, e que podem matar um homem antes que ele perceba que está morto.",
    avatar: "10",
    passiveId: "EMBOSCADA",
    resourceType: "supplies",
    combat: 4,
    speed: 4,
    focus: 1,
    resistance: 0,
    will: 0,
    vitality: 1,
  },
  {
    slotIndex: 1,
    name: "Esqueletos Blindados",
    description:
      "Os ossos de guerreiros caídos, reanimados e vestidos com armaduras forjadas em forjas alimentadas por almas. Não sentem dor, não sentem medo, e nunca param até que seus ossos virem pó.",
    avatar: "11",
    passiveId: "ESCUDO_PROTETOR",
    resourceType: "arcane",
    combat: 2,
    speed: 1,
    focus: 1,
    resistance: 4,
    will: 0,
    vitality: 2,
  },
  {
    slotIndex: 2,
    name: "Espectros de Guerra",
    description:
      "Fantasmas de generais e campeões mortos, amarrados ao serviço eterno de Nyxrath. Podem atravessar paredes e drenar a vida dos vivos com seu toque gelado.",
    avatar: "12",
    passiveId: "FURTIVIDADE",
    resourceType: "arcane",
    combat: 3,
    speed: 3,
    focus: 2,
    resistance: 0,
    will: 0,
    vitality: 2,
  },
  {
    slotIndex: 3,
    name: "Cultistas do Véu",
    description:
      "Fanáticos que veneram Malachar como um deus. Praticam rituais de sangue para canalizar magia negra, e muitos voluntariamente se transformam em mortos-vivos.",
    avatar: "13",
    passiveId: "TIRO_RAPIDO",
    resourceType: "devotion",
    combat: 1,
    speed: 2,
    focus: 4,
    resistance: 1,
    will: 0,
    vitality: 2,
  },
  {
    slotIndex: 4,
    name: "Abominações de Carne",
    description:
      "Construtos grotescos feitos de partes de centenas de corpos. Cada um é único em sua monstruosidade, costurado e animado por magia profana. São usados como tanques de guerra vivos.",
    avatar: "14",
    passiveId: "ESCUDO_PROTETOR",
    resourceType: "arcane",
    combat: 3,
    speed: 0,
    focus: 1,
    resistance: 2,
    will: 0,
    vitality: 4,
  },
];

// =============================================================================
// TROPAS DE ASHENVALE (Confederação Dracônica)
// =============================================================================

export const ASHENVALE_TROOPS: TroopTemplateDefinition[] = [
  {
    slotIndex: 0,
    name: "Dragonetes de Fogo",
    description:
      "Jovens dragões que ainda não atingiram maturidade plena, mas são ferozes em batalha. Seu fogo é temperamental e explosivo, perfeito para causar caos nas linhas inimigas.",
    avatar: "8",
    passiveId: "TIRO_RAPIDO",
    resourceType: "arcane",
    combat: 4,
    speed: 3,
    focus: 2,
    resistance: 1,
    will: 0,
    vitality: 0,
  },
  {
    slotIndex: 1,
    name: "Kobolds Juramentados",
    description:
      "Pequenas criaturas reptilianas que servem os dragões com devoção fanática. São excelentes mineradores e trapaceiros, preparando emboscadas e armadilhas para os inimigos de seus mestres.",
    avatar: "15",
    passiveId: "EMBOSCADA",
    resourceType: "ore",
    combat: 2,
    speed: 3,
    focus: 2,
    resistance: 1,
    will: 0,
    vitality: 2,
  },
  {
    slotIndex: 2,
    name: "Draconatos de Guerra",
    description:
      "Humanos transformados pelo sangue dracônico em guerreiros híbridos. Com escamas, garras e um sopro elemental menor, são a infantaria pesada da Confederação.",
    avatar: "1",
    passiveId: "ESCUDO_PROTETOR",
    resourceType: "experience",
    combat: 3,
    speed: 2,
    focus: 1,
    resistance: 3,
    will: 0,
    vitality: 1,
  },
  {
    slotIndex: 3,
    name: "Xamãs da Chama Viva",
    description:
      "Místicos que canalizam o poder dos vulcões de Ashenvale. Podem invocar espíritos elementais e curar aliados com o calor regenerativo do magma.",
    avatar: "5",
    passiveId: "TIRO_RAPIDO",
    resourceType: "devotion",
    combat: 1,
    speed: 2,
    focus: 5,
    resistance: 1,
    will: 0,
    vitality: 1,
  },
  {
    slotIndex: 4,
    name: "Wyrms Subterrâneos",
    description:
      "Dragões serpentinos que vivem nas profundezas. Podem atravessar rocha sólida e emergir sob os pés dos inimigos. Seu ácido derrete armaduras como manteiga.",
    avatar: "9",
    passiveId: "INVESTIDA",
    resourceType: "ore",
    combat: 3,
    speed: 2,
    focus: 1,
    resistance: 2,
    will: 0,
    vitality: 2,
  },
];

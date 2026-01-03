// server/src/data/races.ts

export interface RaceDefinition {
  id: string; // O Enum do Banco (HUMANOIDE, DRAGAO...)
  name: string;
  description: string; // Flavor text
  passiveName: string;
  passiveEffect: string; // Regra mecânica
  color: number; // Cor temática (apenas para UI)
}

export const RACE_DEFINITIONS: RaceDefinition[] = [
  {
    id: "ABERRACAO",
    name: "Aberrações",
    description: "Criaturas distorcidas que desafiam a lógica natural.",
    passiveName: "Pele Amorfa",
    passiveEffect: "Reduz todos os tipos de danos recebidos em 1.",
    color: 0x8e44ad, // Roxo
  },
  {
    id: "BESTA",
    name: "Bestas",
    description: "Animais selvagens unidos por instinto de matilha.",
    passiveName: "Fúria da Matilha",
    passiveEffect:
      "Quando uma Unidade Besta aliada morre, todas as Unidades Bestas aliadas recebem +1D na sua próxima rolagem.",
    color: 0x8b4513, // Marrom
  },
  {
    id: "CELESTIAL",
    name: "Celestiais",
    description: "Seres divinos de luz e justiça inabalável.",
    passiveName: "Luz Sagrada",
    passiveEffect:
      "Causa o dobro de dano em Diabos, Monstruosidades e Mortos-Vivos.",
    color: 0xffd700, // Dourado
  },
  {
    id: "CONSTRUTO",
    name: "Construtos",
    description: "Máquinas de guerra sem alma e sem medo.",
    passiveName: "Peso de Ferro",
    passiveEffect: "Não pode ser arremessada, agarrada ou derrubada.",
    color: 0x95a5a6, // Cinza
  },
  {
    id: "DRAGAO",
    name: "Dragões",
    description: "Criaturas ancestrais de poder arcano imenso.",
    passiveName: "Sangue Arcano",
    passiveEffect: "Reduz o custo de Arcana para Magias em 2.",
    color: 0xc0392b, // Vermelho escuro
  },
  {
    id: "ELEMENTAL",
    name: "Elementais",
    description: "Manifestações vivas dos elementos primordiais.",
    passiveName: "Afinidade Elemental",
    passiveEffect:
      "Escolha dois Elementos entre Fogo, Raio e Gelo. Imune a um tipo, e vulnerável a outro (recebe o dobro do dano).",
    color: 0xe67e22, // Laranja
  },
  {
    id: "FADA",
    name: "Fadas",
    description: "Seres mágicos dos reinos encantados.",
    passiveName: "Graça Feérica",
    passiveEffect: "Imune a efeitos negativos de Climas.",
    color: 0x9b59b6, // Lilás
  },
  {
    id: "DIABO",
    name: "Diabos",
    description: "Demônios ardilosos dos planos infernais.",
    passiveName: "Chamas do Inferno",
    passiveEffect: "Causa o dobro de dano em Celestiais, Humanoides e Fadas.",
    color: 0x8b0000, // Vermelho sangue
  },
  {
    id: "GIGANTE",
    name: "Gigantes",
    description: "Titãs colossais de força descomunal.",
    passiveName: "Estatura Colossal",
    passiveEffect:
      "Ocupa o dobro do espaço em mapas e aumenta o alcance de tudo em 1 quadrado.",
    color: 0x7f8c8d, // Cinza pedra
  },
  {
    id: "HUMANOIDE",
    name: "Humanoides",
    description:
      "Versáteis e resilientes, os humanoides dominam pela tenacidade.",
    passiveName: "Vingança Final",
    passiveEffect:
      "Quando tem sua Vitalidade zerada, pode realizar um ataque contra o alvo que a zerou imediatamente.",
    color: 0x3498db, // Azul
  },
  {
    id: "MONSTRUOSIDADE",
    name: "Monstruosidades",
    description: "Criaturas terríveis nascidas do caos.",
    passiveName: "Sede de Sangue",
    passiveEffect:
      "Ao matar um inimigo, pode realizar um ataque contra um alvo imediatamente ou usar a ação Corrida.",
    color: 0x2c3e50, // Azul escuro
  },
  {
    id: "GOSMA",
    name: "Gosmas",
    description: "Massas amorfas de matéria corrosiva.",
    passiveName: "Aderência Ácida",
    passiveEffect:
      "Quando agarra uma Unidade, a Unidade agarrada sofre 2 de Dano Físico todo Turno.",
    color: 0x27ae60, // Verde
  },
  {
    id: "PLANTA",
    name: "Plantas",
    description: "Seres vegetais enraizados na força da natureza.",
    passiveName: "Raízes Profundas",
    passiveEffect:
      "Quando está em uma Batalha Defensiva, todas as rolagens recebem +1D.",
    color: 0x2ecc71, // Verde claro
  },
  {
    id: "MORTO_VIVO",
    name: "Mortos-Vivos",
    description: "Cadáveres reanimados pela necromancia.",
    passiveName: "Drenar Vida",
    passiveEffect:
      "Ao render um inimigo, recupera 4 de Vitalidade imediatamente.",
    color: 0x1a1a2e, // Preto azulado
  },
  {
    id: "INSETO",
    name: "Insetos",
    description: "Enxames coordenados com eficiência implacável.",
    passiveName: "Colméia Produtiva",
    passiveEffect:
      "Escolha um Recurso. A Produção Passiva desse Recurso sobe em 2. Não pode ser alterado após início de Campanha.",
    color: 0xd4ac0d, // Amarelo mostarda
  },
];

/**
 * Obtém uma raça pelo ID
 */
export function getRaceById(id: string): RaceDefinition | undefined {
  return RACE_DEFINITIONS.find((r) => r.id === id);
}

/**
 * Obtém todas as raças
 */
export function getAllRaces(): RaceDefinition[] {
  return RACE_DEFINITIONS;
}

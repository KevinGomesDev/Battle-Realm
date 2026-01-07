// shared/data/Templates/RacesTemplates.ts
// Templates raw de todas as raças do jogo

import type { RaceDefinition } from "../../types/units.types";

export const RACE_DEFINITIONS: RaceDefinition[] = [
  {
    id: "ABERRACAO",
    name: "Aberrações",
    description: "Criaturas distorcidas que desafiam a lógica natural.",
    passiveName: "Pele Amorfa",
    passiveEffect: "Reduz todos os tipos de danos recebidos em 1.",
    passiveConditionId: "PELE_AMORFA",
    color: 0x8e44ad, // Roxo
  },
  {
    id: "BESTA",
    name: "Bestas",
    description: "Animais selvagens unidos por instinto de matilha.",
    passiveName: "Fúria da Matilha",
    passiveEffect:
      "Quando uma Unidade Besta aliada morre, todas as Unidades Bestas aliadas recebem +1D na sua próxima rolagem.",
    passiveConditionId: "FURIA_DA_MATILHA",
    color: 0x8b4513, // Marrom
  },
  {
    id: "CELESTIAL",
    name: "Celestiais",
    description: "Seres divinos de luz e justiça inabalável.",
    passiveName: "Luz Sagrada",
    passiveEffect:
      "Causa o dobro de dano em Diabos, Monstruosidades e Mortos-Vivos.",
    passiveConditionId: "LUZ_SAGRADA",
    color: 0xffd700, // Dourado
  },
  {
    id: "CONSTRUTO",
    name: "Construtos",
    description: "Máquinas de guerra sem alma e sem medo.",
    passiveName: "Peso de Ferro",
    passiveEffect: "Não pode ser arremessada, agarrada ou derrubada.",
    passiveConditionId: "PESO_DE_FERRO",
    color: 0x95a5a6, // Cinza
  },
  {
    id: "DRAGAO",
    name: "Dragões",
    description: "Criaturas ancestrais de poder arcano imenso.",
    passiveName: "Sangue Arcano",
    passiveEffect: "Reduz o custo de Arcana para Magias em 2.",
    passiveConditionId: "SANGUE_ARCANO",
    color: 0xc0392b, // Vermelho escuro
  },
  {
    id: "ELEMENTAL",
    name: "Elementais",
    description: "Manifestações vivas dos elementos primordiais.",
    passiveName: "Afinidade Elemental",
    passiveEffect:
      "Escolha dois Elementos entre Fogo, Raio e Gelo. Imune a um tipo, e vulnerável a outro (recebe o dobro do dano).",
    passiveConditionId: "AFINIDADE_ELEMENTAL",
    color: 0xe67e22, // Laranja
  },
  {
    id: "FADA",
    name: "Fadas",
    description: "Seres mágicos dos reinos encantados.",
    passiveName: "Graça Feérica",
    passiveEffect: "Imune a efeitos negativos de Climas.",
    passiveConditionId: "GRACA_FEERICA",
    color: 0x9b59b6, // Lilás
  },
  {
    id: "DIABO",
    name: "Diabos",
    description: "Demônios ardilosos dos planos infernais.",
    passiveName: "Chamas do Inferno",
    passiveEffect: "Causa o dobro de dano em Celestiais, Humanoides e Fadas.",
    passiveConditionId: "CHAMAS_DO_INFERNO",
    color: 0x8b0000, // Vermelho sangue
  },
  {
    id: "GIGANTE",
    name: "Gigantes",
    description: "Titãs colossais de força descomunal.",
    passiveName: "Estatura Colossal",
    passiveEffect:
      "Ocupa o dobro do espaço em mapas e aumenta o alcance de tudo em 1 quadrado.",
    passiveConditionId: "ESTATURA_COLOSSAL",
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
    passiveConditionId: "VINGANCA_FINAL",
    color: 0x3498db, // Azul
  },
  {
    id: "MONSTRUOSIDADE",
    name: "Monstruosidades",
    description: "Criaturas terríveis nascidas do caos.",
    passiveName: "Sede de Sangue",
    passiveEffect:
      "Ao matar um inimigo, pode realizar um ataque contra um alvo imediatamente ou usar a ação Corrida.",
    passiveConditionId: "SEDE_DE_SANGUE",
    color: 0x2c3e50, // Azul escuro
  },
  {
    id: "GOSMA",
    name: "Gosmas",
    description: "Massas amorfas de matéria corrosiva.",
    passiveName: "Aderência Ácida",
    passiveEffect:
      "Quando agarra uma Unidade, a Unidade agarrada sofre 2 de Dano Físico todo Turno.",
    passiveConditionId: "ADERENCIA_ACIDA",
    color: 0x27ae60, // Verde
  },
  {
    id: "PLANTA",
    name: "Plantas",
    description: "Seres vegetais enraizados na força da natureza.",
    passiveName: "Raízes Profundas",
    passiveEffect:
      "Quando está em uma Batalha Defensiva, todas as rolagens recebem +1D.",
    passiveConditionId: "RAIZES_PROFUNDAS",
    color: 0x2ecc71, // Verde claro
  },
  {
    id: "MORTO_VIVO",
    name: "Mortos-Vivos",
    description: "Cadáveres reanimados pela necromancia.",
    passiveName: "Drenar Vida",
    passiveEffect:
      "Ao render um inimigo, recupera 4 de Vitalidade imediatamente.",
    passiveConditionId: "DRENAR_VIDA",
    color: 0x1a1a2e, // Preto azulado
  },
  {
    id: "INSETO",
    name: "Insetos",
    description: "Enxames coordenados com eficiência implacável.",
    passiveName: "Colméia Produtiva",
    passiveEffect:
      "Escolha um Recurso. A Produção Passiva desse Recurso sobe em 2. Não pode ser alterado após início de Campanha.",
    passiveConditionId: "COLMEIA_PRODUTIVA",
    color: 0xd4ac0d, // Amarelo mostarda
  },
];

// shared/data/Templates/EventsTemplates.ts
// Templates raw de todos os eventos/desafios de território do jogo

export type AttributeType =
  | "strength"
  | "agility"
  | "intelligence"
  | "charisma"
  | "perception"
  | "constitution";

export interface TerritoryChoice {
  id: string;
  description: string;
  testedAttribute: AttributeType;
  successEffect: string;
  failureEffect?: string;
}

export interface TerritoryChallenge {
  id: number;
  name: string;
  description: string;
  choices: TerritoryChoice[];
}

export const TERRITORY_CHALLENGES: TerritoryChallenge[] = [
  {
    id: 1,
    name: "Despertar do Guardião do Território",
    description:
      "Ruínas antigas revelam a presença de um guardião ancestral adormecido. Sua equipe precisa decidir como despertar esta entidade poderosa.",
    choices: [
      {
        id: "history",
        description:
          "Estudar os textos antigos para entender a história do guardião",
        testedAttribute: "intelligence",
        successEffect:
          "O guardião desperta benevolente e se torna um aliado. Em Batalhas neste território, o guardião (Criatura nível 10) auxilia seus aliados.",
        failureEffect:
          "O guardião desperta confuso e hostil, atacando imediatamente.",
      },
      {
        id: "ritual",
        description: "Realizar um ritual de respeito e oferendas",
        testedAttribute: "charisma",
        successEffect:
          "O guardião reconhece sua reverência e se torna protetor do território.",
        failureEffect:
          "O ritual é mal executado, ofendendo o guardião que amaldiçoa o território.",
      },
    ],
  },
  {
    id: 2,
    name: "Descoberta da Caverna dos Cristais",
    description:
      "Uma caverna repleta de cristais mágicos brilhantes foi descoberta, mas está protegida por mecanismos antigos e criaturas elementais.",
    choices: [
      {
        id: "explore",
        description: "Explorar cuidadosamente e mapear os perigos",
        testedAttribute: "perception",
        successEffect:
          "Cristais mágicos raros são coletados com segurança. Cada Produtor de Arcana neste Território conta como dois.",
        failureEffect:
          "Armadilhas são acionadas, causando dano e destruindo alguns cristais.",
      },
      {
        id: "negotiate",
        description: "Tentar negociar com os elementais guardiões",
        testedAttribute: "charisma",
        successEffect:
          "Os elementais concedem acesso aos cristais em troca de respeito à caverna.",
        failureEffect:
          "Os elementais atacam, considerando a presença uma invasão.",
      },
    ],
  },
  {
    id: 3,
    name: "Despertar da Árvore Anciã",
    description:
      "Uma árvore colossal e ancestral pulsa com energia vital. Dizem que ela pode conceder bênçãos àqueles dignos o suficiente.",
    choices: [
      {
        id: "commune",
        description: "Comungar espiritualmente com a árvore",
        testedAttribute: "charisma",
        successEffect:
          "A Unidade recebe bênção sagrada, regenerando 1 de Vitalidade por turno em Batalhas (se acima de 0).",
        failureEffect: "A árvore rejeita a comunhão, causando exaustão mental.",
      },
      {
        id: "study",
        description: "Estudar padrões de energia para compreender a árvore",
        testedAttribute: "intelligence",
        successEffect:
          "Compreensão profunda da magia vital concede benefícios de cura.",
        failureEffect:
          "Análise incorreta causa feedback de energia, causando dano.",
      },
    ],
  },
  {
    id: 4,
    name: "O Encontro com o Guardião das Sombras",
    description:
      "Uma figura sombria emerge das trevas, oferecendo conhecimento arcano em troca de um desafio.",
    choices: [
      {
        id: "duel",
        description: "Aceitar o duelo arcano proposto",
        testedAttribute: "intelligence",
        successEffect:
          "Vitória concede conhecimento arcano. A Unidade pode conjurar uma Magia à escolha, uma vez por Batalha, sem custo.",
        failureEffect:
          "Derrota no duelo resulta em perda temporária de poder mágico.",
      },
      {
        id: "trick",
        description: "Usar astúcia para vencer sem confronto direto",
        testedAttribute: "agility",
        successEffect:
          "O guardião, impressionado, compartilha segredos das sombras.",
        failureEffect:
          "O truque é descoberto, e o guardião ataca furiosamente.",
      },
    ],
  },
  {
    id: 5,
    name: "O Desafio do Labirinto Antigo",
    description:
      "Um labirinto mágico complexo bloqueia o caminho. Suas paredes mudam constantemente, e armadilhas mortais aguardam os incautos.",
    choices: [
      {
        id: "navigate",
        description: "Navegar usando lógica e padrões",
        testedAttribute: "intelligence",
        successEffect:
          "Segredos arcanos são revelados. O Território recebe um Posto extra gratuitamente.",
        failureEffect:
          "O grupo se perde, desperdiçando tempo e recursos preciosos.",
      },
      {
        id: "speed",
        description:
          "Correr através das mudanças antes que as paredes se fechem",
        testedAttribute: "agility",
        successEffect:
          "Velocidade supera os mecanismos, revelando o centro do labirinto.",
        failureEffect:
          "Armadilhas são acionadas durante a corrida, causando ferimentos.",
      },
    ],
  },
  {
    id: 6,
    name: "O Despertar da Maldição Ancestral",
    description:
      "Uma maldição antiga assombra o território, manifestando-se em fenômenos sobrenaturais. Dissipar a maldição requer compreensão e coragem.",
    choices: [
      {
        id: "research",
        description: "Pesquisar a origem da maldição em tomos antigos",
        testedAttribute: "intelligence",
        successEffect:
          "A maldição é dissipada completamente. Cada Produtor de Minério neste Território conta como dois.",
        failureEffect:
          "Conhecimento incompleto leva a ritual falho, fortalecendo a maldição.",
      },
      {
        id: "confront",
        description: "Confrontar diretamente a fonte da maldição",
        testedAttribute: "strength",
        successEffect:
          "Força de vontade quebra a maldição, libertando o território.",
        failureEffect:
          "A maldição se apega à Unidade, causando efeitos debilitantes.",
      },
    ],
  },
  {
    id: 7,
    name: "O Despertar do Guardião Elemental",
    description:
      "Um espírito elemental antigo repousa neste local. Despertar e ganhar sua confiança pode trazer grande poder.",
    choices: [
      {
        id: "tribute",
        description: "Oferecer tributo de elementos puros",
        testedAttribute: "perception",
        successEffect:
          "O elemental aceita e concede lealdade. Você recebe gratuitamente uma Criatura de Nível 10, que é considerada Tropa de todas as Categorias.",
        failureEffect:
          "Tributo inadequado ofende o elemental, que ataca furiosamente.",
      },
      {
        id: "balance",
        description: "Demonstrar equilíbrio e harmonia elemental",
        testedAttribute: "charisma",
        successEffect:
          "Harmonia impressiona o elemental, que oferece sua proteção eterna.",
        failureEffect:
          "Desequilíbrio causa a fúria dos elementos, criando tempestades.",
      },
    ],
  },
  {
    id: 8,
    name: "A Descoberta do Poço da Sabedoria",
    description:
      "Um poço místico que reflete não a imagem, mas o conhecimento daqueles que nele olham. Suas águas prometem insights profundos.",
    choices: [
      {
        id: "meditate",
        description: "Meditar profundamente sobre as águas",
        testedAttribute: "intelligence",
        successEffect:
          "Insights sobre estratégia são revelados. A Unidade sempre será a primeira a agir em Batalha.",
        failureEffect:
          "Visões confusas causam desorientação temporária na Unidade.",
      },
      {
        id: "drink",
        description: "Beber das águas sagradas",
        testedAttribute: "constitution",
        successEffect:
          "Sabedoria flui pela mente, concedendo clareza tática absoluta.",
        failureEffect:
          "Águas mágicas causam reação adversa, enfraquecendo temporariamente.",
      },
    ],
  },
  {
    id: 9,
    name: "O Desafio da Caverna do Dragão",
    description:
      "Uma caverna que abriga um dragão guardião. Ganhar sua confiança ou derrotá-lo pode trazer aliança poderosa.",
    choices: [
      {
        id: "combat",
        description: "Provar valor através de combate honrado",
        testedAttribute: "strength",
        successEffect:
          "Respeito é ganho através de força. Você recebe uma Criatura de Nível 10 como aliada.",
        failureEffect:
          "O dragão vence facilmente e expulsa o grupo com queimaduras severas.",
      },
      {
        id: "diplomacy",
        description: "Negociar com sabedoria e oferendas valiosas",
        testedAttribute: "charisma",
        successEffect:
          "O dragão reconhece diplomacia e aceita aliança mutuamente benéfica.",
        failureEffect:
          "Oferendas são consideradas insultuosas, enfurecendo o dragão.",
      },
    ],
  },
  {
    id: 10,
    name: "A Descoberta da Fonte da Vida",
    description:
      "Uma fonte mágica que emana energia vital pura. Suas águas prometem renovação, mas exigem pureza de coração.",
    choices: [
      {
        id: "purify",
        description: "Purificar-se espiritualmente antes de beber",
        testedAttribute: "charisma",
        successEffect:
          "Toda cura recebida pela Unidade responsável é dobrada permanentemente.",
        failureEffect:
          "Impurezas impedem a absorção do poder, causando náusea.",
      },
      {
        id: "study_essence",
        description: "Estudar a essência mágica da fonte",
        testedAttribute: "intelligence",
        successEffect:
          "Compreensão da fonte permite canalizar seu poder continuamente.",
        failureEffect: "Análise incorreta contamina temporariamente as águas.",
      },
    ],
  },
  {
    id: 11,
    name: "A Prova dos Três Portais",
    description:
      "Três portais místicos surgem, cada um levando a um desafio diferente em planos extraplanares. Escolher sabiamente é essencial.",
    choices: [
      {
        id: "portal_strength",
        description: "Entrar no Portal da Força (desafio físico)",
        testedAttribute: "strength",
        successEffect:
          "Superar desafio concede aliança planar. Você recebe uma Tropa aleatória gratuitamente.",
        failureEffect: "Falha no desafio físico resulta em ferimentos graves.",
      },
      {
        id: "portal_mind",
        description: "Entrar no Portal da Mente (desafio mental)",
        testedAttribute: "intelligence",
        successEffect:
          "Conhecimento arcano antigo e alianças extraplanares são estabelecidas.",
        failureEffect:
          "Enigmas não resolvidos prendem a mente temporariamente.",
      },
      {
        id: "portal_spirit",
        description: "Entrar no Portal do Espírito (desafio espiritual)",
        testedAttribute: "charisma",
        successEffect:
          "Conexão espiritual profunda concede bênçãos de seres superiores.",
        failureEffect: "Rejeição espiritual causa perda temporária de moral.",
      },
    ],
  },
  {
    id: 12,
    name: "O Despertar do Guardião da Floresta Antiga",
    description:
      "Um espírito guardião da floresta dormita há séculos. Despertá-lo corretamente pode trazer prosperidade à região.",
    choices: [
      {
        id: "nature_ritual",
        description: "Realizar ritual de comunhão com a natureza",
        testedAttribute: "charisma",
        successEffect:
          "O guardião desperta e abençoa o território. Token de Suprimento neste Território contam como dois.",
        failureEffect:
          "Ritual incorreto ofende o espírito, que envia criaturas contra invasores.",
      },
      {
        id: "understand",
        description: "Estudar os ciclos naturais para compreender o guardião",
        testedAttribute: "intelligence",
        successEffect:
          "Compreensão profunda da floresta garante proteção e prosperidade.",
        failureEffect:
          "Análise superficial não desperta o guardião, desperdiçando tempo.",
      },
    ],
  },
  {
    id: 13,
    name: "O Desafio do Vale das Sombras",
    description:
      "Um vale envolto em sombras eternas esconde rotas secretas e perigos mortais. Conhecer seus segredos pode ser vantajoso.",
    choices: [
      {
        id: "map_routes",
        description: "Mapear cuidadosamente as rotas seguras",
        testedAttribute: "perception",
        successEffect:
          "Rotas e esconderijos são descobertos. A Unidade pode usar Fuga em troca de movimento, com sucesso automático.",
        failureEffect:
          "Caminhos errados levam a emboscadas de criaturas sombrias.",
      },
      {
        id: "stealth",
        description: "Usar furtividade para atravessar sem ser detectado",
        testedAttribute: "agility",
        successEffect:
          "Passagem silenciosa revela segredos das sombras sem alertar perigos.",
        failureEffect:
          "Movimento descuidado alerta guardiões sombrios que atacam.",
      },
    ],
  },
  {
    id: 14,
    name: "O Enigma do Templo Esquecido",
    description:
      "Um templo antigo repleto de enigmas e armadilhas protege conhecimento sagrado perdido.",
    choices: [
      {
        id: "solve_riddles",
        description: "Decifrar os enigmas inscritos nas paredes",
        testedAttribute: "intelligence",
        successEffect:
          "Bênção divina é concedida. A Unidade emite aura de 3 quadrados: ela e aliados na área recebem +1D em Testes Resistidos em Batalhas.",
        failureEffect:
          "Respostas incorretas ativam armadilhas mágicas dolorosas.",
      },
      {
        id: "faith",
        description: "Demonstrar fé e devoção aos deuses antigos",
        testedAttribute: "charisma",
        successEffect:
          "Fé sincera é reconhecida, e técnicas sagradas são reveladas.",
        failureEffect:
          "Falta de sinceridade resulta em rejeição divina e maldições.",
      },
    ],
  },
  {
    id: 15,
    name: "A Prova da Alma Perdida",
    description:
      "Uma alma penada oferece um teste de coragem e compaixão, prometendo recompensa àqueles que provarem sua bondade.",
    choices: [
      {
        id: "help_soul",
        description: "Ajudar a alma a encontrar paz",
        testedAttribute: "charisma",
        successEffect:
          "Gratidão da alma revela localização de artefato poderoso. A Unidade encontra Equipamento Mágico aleatório.",
        failureEffect:
          "Tentativa falha de ajuda prende a alma em tormento, que ataca.",
      },
      {
        id: "investigate",
        description: "Investigar a origem da maldição da alma",
        testedAttribute: "intelligence",
        successEffect:
          "Quebrar a maldição libera tanto a alma quanto tesouros ocultos.",
        failureEffect:
          "Investigação superficial não resolve nada e desperdiça tempo.",
      },
    ],
  },
  {
    id: 16,
    name: "A Jornada do Guardião Celestial",
    description:
      "Uma entidade celestial oferece uma jornada de provações para testar a dignidade dos mortais.",
    choices: [
      {
        id: "endure",
        description: "Resistir às provações físicas e mentais",
        testedAttribute: "constitution",
        successEffect:
          "Resistência exemplar concede bênção divina. A Unidade recebe permanentemente +2D em todos os Testes Resistidos.",
        failureEffect:
          "Falha nas provações resulta em exaustão severa e desânimo.",
      },
      {
        id: "prove_worthy",
        description: "Demonstrar sabedoria e virtude",
        testedAttribute: "charisma",
        successEffect:
          "Virtude reconhecida garante proteção divina e sabedoria sagrada.",
        failureEffect:
          "Falta de virtude resulta em rejeição celestial e perda de moral.",
      },
    ],
  },
  {
    id: 17,
    name: "A Prova do Renascimento",
    description:
      "Um ritual místico oferece a chance de transcender limites mortais, mas exige sacrifício e determinação absolutos.",
    choices: [
      {
        id: "ascend",
        description: "Submeter-se ao ritual de ascensão",
        testedAttribute: "constitution",
        successEffect:
          "A Unidade Ascende, recebendo Passiva de Raça extra aleatória. Se Herói, torna-se Regente. Se Regente, dobra Vitalidade.",
        failureEffect:
          "Ritual falha dolorosamente, causando dano severo e fraqueza temporária.",
      },
      {
        id: "understand_ritual",
        description: "Estudar o ritual antes de executá-lo",
        testedAttribute: "intelligence",
        successEffect:
          "Compreensão perfeita garante ascensão controlada e segura.",
        failureEffect: "Estudo insuficiente leva a erro crítico no ritual.",
      },
    ],
  },
  {
    id: 18,
    name: "O Despertar da Colina Sagrada",
    description:
      "Uma colina banhada por energia espiritual pulsa com poder antigo. Espíritos naturais aguardam o ritual correto.",
    choices: [
      {
        id: "spirit_communion",
        description: "Comungar com os espíritos naturais",
        testedAttribute: "charisma",
        successEffect:
          "Bênção dos espíritos é concedida. A Unidade recebe uma Capa Mágica.",
        failureEffect: "Comunhão falha, e espíritos manifestam hostilidade.",
      },
      {
        id: "channel_energy",
        description: "Canalizar a energia da colina",
        testedAttribute: "intelligence",
        successEffect:
          "Energia canalizada corretamente concede poder místico permanente.",
        failureEffect:
          "Canalização incorreta causa sobrecarga de energia mágica.",
      },
    ],
  },
  {
    id: 19,
    name: "A Expedição à Cidade Submersa",
    description:
      "Ruínas de uma cidade antiga submersas abrigam artefatos e perigos aquáticos. Exploração requer preparo e habilidade.",
    choices: [
      {
        id: "swim_explore",
        description: "Mergulhar e explorar metodicamente",
        testedAttribute: "constitution",
        successEffect:
          "Artefatos ancestrais são recuperados. A Unidade recebe um Foco Arcano Mágico.",
        failureEffect:
          "Falta de ar e pressão causam desmaio e perda de equipamento.",
      },
      {
        id: "detect_traps",
        description: "Identificar armadilhas aquáticas antes de avançar",
        testedAttribute: "perception",
        successEffect:
          "Navegação segura leva aos tesouros mais valiosos da cidade.",
        failureEffect:
          "Armadilhas não detectadas são acionadas, causando ferimentos.",
      },
    ],
  },
  {
    id: 20,
    name: "O Desafio da Esfinge Enigmática",
    description:
      "Uma esfinge antiga guarda tesouros e oferece enigmas mortais. Apenas os mais sábios podem obter suas recompensas.",
    choices: [
      {
        id: "answer_riddles",
        description: "Responder aos enigmas da esfinge",
        testedAttribute: "intelligence",
        successEffect:
          "Respostas corretas impressionam a esfinge. A Unidade recebe uma Arma Mágica.",
        failureEffect:
          "Respostas erradas enfurecem a esfinge, que ataca violentamente.",
      },
      {
        id: "outsmart",
        description: "Tentar enganar a esfinge com astúcia",
        testedAttribute: "charisma",
        successEffect:
          "Astúcia diverte a esfinge, que concede tesouro por entretenimento.",
        failureEffect:
          "Tentativa de engano é descoberta, enfurecendo a criatura.",
      },
    ],
  },
];

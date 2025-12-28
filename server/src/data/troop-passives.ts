// src/data/troop-passives.ts

/**
 * Passivas disponíveis para escolha na criação de Tropas.
 * Cada Reino define suas 5 tropas com uma passiva cada.
 */

export interface TroopPassiveDef {
  id: string;
  name: string;
  description: string;
}

export const TROOP_PASSIVES: TroopPassiveDef[] = [
  {
    id: "ESCUDO_PROTETOR",
    name: "Escudo Protetor",
    description:
      "A tropa pode usar sua Reação para absorver parte do dano de um aliado adjacente, reduzindo o dano em 2.",
  },
  {
    id: "INVESTIDA",
    name: "Investida",
    description:
      "Ao se mover em linha reta por pelo menos 2 casas antes de atacar, causa +2 de dano.",
  },
  {
    id: "EMBOSCADA",
    name: "Emboscada",
    description:
      "Caso ataque uma unidade que ainda não agiu neste turno, causa +3 de dano.",
  },
  {
    id: "FURTIVIDADE",
    name: "Furtividade",
    description:
      "Não pode ser alvo de ataques à distância enquanto estiver adjacente a outra unidade aliada.",
  },
  {
    id: "TIRO_RAPIDO",
    name: "Tiro Rápido",
    description:
      "Pode realizar dois ataques à distância por turno, mas cada ataque causa -1 de dano.",
  },
  //   {
  //     id: "PRECISAO_MORTAL",
  //     name: "Precisão Mortal",
  //     description: "Ataques à distância ignoram 2 pontos de Armadura do alvo.",
  //   },
  //   {
  //     id: "CONJURACAO_RAPIDA",
  //     name: "Conjuração Rápida",
  //     description: "Pode conjurar uma magia como ação bônus uma vez por batalha.",
  //   },
  //   {
  //     id: "FOCO_ARCANO",
  //     name: "Foco Arcano",
  //     description: "Magias causam +1 de dano e testes de Foco têm +1D.",
  //   },
  //   {
  //     id: "RESISTENCIA_ELEMENTAL",
  //     name: "Resistência Elemental",
  //     description:
  //       "Reduz todo dano elemental (Fogo, Gelo, Eletricidade) recebido em 2.",
  //   },
  //   {
  //     id: "REGENERACAO",
  //     name: "Regeneração",
  //     description:
  //       "Recupera 1 de Vitalidade no início de cada turno em batalha, desde que esteja acima de 0.",
  //   },
  //   {
  //     id: "BERSERKER",
  //     name: "Berserker",
  //     description:
  //       "Quando abaixo de 50% de Vitalidade, ganha +2 em Combate mas -1 em Armadura.",
  //   },
  //   {
  //     id: "FORMACAO_DEFENSIVA",
  //     name: "Formação Defensiva",
  //     description:
  //       "Enquanto adjacente a pelo menos 2 aliados, ganha +2 em Armadura.",
  //   },
  //   {
  //     id: "PROVOCAR",
  //     name: "Provocar",
  //     description:
  //       "Pode usar sua ação para forçar um inimigo adjacente a atacá-la no próximo turno.",
  //   },
  //   {
  //     id: "GOLPE_ATORDOANTE",
  //     name: "Golpe Atordoante",
  //     description:
  //       "Ao acertar um ataque corpo a corpo, pode gastar a Reação para atordoar o alvo (perde 1 ação).",
  //   },
  //   {
  //     id: "EVASAO",
  //     name: "Evasão",
  //     description:
  //       "Pode usar Reação para reduzir dano de um ataque em sua Acuidade.",
  //   },
  //   {
  //     id: "CURA_DE_CAMPO",
  //     name: "Cura de Campo",
  //     description:
  //       "Uma vez por batalha, pode curar um aliado adjacente em 3 de Vitalidade.",
  //   },
  //   {
  //     id: "MORAL_ELEVADO",
  //     name: "Moral Elevado",
  //     description: "Aliados adjacentes ganham +1D em testes de Combate.",
  //   },
  //   {
  //     id: "VETERANO",
  //     name: "Veterano",
  //     description:
  //       "Ganha +1 em todos os atributos ao atingir nível 5 ou superior.",
  //   },
  //   {
  //     id: "FLANQUEADOR",
  //     name: "Flanqueador",
  //     description:
  //       "Ganha +2 de dano contra inimigos que estão adjacentes a outro aliado.",
  //   },
  //   {
  //     id: "CONTRA_ATAQUE",
  //     name: "Contra-Ataque",
  //     description:
  //       "Ao ser atacado em corpo a corpo, pode usar Reação para contra-atacar causando metade do dano.",
  //   },
];

// Mapa para busca rápida por ID
export const TROOP_PASSIVES_MAP: Record<string, TroopPassiveDef> = {};
for (const p of TROOP_PASSIVES) {
  TROOP_PASSIVES_MAP[p.id] = p;
}

// server/src/data/alignments.ts

export const ALIGNMENT_DEFINITIONS = [
  {
    id: "BOM",
    name: "Alinhamento: BOM",
    description:
      "Reinos de ordem, luz e justiça. Buscam proteger os fracos e expurgar a escuridão do mundo.",
    passiveName: "Mecânica: Luz Sagrada",
    passiveEffect:
      "Seus ataques contra unidades de alinhamento MAL causam Dano Extra. Ataques contra Neutros ou Bons não possuem bônus.",
    color: 0x3498db, // Azul Real / Branco
  },
  {
    id: "NEUTRO",
    name: "Alinhamento: NEUTRO",
    description:
      "Reinos de equilíbrio, mercenários ou forças da natureza. Não tomam partido na guerra eterna.",
    passiveName: "Mecânica: Imparcialidade",
    passiveEffect:
      "Você não recebe Dano Extra de ninguém baseado em alinhamento, mas também não causa Dano Extra por alinhamento.",
    color: 0x2ecc71, // Verde / Cinza
  },
  {
    id: "MAL",
    name: "Alinhamento: MAL",
    description:
      "Reinos de conquista, poder e ambição. Acreditam que apenas os fortes merecem governar.",
    passiveName: "Mecânica: Malícia Pura",
    passiveEffect:
      "Seus ataques contra unidades de alinhamento BOM causam Dano Extra. Ataques contra Neutros ou Maus não possuem bônus.",
    color: 0xe74c3c, // Vermelho Sangue
  },
];

// prisma/seed-classes.ts
// Script para popular as classes e skills no banco de dados

import {
  PrismaClient,
  Archetype,
  SkillCategory,
  CostTier,
  SkillRange,
} from "@prisma/client";

const prisma = new PrismaClient();

interface SkillSeed {
  code: string;
  name: string;
  description: string;
  category: SkillCategory;
  costTier?: CostTier;
  range?: SkillRange;
  functionName?: string;
  metadata?: string;
}

interface ClassSeed {
  code: string;
  name: string;
  description: string;
  archetype: Archetype;
  resourceUsed: string;
  skills: SkillSeed[];
}

const CLASSES_TO_SEED: ClassSeed[] = [
  {
    code: "BARBARIAN",
    name: "Bárbaro",
    description:
      "Guerreiro selvagem que ganha força com a fúria. Pode atacar múltiplas vezes sem proteção.",
    archetype: "PHYSICAL",
    resourceUsed: "FOOD",
    skills: [
      {
        code: "BARBARIAN_WILD_FURY",
        name: "Fúria Selvagem",
        description:
          "Todo dano recebido reduzido em 1. Ataques têm mínimo 2 de acertos. Duplicado sem Proteção.",
        category: "PASSIVE",
        functionName: "applyWildFury",
      },
      {
        code: "BARBARIAN_RECKLESS_ATTACK",
        name: "Ataque Descuidado",
        description: "Sem Proteção: Pode atacar 2x quando usa Ação de Ataque.",
        category: "PASSIVE",
        functionName: "checkRecklessAttack",
      },
      {
        code: "BARBARIAN_TOTAL_DESTRUCTION",
        name: "Destruição Total",
        description:
          "Escolha dano de 1 até seu Combate em alvo adjacente. Você recebe o mesmo dano.",
        category: "ACTIVE",
        costTier: "LOW",
        range: "ADJACENT",
        functionName: "executeTotalDestruction",
      },
    ],
  },
  {
    code: "WARRIOR",
    name: "Guerreiro",
    description:
      "Soldado disciplinado e experiente. Mestre em ataques múltiplos e em recuperação tática.",
    archetype: "PHYSICAL",
    resourceUsed: "FOOD",
    skills: [
      {
        code: "WARRIOR_EXTRA_ATTACK",
        name: "Ataque Extra",
        description:
          "Quando usa a Ação de Ataque, você pode realizar um ataque a mais.",
        category: "PASSIVE",
        functionName: "checkExtraAttack",
      },
      {
        code: "WARRIOR_STRATEGIST",
        name: "Estrategista Nato",
        description:
          "Caso falhe em um Teste Resistido iniciado por você, tenha sucesso instantaneamente.",
        category: "REACTIVE",
        costTier: "LOW",
        functionName: "executeStrategist",
      },
      {
        code: "WARRIOR_ACTION_SURGE",
        name: "Surto de Ação",
        description:
          "Você recebe uma ação extra em seu turno. Não consome ação.",
        category: "ACTIVE",
        costTier: "MEDIUM",
        range: "SELF",
        functionName: "executeActionSurge",
      },
    ],
  },
  {
    code: "CLERIC",
    name: "Clérigo",
    description:
      "Escolhido divino com poderes sagrados. Protege aliados e expele maldições.",
    archetype: "SPIRITUAL",
    resourceUsed: "DEVOTION",
    skills: [
      {
        code: "CLERIC_MAGIC",
        name: "Magia",
        description: "Pode conjurar Sana, Lumen e Borealis.",
        category: "PASSIVE",
        functionName: "enableClericMagic",
      },
      {
        code: "CLERIC_CELESTIAL_EXPULSION",
        name: "Expulsão Celestial",
        description:
          "Você e aliados adjacentes não podem ser afetados por Maldições.",
        category: "PASSIVE",
        functionName: "applyCelestialExpulsion",
      },
      {
        code: "CLERIC_CHANNEL_DIVINITY",
        name: "Canalizar Divindade",
        description:
          "Você e aliados adjacentes recebem metade de Dano de Avatares (incluindo Dano Verdadeiro).",
        category: "PASSIVE",
        functionName: "applyChannelDivinity",
      },
    ],
  },
  {
    code: "WIZARD",
    name: "Mago",
    description:
      "Estudioso das artes arcanas que manipula a realidade através de feitiços poderosos.",
    archetype: "ARCANE",
    resourceUsed: "ARCANA",
    skills: [
      {
        code: "WIZARD_ARCANE_MASTERY",
        name: "Maestria Arcana",
        description:
          "Pode conjurar qualquer magia arcana. +1 dado em todos os testes de Foco.",
        category: "PASSIVE",
        functionName: "applyArcaneMastery",
      },
      {
        code: "WIZARD_SPELL_SHIELD",
        name: "Escudo Arcano",
        description:
          "Como reação, ganha +3 de Armadura contra um ataque mágico.",
        category: "REACTIVE",
        costTier: "LOW",
        functionName: "executeSpellShield",
      },
      {
        code: "WIZARD_METAMAGIC",
        name: "Metamagia",
        description:
          "Pode modificar uma magia: dobrar alcance, dobrar área ou ignorar resistência.",
        category: "ACTIVE",
        costTier: "HIGH",
        functionName: "executeMetamagic",
      },
    ],
  },
  {
    code: "ROGUE",
    name: "Ladino",
    description:
      "Especialista em furtividade e ataques precisos. Mestre em encontrar pontos fracos.",
    archetype: "PHYSICAL",
    resourceUsed: "FOOD",
    skills: [
      {
        code: "ROGUE_SNEAK_ATTACK",
        name: "Ataque Furtivo",
        description:
          "Causa +3 de dano ao atacar um inimigo que não te viu ou que está flanqueado.",
        category: "PASSIVE",
        functionName: "applySneakAttack",
      },
      {
        code: "ROGUE_EVASION",
        name: "Evasão",
        description:
          "Pode gastar reação para reduzir dano de área pela metade, ou zero se passar no teste.",
        category: "REACTIVE",
        costTier: "LOW",
        functionName: "executeEvasion",
      },
      {
        code: "ROGUE_ASSASSINATE",
        name: "Assassinar",
        description:
          "Primeiro ataque em combate contra alvo que não agiu causa dano dobrado.",
        category: "PASSIVE",
        functionName: "checkAssassinate",
      },
    ],
  },
  {
    code: "RANGER",
    name: "Patrulheiro",
    description:
      "Caçador experiente com domínio sobre terrenos selvagens e ataques à distância.",
    archetype: "PHYSICAL",
    resourceUsed: "FOOD",
    skills: [
      {
        code: "RANGER_HUNTERS_MARK",
        name: "Marca do Caçador",
        description:
          "Marca um inimigo. Todos os seus ataques contra ele causam +2 de dano.",
        category: "ACTIVE",
        costTier: "LOW",
        range: "RANGED",
        functionName: "executeHuntersMark",
      },
      {
        code: "RANGER_NATURAL_EXPLORER",
        name: "Explorador Natural",
        description:
          "+2 de movimento em terrenos naturais. Não sofre penalidades de terreno difícil.",
        category: "PASSIVE",
        functionName: "applyNaturalExplorer",
      },
      {
        code: "RANGER_VOLLEY",
        name: "Rajada",
        description:
          "Ataca todos os inimigos em uma área 3x3 com metade do dano normal.",
        category: "ACTIVE",
        costTier: "MEDIUM",
        range: "AREA",
        functionName: "executeVolley",
      },
    ],
  },
];

async function main() {
  console.log("🌱 Iniciando seed de classes e skills...");

  for (const classDef of CLASSES_TO_SEED) {
    console.log(`  📚 Criando classe: ${classDef.name}`);

    // Upsert da classe
    const heroClass = await prisma.heroClass.upsert({
      where: { code: classDef.code },
      update: {
        name: classDef.name,
        description: classDef.description,
        archetype: classDef.archetype,
        resourceUsed: classDef.resourceUsed,
      },
      create: {
        code: classDef.code,
        name: classDef.name,
        description: classDef.description,
        archetype: classDef.archetype,
        resourceUsed: classDef.resourceUsed,
      },
    });

    // Criar skills da classe
    for (const skill of classDef.skills) {
      console.log(`    ⚔️  Criando skill: ${skill.name}`);

      await prisma.skill.upsert({
        where: { code: skill.code },
        update: {
          name: skill.name,
          description: skill.description,
          category: skill.category,
          costTier: skill.costTier || null,
          range: skill.range || null,
          functionName: skill.functionName || null,
          metadata: skill.metadata || "{}",
        },
        create: {
          code: skill.code,
          name: skill.name,
          description: skill.description,
          category: skill.category,
          costTier: skill.costTier || null,
          range: skill.range || null,
          classId: heroClass.id,
          functionName: skill.functionName || null,
          metadata: skill.metadata || "{}",
        },
      });
    }
  }

  console.log("✅ Seed concluído!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

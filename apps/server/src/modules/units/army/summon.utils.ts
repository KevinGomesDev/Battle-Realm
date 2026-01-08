// src/utils/army/summon.utils.ts
import { prisma } from "../../../lib/prisma";
import {
  HERO_CLASSES,
  getAbilitiesForClass as getSkillsForClass,
  TROOP_SKILLS,
} from "@boundless/shared/data/abilities.data";
import { HP_CONFIG, MANA_CONFIG } from "@boundless/shared/config";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate creature stats: base value (1-6) + level
function generateCreatureStats(level: number) {
  const randomBase = () => Math.floor(Math.random() * 6) + 1 + level;
  return {
    combat: randomBase(),
    speed: randomBase(),
    focus: randomBase(),
    resistance: randomBase(),
    will: randomBase(),
    vitality: randomBase(),
  };
}

export async function createSummonedCreature(params: {
  matchId: string;
  ownerId?: string | null; // MatchKingdom controlling creature (optional for NPC)
  summonerUnitId?: string | null; // Link to summoner unit; if absent, defaults to Regent
  level?: number; // default 1
  name?: string | null;
}): Promise<{ success: boolean; unit?: any; message?: string }> {
  try {
    const { matchId, ownerId = null } = params;
    const level = Math.max(1, params.level || 1);

    // Determine summoner: provided or fallback to Regent of the owner
    let summonerUnitId = params.summonerUnitId || null;
    if (!summonerUnitId && ownerId) {
      const regent = await prisma.unit.findFirst({
        where: { matchId, ownerId, category: "REGENT" },
      });
      if (regent) summonerUnitId = regent.id;
    }

    // Random passive from troop passives (since creatures don't belong to a kingdom's template)
    const randomPassive = pickRandom(TROOP_SKILLS);

    // Random class feature a partir dos dados estáticos
    const randomClass = pickRandom(HERO_CLASSES);
    const classSkills = getSkillsForClass(randomClass.code);
    const randomSkill = classSkills.length > 0 ? pickRandom(classSkills) : null;

    const stats = generateCreatureStats(level);

    const creature = await prisma.unit.create({
      data: {
        matchId,
        ownerId: ownerId || null,
        category: "SUMMON",
        level,
        name: params.name || null,
        classCode: null, // Summons não têm classe
        features: JSON.stringify(
          [randomPassive.code, randomSkill ? randomSkill.code : null].filter(
            Boolean
          )
        ),
        combat: stats.combat,
        speed: stats.speed,
        focus: stats.focus,
        resistance: stats.resistance,
        will: stats.will,
        vitality: stats.vitality,
        maxHp: stats.vitality * HP_CONFIG.multiplier,
        currentHp: stats.vitality * HP_CONFIG.multiplier,
        maxMana: stats.will * MANA_CONFIG.multiplier,
        currentMana: stats.will * MANA_CONFIG.multiplier,
        movesLeft: 3,
        actionsLeft: 1,
        summonerId: summonerUnitId || null,
      },
    });

    return { success: true, unit: creature };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Erro ao criar invocação",
    };
  }
}

// src/utils/army/summon.utils.ts
import { prisma } from "../../lib/prisma";
import { TROOP_PASSIVES } from "../../data/troop-passives";
import { rollExplodingD6Once } from "../dice";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate creature stats per spec: for each attribute, 1D6 (exploding on 6) + level
function generateCreatureStats(level: number) {
  const rollPlusLevel = () => rollExplodingD6Once() + level;
  return {
    combat: rollPlusLevel(),
    acuity: rollPlusLevel(),
    focus: rollPlusLevel(),
    armor: rollPlusLevel(),
    vitality: rollPlusLevel(),
  };
}

export async function createSummonedCreature(params: {
  matchId: string;
  ownerId?: string | null; // MatchPlayer controlling creature (optional for NPC)
  kingdomId?: string | null; // Kingdom affiliation
  summonerUnitId?: string | null; // Link to summoner unit; if absent, defaults to Regent
  level?: number; // default 1
  name?: string | null;
}): Promise<{ success: boolean; unit?: any; message?: string }> {
  try {
    const { matchId, ownerId = null, kingdomId = null } = params;
    const level = Math.max(1, params.level || 1);

    // Determine summoner: provided or fallback to Regent of the kingdom
    let summonerUnitId = params.summonerUnitId || null;
    if (!summonerUnitId && kingdomId) {
      const regent = await prisma.unit.findFirst({
        where: { matchId, kingdomId, category: "REGENT" },
        orderBy: { createdAt: "asc" },
      } as any);
      if (regent) summonerUnitId = regent.id;
    }

    // Random passive from troop passives (since creatures don't belong to a kingdom's template)
    const randomPassive = pickRandom(TROOP_PASSIVES);

    // Random class feature a partir do banco
    const totalClasses = await prisma.heroClass.count();
    const randomIndex = Math.max(0, Math.floor(Math.random() * totalClasses));
    const randomClass = await prisma.heroClass.findFirst({
      skip: randomIndex,
      include: { skills: true },
    });
    const randomSkill = randomClass ? pickRandom(randomClass.skills) : null;

    const stats = generateCreatureStats(level);

    const creature = await prisma.unit.create({
      data: {
        matchId,
        ownerId: ownerId || null,
        kingdomId: kingdomId || null,
        category: "SUMMON",
        level,
        name: params.name || null,
        heroClass: null,
        classFeatures: JSON.stringify(
          [randomPassive.id, randomSkill ? randomSkill.code : null].filter(
            Boolean
          )
        ),
        combat: stats.combat,
        acuity: stats.acuity,
        focus: stats.focus,
        armor: stats.armor,
        vitality: stats.vitality,
        currentHp: stats.vitality,
        movesLeft: 3,
        actionsLeft: 1,
        summonerId: summonerUnitId || null,
      },
    } as any);

    return { success: true, unit: creature };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Erro ao criar invocação",
    };
  }
}

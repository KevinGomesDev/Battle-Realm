// scripts/reset-db.ts
// Deletes all game data (keeps user accounts).
//
// Para executar:
//   npx ts-node scripts/reset-db.ts
//
// Ou via npm script (se configurado):
//   npm run db:reset
//
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log(
    "[RESET] Starting deletion of all game data (keeping users)...\n"
  );

  // Order matters because of foreign key constraints.
  // Start with the most dependent tables first.

  // === BATTLE RELATED ===
  console.log("[RESET] Deleting battle logs...");
  const logsDeleted = await prisma.battleLog.deleteMany();
  console.log(`  -> ${logsDeleted.count} battle logs deleted`);

  console.log("[RESET] Deleting battle units...");
  const battleUnitsDeleted = await prisma.battleUnit.deleteMany();
  console.log(`  -> ${battleUnitsDeleted.count} battle units deleted`);

  console.log("[RESET] Deleting battles...");
  const battlesDeleted = await prisma.battle.deleteMany();
  console.log(`  -> ${battlesDeleted.count} battles deleted`);

  console.log("[RESET] Deleting arena lobbies...");
  const lobbiesDeleted = await prisma.arenaLobby.deleteMany();
  console.log(`  -> ${lobbiesDeleted.count} arena lobbies deleted`);

  // === MATCH RELATED ===
  console.log("[RESET] Deleting game events...");
  const eventsDeleted = await prisma.gameEvent.deleteMany();
  console.log(`  -> ${eventsDeleted.count} game events deleted`);

  console.log("[RESET] Deleting units...");
  const unitsDeleted = await prisma.unit.deleteMany();
  console.log(`  -> ${unitsDeleted.count} units deleted`);

  console.log("[RESET] Deleting structures...");
  const structuresDeleted = await prisma.structure.deleteMany();
  console.log(`  -> ${structuresDeleted.count} structures deleted`);

  console.log("[RESET] Deleting territories...");
  const territoriesDeleted = await prisma.territory.deleteMany();
  console.log(`  -> ${territoriesDeleted.count} territories deleted`);

  console.log("[RESET] Deleting match players...");
  const matchPlayersDeleted = await prisma.matchPlayer.deleteMany();
  console.log(`  -> ${matchPlayersDeleted.count} match players deleted`);

  console.log("[RESET] Deleting matches...");
  const matchesDeleted = await prisma.match.deleteMany();
  console.log(`  -> ${matchesDeleted.count} matches deleted`);

  // === KINGDOM RELATED ===
  console.log("[RESET] Deleting troop templates...");
  const troopTemplatesDeleted = await prisma.troopTemplate.deleteMany();
  console.log(`  -> ${troopTemplatesDeleted.count} troop templates deleted`);

  console.log("[RESET] Deleting kingdoms...");
  const kingdomsDeleted = await prisma.kingdom.deleteMany();
  console.log(`  -> ${kingdomsDeleted.count} kingdoms deleted`);

  // === RESET USER STATS (optional - keep accounts but reset stats) ===
  console.log("[RESET] Resetting user statistics...");
  const usersUpdated = await prisma.user.updateMany({
    data: {
      arenaWins: 0,
      arenaLosses: 0,
      matchWins: 0,
      matchLosses: 0,
    },
  });
  console.log(`  -> ${usersUpdated.count} users stats reset`);

  console.log(
    "\n[RESET] ✅ Done! All game data deleted. User accounts preserved."
  );
}

resetDatabase()
  .catch((err) => {
    console.error("[RESET] ❌ Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

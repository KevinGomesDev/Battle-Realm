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

  const battleUnitsDeleted = await prisma.battleUnit.deleteMany();
  if (battleUnitsDeleted.count > 0) {
    console.log(`[RESET] Deleted ${battleUnitsDeleted.count} battle units`);
  }

  const battlesDeleted = await prisma.battle.deleteMany();
  if (battlesDeleted.count > 0) {
    console.log(`[RESET] Deleted ${battlesDeleted.count} battles`);
  }

  const lobbiesDeleted = await prisma.arenaLobby.deleteMany();
  if (lobbiesDeleted.count > 0) {
    console.log(`[RESET] Deleted ${lobbiesDeleted.count} arena lobbies`);
  }

  // === MATCH RELATED ===
  const eventsDeleted = await prisma.gameEvent.deleteMany();
  if (eventsDeleted.count > 0) {
    console.log(`[RESET] Deleted ${eventsDeleted.count} game events`);
  }

  const unitsDeleted = await prisma.unit.deleteMany();
  if (unitsDeleted.count > 0) {
    console.log(`[RESET] Deleted ${unitsDeleted.count} units`);
  }

  const structuresDeleted = await prisma.structure.deleteMany();
  if (structuresDeleted.count > 0) {
    console.log(`[RESET] Deleted ${structuresDeleted.count} structures`);
  }

  const territoriesDeleted = await prisma.territory.deleteMany();
  if (territoriesDeleted.count > 0) {
    console.log(`[RESET] Deleted ${territoriesDeleted.count} territories`);
  }

  const matchKingdomsDeleted = await prisma.matchKingdom.deleteMany();
  if (matchKingdomsDeleted.count > 0) {
    console.log(`[RESET] Deleted ${matchKingdomsDeleted.count} match kingdoms`);
  }

  const matchesDeleted = await prisma.match.deleteMany();
  if (matchesDeleted.count > 0) {
    console.log(`[RESET] Deleted ${matchesDeleted.count} matches`);
  }

  // === KINGDOM RELATED ===
  const troopTemplatesDeleted = await prisma.troopTemplate.deleteMany();
  if (troopTemplatesDeleted.count > 0) {
    console.log(
      `[RESET] Deleted ${troopTemplatesDeleted.count} troop templates`
    );
  }

  const kingdomsDeleted = await prisma.kingdom.deleteMany();
  if (kingdomsDeleted.count > 0) {
    console.log(`[RESET] Deleted ${kingdomsDeleted.count} kingdoms`);
  }

  // === RESET USER STATS (optional - keep accounts but reset stats) ===
  const usersUpdated = await prisma.user.updateMany({
    data: {
      arenaWins: 0,
      arenaLosses: 0,
      matchWins: 0,
      matchLosses: 0,
    },
  });
  if (usersUpdated.count > 0) {
    console.log(`[RESET] Reset stats for ${usersUpdated.count} users`);
  }

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

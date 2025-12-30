-- Migration: Reorganize Unit model and add HeroClass/Skill tables
-- 1. Create new enums
CREATE TYPE "Archetype" AS ENUM ('PHYSICAL', 'SPIRITUAL', 'ARCANE');
CREATE TYPE "SkillCategory" AS ENUM ('PASSIVE', 'ACTIVE', 'REACTIVE');
CREATE TYPE "CostTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EXTREME');
CREATE TYPE "SkillRange" AS ENUM ('SELF', 'ADJACENT', 'RANGED', 'AREA');

-- 2. Create HeroClass table
CREATE TABLE "HeroClass" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archetype" "Archetype" NOT NULL,
    "resourceUsed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroClass_pkey" PRIMARY KEY ("id")
);

-- 3. Create Skill table
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL,
    "costTier" "CostTier",
    "range" "SkillRange",
    "classId" TEXT NOT NULL,
    "functionName" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- 4. Create unique indices
CREATE UNIQUE INDEX "HeroClass_code_key" ON "HeroClass"("code");
CREATE UNIQUE INDEX "Skill_code_key" ON "Skill"("code");

-- 5. Add foreign key for Skill -> HeroClass
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_classId_fkey" FOREIGN KEY ("classId") REFERENCES "HeroClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Modify Unit table
-- Add new columns
ALTER TABLE "Unit" ADD COLUMN "troopSlot" INTEGER;
ALTER TABLE "Unit" ADD COLUMN "classId" TEXT;

-- Migrate data: copy heroClass to temporary, we'll need to link after seeding
-- For now just drop the old column after adding new one
ALTER TABLE "Unit" DROP COLUMN IF EXISTS "type";
ALTER TABLE "Unit" DROP COLUMN IF EXISTS "heroClass";

-- 7. Add foreign key for Unit -> HeroClass
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_classId_fkey" FOREIGN KEY ("classId") REFERENCES "HeroClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8. UnitCategory enum já está em inglês, não precisa migrar

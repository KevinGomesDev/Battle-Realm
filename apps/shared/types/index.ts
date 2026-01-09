// Shared Types - Barrel Export
// Fonte de verdade para tipos

// Core types
export * from "./ability.types";
export * from "./battle.types";
export * from "./conditions.types";

// Domain types
export * from "./arena.types";
export * from "./auth.types";
export * from "./character.types";
export * from "./chat.types";
export * from "./commands.types";
export * from "./dice.types";
export * from "./events.types";
export * from "./items.types";
export * from "./map.types";
export * from "./match.types";
export * from "./ranking.types";
export * from "./session.types";
export * from "./audio.types";

// Kingdom - exportar tudo exceto tipos duplicados com units.types
export {
  type ResourceKey,
  type AttributeKey,
  type Alignment,
  type Race,
  type ResourceType,
  type BaseAttributes,
  type Kingdom,
  type KingdomWithRelations,
  type KingdomSummary,
  type MatchResult,
  type MatchHistory,
  type TroopTemplate,
  type CreateTroopTemplateData,
  type Unit,
  type RegentData,
  type CreateRegentData,
  type CreateKingdomData,
  type CreateKingdomFromTemplateData,
  type TemplateDifficulty,
  type KingdomTemplateSummary,
  type KingdomTemplateDetails,
  type RaceDefinition,
} from "./kingdom.types";

// Units - não exporta UnitCategory e RaceDefinition para evitar duplicação
export {
  type UnitStats,
  type UnitDefinition,
  type TroopTemplateData,
  type HeroTemplate,
  type RegentTemplate,
  type SummonAIBehavior,
  type SummonTemplate,
  type KingdomTemplateDefinition,
} from "./units.types";

// Nemesis System - Narrativa Emergente
export * from "./nemesis.types";

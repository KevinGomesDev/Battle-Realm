// Barrel export para componentes de Dashboard
export { SectionCard } from "./SectionCard";
export { Ranking } from "./Ranking";

// Seções com hooks de ações
export { KingdomSection, useKingdomSectionActions } from "./KingdomSection";
export { MatchSection, useMatchSectionActions } from "./MatchSection";
export {
  BattleSection,
  useBattleSectionActions,
  BattleSelectionProvider,
} from "./BattleSection";

// Lobbies compactos
export { MatchLobby } from "./MatchLobby";
export { BattleLobby } from "./BattleLobby";

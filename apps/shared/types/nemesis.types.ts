// shared/types/nemesis.types.ts
// Sistema Nemesis - Narrativa Emergente e Rivalidades Pessoais
// Inspirado no Shadow of Mordor

// =============================================================================
// TIPOS BASE
// =============================================================================

/** ID único de um Nemesis */
export type NemesisId = string;

/** ID do jogador */
export type PlayerId = string;

/** ID da unidade que se tornou Nemesis */
export type UnitInstanceId = string;

// =============================================================================
// PERSONALIDADE E TRAÇOS
// =============================================================================

/** Traços de personalidade que afetam diálogos e comportamento */
export type PersonalityTrait =
  | "COWARD" // Foge quando HP baixo
  | "BERSERKER" // Fica mais forte quando ferido
  | "CUNNING" // Tenta emboscadas
  | "PRIDEFUL" // Nunca foge, zoa constantemente
  | "SADISTIC" // Provoca quando causa dano
  | "VENGEFUL" // Obsecado em matar quem o feriu
  | "HONORABLE" // Luta limpo, respeita inimigos fortes
  | "TREACHEROUS" // Ataca pelas costas
  | "FANATIC" // Devoção extrema, não teme morte
  | "SURVIVOR"; // Fez de tudo para sobreviver

/** Medos que o Nemesis desenvolveu baseado em encontros passados */
export type NemesisFear =
  | "FIRE" // Foi queimado
  | "MAGIC" // Foi devastado por magia
  | "MELEE" // Derrotado em combate corpo-a-corpo
  | "RANGED" // Atingido por ataques à distância
  | "BEASTS" // Atacado por invocações/monstros
  | "AMBUSH" // Foi emboscado
  | "OUTNUMBERED" // Perdeu quando em desvantagem numérica
  | "SPECIFIC_UNIT"; // Medo de uma unidade específica que o derrotou

/** Forças que o Nemesis desenvolveu */
export type NemesisStrength =
  | "FIRE_PROOF" // Resistência a fogo
  | "MAGIC_RESISTANT" // Resistência a magia
  | "THICK_SKIN" // Resistência física aumentada
  | "QUICK_REFLEXES" // Maior esquiva
  | "COMBAT_MASTER" // Melhor em combate corpo-a-corpo
  | "IRON_WILL" // Imune a medo e efeitos mentais
  | "REGENERATION" // Recupera HP lentamente
  | "PACK_LEADER" // Buff para aliados próximos
  | "LAST_STAND" // Mais forte quando sozinho
  | "DETERMINED"; // Não pode ser executado facilmente

/** Tipo de cicatriz visual que o Nemesis carrega */
export type ScarType =
  | "BURN_FACE" // Rosto queimado
  | "BURN_BODY" // Corpo queimado
  | "MISSING_EYE" // Perdeu um olho
  | "SLASH_FACE" // Corte no rosto
  | "BROKEN_HORN" // Chifre quebrado (para raças com chifres)
  | "METAL_PLATE" // Placa de metal cobrindo ferimento
  | "STITCHES" // Costurado após corte grave
  | "LIMP"; // Manca (perna ferida)

// =============================================================================
// EVENTOS E HISTÓRICO
// =============================================================================

/** Tipos de encontro entre jogador e Nemesis */
export type NemesisEventType =
  // Vitórias do Nemesis
  | "KILLED_PLAYER_UNIT" // Matou uma unidade do jogador
  | "KILLED_PLAYER_HERO" // Matou um herói do jogador
  | "KILLED_PLAYER_REGENT" // Matou o regente (evento épico)
  | "ROUTED_PLAYER" // Fez o jogador fugir/render
  | "AMBUSHED_PLAYER" // Emboscou o jogador com sucesso

  // Vitórias do Jogador
  | "WOUNDED_BY_PLAYER" // Foi ferido mas escapou
  | "DEFEATED_BY_PLAYER" // Foi derrotado mas sobreviveu
  | "HUMILIATED" // Derrotado de forma vergonhosa
  | "SCARED_OFF" // Fugiu com medo

  // Eventos neutros
  | "ESCAPED_BATTLE" // Fugiu da batalha
  | "PROMOTED" // Foi promovido por outro motivo
  | "BETRAYED_ALLY" // Traiu um aliado (para Nemesis traiçoeiros)
  | "RECRUITED_FOLLOWERS"; // Ganhou seguidores

/** Registro de um encontro */
export interface NemesisEncounter {
  id: string;
  timestamp: number;
  eventType: NemesisEventType;

  /** Contexto do evento */
  context: {
    /** ID da batalha onde ocorreu */
    battleId?: string;
    /** Tipo de dano que causou/recebeu */
    damageType?: "PHYSICAL" | "MAGICAL" | "FIRE" | "POISON" | "TRUE";
    /** Unidade específica envolvida */
    involvedUnitId?: string;
    /** HP restante quando escapou (se aplicável) */
    remainingHpPercent?: number;
    /** Estava em desvantagem numérica? */
    wasOutnumbered?: boolean;
  };

  /** Consequências do evento */
  consequences: {
    /** Medos adquiridos */
    fearsGained?: NemesisFear[];
    /** Forças adquiridas */
    strengthsGained?: NemesisStrength[];
    /** Cicatrizes adquiridas */
    scarsGained?: ScarType[];
    /** Mudança de rank */
    rankChange?: number;
    /** Traços de personalidade desenvolvidos */
    traitsGained?: PersonalityTrait[];
  };
}

// =============================================================================
// HIERARQUIA E RANK
// =============================================================================

/** Rank do Nemesis na hierarquia inimiga */
export type NemesisRank =
  | "GRUNT" // Soldado comum que subiu
  | "CAPTAIN" // Líder de esquadrão
  | "ELITE" // Guerreiro de elite
  | "WARLORD" // Senhor da guerra
  | "OVERLORD"; // Chefe supremo

/** Configuração de rank */
export interface NemesisRankConfig {
  rank: NemesisRank;
  minPowerLevel: number;
  maxPowerLevel: number;
  statMultiplier: number;
  followerCount: number;
  titlePrefix: string[];
}

// =============================================================================
// PROVOCAÇÕES E DIÁLOGOS
// =============================================================================

/** Contexto para seleção de provocação */
export type TauntContext =
  | "FIRST_ENCOUNTER" // Primeira vez que vê o jogador
  | "REVENGE_ENCOUNTER" // Voltando após ser derrotado
  | "KILLING_BLOW" // Ao matar uma unidade do jogador
  | "BEING_WOUNDED" // Ao ser ferido
  | "LOW_HEALTH" // Quando HP está baixo
  | "FLEEING" // Ao fugir
  | "PLAYER_FLEEING" // Quando jogador foge
  | "REMATCH" // Encontro repetido
  | "SHOWING_SCAR" // Referenciando cicatriz
  | "MOCKING_FEAR" // Zombando do jogador
  | "AMBUSH"; // Ao emboscar

/** Uma provocação/fala do Nemesis */
export interface NemesisTaunt {
  id: string;
  context: TauntContext;
  /** Traços necessários para usar esta fala */
  requiredTraits?: PersonalityTrait[];
  /** Traços que impedem esta fala */
  excludedTraits?: PersonalityTrait[];
  /** Template da fala (usa placeholders como {playerName}, {scarOrigin}) */
  template: string;
  /** Prioridade (maior = mais provável de ser escolhida) */
  priority: number;
}

// =============================================================================
// ENTIDADE NEMESIS PRINCIPAL
// =============================================================================

/** O Nemesis completo */
export interface Nemesis {
  id: NemesisId;

  // === Identidade ===
  /** Nome gerado ou conquistado */
  name: string;
  /** Título baseado em feitos */
  title: string;
  /** Nome completo formatado */
  fullName: string;

  // === Origem ===
  /** ID da unidade original que se tornou Nemesis */
  originalUnitId: UnitInstanceId;
  /** Tipo/template da unidade original */
  unitType: string;
  /** Raça do Nemesis */
  race: string;
  /** Reino/facção de origem */
  factionId: string;

  // === Status ===
  /** Rank atual */
  rank: NemesisRank;
  /** Nível de poder (afeta stats) */
  powerLevel: number;
  /** Está vivo? */
  isAlive: boolean;
  /** Última vez visto (timestamp) */
  lastSeen: number;
  /** Está ativo no mundo? */
  isActive: boolean;

  // === Personalidade ===
  /** Traços de personalidade */
  traits: PersonalityTrait[];
  /** Medos desenvolvidos */
  fears: NemesisFear[];
  /** Forças desenvolvidas */
  strengths: NemesisStrength[];

  // === Aparência ===
  /** Cicatrizes visíveis */
  scars: ScarType[];
  /** Modificadores visuais customizados */
  visualModifiers: string[];

  // === Histórico ===
  /** Todos os encontros com o jogador */
  encounters: NemesisEncounter[];
  /** Quantas vezes matou unidades do jogador */
  playerKillCount: number;
  /** Quantas vezes foi derrotado */
  defeatCount: number;
  /** Quantas vezes escapou */
  escapeCount: number;

  // === Relações ===
  /** ID do jogador que é alvo principal */
  targetPlayerId: PlayerId;
  /** IDs de unidades específicas que odeia */
  hatedUnitIds: UnitInstanceId[];
  /** IDs de outros Nemesis que são aliados */
  allyNemesisIds: NemesisId[];
  /** IDs de outros Nemesis que são rivais */
  rivalNemesisIds: NemesisId[];

  // === Metadados ===
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// DTOs E INPUTS
// =============================================================================

/** Dados mínimos para criar um Nemesis a partir de uma unidade */
export interface CreateNemesisInput {
  unitInstanceId: UnitInstanceId;
  unitType: string;
  race: string;
  factionId: string;
  targetPlayerId: PlayerId;
  /** Evento que originou a criação */
  originEvent: NemesisEventType;
  /** Contexto do evento de origem */
  originContext?: NemesisEncounter["context"];
}

/** Dados para registrar um encontro */
export interface RecordEncounterInput {
  nemesisId: NemesisId;
  eventType: NemesisEventType;
  context?: NemesisEncounter["context"];
}

/** Filtros para buscar Nemesis */
export interface NemesisQueryFilters {
  playerId?: PlayerId;
  isAlive?: boolean;
  isActive?: boolean;
  minRank?: NemesisRank;
  factionId?: string;
}

/** Resumo de Nemesis para listagens */
export interface NemesisSummary {
  id: NemesisId;
  fullName: string;
  rank: NemesisRank;
  powerLevel: number;
  playerKillCount: number;
  isAlive: boolean;
  lastSeen: number;
  primaryTrait?: PersonalityTrait;
  scarCount: number;
}

// =============================================================================
// CONFIGURAÇÃO DO SISTEMA
// =============================================================================

/** Configuração global do sistema Nemesis */
export interface NemesisSystemConfig {
  /** Chance (0-1) de uma unidade virar Nemesis ao matar jogador */
  promotionChanceOnKill: number;
  /** Chance de um Nemesis derrotado sobreviver */
  survivalChanceOnDefeat: number;
  /** Máximo de Nemesis ativos por jogador */
  maxActiveNemesesPerPlayer: number;
  /** Tempo mínimo (ms) entre aparições do mesmo Nemesis */
  minTimeBetweenEncounters: number;
  /** Multiplicador de XP ao derrotar Nemesis */
  nemesisXpMultiplier: number;
  /** Chance de ganhar loot especial de Nemesis */
  specialLootChance: number;
}

// ===== SOUNDS DATA =====
// Catálogo de todos os sons do jogo

import type { SoundDefinition } from "../types/audio.types";

// ===== UI SOUNDS =====
export const UI_SOUNDS: Record<string, SoundDefinition> = {
  CLICK: {
    id: "ui_click",
    src: "/sounds/ui/click.mp3",
    category: "ui",
    volume: 0.5,
  },
  HOVER: {
    id: "ui_hover",
    src: "/sounds/ui/hover.mp3",
    category: "ui",
    volume: 0.3,
  },
  SUCCESS: {
    id: "ui_success",
    src: "/sounds/ui/success.mp3",
    category: "ui",
    volume: 0.6,
  },
  ERROR: {
    id: "ui_error",
    src: "/sounds/ui/error.mp3",
    category: "ui",
    volume: 0.6,
  },
  NOTIFICATION: {
    id: "ui_notification",
    src: "/sounds/ui/notification.mp3",
    category: "ui",
    volume: 0.7,
  },
  OPEN_MENU: {
    id: "ui_open_menu",
    src: "/sounds/ui/open-menu.mp3",
    category: "ui",
    volume: 0.5,
  },
  CLOSE_MENU: {
    id: "ui_close_menu",
    src: "/sounds/ui/close-menu.mp3",
    category: "ui",
    volume: 0.5,
  },
};

// ===== COMBAT SOUNDS =====
export const COMBAT_SOUNDS: Record<string, SoundDefinition> = {
  ATTACK_SWORD: {
    id: "combat_attack_sword",
    src: "/sounds/combat/sword-slash.mp3",
    category: "combat",
    volume: 0.8,
  },
  ATTACK_BOW: {
    id: "combat_attack_bow",
    src: "/sounds/combat/bow-release.mp3",
    category: "combat",
    volume: 0.7,
  },
  HIT_PHYSICAL: {
    id: "combat_hit_physical",
    src: "/sounds/combat/hit-physical.mp3",
    category: "combat",
    volume: 0.8,
  },
  HIT_CRITICAL: {
    id: "combat_hit_critical",
    src: "/sounds/combat/hit-critical.mp3",
    category: "combat",
    volume: 0.9,
  },
  MISS: {
    id: "combat_miss",
    src: "/sounds/combat/miss.mp3",
    category: "combat",
    volume: 0.5,
  },
  BLOCK: {
    id: "combat_block",
    src: "/sounds/combat/block.mp3",
    category: "combat",
    volume: 0.7,
  },
  DEATH: {
    id: "combat_death",
    src: "/sounds/combat/death.mp3",
    category: "combat",
    volume: 0.8,
  },
  VICTORY: {
    id: "combat_victory",
    src: "/sounds/combat/victory.mp3",
    category: "combat",
    volume: 0.9,
  },
  DEFEAT: {
    id: "combat_defeat",
    src: "/sounds/combat/defeat.mp3",
    category: "combat",
    volume: 0.8,
  },
  TURN_START: {
    id: "combat_turn_start",
    src: "/sounds/combat/turn-start.mp3",
    category: "combat",
    volume: 0.6,
  },
};

// ===== SPELL SOUNDS =====
export const SPELL_SOUNDS: Record<string, SoundDefinition> = {
  CAST_FIRE: {
    id: "spell_cast_fire",
    src: "/sounds/spells/cast-fire.mp3",
    category: "spell",
    volume: 0.8,
  },
  CAST_ICE: {
    id: "spell_cast_ice",
    src: "/sounds/spells/cast-ice.mp3",
    category: "spell",
    volume: 0.8,
  },
  CAST_LIGHTNING: {
    id: "spell_cast_lightning",
    src: "/sounds/spells/cast-lightning.mp3",
    category: "spell",
    volume: 0.9,
  },
  CAST_HEAL: {
    id: "spell_cast_heal",
    src: "/sounds/spells/cast-heal.mp3",
    category: "spell",
    volume: 0.7,
  },
  CAST_BUFF: {
    id: "spell_cast_buff",
    src: "/sounds/spells/cast-buff.mp3",
    category: "spell",
    volume: 0.7,
  },
  CAST_DEBUFF: {
    id: "spell_cast_debuff",
    src: "/sounds/spells/cast-debuff.mp3",
    category: "spell",
    volume: 0.7,
  },
  CAST_GENERIC: {
    id: "spell_cast_generic",
    src: "/sounds/spells/cast-generic.mp3",
    category: "spell",
    volume: 0.7,
  },
};

// ===== MUSIC =====
export const MUSIC_TRACKS: Record<string, SoundDefinition> = {
  MAIN_MENU: {
    id: "music_main_menu",
    src: "/sounds/music/main-menu.mp3",
    category: "music",
    volume: 0.5,
    loop: true,
    preload: true,
  },
  BATTLE_NORMAL: {
    id: "music_battle_normal",
    src: "/sounds/music/battle-normal.mp3",
    category: "music",
    volume: 0.5,
    loop: true,
  },
  BATTLE_INTENSE: {
    id: "music_battle_intense",
    src: "/sounds/music/battle-intense.mp3",
    category: "music",
    volume: 0.5,
    loop: true,
  },
  KINGDOM_MAP: {
    id: "music_kingdom_map",
    src: "/sounds/music/kingdom-map.mp3",
    category: "music",
    volume: 0.4,
    loop: true,
  },
  VICTORY: {
    id: "music_victory",
    src: "/sounds/music/victory.mp3",
    category: "music",
    volume: 0.6,
    loop: false,
  },
  DEFEAT: {
    id: "music_defeat",
    src: "/sounds/music/defeat.mp3",
    category: "music",
    volume: 0.5,
    loop: false,
  },
};

// ===== AMBIENT SOUNDS =====
export const AMBIENT_SOUNDS: Record<string, SoundDefinition> = {
  FOREST: {
    id: "ambient_forest",
    src: "/sounds/ambient/forest.mp3",
    category: "ambient",
    volume: 0.3,
    loop: true,
  },
  RAIN: {
    id: "ambient_rain",
    src: "/sounds/ambient/rain.mp3",
    category: "ambient",
    volume: 0.4,
    loop: true,
  },
  WIND: {
    id: "ambient_wind",
    src: "/sounds/ambient/wind.mp3",
    category: "ambient",
    volume: 0.3,
    loop: true,
  },
  FIRE_CRACKLING: {
    id: "ambient_fire",
    src: "/sounds/ambient/fire-crackling.mp3",
    category: "ambient",
    volume: 0.4,
    loop: true,
  },
  CROWD: {
    id: "ambient_crowd",
    src: "/sounds/ambient/crowd.mp3",
    category: "ambient",
    volume: 0.3,
    loop: true,
  },
};

// ===== QTE SOUNDS =====
export const QTE_SOUNDS: Record<string, SoundDefinition> = {
  // Som de início do QTE - toca quando o círculo aparece
  START: {
    id: "qte_start",
    src: "/sounds/qte/qte-start.mp3",
    category: "combat",
    volume: 0.7,
    preload: true,
  },
  // Tick suave durante o círculo fechando (loop)
  TICK: {
    id: "qte_tick",
    src: "/sounds/qte/qte-tick.mp3",
    category: "combat",
    volume: 0.3,
  },
  // Bip de urgência nos últimos 30% do tempo
  COUNTDOWN: {
    id: "qte_countdown",
    src: "/sounds/qte/qte-countdown.mp3",
    category: "combat",
    volume: 0.5,
  },
  // Acerto perfeito - som épico
  PERFECT: {
    id: "qte_perfect",
    src: "/sounds/qte/qte-perfect.mp3",
    category: "combat",
    volume: 0.9,
    preload: true,
  },
  // Acerto normal
  HIT: {
    id: "qte_hit",
    src: "/sounds/qte/qte-hit.mp3",
    category: "combat",
    volume: 0.7,
    preload: true,
  },
  // Falha/erro
  MISS: {
    id: "qte_miss",
    src: "/sounds/qte/qte-miss.mp3",
    category: "combat",
    volume: 0.6,
    preload: true,
  },
  // Bloqueio bem-sucedido
  BLOCK: {
    id: "qte_block",
    src: "/sounds/qte/qte-block.mp3",
    category: "combat",
    volume: 0.8,
  },
};

// ===== ALL SOUNDS =====
export const ALL_SOUNDS: Record<string, SoundDefinition> = {
  ...UI_SOUNDS,
  ...COMBAT_SOUNDS,
  ...SPELL_SOUNDS,
  ...MUSIC_TRACKS,
  ...AMBIENT_SOUNDS,
  ...QTE_SOUNDS,
};

// ===== SOUND IDS (para type-safety) =====
export type UISoundId = keyof typeof UI_SOUNDS;
export type CombatSoundId = keyof typeof COMBAT_SOUNDS;
export type SpellSoundId = keyof typeof SPELL_SOUNDS;
export type MusicTrackId = keyof typeof MUSIC_TRACKS;
export type AmbientSoundId = keyof typeof AMBIENT_SOUNDS;
export type QTESoundId = keyof typeof QTE_SOUNDS;
export type SoundId = keyof typeof ALL_SOUNDS;

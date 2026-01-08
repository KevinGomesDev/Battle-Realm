// ===== USE AUDIO HOOK =====
// Hook React para uso do serviço de áudio

import { useCallback, useEffect, useMemo, useState } from "react";
import { audioService } from "../services/audio.service";
import type {
  AudioSettings,
  SoundPlayOptions,
} from "../../../shared/types/audio.types";
import type { SoundId } from "../../../shared/data/sounds.data";

/**
 * Hook principal para controle de áudio
 */
export function useAudio() {
  const [settings, setSettings] = useState<AudioSettings>(() =>
    audioService.getSettings()
  );

  // Inicializa o serviço na primeira renderização
  useEffect(() => {
    audioService.init();
  }, []);

  const play = useCallback((soundId: SoundId, options?: SoundPlayOptions) => {
    return audioService.play(soundId, options);
  }, []);

  const stop = useCallback((soundId: SoundId) => {
    audioService.stop(soundId);
  }, []);

  const playMusic = useCallback((musicId: SoundId, fadeIn = true) => {
    audioService.playMusic(musicId, fadeIn);
  }, []);

  const stopMusic = useCallback((fadeOut = true) => {
    audioService.stopMusic(fadeOut);
  }, []);

  const toggleMute = useCallback(() => {
    const muted = audioService.toggleMute();
    setSettings(audioService.getSettings());
    return muted;
  }, []);

  const setMasterVolume = useCallback((volume: number) => {
    audioService.setMasterVolume(volume);
    setSettings(audioService.getSettings());
  }, []);

  const setMusicVolume = useCallback((volume: number) => {
    audioService.setCategoryVolume("music", volume);
    setSettings(audioService.getSettings());
  }, []);

  const setSfxVolume = useCallback((volume: number) => {
    audioService.setCategoryVolume("ui", volume);
    setSettings(audioService.getSettings());
  }, []);

  return useMemo(
    () => ({
      settings,
      play,
      stop,
      playMusic,
      stopMusic,
      toggleMute,
      setMasterVolume,
      setMusicVolume,
      setSfxVolume,
    }),
    [
      settings,
      play,
      stop,
      playMusic,
      stopMusic,
      toggleMute,
      setMasterVolume,
      setMusicVolume,
      setSfxVolume,
    ]
  );
}

/**
 * Hook para tocar sons de UI (click, hover, etc)
 */
export function useUISounds() {
  const playClick = useCallback(() => {
    audioService.play("CLICK");
  }, []);

  const playHover = useCallback(() => {
    audioService.play("HOVER");
  }, []);

  const playSuccess = useCallback(() => {
    audioService.play("SUCCESS");
  }, []);

  const playError = useCallback(() => {
    audioService.play("ERROR");
  }, []);

  const playNotification = useCallback(() => {
    audioService.play("NOTIFICATION");
  }, []);

  return useMemo(
    () => ({
      playClick,
      playHover,
      playSuccess,
      playError,
      playNotification,
    }),
    [playClick, playHover, playSuccess, playError, playNotification]
  );
}

/**
 * Hook para sons de combate
 */
export function useCombatSounds() {
  const playAttack = useCallback((type: "sword" | "bow" = "sword") => {
    audioService.play(type === "sword" ? "ATTACK_SWORD" : "ATTACK_BOW");
  }, []);

  const playHit = useCallback((critical = false) => {
    audioService.play(critical ? "HIT_CRITICAL" : "HIT_PHYSICAL");
  }, []);

  const playMiss = useCallback(() => {
    audioService.play("MISS");
  }, []);

  const playBlock = useCallback(() => {
    audioService.play("BLOCK");
  }, []);

  const playDeath = useCallback(() => {
    audioService.play("DEATH");
  }, []);

  const playTurnStart = useCallback(() => {
    audioService.play("TURN_START");
  }, []);

  const playVictory = useCallback(() => {
    audioService.play("VICTORY");
  }, []);

  const playDefeat = useCallback(() => {
    audioService.play("DEFEAT");
  }, []);

  return useMemo(
    () => ({
      playAttack,
      playHit,
      playMiss,
      playBlock,
      playDeath,
      playTurnStart,
      playVictory,
      playDefeat,
    }),
    [
      playAttack,
      playHit,
      playMiss,
      playBlock,
      playDeath,
      playTurnStart,
      playVictory,
      playDefeat,
    ]
  );
}

/**
 * Hook para tocar sons de spell
 */
export function useSpellSounds() {
  const playCast = useCallback(
    (
      element:
        | "fire"
        | "ice"
        | "lightning"
        | "heal"
        | "buff"
        | "debuff"
        | "generic" = "generic"
    ) => {
      const soundMap: Record<string, SoundId> = {
        fire: "CAST_FIRE",
        ice: "CAST_ICE",
        lightning: "CAST_LIGHTNING",
        heal: "CAST_HEAL",
        buff: "CAST_BUFF",
        debuff: "CAST_DEBUFF",
        generic: "CAST_GENERIC",
      };
      audioService.play(soundMap[element] || "CAST_GENERIC");
    },
    []
  );

  return useMemo(() => ({ playCast }), [playCast]);
}

// ===== AUDIO STORE =====
// Store Zustand para estado reativo do áudio

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AudioSettings,
  SoundCategory,
} from "../../../shared/types/audio.types";
import { DEFAULT_AUDIO_SETTINGS } from "../../../shared/types/audio.types";
import { audioService } from "../services/audio.service";

interface AudioState extends AudioSettings {
  // Actions
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setAmbientVolume: (volume: number) => void;
  setVoiceVolume: (volume: number) => void;
  setCategoryVolume: (category: SoundCategory, volume: number) => void;
  toggleMute: () => void;
  resetToDefaults: () => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_AUDIO_SETTINGS,

      setMasterVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        set({ masterVolume: clamped });
        audioService.setMasterVolume(clamped);
      },

      setMusicVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        set({ musicVolume: clamped });
        audioService.setCategoryVolume("music", clamped);
      },

      setSfxVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        set({ sfxVolume: clamped });
        audioService.setCategoryVolume("ui", clamped);
      },

      setAmbientVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        set({ ambientVolume: clamped });
        audioService.setCategoryVolume("ambient", clamped);
      },

      setVoiceVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        set({ voiceVolume: clamped });
        audioService.setCategoryVolume("voice", clamped);
      },

      setCategoryVolume: (category, volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        switch (category) {
          case "music":
            get().setMusicVolume(clamped);
            break;
          case "ambient":
            get().setAmbientVolume(clamped);
            break;
          case "voice":
            get().setVoiceVolume(clamped);
            break;
          default:
            get().setSfxVolume(clamped);
        }
      },

      toggleMute: () => {
        const newMuted = !get().muted;
        set({ muted: newMuted });
        audioService.toggleMute();
      },

      resetToDefaults: () => {
        set(DEFAULT_AUDIO_SETTINGS);
        audioService.updateSettings(DEFAULT_AUDIO_SETTINGS);
      },
    }),
    {
      name: "boundless-audio",
      partialize: (state) => ({
        masterVolume: state.masterVolume,
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
        ambientVolume: state.ambientVolume,
        voiceVolume: state.voiceVolume,
        muted: state.muted,
      }),
    }
  )
);

// ===== AUDIO SERVICE =====
// Serviço singleton para gerenciamento de áudio usando Howler.js

import { Howl, Howler } from "howler";
import type {
  SoundDefinition,
  SoundPlayOptions,
  AudioSettings,
  SoundCategory,
} from "@boundless/shared/types/audio.types";
import { DEFAULT_AUDIO_SETTINGS } from "@boundless/shared/types/audio.types";
import { ALL_SOUNDS, type SoundId } from "@boundless/shared/data/sounds.data";

const STORAGE_KEY = "boundless-audio-settings";

class AudioService {
  private sounds: Map<string, Howl> = new Map();
  private currentMusic: Howl | null = null;
  private currentMusicId: string | null = null;
  private settings: AudioSettings;
  private initialized = false;

  constructor() {
    this.settings = this.loadSettings();
    this.applyGlobalSettings();
  }

  // ===== INICIALIZAÇÃO =====

  /**
   * Inicializa o serviço de áudio e pré-carrega sons essenciais
   */
  init(): void {
    if (this.initialized) return;

    // Pré-carregar sons marcados como preload
    Object.values(ALL_SOUNDS)
      .filter((sound) => sound.preload)
      .forEach((sound) => this.load(sound));

    this.initialized = true;
  }

  /**
   * Carrega um som no cache
   */
  load(definition: SoundDefinition): Howl {
    if (this.sounds.has(definition.id)) {
      return this.sounds.get(definition.id)!;
    }

    const howl = new Howl({
      src: Array.isArray(definition.src) ? definition.src : [definition.src],
      volume: this.calculateVolume(definition),
      loop: definition.loop ?? false,
      sprite: definition.sprite,
      preload: true,
      onloaderror: (_id, error) => {
        console.warn(
          `[AudioService] Failed to load sound: ${definition.id}`,
          error
        );
      },
    });

    this.sounds.set(definition.id, howl);
    return howl;
  }

  // ===== REPRODUÇÃO =====

  /**
   * Toca um som pelo ID do catálogo
   */
  play(soundId: SoundId, options?: SoundPlayOptions): number | null {
    const definition = ALL_SOUNDS[soundId];
    if (!definition) {
      console.warn(`[AudioService] Sound not found: ${soundId}`);
      return null;
    }

    return this.playSound(definition, options);
  }

  /**
   * Toca um som por definição
   */
  playSound(
    definition: SoundDefinition,
    options?: SoundPlayOptions
  ): number | null {
    if (this.settings.muted) return null;

    const howl = this.load(definition);
    const volume = options?.volume ?? this.calculateVolume(definition);

    // Aplicar opções
    if (options?.rate) howl.rate(options.rate);
    if (options?.loop !== undefined) howl.loop(options.loop);

    // Tocar (sprite ou normal)
    const playId = options?.sprite ? howl.play(options.sprite) : howl.play();

    // Aplicar volume
    howl.volume(volume, playId);

    // Fade se especificado
    if (options?.fade) {
      howl.fade(
        options.fade.from,
        options.fade.to,
        options.fade.duration,
        playId
      );
    }

    // Callback de fim
    if (options?.onEnd) {
      howl.once("end", options.onEnd, playId);
    }

    return playId;
  }

  /**
   * Para um som específico
   */
  stop(soundId: SoundId): void {
    const definition = ALL_SOUNDS[soundId];
    if (!definition) return;

    const howl = this.sounds.get(definition.id);
    if (howl) {
      howl.stop();
    }
  }

  /**
   * Pausa um som específico
   */
  pause(soundId: SoundId): void {
    const definition = ALL_SOUNDS[soundId];
    if (!definition) return;

    const howl = this.sounds.get(definition.id);
    if (howl) {
      howl.pause();
    }
  }

  // ===== MÚSICA =====

  /**
   * Toca uma música (para a anterior automaticamente)
   */
  playMusic(musicId: SoundId, fadeIn = true): void {
    const definition = ALL_SOUNDS[musicId];
    if (!definition || definition.category !== "music") {
      console.warn(`[AudioService] Invalid music: ${musicId}`);
      return;
    }

    // Se é a mesma música, não faz nada
    if (this.currentMusicId === definition.id && this.currentMusic?.playing()) {
      return;
    }

    // Para música atual com fade out
    this.stopMusic(true);

    // Carrega e toca nova música
    const howl = this.load(definition);
    this.currentMusic = howl;
    this.currentMusicId = definition.id;

    const targetVolume = this.calculateVolume(definition);

    if (fadeIn) {
      howl.volume(0);
      howl.play();
      howl.fade(0, targetVolume, 1000);
    } else {
      howl.volume(targetVolume);
      howl.play();
    }
  }

  /**
   * Para a música atual
   */
  stopMusic(fadeOut = true): void {
    if (!this.currentMusic) return;

    if (fadeOut && this.currentMusic.playing()) {
      const currentVolume = this.currentMusic.volume();
      this.currentMusic.fade(currentVolume, 0, 500);
      this.currentMusic.once("fade", () => {
        this.currentMusic?.stop();
      });
    } else {
      this.currentMusic.stop();
    }

    this.currentMusic = null;
    this.currentMusicId = null;
  }

  /**
   * Pausa/retoma a música atual
   */
  toggleMusic(): void {
    if (!this.currentMusic) return;

    if (this.currentMusic.playing()) {
      this.currentMusic.pause();
    } else {
      this.currentMusic.play();
    }
  }

  // ===== CONFIGURAÇÕES =====

  /**
   * Atualiza configurações de áudio
   */
  updateSettings(newSettings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    this.applyGlobalSettings();
    this.updateAllVolumes();
  }

  /**
   * Retorna as configurações atuais
   */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Muta/desmuta o áudio global
   */
  toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    this.saveSettings();
    this.applyGlobalSettings();
    return this.settings.muted;
  }

  /**
   * Define o volume master
   */
  setMasterVolume(volume: number): void {
    this.updateSettings({ masterVolume: Math.max(0, Math.min(1, volume)) });
  }

  /**
   * Define o volume de uma categoria
   */
  setCategoryVolume(category: SoundCategory, volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    switch (category) {
      case "music":
        this.updateSettings({ musicVolume: clampedVolume });
        break;
      case "ambient":
        this.updateSettings({ ambientVolume: clampedVolume });
        break;
      case "voice":
        this.updateSettings({ voiceVolume: clampedVolume });
        break;
      default:
        this.updateSettings({ sfxVolume: clampedVolume });
    }
  }

  // ===== UTILITÁRIOS =====

  /**
   * Calcula o volume final baseado nas configurações
   */
  private calculateVolume(definition: SoundDefinition): number {
    const baseVolume = definition.volume ?? 1;
    const master = this.settings.masterVolume;

    let categoryMultiplier = 1;
    switch (definition.category) {
      case "music":
        categoryMultiplier = this.settings.musicVolume;
        break;
      case "ambient":
        categoryMultiplier = this.settings.ambientVolume;
        break;
      case "voice":
        categoryMultiplier = this.settings.voiceVolume;
        break;
      default:
        categoryMultiplier = this.settings.sfxVolume;
    }

    return baseVolume * master * categoryMultiplier;
  }

  /**
   * Aplica configurações globais do Howler
   */
  private applyGlobalSettings(): void {
    Howler.mute(this.settings.muted);
  }

  /**
   * Atualiza volumes de todos os sons carregados
   */
  private updateAllVolumes(): void {
    // Atualiza música atual
    if (this.currentMusic && this.currentMusicId) {
      const definition = Object.values(ALL_SOUNDS).find(
        (s) => s.id === this.currentMusicId
      );
      if (definition) {
        this.currentMusic.volume(this.calculateVolume(definition));
      }
    }

    // Atualiza outros sons em loop (ambient, etc)
    this.sounds.forEach((howl, id) => {
      if (howl.playing() && howl.loop()) {
        const definition = Object.values(ALL_SOUNDS).find((s) => s.id === id);
        if (definition) {
          howl.volume(this.calculateVolume(definition));
        }
      }
    });
  }

  /**
   * Salva configurações no localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      console.warn("[AudioService] Failed to save settings");
    }
  }

  /**
   * Carrega configurações do localStorage
   */
  private loadSettings(): AudioSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      console.warn("[AudioService] Failed to load settings");
    }
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  /**
   * Libera recursos de um som
   */
  unload(soundId: SoundId): void {
    const definition = ALL_SOUNDS[soundId];
    if (!definition) return;

    const howl = this.sounds.get(definition.id);
    if (howl) {
      howl.unload();
      this.sounds.delete(definition.id);
    }
  }

  /**
   * Libera todos os recursos
   */
  unloadAll(): void {
    this.stopMusic(false);
    this.sounds.forEach((howl) => howl.unload());
    this.sounds.clear();
  }
}

// Singleton export
export const audioService = new AudioService();

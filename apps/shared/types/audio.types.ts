// ===== AUDIO TYPES =====
// Tipos para o sistema de áudio do jogo

export type SoundCategory =
  | "ui" // Sons de interface (cliques, hover, notificações)
  | "combat" // Sons de combate (ataques, skills, impactos)
  | "ambient" // Sons ambiente (vento, chuva, floresta)
  | "music" // Músicas de fundo
  | "voice" // Vozes/falas
  | "spell"; // Sons de magias

export interface SoundDefinition {
  id: string;
  src: string | string[]; // Pode ter múltiplos formatos (mp3, ogg, wav)
  category: SoundCategory;
  volume?: number; // 0-1, padrão 1
  loop?: boolean; // Padrão false
  sprite?: Record<string, [number, number]>; // Para spritesheets de áudio
  preload?: boolean; // Se deve pré-carregar
}

export interface SoundPlayOptions {
  volume?: number; // Override do volume (0-1)
  rate?: number; // Velocidade (0.5-4)
  loop?: boolean; // Override do loop
  fade?: {
    from: number;
    to: number;
    duration: number; // em ms
  };
  sprite?: string; // Nome do sprite a tocar
  onEnd?: () => void; // Callback ao terminar
}

export interface AudioSettings {
  masterVolume: number; // Volume geral (0-1)
  musicVolume: number; // Volume de música (0-1)
  sfxVolume: number; // Volume de efeitos (0-1)
  ambientVolume: number; // Volume de ambiente (0-1)
  voiceVolume: number; // Volume de vozes (0-1)
  muted: boolean; // Mudo global
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 1.0,
  ambientVolume: 0.5,
  voiceVolume: 1.0,
  muted: false,
};

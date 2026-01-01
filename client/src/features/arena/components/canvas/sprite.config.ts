/**
 * Configuração de sprites para personagens no sistema de batalha e seleção de avatar.
 *
 * ESTRUTURA DE PASTAS:
 * /sprites/Characters/{heroId}/Hero_{heroId}_{animation}.png
 *
 * Exemplo: /sprites/Characters/7/Hero_007_Walk.png
 *
 * Cada sprite é um sheet horizontal com frames 32x32.
 */

/** Animações disponíveis para cada personagem */
export type SpriteAnimation =
  | "Idle"
  | "Walk"
  | "Sword_1"
  | "Sword_2"
  | "Bow"
  | "Staff"
  | "Damage"
  | "Dead"
  | "Jump"
  | "Fall"
  | "Pull"
  | "Push";

/** Estados de animação para o sistema de combate */
export type CombatAnimationState =
  | "idle"
  | "walking"
  | "attacking"
  | "damaged"
  | "dead";

/** Total de personagens disponíveis (pastas 1-15) */
export const TOTAL_HEROES = 15;

/** Lista de IDs de heróis disponíveis (1 a 15) */
export const HERO_IDS: number[] = Array.from(
  { length: TOTAL_HEROES },
  (_, i) => i + 1
);

/** Mapeamento de estado de combate para animação de sprite */
export const COMBAT_STATE_TO_ANIMATION: Record<
  CombatAnimationState,
  SpriteAnimation
> = {
  idle: "Idle",
  walking: "Walk",
  attacking: "Sword_1", // Default melee attack
  damaged: "Damage",
  dead: "Dead",
};

/** Configuração de cada animação (frames e duração) */
export interface AnimationConfig {
  /** Nome do arquivo (sem extensão) */
  fileName: SpriteAnimation;
  /** Número de frames na animação */
  frameCount: number;
  /** Duração de cada frame em ms */
  frameDuration: number;
  /** Se a animação deve repetir (loop) */
  loop: boolean;
}

/** Configurações de todas as animações */
export const ANIMATION_CONFIGS: Record<SpriteAnimation, AnimationConfig> = {
  // Ritmo levemente mais lento para leitura clara das animações
  Idle: { fileName: "Idle", frameCount: 4, frameDuration: 500, loop: true },
  Walk: { fileName: "Walk", frameCount: 6, frameDuration: 140, loop: true },
  Sword_1: {
    fileName: "Sword_1",
    frameCount: 6,
    frameDuration: 120,
    loop: false,
  },
  Sword_2: {
    fileName: "Sword_2",
    frameCount: 6,
    frameDuration: 120,
    loop: false,
  },
  Bow: { fileName: "Bow", frameCount: 6, frameDuration: 130, loop: false },
  Staff: { fileName: "Staff", frameCount: 6, frameDuration: 130, loop: false },
  Damage: {
    fileName: "Damage",
    frameCount: 3,
    frameDuration: 200,
    loop: false,
  },
  Dead: { fileName: "Dead", frameCount: 3, frameDuration: 260, loop: false },
  Jump: { fileName: "Jump", frameCount: 4, frameDuration: 130, loop: false },
  Fall: { fileName: "Fall", frameCount: 2, frameDuration: 130, loop: false },
  Pull: { fileName: "Pull", frameCount: 4, frameDuration: 130, loop: false },
  Push: { fileName: "Push", frameCount: 4, frameDuration: 130, loop: false },
};

/** Tamanho de cada frame no sprite sheet */
export const FRAME_SIZE = 32;

/** Direções possíveis para o sprite */
export type SpriteDirection = "left" | "right";

/**
 * Interface de configuração completa de um sprite de herói
 */
export interface HeroSpriteConfig {
  /** ID do herói (1-15) */
  heroId: number;
  /** Caminho base para os sprites */
  basePath: string;
  /** Prefixo do arquivo (ex: "Hero_001") */
  filePrefix: string;
}

/**
 * Gera a configuração de sprite para um herói
 */
export function getHeroSpriteConfig(heroId: number): HeroSpriteConfig {
  const paddedId = String(heroId).padStart(3, "0");
  return {
    heroId,
    basePath: `/sprites/Characters/${heroId}`,
    filePrefix: `Hero_${paddedId}`,
  };
}

/**
 * Gera o caminho completo para um arquivo de animação
 */
export function getAnimationPath(
  heroId: number,
  animation: SpriteAnimation
): string {
  const config = getHeroSpriteConfig(heroId);
  return `${config.basePath}/${config.filePrefix}_${animation}.png`;
}

/**
 * Gera o caminho para o sprite estático (thumbnail)
 */
export function getHeroThumbnailPath(heroId: number): string {
  const config = getHeroSpriteConfig(heroId);
  return `${config.basePath}/${config.filePrefix}.png`;
}

/**
 * Converte um avatar string antigo ("[n].png") para novo formato (heroId number)
 * ou retorna um ID aleatório se inválido
 */
export function parseAvatarToHeroId(avatar?: string): number {
  if (!avatar) return 1;

  // Novo formato: já é um número como string
  const numericId = parseInt(avatar, 10);
  if (!isNaN(numericId) && numericId >= 1 && numericId <= TOTAL_HEROES) {
    return numericId;
  }

  // Formato antigo: "[n].png" - mapear para 1-15
  const match = avatar.match(/\[(\d+)\]\.png/);
  if (match) {
    const oldId = parseInt(match[1], 10);
    // Mapear IDs antigos para novos (mod 15 + 1 para ficar entre 1-15)
    return ((oldId - 1) % TOTAL_HEROES) + 1;
  }

  // Default
  return 1;
}

/**
 * Converte heroId para string de avatar (para salvar no banco)
 */
export function heroIdToAvatarString(heroId: number): string {
  return String(heroId);
}

/**
 * Obtém um heroId aleatório
 */
export function getRandomHeroId(): number {
  return Math.floor(Math.random() * TOTAL_HEROES) + 1;
}

/**
 * Verifica se um heroId é válido
 */
export function isValidHeroId(id: number): boolean {
  return Number.isInteger(id) && id >= 1 && id <= TOTAL_HEROES;
}

/**
 * Mapeamento de classCode para heroId preferido
 * Inclui fallbacks usados pelo canvas para unidades sem avatar
 */
export const CLASS_CODE_TO_HERO_ID: Record<string, number> = {
  // Classes principais
  WARRIOR: 1,
  CLERIC: 5,
  WIZARD: 10,
  // Fallbacks do canvas (para unidades sem avatar/classCode)
  swordman: 1, // Unidade aliada default
  mage: 10, // Unidade inimiga default
  // Variações lowercase
  warrior: 1,
  cleric: 5,
  wizard: 10,
};

/**
 * Obtém heroId baseado em classCode ou avatar
 */
export function getHeroIdForUnit(avatar?: string, classCode?: string): number {
  // Prioridade 1: avatar direto
  if (avatar) {
    return parseAvatarToHeroId(avatar);
  }

  // Prioridade 2: classCode
  if (classCode && CLASS_CODE_TO_HERO_ID[classCode]) {
    return CLASS_CODE_TO_HERO_ID[classCode];
  }

  // Default
  return 1;
}

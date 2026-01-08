import { useEffect, useRef, useState, useCallback } from "react";
import {
  HERO_IDS,
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  getAnimationPath,
  getHeroIdForUnit,
  type SpriteAnimation,
  type CombatAnimationState,
  COMBAT_STATE_TO_ANIMATION,
} from "./sprite.config";

/** Imagem carregada com metadados */
interface LoadedImage {
  image: HTMLImageElement;
  loaded: boolean;
}

/** Estado de animação de uma unidade */
export interface UnitAnimationState {
  heroId: number;
  currentAnimation: SpriteAnimation;
  frameIndex: number;
  lastFrameTime: number;
  /** Callback quando animação não-loop termina */
  onComplete?: () => void;
}

/** Cache de imagens carregadas: heroId -> animation -> LoadedImage */
type ImageCache = Map<number, Map<SpriteAnimation, LoadedImage>>;

interface UseSpritesReturn {
  /** Verifica se todos os sprites essenciais estão carregados */
  allLoaded: boolean;
  /** Obtém a imagem para um herói e animação específicos */
  getImage: (
    heroId: number,
    animation: SpriteAnimation
  ) => HTMLImageElement | null;
  /** Obtém heroId baseado em avatar ou classCode */
  getHeroId: (avatar?: string, classCode?: string) => number;
  /** Obtém sprite pronto para desenho (com image e config) */
  getSprite: (
    spriteType: string,
    animation?: SpriteAnimation
  ) => {
    image: HTMLImageElement;
    config: {
      frameWidth: number;
      frameHeight: number;
      frameCount: number;
      row: number;
      loop: boolean;
    };
  } | null;
  /** Frame index global para animações idle (ref para evitar re-renders) */
  frameIndexRef: React.MutableRefObject<number>;
  /** Timestamp da última mudança de frame */
  lastFrameChangeRef: React.MutableRefObject<number>;
}

/** Animações essenciais que são pré-carregadas */
const PRELOAD_ANIMATIONS: SpriteAnimation[] = [
  "Idle",
  "Walk",
  "Sword_1",
  "Dead",
  "Damage",
];

/**
 * Hook para carregar e gerenciar sprites de personagens
 * Carrega animações essenciais no início e outras sob demanda
 */
export function useSprites(): UseSpritesReturn {
  const imageCacheRef = useRef<ImageCache>(new Map());
  const [allLoaded, setAllLoaded] = useState(false);
  const frameIndexRef = useRef(0);
  const lastFrameChangeRef = useRef(0);

  // Carregar animações essenciais para todos os heróis
  useEffect(() => {
    let totalToLoad = HERO_IDS.length * PRELOAD_ANIMATIONS.length;
    let loadedCount = 0;

    HERO_IDS.forEach((heroId) => {
      // Inicializar mapa para este herói
      if (!imageCacheRef.current.has(heroId)) {
        imageCacheRef.current.set(heroId, new Map());
      }
      const heroCache = imageCacheRef.current.get(heroId)!;

      PRELOAD_ANIMATIONS.forEach((animation) => {
        const path = getAnimationPath(heroId, animation);
        const img = new Image();

        const loadedImage: LoadedImage = { image: img, loaded: false };
        heroCache.set(animation, loadedImage);

        img.onload = () => {
          loadedImage.loaded = true;
          loadedCount++;
          if (loadedCount >= totalToLoad) {
            setAllLoaded(true);
          }
        };

        img.onerror = () => {
          console.warn(`Falha ao carregar sprite: ${path}`);
          loadedCount++;
          if (loadedCount >= totalToLoad) {
            setAllLoaded(true);
          }
        };

        img.src = path;
      });
    });

    // Inicializar timestamp
    lastFrameChangeRef.current = performance.now();
  }, []);

  // Obter imagem (carrega sob demanda se necessário)
  const getImage = useCallback(
    (heroId: number, animation: SpriteAnimation): HTMLImageElement | null => {
      const heroCache = imageCacheRef.current.get(heroId);

      if (!heroCache) {
        // Herói não existe no cache, criar
        imageCacheRef.current.set(heroId, new Map());
        return null;
      }

      const cached = heroCache.get(animation);

      if (cached?.loaded) {
        return cached.image;
      }

      // Carregar sob demanda se não existe
      if (!cached) {
        const path = getAnimationPath(heroId, animation);
        const img = new Image();
        const loadedImage: LoadedImage = { image: img, loaded: false };
        heroCache.set(animation, loadedImage);

        img.onload = () => {
          loadedImage.loaded = true;
        };
        img.onerror = () => {
          console.warn(`Falha ao carregar sprite sob demanda: ${path}`);
        };
        img.src = path;
      }

      // Fallback para Idle se animação não carregada ainda
      if (animation !== "Idle") {
        const idleCached = heroCache.get("Idle");
        if (idleCached?.loaded) {
          return idleCached.image;
        }
      }

      return null;
    },
    []
  );

  // Wrapper para getHeroIdForUnit
  const getHeroId = useCallback(
    (avatar?: string, classCode?: string): number => {
      return getHeroIdForUnit(avatar, classCode);
    },
    []
  );

  /**
   * Obtém sprite pronto para desenho no canvas
   * @param spriteType - avatar string ou classCode
   * @param animation - animação desejada (default: "Idle")
   * @returns Objeto com imagem e configuração ou null se não carregado
   */
  const getSprite = useCallback(
    (
      spriteType: string,
      animation: SpriteAnimation = "Idle"
    ): {
      image: HTMLImageElement;
      config: {
        frameWidth: number;
        frameHeight: number;
        frameCount: number;
        row: number;
        loop: boolean;
      };
    } | null => {
      // Converter spriteType para heroId
      const heroId = getHeroIdForUnit(spriteType, spriteType);

      // Obter imagem da animação
      const image = getImage(heroId, animation);

      if (!image) {
        return null;
      }

      // Configuração da animação (todos os sprites usam 32x32 frames, row 0)
      const animConfig = ANIMATION_CONFIGS[animation];
      return {
        image,
        config: {
          frameWidth: FRAME_SIZE,
          frameHeight: FRAME_SIZE,
          frameCount: animConfig.frameCount,
          row: 0,
          loop: animConfig.loop,
        },
      };
    },
    [getImage]
  );

  return {
    allLoaded,
    getImage,
    getHeroId,
    getSprite,
    frameIndexRef,
    lastFrameChangeRef,
  };
}

/**
 * Atualiza o frame de animação global
 * Deve ser chamado dentro do loop de render do canvas
 * @returns true se o frame mudou (precisa redesenhar sprites)
 */
export function updateSpriteFrame(
  frameIndexRef: React.MutableRefObject<number>,
  lastFrameChangeRef: React.MutableRefObject<number>,
  currentTime: number
): boolean {
  const elapsed = currentTime - lastFrameChangeRef.current;
  const idleConfig = ANIMATION_CONFIGS.Idle;

  if (elapsed >= idleConfig.frameDuration) {
    frameIndexRef.current = (frameIndexRef.current + 1) % idleConfig.frameCount;
    lastFrameChangeRef.current = currentTime;
    return true;
  }

  return false;
}

/**
 * Hook para gerenciar animações individuais de unidades no combate
 */
export function useUnitAnimationStates() {
  const statesRef = useRef<Map<string, UnitAnimationState>>(new Map());

  /** Define ou atualiza o estado de animação de uma unidade */
  const setAnimation = useCallback(
    (
      unitId: string,
      heroId: number,
      state: CombatAnimationState,
      onComplete?: () => void
    ) => {
      const animation = COMBAT_STATE_TO_ANIMATION[state];
      const config = ANIMATION_CONFIGS[animation];

      statesRef.current.set(unitId, {
        heroId,
        currentAnimation: animation,
        frameIndex: 0,
        lastFrameTime: performance.now(),
        onComplete: config.loop ? undefined : onComplete,
      });
    },
    []
  );

  /** Atualiza frames de todas as animações ativas */
  const updateAnimations = useCallback((currentTime: number) => {
    statesRef.current.forEach((state) => {
      const config = ANIMATION_CONFIGS[state.currentAnimation];
      const elapsed = currentTime - state.lastFrameTime;

      if (elapsed >= config.frameDuration) {
        const nextFrame = state.frameIndex + 1;

        if (nextFrame >= config.frameCount) {
          if (config.loop) {
            state.frameIndex = 0;
          } else {
            // Animação terminou
            state.onComplete?.();
            // Voltar para idle
            state.currentAnimation = "Idle";
            state.frameIndex = 0;
            state.onComplete = undefined;
          }
        } else {
          state.frameIndex = nextFrame;
        }

        state.lastFrameTime = currentTime;
      }
    });
  }, []);

  /** Obtém estado atual de uma unidade */
  const getState = useCallback(
    (unitId: string): UnitAnimationState | undefined => {
      return statesRef.current.get(unitId);
    },
    []
  );

  /** Remove estado de uma unidade */
  const removeState = useCallback((unitId: string) => {
    statesRef.current.delete(unitId);
  }, []);

  return {
    setAnimation,
    updateAnimations,
    getState,
    removeState,
  };
}

/** Constantes exportadas para uso no canvas */
export { FRAME_SIZE, ANIMATION_CONFIGS };

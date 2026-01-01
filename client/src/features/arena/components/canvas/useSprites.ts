import { useEffect, useRef, useState, useCallback } from "react";
import {
  SPRITE_SHEETS,
  type SpriteConfig,
  getSpriteConfig,
} from "./sprite.config";

interface LoadedSprite {
  image: HTMLImageElement;
  config: SpriteConfig;
}

interface UseSpritesReturn {
  sprites: Map<string, LoadedSprite>;
  allLoaded: boolean;
  getSprite: (unitType?: string) => LoadedSprite | null;
  /** Frame atual da animação (ref para evitar re-renders) */
  frameIndexRef: React.MutableRefObject<number>;
  /** Timestamp da última mudança de frame (para otimização) */
  lastFrameChangeRef: React.MutableRefObject<number>;
}

// Configuração de animação de sprites
const SPRITE_ANIMATION = {
  /** Duração de cada frame em ms (200ms = 5 FPS para sprites) */
  frameDuration: 200,
  /** Número total de frames na animação idle */
  totalFrames: 4,
} as const;

/**
 * Hook para carregar e gerenciar sprites de unidades
 * Usa refs ao invés de state para frameIndex para evitar re-renders desnecessários
 */
export function useSprites(): UseSpritesReturn {
  const spritesRef = useRef<Map<string, LoadedSprite>>(new Map());
  const [allLoaded, setAllLoaded] = useState(false);
  const frameIndexRef = useRef(0);
  const lastFrameChangeRef = useRef(0);

  // Carregar todos os sprites
  useEffect(() => {
    const spriteKeys = Object.keys(SPRITE_SHEETS);
    let loadedCount = 0;

    spriteKeys.forEach((key) => {
      const config = SPRITE_SHEETS[key];
      const img = new Image();

      img.onload = () => {
        spritesRef.current.set(key, { image: img, config });
        loadedCount++;

        if (loadedCount === spriteKeys.length) {
          setAllLoaded(true);
        }
      };

      img.onerror = () => {
        console.error(`Falha ao carregar sprite: ${config.src}`);
        loadedCount++;

        if (loadedCount === spriteKeys.length) {
          setAllLoaded(true);
        }
      };

      img.src = config.src;
    });

    return () => {
      // Cleanup não necessário para imagens
    };
  }, []);

  // Atualizar frame index baseado no tempo (chamado pelo loop de render principal)
  // NÃO usa requestAnimationFrame próprio - deixa o canvas principal controlar
  useEffect(() => {
    if (!allLoaded) return;

    // Apenas inicializa o timestamp
    lastFrameChangeRef.current = performance.now();
  }, [allLoaded]);

  // Função para obter sprite por ID de avatar ou classCode
  const getSprite = useCallback(
    (spriteIdentifier?: string): LoadedSprite | null => {
      // Obtém a configuração do sprite
      const config = getSpriteConfig(spriteIdentifier);

      // Se é um ID válido ([n].png), busca diretamente
      if (spriteIdentifier && spritesRef.current.has(spriteIdentifier)) {
        return spritesRef.current.get(spriteIdentifier) || null;
      }

      // Busca pelo src da configuração
      for (const [, sprite] of spritesRef.current.entries()) {
        if (sprite.config.src === config.src) {
          return sprite;
        }
      }

      // Fallback para o primeiro sprite
      return spritesRef.current.get("[1].png") || null;
    },
    []
  );

  return {
    sprites: spritesRef.current,
    allLoaded,
    getSprite,
    frameIndexRef,
    lastFrameChangeRef,
  };
}

/**
 * Atualiza o frame de animação dos sprites
 * Deve ser chamado dentro do loop de render do canvas
 * @returns true se o frame mudou (precisa redesenhar sprites)
 */
export function updateSpriteFrame(
  frameIndexRef: React.MutableRefObject<number>,
  lastFrameChangeRef: React.MutableRefObject<number>,
  currentTime: number
): boolean {
  const elapsed = currentTime - lastFrameChangeRef.current;

  if (elapsed >= SPRITE_ANIMATION.frameDuration) {
    frameIndexRef.current =
      (frameIndexRef.current + 1) % SPRITE_ANIMATION.totalFrames;
    lastFrameChangeRef.current = currentTime;
    return true;
  }

  return false;
}

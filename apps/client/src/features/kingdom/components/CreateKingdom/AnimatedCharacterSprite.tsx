import React, { useEffect, useRef, useState } from "react";
import {
  HERO_IDS,
  TOTAL_HEROES,
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  getAnimationPath,
  parseAvatarToHeroId,
  heroIdToAvatarString,
  type SpriteAnimation,
  type SpriteDirection,
} from "../../../battle/components/canvas";

// Re-export para uso externo
export { HERO_IDS, TOTAL_HEROES, parseAvatarToHeroId, heroIdToAvatarString };
export type { SpriteAnimation, SpriteDirection };

interface AnimatedCharacterSpriteProps {
  /** ID do herói (1-15) */
  heroId: number;
  /** Tamanho do sprite em pixels (ignorado se autoFill=true) */
  size?: number;
  /** Animação a exibir */
  animation?: SpriteAnimation;
  /** Direção do sprite (left = espelhado) */
  direction?: SpriteDirection;
  /** Classes CSS adicionais */
  className?: string;
  /** Callback quando animação não-loop termina */
  onAnimationEnd?: () => void;
}

/**
 * Componente unificado para exibir sprites de personagens animados.
 * ÚNICO componente responsável por renderizar personagens em toda a aplicação.
 *
 * Usado em:
 * - Seletor de avatar (criação de reino/tropas)
 * - Canvas de batalha
 * - Qualquer outro lugar que precise exibir personagens
 *
 * Com autoFill=true, o sprite preenche 100% do container pai e se centraliza.
 */
export const AnimatedCharacterSprite: React.FC<
  AnimatedCharacterSpriteProps
> = ({
  heroId,
  size = 64,
  animation = "Idle",
  direction = "right",
  className = "",
  onAnimationEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const loadedPathRef = useRef<string>("");
  const lastFrameTimeRef = useRef(0);
  const animationEndCalledRef = useRef(false);
  const [canvasSize] = useState(size);

  const config = ANIMATION_CONFIGS[animation];
  const { frameCount, frameDuration, loop } = config;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Calcular caminho do sprite
    const spritePath = getAnimationPath(heroId, animation);

    // Recarregar se mudou o sprite
    if (loadedPathRef.current !== spritePath) {
      const img = new Image();
      img.src = spritePath;
      imageRef.current = img;
      loadedPathRef.current = spritePath;
      frameRef.current = 0;
      animationEndCalledRef.current = false;
    }

    const img = imageRef.current;
    if (!img) return;

    let animationId: number;

    const draw = (timestamp: number) => {
      if (!ctx || !img.complete) {
        animationId = requestAnimationFrame(draw);
        return;
      }

      // Atualizar frame baseado no tempo
      if (timestamp - lastFrameTimeRef.current >= frameDuration) {
        const nextFrame = frameRef.current + 1;

        if (nextFrame >= frameCount) {
          if (loop) {
            frameRef.current = 0;
          } else {
            // Manter no último frame
            frameRef.current = frameCount - 1;
            // Chamar callback de fim de animação
            if (!animationEndCalledRef.current) {
              animationEndCalledRef.current = true;
              onAnimationEnd?.();
            }
          }
        } else {
          frameRef.current = nextFrame;
        }

        lastFrameTimeRef.current = timestamp;
      }

      // Limpar canvas
      ctx.clearRect(0, 0, canvasSize, canvasSize);

      // Calcular posição no sprite sheet (frames horizontais)
      const srcX = frameRef.current * FRAME_SIZE;
      const srcY = 0;

      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // Aplicar flip se direção é esquerda
      if (direction === "left") {
        ctx.translate(canvasSize, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(
        img,
        srcX,
        srcY,
        FRAME_SIZE,
        FRAME_SIZE,
        0,
        0,
        canvasSize,
        canvasSize
      );

      ctx.restore();

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [
    heroId,
    canvasSize,
    animation,
    direction,
    frameCount,
    frameDuration,
    loop,
    onAnimationEnd,
  ]);

  // Modo normal: canvas com tamanho fixo
  return (
    <div className="mb-7" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        className={className}
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
};

interface AvatarSelectorProps {
  /** Avatar selecionado atualmente (heroId como string "1"-"15") */
  selectedAvatar: string;
  /** Callback quando avatar muda */
  onSelectAvatar: (avatarId: string) => void;
  /** Tamanho do sprite exibido */
  spriteSize?: number;
  /** Título do seletor */
  title?: string;
  /** Avatares já em uso que não podem ser selecionados (exceto o atual) */
  usedAvatars?: string[];
}

/**
 * Seletor de avatar genérico com setas para navegar entre sprites animados
 * Usa os novos sprites Hero_001 a Hero_015
 * Pula automaticamente avatares já em uso por outras entidades do reino
 */
export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  selectedAvatar,
  onSelectAvatar,
  spriteSize = 128,
  title = "Aparência",
  usedAvatars = [],
}) => {
  // Converter avatar para heroId
  const currentHeroId = parseAvatarToHeroId(selectedAvatar);
  const currentIndex = HERO_IDS.indexOf(currentHeroId);
  const validIndex = currentIndex >= 0 ? currentIndex : 0;

  // Avatares disponíveis (não usados por outros, ou é o atual)
  const isAvatarAvailable = (heroId: number): boolean => {
    const avatarString = heroIdToAvatarString(heroId);
    // Disponível se: não está na lista de usados OU é o avatar atual
    return (
      !usedAvatars.includes(avatarString) || avatarString === selectedAvatar
    );
  };

  // Contar avatares disponíveis
  const availableCount = HERO_IDS.filter(isAvatarAvailable).length;

  const findNextAvailable = (startIndex: number, direction: 1 | -1): number => {
    let index = startIndex;
    let attempts = 0;
    const maxAttempts = HERO_IDS.length;

    while (attempts < maxAttempts) {
      index = (index + direction + HERO_IDS.length) % HERO_IDS.length;
      if (isAvatarAvailable(HERO_IDS[index])) {
        return index;
      }
      attempts++;
    }

    // Se não encontrou, retorna o atual (todos bloqueados)
    return validIndex;
  };

  const goToPrev = () => {
    const newIndex = findNextAvailable(validIndex, -1);
    onSelectAvatar(heroIdToAvatarString(HERO_IDS[newIndex]));
  };

  const goToNext = () => {
    const newIndex = findNextAvailable(validIndex, 1);
    onSelectAvatar(heroIdToAvatarString(HERO_IDS[newIndex]));
  };

  // Desabilitar navegação se só tem 1 ou menos disponíveis
  const canNavigate = availableCount > 1;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Título */}
      <label className="text-sm font-semibold text-white">{title}</label>

      {/* Sprite animado com setas */}
      <div className="relative flex items-center gap-4">
        {/* Seta esquerda */}
        <button
          type="button"
          onClick={goToPrev}
          disabled={!canNavigate}
          className={`p-2 rounded-full transition-all border border-slate-500/30
                     ${
                       canNavigate
                         ? "bg-slate-700/50 hover:bg-slate-600/70 text-white hover:scale-110 active:scale-95"
                         : "bg-slate-800/30 text-slate-600 cursor-not-allowed"
                     }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Container do sprite */}
        <div
          className="relative rounded-xl overflow-hidden bg-slate-900/80 border border-slate-600"
          style={{ width: spriteSize + 16, height: spriteSize + 16 }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatedCharacterSprite
              heroId={HERO_IDS[validIndex]}
              size={spriteSize}
              animation="Idle"
            />
          </div>
        </div>

        {/* Seta direita */}
        <button
          type="button"
          onClick={goToNext}
          disabled={!canNavigate}
          className={`p-2 rounded-full transition-all border border-slate-500/30
                     ${
                       canNavigate
                         ? "bg-slate-700/50 hover:bg-slate-600/70 text-white hover:scale-110 active:scale-95"
                         : "bg-slate-800/30 text-slate-600 cursor-not-allowed"
                     }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Contador - mostra disponíveis */}
      <p className="text-xs text-slate-400">
        {availableCount} / {HERO_IDS.length} disponíveis
      </p>
    </div>
  );
};

/**
 * Seletor de avatar compacto (grid de miniaturas)
 */
interface AvatarGridSelectorProps {
  /** Avatar selecionado atualmente */
  selectedAvatar: string;
  /** Callback quando avatar muda */
  onSelectAvatar: (avatarId: string) => void;
  /** Número de colunas no grid */
  columns?: number;
  /** Tamanho de cada miniatura */
  thumbnailSize?: number;
  /** Avatares já em uso que não podem ser selecionados (exceto o atual) */
  usedAvatars?: string[];
}

export const AvatarGridSelector: React.FC<AvatarGridSelectorProps> = ({
  selectedAvatar,
  onSelectAvatar,
  columns = 5,
  thumbnailSize = 48,
  usedAvatars = [],
}) => {
  const currentHeroId = parseAvatarToHeroId(selectedAvatar);

  const isAvatarAvailable = (heroId: number): boolean => {
    const avatarString = heroIdToAvatarString(heroId);
    return (
      !usedAvatars.includes(avatarString) || avatarString === selectedAvatar
    );
  };

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {HERO_IDS.map((heroId) => {
        const isAvailable = isAvatarAvailable(heroId);
        const isSelected = currentHeroId === heroId;

        return (
          <button
            key={heroId}
            type="button"
            onClick={() =>
              isAvailable && onSelectAvatar(heroIdToAvatarString(heroId))
            }
            disabled={!isAvailable}
            className={`p-1 rounded border-2 transition-all relative ${
              isSelected
                ? "border-amber-500 bg-amber-500/20"
                : isAvailable
                ? "border-slate-600 hover:border-slate-500"
                : "border-slate-700 bg-slate-900/80 opacity-40 cursor-not-allowed"
            }`}
          >
            <AnimatedCharacterSprite
              heroId={heroId}
              size={thumbnailSize}
              animation="Idle"
            />
            {/* Indicador de "em uso" */}
            {!isAvailable && !isSelected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                <span className="text-xs text-red-400 font-bold">EM USO</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

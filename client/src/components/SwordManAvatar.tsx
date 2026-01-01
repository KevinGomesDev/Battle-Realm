import React, { useEffect, useRef } from "react";

// Caminho público do sprite (funciona em dev e prod)
const SWORDMAN_SPRITE_URL = "/sprites/Characters/MiniSwordMan.png";

interface SwordManAvatarProps {
  /** Tamanho do avatar em pixels */
  size?: number;
  /** Animação a exibir: 0=idle, 1=walk, 2=attack, 3=hurt */
  animation?: number;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Avatar animado do SwordMan usando sprite sheet
 * Sprite: 192x192 pixels total
 * Layout: 6 colunas x 6 linhas
 * Frame size: 32x32 pixels
 *
 * Linhas de animação:
 * 0 = Idle (parado) - APENAS 4 FRAMES VÁLIDOS
 * 1 = Walk (andando)
 * 2 = Attack (atacando)
 * 3 = Hurt (tomando dano)
 * 4 = Death (morrendo)
 * 5 = Special (especial)
 */
export const SwordManAvatar: React.FC<SwordManAvatarProps> = ({
  size = 40,
  animation = 0,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Configuração do sprite MiniSwordMan.png (192x192)
  const FRAME_WIDTH = 32;
  const FRAME_HEIGHT = 32;
  // Idle tem apenas 4 frames válidos, outras animações têm 6
  const FRAME_COUNT = animation === 0 ? 4 : 6;

  // Velocidades diferentes por tipo de animação
  const animationSpeeds: Record<number, number> = {
    0: 200, // Idle - mais lento
    1: 120, // Walk - médio
    2: 100, // Attack - rápido
    3: 150, // Hurt - médio
    4: 200, // Death - lento
    5: 120, // Special - médio
  };

  const frameDuration = animationSpeeds[animation] || 150;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Carregar imagem
    if (!imageRef.current) {
      const img = new Image();
      img.src = SWORDMAN_SPRITE_URL;
      imageRef.current = img;
    }

    const img = imageRef.current;
    let animationId: number;
    let lastTime = 0;

    const draw = (timestamp: number) => {
      if (!ctx || !img.complete) {
        animationId = requestAnimationFrame(draw);
        return;
      }

      // Atualizar frame baseado no tempo
      if (timestamp - lastTime >= frameDuration) {
        frameRef.current = (frameRef.current + 1) % FRAME_COUNT;
        lastTime = timestamp;
      }

      // Limpar canvas
      ctx.clearRect(0, 0, size, size);

      // Desenhar frame atual
      const srcX = frameRef.current * FRAME_WIDTH;
      const srcY = animation * FRAME_HEIGHT;

      ctx.drawImage(
        img,
        srcX,
        srcY,
        FRAME_WIDTH,
        FRAME_HEIGHT,
        0,
        0,
        size,
        size
      );

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [size, animation, frameDuration, FRAME_COUNT]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated" }}
    />
  );
};

export default SwordManAvatar;

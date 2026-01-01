import React, { useEffect, useRef } from "react";

// Total de sprites disponíveis (contagem de arquivos [n].png na pasta Characters)
export const TOTAL_SPRITES = 46;

// IDs de sprites que são personagens humanoides (para uso em avatares)
// Exclui: [1] Anvil, [4] Bear, [5] Bird, [7] Boar, [8] Bunny, [11] Deer1, [12] Deer2, [14] Fox, [45] Wolf
export const CHARACTER_SPRITE_IDS: string[] = [
  "[2].png", // ArcherMan
  "[3].png", // ArchMage
  "[6].png", // Blacksmith
  "[9].png", // CavalierMan
  "[10].png", // CrossBowMan
  "[13].png", // EarthWarrior
  "[15].png", // Gatherer
  "[16].png", // GraveDigger
  "[17].png", // HalberdMan
  "[18].png", // HorseMan
  "[19].png", // Hunter
  "[20].png", // IceSwordswoman
  "[21].png", // KingMan
  "[22].png", // LightningWarrior
  "[23].png", // Lumberjack
  "[24].png", // Mage
  "[25].png", // Merchant
  "[26].png", // Miner
  "[27].png", // NobleMan
  "[28].png", // NobleWoman
  "[29].png", // Nun
  "[30].png", // OldMan
  "[31].png", // OldWoman
  "[32].png", // Peasant
  "[33].png", // PrinceMan
  "[34].png", // Princess
  "[35].png", // Queen
  "[36].png", // ShieldMan
  "[37].png", // SpearMan
  "[38].png", // SuspiciousMerchant
  "[39].png", // SwordMan
  "[40].png", // Thief
  "[41].png", // VillagerMan
  "[42].png", // VillagerWoman
  "[43].png", // WaterSpearwoman
  "[44].png", // WindWarrior
  "[46].png", // Worker
];

// Lista de todos os IDs de sprites (incluindo animais/itens)
export const SPRITE_IDS: string[] = Array.from(
  { length: TOTAL_SPRITES },
  (_, i) => `[${i + 1}].png`
);

interface AnimatedCharacterSpriteProps {
  /** ID do arquivo sprite (ex: "[1].png") */
  spriteId: string;
  /** Tamanho do sprite em pixels */
  size?: number;
  /** Animação: 0=idle, 1=walk, 2=attack */
  animation?: 0 | 1 | 2;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Componente de sprite animado genérico para personagens
 * Todos os sprites seguem o mesmo layout: 192x192 (6 colunas x 6 linhas de 32x32)
 */
export const AnimatedCharacterSprite: React.FC<
  AnimatedCharacterSpriteProps
> = ({ spriteId, size = 64, animation = 0, className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const loadedSpriteRef = useRef<string>("");

  const FRAME_WIDTH = 32;
  const FRAME_HEIGHT = 32;
  const FRAME_COUNT = animation === 0 ? 4 : 6;
  const FRAME_DURATION = animation === 0 ? 200 : 120;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Recarregar se mudou o sprite
    if (loadedSpriteRef.current !== spriteId) {
      const img = new Image();
      img.src = `/sprites/Characters/${spriteId}`;
      imageRef.current = img;
      loadedSpriteRef.current = spriteId;
      frameRef.current = 0;
    }

    const img = imageRef.current;
    if (!img) return;

    let animationId: number;
    let lastTime = 0;

    const draw = (timestamp: number) => {
      if (!ctx || !img.complete) {
        animationId = requestAnimationFrame(draw);
        return;
      }

      if (timestamp - lastTime >= FRAME_DURATION) {
        frameRef.current = (frameRef.current + 1) % FRAME_COUNT;
        lastTime = timestamp;
      }

      ctx.clearRect(0, 0, size, size);

      const srcX = frameRef.current * FRAME_WIDTH;
      const srcY = animation * FRAME_HEIGHT;

      ctx.imageSmoothingEnabled = false;

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
  }, [spriteId, size, animation, FRAME_COUNT, FRAME_DURATION]);

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

interface AvatarSelectorProps {
  /** Avatar selecionado atualmente (ID como "[1].png") */
  selectedAvatar: string;
  /** Callback quando avatar muda */
  onSelectAvatar: (avatarId: string) => void;
  /** Tamanho do sprite exibido */
  spriteSize?: number;
  /** Título do seletor */
  title?: string;
}

/**
 * Seletor de avatar genérico com setas para navegar entre sprites animados
 * Usa apenas sprites de personagens humanoides (CHARACTER_SPRITE_IDS)
 */
export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  selectedAvatar,
  onSelectAvatar,
  spriteSize = 128,
  title = "Aparência",
}) => {
  const currentIndex = CHARACTER_SPRITE_IDS.findIndex(
    (id) => id === selectedAvatar
  );
  const validIndex = currentIndex >= 0 ? currentIndex : 0;

  const goToPrev = () => {
    const newIndex =
      (validIndex - 1 + CHARACTER_SPRITE_IDS.length) %
      CHARACTER_SPRITE_IDS.length;
    onSelectAvatar(CHARACTER_SPRITE_IDS[newIndex]);
  };

  const goToNext = () => {
    const newIndex = (validIndex + 1) % CHARACTER_SPRITE_IDS.length;
    onSelectAvatar(CHARACTER_SPRITE_IDS[newIndex]);
  };

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
          className="p-2 rounded-full bg-slate-700/50 hover:bg-slate-600/70 text-white transition-all
                     hover:scale-110 active:scale-95 border border-slate-500/30"
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
              spriteId={CHARACTER_SPRITE_IDS[validIndex]}
              size={spriteSize}
              animation={0}
            />
          </div>
        </div>

        {/* Seta direita */}
        <button
          type="button"
          onClick={goToNext}
          className="p-2 rounded-full bg-slate-700/50 hover:bg-slate-600/70 text-white transition-all
                     hover:scale-110 active:scale-95 border border-slate-500/30"
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

      {/* Contador */}
      <p className="text-xs text-slate-400">
        {validIndex + 1} / {CHARACTER_SPRITE_IDS.length}
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
}

export const AvatarGridSelector: React.FC<AvatarGridSelectorProps> = ({
  selectedAvatar,
  onSelectAvatar,
  columns = 8,
  thumbnailSize = 40,
}) => {
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {SPRITE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelectAvatar(id)}
          className={`p-1 rounded border-2 transition-all ${
            selectedAvatar === id
              ? "border-blue-500 bg-blue-500/20"
              : "border-slate-600 hover:border-slate-500"
          }`}
        >
          <AnimatedCharacterSprite spriteId={id} size={thumbnailSize} />
        </button>
      ))}
    </div>
  );
};

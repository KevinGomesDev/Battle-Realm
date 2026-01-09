/**
 * Renderer para unidades no canvas de batalha
 * Responsável por desenhar sprites, condições e balões de fala
 *
 * Efeitos visuais aplicados:
 * - HP baixo: saturação reduzida, tom avermelhado, pulso
 * - Dano: shake horizontal + flash branco/vermelho
 * - Ataque: escala + movimento para frente
 * - Morte: grayscale + opacidade reduzida
 */

import type { BattleUnitState } from "@/services/colyseus.service";
import type { SpriteDirection } from "../sprite.config";
import { UNIT_RENDER_CONFIG } from "../canvas.constants";

interface PlayerColors {
  primary: string;
  secondary: string;
  highlight: string;
}

interface SpriteConfig {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  row: number;
  loop: boolean;
}

interface LoadedSprite {
  image: HTMLImageElement;
  config: SpriteConfig;
}

/** Estado de animação de combate */
export type UnitCombatState = "idle" | "attacking" | "damaged" | "dead";

/** Dados de animação temporária de uma unidade */
export interface UnitAnimationState {
  combatState: UnitCombatState;
  stateStartTime: number;
  /** Offset X para shake/attack (pixels) */
  offsetX: number;
  /** Offset Y (pixels) */
  offsetY: number;
  /** Escala adicional */
  scale: number;
  /** Intensidade do flash (0-1) */
  flashIntensity: number;
}

interface DrawUnitParams {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  size: number;
  unit: BattleUnitState;
  isOwned: boolean;
  isSelected: boolean;
  direction: SpriteDirection;
  sprite: LoadedSprite | null;
  spritesLoaded: boolean;
  currentFrame: number;
  playerColors: PlayerColors;
  /** HP normalizado (0-1), padrão 1 */
  hpPercent?: number;
  /** Estado de animação de combate */
  animationState?: UnitAnimationState;
  /** Tempo de animação global (para efeitos pulsantes) */
  animationTime?: number;
}

// =============================================================================
// HELPERS DE EFEITOS VISUAIS
// =============================================================================

/**
 * Calcula offset de shake para animação de dano
 */
function getDamageShakeOffset(elapsed: number, duration: number): number {
  if (elapsed >= duration) return 0;
  const progress = elapsed / duration;
  const intensity = 1 - progress; // Diminui ao longo do tempo
  const shake = Math.sin(progress * Math.PI * 8) * 4 * intensity;
  return shake;
}

/**
 * Calcula offset e escala para animação de ataque
 */
function getAttackAnimation(
  elapsed: number,
  duration: number
): { offsetX: number; scale: number } {
  if (elapsed >= duration) return { offsetX: 0, scale: 1 };

  const progress = elapsed / duration;

  // Avança rápido, recua devagar
  let offsetX: number;
  let scale: number;

  if (progress < 0.3) {
    // Avança
    const t = progress / 0.3;
    offsetX = t * 8;
    scale = 1 + t * 0.15;
  } else if (progress < 0.7) {
    // Mantém
    offsetX = 8 - ((progress - 0.3) / 0.4) * 10;
    scale = 1.15 - ((progress - 0.3) / 0.4) * 0.1;
  } else {
    // Volta
    const t = (progress - 0.7) / 0.3;
    offsetX = -2 + t * 2;
    scale = 1.05 - t * 0.05;
  }

  return { offsetX, scale };
}

/**
 * Calcula intensidade do flash para dano
 */
function getDamageFlashIntensity(elapsed: number, duration: number): number {
  if (elapsed >= duration) return 0;

  const progress = elapsed / duration;

  // Flash inicial forte, depois pulsa e some
  if (progress < 0.1) {
    return 0.8;
  } else if (progress < 0.2) {
    return 0.2;
  } else if (progress < 0.4) {
    return 0.5;
  } else if (progress < 0.6) {
    return 0.1;
  } else {
    return 0;
  }
}

/**
 * Calcula opacidade e filtro baseado no HP
 */
function getHealthVisualEffect(
  hpPercent: number,
  animationTime: number
): {
  opacity: number;
  saturation: number;
  brightness: number;
  tintRed: boolean;
} {
  if (hpPercent > 0.7) {
    return { opacity: 1, saturation: 1, brightness: 1, tintRed: false };
  } else if (hpPercent > 0.4) {
    const intensity = 1 - (hpPercent - 0.4) / 0.3;
    return {
      opacity: 1,
      saturation: 1 - intensity * 0.2,
      brightness: 1,
      tintRed: intensity > 0.5,
    };
  } else if (hpPercent > 0.15) {
    const intensity = 1 - (hpPercent - 0.15) / 0.25;
    return {
      opacity: 1,
      saturation: 0.8 - intensity * 0.3,
      brightness: 1 - intensity * 0.15,
      tintRed: true,
    };
  } else {
    // Crítico - pulsa
    const pulse = Math.sin(animationTime / 400) * 0.15 + 0.85;
    return {
      opacity: pulse,
      saturation: 0.4,
      brightness: 0.75,
      tintRed: true,
    };
  }
}

/**
 * Desenha uma unidade usando sprite ou fallback procedural
 * Aplica efeitos visuais baseados em HP e estado de combate
 */
export function drawUnit({
  ctx,
  x,
  y,
  size,
  unit,
  isOwned,
  isSelected,
  direction,
  sprite,
  spritesLoaded,
  currentFrame,
  playerColors,
  hpPercent = 1,
  animationState,
  animationTime = 0,
}: DrawUnitParams): void {
  // Usar HP fornecido
  const hp = hpPercent;
  const isDead = !unit.isAlive || hp <= 0;

  // Calcular efeitos de animação de combate
  let offsetX = 0;
  let offsetY = 0;
  let scale = 1;
  let flashIntensity = 0;

  if (animationState && !isDead) {
    const elapsed = animationTime - animationState.stateStartTime;

    if (animationState.combatState === "damaged") {
      const duration = 500; // ms
      offsetX = getDamageShakeOffset(elapsed, duration);
      flashIntensity = getDamageFlashIntensity(elapsed, duration);
    } else if (animationState.combatState === "attacking") {
      const duration = 400; // ms
      const attackAnim = getAttackAnimation(elapsed, duration);
      offsetX = attackAnim.offsetX * (direction === "left" ? -1 : 1);
      scale = attackAnim.scale;
    }
  }

  // Calcular efeitos visuais de HP
  const healthEffect = getHealthVisualEffect(hp, animationTime);

  // Aplicar opacidade para morte ou HP crítico
  const finalOpacity = isDead ? 0.4 : healthEffect.opacity;

  ctx.save();
  ctx.globalAlpha = finalOpacity;

  // Aplicar filtros de HP (grayscale para morte)
  if (isDead) {
    ctx.filter = "grayscale(100%)";
  } else if (healthEffect.saturation < 1 || healthEffect.brightness < 1) {
    ctx.filter = `saturate(${healthEffect.saturation}) brightness(${healthEffect.brightness})`;
  }

  // Calcular posição final com offsets de animação
  const finalX = x + offsetX;
  const finalY = y + offsetY;

  // Se o sprite está carregado, usa ele
  if (sprite && spritesLoaded) {
    const { image, config } = sprite;
    const { frameWidth, frameHeight, frameCount } = config;

    // Calcular posição no sprite sheet
    const srcX = (currentFrame % frameCount) * frameWidth;
    const srcY = config.row * frameHeight;

    // Sprite maior, centralizado verticalmente
    const baseDestSize = size * UNIT_RENDER_CONFIG.spriteScale;
    const destSize = baseDestSize * scale;
    const spriteOffsetX = (size - destSize) / 2;
    const spriteOffsetY =
      size * UNIT_RENDER_CONFIG.verticalOffset - (destSize - baseDestSize) / 2;

    const shouldFlip = direction === "left";

    ctx.save();

    // Aplicar flip se necessário
    if (shouldFlip) {
      ctx.translate(finalX + size, finalY);
      ctx.scale(-1, 1);
      ctx.drawImage(
        image,
        srcX,
        srcY,
        frameWidth,
        frameHeight,
        spriteOffsetX,
        spriteOffsetY,
        destSize,
        destSize
      );
    } else {
      ctx.drawImage(
        image,
        srcX,
        srcY,
        frameWidth,
        frameHeight,
        finalX + spriteOffsetX,
        finalY + spriteOffsetY,
        destSize,
        destSize
      );
    }

    ctx.restore();

    // Aplicar flash de dano (overlay vermelho/branco)
    if (flashIntensity > 0) {
      ctx.save();
      ctx.globalAlpha = flashIntensity * 0.6;
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "#ffcccc";
      ctx.fillRect(finalX, finalY, size, size);
      ctx.restore();
    }
  } else {
    // Fallback: desenho procedural caso sprite não carregue
    drawProceduralUnit(ctx, finalX, finalY, size, isOwned, playerColors, scale);
  }

  // Restaurar contexto dos filtros
  ctx.restore();

  // Indicador de HP crítico (borda vermelha pulsante)
  if (!isDead && hp <= 0.25 && hp > 0) {
    const pulse = Math.sin(animationTime / 500) * 0.3 + 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(220, 38, 38, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    ctx.restore();
  }

  // Seleção manual - quadrado amarelo/vermelho com gap de 2px
  if (isSelected) {
    ctx.strokeStyle = "#ef4444"; // Vermelho
    ctx.lineWidth = 2;
    const gap = 2;
    ctx.strokeRect(x + gap, y + gap, size - gap * 2, size - gap * 2);
  }
}

/**
 * Desenha uma unidade com arte procedural (fallback)
 */
function drawProceduralUnit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  _isOwned: boolean,
  colors: PlayerColors,
  scale: number = 1
): void {
  void _isOwned; // Reserved for future use

  // Aplicar escala ao desenho procedural
  const scaledSize = size * scale;
  const scaleOffset = (size - scaledSize) / 2;
  const sx = x + scaleOffset;
  const sy = y + scaleOffset;

  const px = Math.max(2, scaledSize / 16);
  const offsetX = sx + scaledSize * 0.15;
  const offsetY = sy + scaledSize * 0.1;

  // Coroa
  ctx.fillStyle = colors.highlight;
  ctx.fillRect(offsetX + scaledSize * 0.35, offsetY, px * 2, px);

  // Cabeça
  ctx.fillStyle = colors.primary;
  ctx.fillRect(
    offsetX + scaledSize * 0.2,
    offsetY + px,
    scaledSize * 0.5,
    px * 3
  );

  // Olhos
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(offsetX + scaledSize * 0.25, offsetY + px * 2, px, px);
  ctx.fillRect(offsetX + scaledSize * 0.45, offsetY + px * 2, px, px);

  // Corpo
  ctx.fillStyle = colors.primary;
  ctx.fillRect(
    offsetX + scaledSize * 0.15,
    offsetY + px * 4,
    scaledSize * 0.6,
    px * 3
  );

  // Detalhe armadura
  ctx.fillStyle = colors.highlight;
  ctx.fillRect(
    offsetX + scaledSize * 0.3,
    offsetY + px * 4,
    scaledSize * 0.2,
    px
  );

  // Pernas
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(offsetX + scaledSize * 0.2, offsetY + px * 7, px * 2, px * 2);
  ctx.fillRect(offsetX + scaledSize * 0.45, offsetY + px * 7, px * 2, px * 2);

  // Espada
  ctx.fillStyle = "#c0c0c0";
  ctx.fillRect(offsetX + scaledSize * 0.7, offsetY + px * 3, px, px * 4);
  ctx.fillStyle = "#8b4513";
  ctx.fillRect(offsetX + scaledSize * 0.7, offsetY + px * 7, px, px * 2);
}

interface DrawConditionsParams {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  conditions: string[];
  conditionColors: Record<string, string>;
}

/**
 * Desenha indicadores de condições sobre a unidade
 */
export function drawConditions({
  ctx,
  x,
  y,
  conditions,
  conditionColors,
}: DrawConditionsParams): void {
  conditions.slice(0, 3).forEach((cond, i) => {
    ctx.fillStyle = conditionColors[cond] || "#ffffff";
    ctx.fillRect(x + 4 + i * 6, y + 2, 4, 4);
  });
}

interface DrawSpeechBubbleParams {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  size: number;
  message: string;
  isOwned: boolean;
}

/**
 * Desenha balão de fala sobre a unidade
 */
export function drawSpeechBubble({
  ctx,
  x,
  y,
  size,
  message,
  isOwned,
}: DrawSpeechBubbleParams): void {
  const bubbleHeight = 20;
  const bubbleY = y - bubbleHeight - 8;
  const maxWidth = size * 3;

  // Medir texto e calcular largura
  ctx.font = "10px 'MedievalSharp', serif";
  const textWidth = Math.min(ctx.measureText(message).width + 12, maxWidth);
  const bubbleWidth = textWidth;
  const bubbleX = x + (size - bubbleWidth) / 2;

  // Truncar texto se muito longo
  let displayText = message;
  if (ctx.measureText(message).width + 12 > maxWidth) {
    while (
      ctx.measureText(displayText + "...").width + 12 > maxWidth &&
      displayText.length > 0
    ) {
      displayText = displayText.slice(0, -1);
    }
    displayText += "...";
  }

  // Fundo do balão
  const bgColor = isOwned ? "#d4af37" : "#dc2626";
  const textColor = isOwned ? "#1a1a1a" : "#ffffff";

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 4);
  ctx.fill();

  // Triângulo apontando para baixo
  ctx.beginPath();
  ctx.moveTo(x + size / 2 - 4, bubbleY + bubbleHeight);
  ctx.lineTo(x + size / 2, bubbleY + bubbleHeight + 6);
  ctx.lineTo(x + size / 2 + 4, bubbleY + bubbleHeight);
  ctx.closePath();
  ctx.fill();

  // Texto
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    displayText,
    bubbleX + bubbleWidth / 2,
    bubbleY + bubbleHeight / 2
  );
}

interface DrawTurnIndicatorParams {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  size: number;
  animationTime: number;
}

/**
 * Desenha indicador de turno ao redor da unidade ativa
 */
export function drawTurnIndicator({
  ctx,
  x,
  y,
  size,
  animationTime,
}: DrawTurnIndicatorParams): void {
  const turnColor = "#10b981"; // Emerald

  // Efeito pulsante
  const pulse = Math.sin(animationTime / 150) * 0.3 + 0.7;

  // Desenhar quadrado ao redor (borda externa)
  ctx.strokeStyle = turnColor;
  ctx.lineWidth = 3;
  ctx.globalAlpha = pulse;
  ctx.strokeRect(x, y, size, size);
  ctx.globalAlpha = 1;

  // Pequeno indicador de diamante acima
  const diamondY = y - 8 + Math.sin(animationTime / 200) * 2;
  ctx.fillStyle = turnColor;
  ctx.beginPath();
  ctx.moveTo(x + size / 2, diamondY);
  ctx.lineTo(x + size / 2 + 4, diamondY + 4);
  ctx.lineTo(x + size / 2, diamondY + 8);
  ctx.lineTo(x + size / 2 - 4, diamondY + 4);
  ctx.closePath();
  ctx.fill();
}

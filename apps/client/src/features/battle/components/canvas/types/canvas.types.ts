/**
 * Tipos compartilhados para o sistema de Canvas de Batalha
 */

import type {
  BattleUnitState,
  BattleObstacleState,
} from "@/services/colyseus.service";
import type { BattleComputed } from "../../../../../stores/battleStore";
import type { TargetingPreview } from "@boundless/shared/utils/targeting.utils";
import type { SpriteAnimation, SpriteDirection } from "../sprite.config";

import type { ProjectileType } from "../components/ProjectileTrajectory";

/** Bolha de fala ativa sobre uma unidade */
export interface ActiveBubble {
  message: string;
  expiresAt: number;
}

/** Posição 2D simples */
export interface Position {
  x: number;
  y: number;
}

/** Preview de área de spell/skill */
export interface SpellAreaPreview {
  /** Tamanho da área (Ex: 3 = 3x3) */
  size: number;
  /** Cor base do preview */
  color: string;
  /** Se true, centra na unidade selecionada (para range SELF) */
  centerOnSelf?: boolean;
  /** Distância máxima do caster */
  maxRange?: number;
  /** Posição do caster para calcular distância */
  casterPos?: Position;
}

/** Preview de linha para Teleport */
export interface TeleportLinePreview {
  /** Posição inicial (caster) */
  from: Position;
  /** Alcance máximo */
  maxRange: number;
  /** Cor da linha */
  color: string;
}

/** Informação de tooltip para célula de movimento */
export interface MovementTooltipInfo {
  totalCost: number;
  hasEngagementPenalty: boolean;
  type: string;
}

/** Informação de tooltip para hover sobre unidade/obstáculo */
export interface HoverTooltipInfo {
  name: string;
  relation: string;
  status: string;
  color: "blue" | "red" | "gray";
}

/** Direção de unidade para virar sprite */
export interface UnitDirectionInfo {
  unitId: string;
  direction: SpriteDirection;
}

/** Props do componente BattleCanvas */
export interface BattleCanvasProps {
  battle: BattleComputed;
  units: BattleUnitState[];
  currentUserId: string;
  selectedUnitId: string | null;
  /** ID da unidade ativa no turno atual */
  activeUnitId?: string | null;
  onCellClick?: (x: number, y: number) => void;
  onUnitClick?: (unit: BattleUnitState) => void;
  onObstacleClick?: (obstacle: BattleObstacleState) => void;
  /** Handler para clique com botão direito (cancela ação pendente) */
  onRightClick?: () => void;
  /** Direção para virar a unidade selecionada */
  unitDirection?: UnitDirectionInfo | null;
  /** Ação pendente - quando "attack", mostra células atacáveis */
  pendingAction?: string | null;
  /** Balões de fala ativos (unitId -> mensagem) */
  activeBubbles?: Map<string, ActiveBubble>;
  /** Preview de área de spell/skill */
  spellAreaPreview?: SpellAreaPreview | null;
  /** Handler para quando o mouse passa sobre uma célula */
  onCellHover?: (cell: Position | null) => void;
  /** Preview de targeting calculado pelo sistema unificado */
  targetingPreview?: TargetingPreview | null;
  /** Preview de linha para teleport */
  teleportLinePreview?: TeleportLinePreview | null;
}

/** Métodos expostos via ref do BattleCanvas */
export interface BattleCanvasRef {
  /** Centralizar câmera em uma unidade pelo ID */
  centerOnUnit: (unitId: string) => void;
  /** Centralizar câmera em uma unidade APENAS se estiver na visão do jogador */
  centerOnUnitIfVisible: (unitId: string) => void;
  /** Centralizar câmera em uma posição do grid APENAS se estiver na visão do jogador */
  centerOnPositionIfVisible: (x: number, y: number) => void;
  /** Verificar se uma unidade está na visão do jogador */
  isUnitVisible: (unitId: string) => boolean;
  /** Verificar se uma posição do grid está na visão do jogador */
  isPositionVisible: (x: number, y: number) => boolean;
  /** Iniciar animação de sprite em uma unidade */
  playAnimation: (unitId: string, animation: SpriteAnimation) => void;
  /** Sacudir a câmera (feedback de dano) */
  shake: (intensity?: number, duration?: number) => void;
  /** Animar movimento de uma unidade de uma posição para outra */
  animateMovement: (
    unitId: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => void;
  /** Disparar um projétil de uma posição para outra */
  fireProjectile: (params: {
    /** Tipo explícito do projétil (opcional se abilityCode for fornecido) */
    type?: ProjectileType;
    /** Código da ability para inferir o tipo de projétil */
    abilityCode?: string;
    /** Posição inicial X (grid) */
    startX: number;
    /** Posição inicial Y (grid) */
    startY: number;
    /** Posição final X (grid) */
    endX: number;
    /** Posição final Y (grid) */
    endY: number;
    /** ID do caster */
    casterId?: string;
    /** ID do alvo */
    targetId?: string;
    /** Se é projétil de área (mostra explosão) */
    isAreaProjectile?: boolean;
    /** Tamanho da explosão em células */
    explosionSize?: number;
    /** Callback quando projétil chegar ao destino */
    onComplete?: () => void;
  }) => void;
}

/** Contexto de renderização para os renderers */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  animationTime: number;
}

/** Cores do grid vindas da configuração do servidor */
export interface GridColors {
  cellLight: string;
  cellDark: string;
  gridLine: string;
  gridDot: string;
  cellHover: string;
  cellMovableNormal: string;
  cellMovableNormalBorder: string;
  cellMovableEngagement: string;
  cellMovableEngagementBorder: string;
  cellAttackable: string;
  areaPreviewTarget: string;
  areaPreviewTargetBorder: string;
  areaPreviewEmpty: string;
  areaPreviewEmptyBorder: string;
  areaPreviewCenter: string;
  areaPreviewOutOfRange: string;
  areaPreviewOutOfRangeBorder: string;
  playerColors: Array<{ primary: string; secondary: string }>;
}

/** Cores do terreno */
export interface TerrainColors {
  primary?: { hex: string };
  secondary?: { hex: string };
  accent?: { hex: string };
}

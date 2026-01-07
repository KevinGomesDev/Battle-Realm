import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
  type CSSProperties,
} from "react";

// ============================================================
// TIPOS
// ============================================================

export interface CameraState {
  /** Offset X em pixels (pan horizontal) */
  offsetX: number;
  /** Offset Y em pixels (pan vertical) */
  offsetY: number;
  /** Nível de zoom (1 = 100%) */
  zoom: number;
}

/** Métodos expostos via ref */
export interface CameraControllerRef {
  /** Centralizar câmera em coordenadas do conteúdo (animated=true por padrão) */
  centerOn: (x: number, y: number, animated?: boolean) => void;
  /** Zoom in */
  zoomIn: () => void;
  /** Zoom out */
  zoomOut: () => void;
  /** Reset para posição inicial */
  reset: () => void;
  /** Estado atual da câmera */
  getCamera: () => CameraState;
  /** Sacudir a câmera (para feedback de dano) */
  shake: (intensity?: number, duration?: number) => void;
}

export interface CameraControllerProps {
  /** Conteúdo filho (normalmente um canvas ou mapa) */
  children: ReactNode;
  /** Largura do conteúdo interno (para limites de pan) */
  contentWidth: number;
  /** Altura do conteúdo interno (para limites de pan) */
  contentHeight: number;
  /** Zoom mínimo permitido (default: 0.5) */
  minZoom?: number;
  /** Zoom máximo permitido (default: 3) */
  maxZoom?: number;
  /** Zoom inicial (default: 1) */
  initialZoom?: number;
  /** Habilitar zoom com scroll (default: true) */
  enableZoom?: boolean;
  /** Habilitar pan/drag (default: true) */
  enablePan?: boolean;
  /** Mostrar controles de zoom (default: true) */
  showZoomControls?: boolean;
  /** Mostrar botão de reset (default: true) */
  showResetButton?: boolean;
  /** Callback quando câmera muda */
  onCameraChange?: (state: CameraState) => void;
  /** Classes CSS adicionais para o container */
  className?: string;
  /** Estilo adicional para o container */
  style?: CSSProperties;
  /** Centralizar conteúdo inicialmente (default: true) */
  centerOnMount?: boolean;
  /** Fator de velocidade do zoom (default: 0.001) */
  zoomSpeed?: number;
}

// ============================================================
// COMPONENTE
// ============================================================

/**
 * CameraController - Componente genérico de controle de câmera
 *
 * Funcionalidades:
 * - Pan/drag com mouse ou touch
 * - Zoom com scroll do mouse ou pinch (touch)
 * - Botões de zoom +/-
 * - Botão de reset para posição inicial
 * - Limites configuráveis
 *
 * Uso:
 * ```tsx
 * const cameraRef = useRef<CameraControllerRef>(null);
 * <CameraController ref={cameraRef} contentWidth={1024} contentHeight={1024}>
 *   <canvas ref={canvasRef} width={1024} height={1024} />
 * </CameraController>
 * // Centralizar: cameraRef.current?.centerOn(x, y)
 * ```
 */
export const CameraController = forwardRef<
  CameraControllerRef,
  CameraControllerProps
>(
  (
    {
      children,
      contentWidth,
      contentHeight,
      minZoom = 0.5,
      maxZoom = 3,
      initialZoom = 1,
      enableZoom = true,
      enablePan = true,
      showZoomControls = true,
      showResetButton = true,
      onCameraChange,
      className = "",
      style,
      centerOnMount = true,
      zoomSpeed = 0.001,
    },
    ref
  ) => {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const initialPinchDistanceRef = useRef<number | null>(null);
    const initialZoomOnPinchRef = useRef(1);

    // Animação suave
    const animationRef = useRef<number | null>(null);
    const targetCameraRef = useRef<CameraState | null>(null);

    // Camera shake
    const shakeAnimationRef = useRef<number | null>(null);
    const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });

    // Estado da câmera
    const [camera, setCamera] = useState<CameraState>({
      offsetX: 0,
      offsetY: 0,
      zoom: initialZoom,
    });

    // Estado para controlar o cursor (forçar re-render quando arrasta)
    const [isDragging, setIsDragging] = useState(false);

    // Animação suave de câmera
    const animateCamera = useCallback(() => {
      if (!targetCameraRef.current) return;

      setCamera((prev) => {
        const target = targetCameraRef.current;
        // Safety check - pode ser null se reset foi chamado durante animação
        if (!target) return prev;

        const dx = target.offsetX - prev.offsetX;
        const dy = target.offsetY - prev.offsetY;
        const dz = target.zoom - prev.zoom;

        // Easing (lerp com fator 0.15 = suave)
        const ease = 0.15;
        const threshold = 0.5;

        const newOffsetX = prev.offsetX + dx * ease;
        const newOffsetY = prev.offsetY + dy * ease;
        const newZoom = prev.zoom + dz * ease;

        // Verificar se chegou no destino
        if (
          Math.abs(dx) < threshold &&
          Math.abs(dy) < threshold &&
          Math.abs(dz) < 0.001
        ) {
          targetCameraRef.current = null;
          return target; // Snap final
        }

        return {
          offsetX: newOffsetX,
          offsetY: newOffsetY,
          zoom: newZoom,
        };
      });

      if (targetCameraRef.current) {
        animationRef.current = requestAnimationFrame(animateCamera);
      }
    }, []);

    // Cleanup animação
    useEffect(() => {
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, []);

    // Centralizar conteúdo no mount
    useEffect(() => {
      if (centerOnMount && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;

        const scaledWidth = contentWidth * initialZoom;
        const scaledHeight = contentHeight * initialZoom;

        setCamera({
          offsetX: (containerWidth - scaledWidth) / 2,
          offsetY: (containerHeight - scaledHeight) / 2,
          zoom: initialZoom,
        });
      }
    }, [centerOnMount, contentWidth, contentHeight, initialZoom]);

    // Notificar mudanças
    useEffect(() => {
      onCameraChange?.(camera);
    }, [camera, onCameraChange]);

    // Limitar offset - Pan livre sem restrições rígidas
    const clampOffset = useCallback(
      (
        offsetX: number,
        offsetY: number,
        zoom: number
      ): { x: number; y: number } => {
        // Retorna os valores sem restrições para permitir pan livre
        return { x: offsetX, y: offsetY };
      },
      []
    );

    // === HANDLERS DE MOUSE ===

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!enablePan) return;
        if (e.button !== 0) return; // Só botão esquerdo

        isDraggingRef.current = true;
        setIsDragging(true);
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      },
      [enablePan]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;

        const deltaX = e.clientX - lastPosRef.current.x;
        const deltaY = e.clientY - lastPosRef.current.y;
        lastPosRef.current = { x: e.clientX, y: e.clientY };

        setCamera((prev) => {
          const newOffset = clampOffset(
            prev.offsetX + deltaX,
            prev.offsetY + deltaY,
            prev.zoom
          );
          return {
            ...prev,
            offsetX: newOffset.x,
            offsetY: newOffset.y,
          };
        });
      },
      [clampOffset]
    );

    const handleMouseUp = useCallback(() => {
      isDraggingRef.current = false;
      setIsDragging(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
      isDraggingRef.current = false;
      setIsDragging(false);
    }, []);

    // === HANDLER DE ZOOM (SCROLL) ===

    const handleWheel = useCallback(
      (e: React.WheelEvent) => {
        if (!enableZoom) return;
        // Removido preventDefault - navegadores usam passive listener

        const container = containerRef.current;
        if (!container) return;

        // Posição do mouse relativa ao container
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setCamera((prev) => {
          // Calcular novo zoom
          const zoomDelta = -e.deltaY * zoomSpeed;
          const newZoom = Math.max(
            minZoom,
            Math.min(maxZoom, prev.zoom + zoomDelta * prev.zoom)
          );

          // Zoom centrado no cursor
          const zoomRatio = newZoom / prev.zoom;
          const newOffsetX = mouseX - (mouseX - prev.offsetX) * zoomRatio;
          const newOffsetY = mouseY - (mouseY - prev.offsetY) * zoomRatio;

          const clamped = clampOffset(newOffsetX, newOffsetY, newZoom);

          return {
            offsetX: clamped.x,
            offsetY: clamped.y,
            zoom: newZoom,
          };
        });
      },
      [enableZoom, minZoom, maxZoom, zoomSpeed, clampOffset]
    );

    // === HANDLERS DE TOUCH ===

    const getTouchDistance = (touches: React.TouchList): number => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        if (e.touches.length === 1 && enablePan) {
          // Pan com um dedo
          isDraggingRef.current = true;
          setIsDragging(true);
          lastPosRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        } else if (e.touches.length === 2 && enableZoom) {
          // Pinch zoom
          isDraggingRef.current = false;
          setIsDragging(false);
          initialPinchDistanceRef.current = getTouchDistance(e.touches);
          initialZoomOnPinchRef.current = camera.zoom;
        }
      },
      [enablePan, enableZoom, camera.zoom]
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        if (e.touches.length === 1 && isDraggingRef.current) {
          // Pan
          const touch = e.touches[0];
          const deltaX = touch.clientX - lastPosRef.current.x;
          const deltaY = touch.clientY - lastPosRef.current.y;
          lastPosRef.current = { x: touch.clientX, y: touch.clientY };

          setCamera((prev) => {
            const newOffset = clampOffset(
              prev.offsetX + deltaX,
              prev.offsetY + deltaY,
              prev.zoom
            );
            return {
              ...prev,
              offsetX: newOffset.x,
              offsetY: newOffset.y,
            };
          });
        } else if (
          e.touches.length === 2 &&
          initialPinchDistanceRef.current !== null
        ) {
          // Pinch zoom
          const currentDistance = getTouchDistance(e.touches);
          const scale = currentDistance / initialPinchDistanceRef.current;
          const newZoom = Math.max(
            minZoom,
            Math.min(maxZoom, initialZoomOnPinchRef.current * scale)
          );

          // Centro do pinch
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            const centerX =
              (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
            const centerY =
              (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

            setCamera((prev) => {
              const zoomRatio = newZoom / prev.zoom;
              const newOffsetX = centerX - (centerX - prev.offsetX) * zoomRatio;
              const newOffsetY = centerY - (centerY - prev.offsetY) * zoomRatio;
              const clamped = clampOffset(newOffsetX, newOffsetY, newZoom);

              return {
                offsetX: clamped.x,
                offsetY: clamped.y,
                zoom: newZoom,
              };
            });
          }
        }
      },
      [minZoom, maxZoom, clampOffset]
    );

    const handleTouchEnd = useCallback(() => {
      isDraggingRef.current = false;
      setIsDragging(false);
      initialPinchDistanceRef.current = null;
    }, []);

    // === CONTROLES DE ZOOM ===

    const handleZoomIn = useCallback(() => {
      setCamera((prev) => {
        const newZoom = Math.min(maxZoom, prev.zoom * 1.2);
        const container = containerRef.current;
        if (!container) return { ...prev, zoom: newZoom };

        // Zoom centrado no container
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;
        const zoomRatio = newZoom / prev.zoom;
        const newOffsetX = centerX - (centerX - prev.offsetX) * zoomRatio;
        const newOffsetY = centerY - (centerY - prev.offsetY) * zoomRatio;
        const clamped = clampOffset(newOffsetX, newOffsetY, newZoom);

        return {
          offsetX: clamped.x,
          offsetY: clamped.y,
          zoom: newZoom,
        };
      });
    }, [maxZoom, clampOffset]);

    const handleZoomOut = useCallback(() => {
      setCamera((prev) => {
        const newZoom = Math.max(minZoom, prev.zoom / 1.2);
        const container = containerRef.current;
        if (!container) return { ...prev, zoom: newZoom };

        // Zoom centrado no container
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;
        const zoomRatio = newZoom / prev.zoom;
        const newOffsetX = centerX - (centerX - prev.offsetX) * zoomRatio;
        const newOffsetY = centerY - (centerY - prev.offsetY) * zoomRatio;
        const clamped = clampOffset(newOffsetX, newOffsetY, newZoom);

        return {
          offsetX: clamped.x,
          offsetY: clamped.y,
          zoom: newZoom,
        };
      });
    }, [minZoom, clampOffset]);

    const handleReset = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const scaledWidth = contentWidth * initialZoom;
      const scaledHeight = contentHeight * initialZoom;

      setCamera({
        offsetX: (containerWidth - scaledWidth) / 2,
        offsetY: (containerHeight - scaledHeight) / 2,
        zoom: initialZoom,
      });
    }, [contentWidth, contentHeight, initialZoom]);

    // Shake da câmera (feedback de dano)
    const shake = useCallback((intensity = 6, duration = 200) => {
      // Cancelar shake anterior se existir
      if (shakeAnimationRef.current) {
        cancelAnimationFrame(shakeAnimationRef.current);
        shakeAnimationRef.current = null;
      }

      const startTime = performance.now();

      const animateShake = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
          // Shake com diminuição gradual
          const currentIntensity = intensity * (1 - progress);
          const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
          const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
          setShakeOffset({ x: offsetX, y: offsetY });
          shakeAnimationRef.current = requestAnimationFrame(animateShake);
        } else {
          // Shake terminou - resetar offset
          setShakeOffset({ x: 0, y: 0 });
          shakeAnimationRef.current = null;
        }
      };

      shakeAnimationRef.current = requestAnimationFrame(animateShake);
    }, []);

    // Cleanup shake animation
    useEffect(() => {
      return () => {
        if (shakeAnimationRef.current) {
          cancelAnimationFrame(shakeAnimationRef.current);
        }
      };
    }, []);

    // Centralizar em coordenadas do conteúdo (x, y em pixels do conteúdo) com animação suave
    const centerOn = useCallback(
      (x: number, y: number, animated = true) => {
        const container = containerRef.current;
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Calcular offset para centralizar (x, y) no centro do container
        // Usar zoom atual do camera state
        setCamera((prev) => {
          const newOffsetX = containerWidth / 2 - x * prev.zoom;
          const newOffsetY = containerHeight / 2 - y * prev.zoom;

          const clamped = clampOffset(newOffsetX, newOffsetY, prev.zoom);

          if (animated) {
            // Iniciar animação suave
            targetCameraRef.current = {
              offsetX: clamped.x,
              offsetY: clamped.y,
              zoom: prev.zoom,
            };

            // Cancelar animação anterior se existir
            if (animationRef.current) {
              cancelAnimationFrame(animationRef.current);
            }
            animationRef.current = requestAnimationFrame(animateCamera);

            return prev; // Não mudar imediatamente, deixar animação fazer
          }

          return {
            ...prev,
            offsetX: clamped.x,
            offsetY: clamped.y,
          };
        });
      },
      [clampOffset, animateCamera]
    );

    // Expor métodos via ref
    useImperativeHandle(
      ref,
      () => ({
        centerOn,
        zoomIn: handleZoomIn,
        zoomOut: handleZoomOut,
        reset: handleReset,
        getCamera: () => camera,
        shake,
      }),
      [centerOn, handleZoomIn, handleZoomOut, handleReset, camera, shake]
    );

    // === RENDER ===

    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden select-none ${className}`}
        style={{
          cursor: isDragging ? "grabbing" : "default",
          touchAction: "none",
          ...style,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Conteúdo transformado */}
        <div
          style={{
            transform: `translate(${camera.offsetX + shakeOffset.x}px, ${
              camera.offsetY + shakeOffset.y
            }px) scale(${camera.zoom})`,
            transformOrigin: "0 0",
            width: contentWidth,
            height: contentHeight,
          }}
        >
          {children}
        </div>

        {/* Controles de zoom */}
        {(showZoomControls || showResetButton) && (
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
            {showZoomControls && (
              <>
                <button
                  onClick={handleZoomIn}
                  className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg 
                           flex items-center justify-center text-xl font-bold transition-colors
                           border border-slate-600 shadow-lg"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  onClick={handleZoomOut}
                  className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg 
                           flex items-center justify-center text-xl font-bold transition-colors
                           border border-slate-600 shadow-lg"
                  title="Zoom Out"
                >
                  −
                </button>
              </>
            )}
            {showResetButton && (
              <button
                onClick={handleReset}
                className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg 
                         flex items-center justify-center text-sm transition-colors
                         border border-slate-600 shadow-lg"
                title="Reset View"
              >
                ⟲
              </button>
            )}
            {/* Indicador de zoom */}
            <div className="text-center text-xs text-slate-400 bg-slate-800/70 rounded px-2 py-1">
              {Math.round(camera.zoom * 100)}%
            </div>
          </div>
        )}
      </div>
    );
  }
);

CameraController.displayName = "CameraController";

export default CameraController;

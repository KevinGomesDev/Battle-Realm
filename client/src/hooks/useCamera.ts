import { useRef, useState, useCallback, useEffect } from "react";

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

export interface UseCameraOptions {
  /** Largura do conteúdo */
  contentWidth: number;
  /** Altura do conteúdo */
  contentHeight: number;
  /** Largura do container */
  containerWidth: number;
  /** Altura do container */
  containerHeight: number;
  /** Zoom mínimo (default: 0.5) */
  minZoom?: number;
  /** Zoom máximo (default: 3) */
  maxZoom?: number;
  /** Zoom inicial (default: 1) */
  initialZoom?: number;
  /** Centralizar inicialmente (default: true) */
  centerOnMount?: boolean;
  /** Callback quando câmera muda */
  onCameraChange?: (state: CameraState) => void;
}

export interface UseCameraReturn {
  /** Estado atual da câmera */
  camera: CameraState;
  /** Setar câmera diretamente */
  setCamera: React.Dispatch<React.SetStateAction<CameraState>>;
  /** Mover câmera por delta */
  pan: (deltaX: number, deltaY: number) => void;
  /** Aplicar zoom (centrado em ponto opcional) */
  zoomTo: (newZoom: number, centerX?: number, centerY?: number) => void;
  /** Zoom in por fator */
  zoomIn: (factor?: number) => void;
  /** Zoom out por fator */
  zoomOut: (factor?: number) => void;
  /** Reset para posição inicial */
  reset: () => void;
  /** Centralizar em coordenadas específicas */
  centerOn: (x: number, y: number) => void;
  /** Converter coordenadas de tela para mundo */
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  /** Converter coordenadas de mundo para tela */
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
}

// ============================================================
// HOOK
// ============================================================

/**
 * useCamera - Hook para controle de câmera em mapas/canvas
 *
 * Fornece estado e funções para pan/zoom programático.
 * Use com CameraController para integração com eventos de mouse/touch.
 */
export function useCamera({
  contentWidth,
  contentHeight,
  containerWidth,
  containerHeight,
  minZoom = 0.5,
  maxZoom = 3,
  initialZoom = 1,
  centerOnMount = true,
  onCameraChange,
}: UseCameraOptions): UseCameraReturn {
  // Estado da câmera
  const [camera, setCamera] = useState<CameraState>(() => {
    if (centerOnMount && containerWidth > 0 && containerHeight > 0) {
      const scaledWidth = contentWidth * initialZoom;
      const scaledHeight = contentHeight * initialZoom;
      return {
        offsetX: (containerWidth - scaledWidth) / 2,
        offsetY: (containerHeight - scaledHeight) / 2,
        zoom: initialZoom,
      };
    }
    return { offsetX: 0, offsetY: 0, zoom: initialZoom };
  });

  // Ref para valores atuais (evita dependências em callbacks)
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Notificar mudanças
  useEffect(() => {
    onCameraChange?.(camera);
  }, [camera, onCameraChange]);

  // Limitar offset
  const clampOffset = useCallback(
    (
      offsetX: number,
      offsetY: number,
      zoom: number
    ): { x: number; y: number } => {
      const scaledWidth = contentWidth * zoom;
      const scaledHeight = contentHeight * zoom;

      const minX = containerWidth - scaledWidth - scaledWidth * 0.5;
      const maxX = scaledWidth * 0.5;
      const minY = containerHeight - scaledHeight - scaledHeight * 0.5;
      const maxY = scaledHeight * 0.5;

      return {
        x: Math.max(minX, Math.min(maxX, offsetX)),
        y: Math.max(minY, Math.min(maxY, offsetY)),
      };
    },
    [contentWidth, contentHeight, containerWidth, containerHeight]
  );

  // Pan por delta
  const pan = useCallback(
    (deltaX: number, deltaY: number) => {
      setCamera((prev) => {
        const clamped = clampOffset(
          prev.offsetX + deltaX,
          prev.offsetY + deltaY,
          prev.zoom
        );
        return {
          ...prev,
          offsetX: clamped.x,
          offsetY: clamped.y,
        };
      });
    },
    [clampOffset]
  );

  // Zoom para valor específico
  const zoomTo = useCallback(
    (newZoom: number, centerX?: number, centerY?: number) => {
      const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
      const cx = centerX ?? containerWidth / 2;
      const cy = centerY ?? containerHeight / 2;

      setCamera((prev) => {
        const zoomRatio = clampedZoom / prev.zoom;
        const newOffsetX = cx - (cx - prev.offsetX) * zoomRatio;
        const newOffsetY = cy - (cy - prev.offsetY) * zoomRatio;
        const clamped = clampOffset(newOffsetX, newOffsetY, clampedZoom);

        return {
          offsetX: clamped.x,
          offsetY: clamped.y,
          zoom: clampedZoom,
        };
      });
    },
    [minZoom, maxZoom, containerWidth, containerHeight, clampOffset]
  );

  // Zoom in
  const zoomIn = useCallback(
    (factor = 1.2) => {
      zoomTo(cameraRef.current.zoom * factor);
    },
    [zoomTo]
  );

  // Zoom out
  const zoomOut = useCallback(
    (factor = 1.2) => {
      zoomTo(cameraRef.current.zoom / factor);
    },
    [zoomTo]
  );

  // Reset
  const reset = useCallback(() => {
    const scaledWidth = contentWidth * initialZoom;
    const scaledHeight = contentHeight * initialZoom;

    setCamera({
      offsetX: (containerWidth - scaledWidth) / 2,
      offsetY: (containerHeight - scaledHeight) / 2,
      zoom: initialZoom,
    });
  }, [
    contentWidth,
    contentHeight,
    containerWidth,
    containerHeight,
    initialZoom,
  ]);

  // Centralizar em coordenadas
  const centerOn = useCallback(
    (x: number, y: number) => {
      const current = cameraRef.current;
      const screenX = x * current.zoom;
      const screenY = y * current.zoom;

      const newOffsetX = containerWidth / 2 - screenX;
      const newOffsetY = containerHeight / 2 - screenY;

      const clamped = clampOffset(newOffsetX, newOffsetY, current.zoom);
      setCamera((prev) => ({
        ...prev,
        offsetX: clamped.x,
        offsetY: clamped.y,
      }));
    },
    [containerWidth, containerHeight, clampOffset]
  );

  // Conversão de coordenadas
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const current = cameraRef.current;
    return {
      x: (screenX - current.offsetX) / current.zoom,
      y: (screenY - current.offsetY) / current.zoom,
    };
  }, []);

  const worldToScreen = useCallback((worldX: number, worldY: number) => {
    const current = cameraRef.current;
    return {
      x: worldX * current.zoom + current.offsetX,
      y: worldY * current.zoom + current.offsetY,
    };
  }, []);

  return {
    camera,
    setCamera,
    pan,
    zoomTo,
    zoomIn,
    zoomOut,
    reset,
    centerOn,
    screenToWorld,
    worldToScreen,
  };
}

export default useCamera;

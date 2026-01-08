import React, { useRef, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface TooltipProps {
  /** Ref do elemento âncora (o elemento que dispara o tooltip) */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Se o tooltip está visível */
  visible: boolean;
  /** Conteúdo do tooltip */
  children: React.ReactNode;
  /** Largura do tooltip (default: w-48) */
  width?: string;
  /** Posição preferida (default: bottom) */
  preferredPosition?: "top" | "bottom" | "left" | "right";
  /**
   * Ref opcional de um container para usar como âncora de posicionamento.
   * Quando fornecido, o tooltip será posicionado relativo ao container,
   * mas centralizado verticalmente com o anchorRef.
   * Útil para tooltips dentro de popups/modais.
   */
  containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Tooltip inteligente que detecta bordas da tela e ajusta posição
 * Usa createPortal para renderizar fora do fluxo DOM
 */
export const Tooltip: React.FC<TooltipProps> = ({
  anchorRef,
  visible,
  children,
  width = "w-48",
  preferredPosition = "bottom",
  containerRef,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom" | "left" | "right";
  }>({
    top: -9999,
    left: -9999,
    placement: preferredPosition,
  });

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current || !tooltipRef.current) return;

    const anchor = anchorRef.current.getBoundingClientRect();
    // Se containerRef for fornecido, usa-o para posicionamento horizontal
    const container = containerRef?.current?.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const GAP = 8;
    let top: number;
    let left: number;
    let placement: "top" | "bottom" | "left" | "right" = preferredPosition;

    if (preferredPosition === "left" || preferredPosition === "right") {
      // Posicionamento horizontal (left/right)
      // Usar container se disponível para posicionamento horizontal
      const posRef = container || anchor;

      if (preferredPosition === "left") {
        left = posRef.left - tooltip.width - GAP;
        // Se não couber à esquerda, tenta à direita
        if (left < GAP) {
          if (posRef.right + tooltip.width + GAP < viewport.width - GAP) {
            left = posRef.right + GAP;
            placement = "right";
          } else {
            left = GAP;
          }
        }
      } else {
        left = posRef.right + GAP;
        // Se não couber à direita, tenta à esquerda
        if (left + tooltip.width > viewport.width - GAP) {
          if (posRef.left - tooltip.width - GAP > GAP) {
            left = posRef.left - tooltip.width - GAP;
            placement = "left";
          } else {
            left = viewport.width - tooltip.width - GAP;
          }
        }
      }

      // Centralizar verticalmente com o anchor (item que está sendo hovered)
      top = anchor.top + anchor.height / 2 - tooltip.height / 2;

      // Ajustar para não sair das bordas verticais
      if (top < GAP) {
        top = GAP;
      } else if (top + tooltip.height > viewport.height - GAP) {
        top = viewport.height - tooltip.height - GAP;
      }
    } else {
      // Posicionamento vertical (top/bottom) - código original
      if (preferredPosition === "bottom") {
        top = anchor.bottom + GAP;
        // Se não couber embaixo, tenta em cima
        if (top + tooltip.height > viewport.height - GAP) {
          if (anchor.top - tooltip.height - GAP > GAP) {
            top = anchor.top - tooltip.height - GAP;
            placement = "top";
          }
        }
      } else {
        top = anchor.top - tooltip.height - GAP;
        // Se não couber em cima, tenta embaixo
        if (top < GAP) {
          if (anchor.bottom + tooltip.height + GAP < viewport.height - GAP) {
            top = anchor.bottom + GAP;
            placement = "bottom";
          }
        }
      }

      // Calcular posição horizontal (centralizado)
      left = anchor.left + anchor.width / 2 - tooltip.width / 2;

      // Ajustar para não sair das bordas horizontais
      if (left < GAP) {
        left = GAP;
      } else if (left + tooltip.width > viewport.width - GAP) {
        left = viewport.width - tooltip.width - GAP;
      }

      // Ajustar para não sair das bordas verticais
      if (top < GAP) {
        top = GAP;
      } else if (top + tooltip.height > viewport.height - GAP) {
        top = viewport.height - tooltip.height - GAP;
      }
    }

    setPosition({ top, left, placement });
  }, [visible, anchorRef, preferredPosition, containerRef]);

  if (!visible) return null;

  // Determinar classes da seta baseado na posição
  const getArrowClasses = () => {
    switch (position.placement) {
      case "bottom":
        return "absolute left-1/2 -translate-x-1/2 -top-1.5 rotate-45 w-3 h-3 bg-surface-900 border-surface-500/50 border-l border-t";
      case "top":
        return "absolute left-1/2 -translate-x-1/2 -bottom-1.5 rotate-45 w-3 h-3 bg-surface-900 border-surface-500/50 border-r border-b";
      case "left":
        return "absolute top-1/2 -translate-y-1/2 -right-1.5 rotate-45 w-3 h-3 bg-surface-900 border-surface-500/50 border-r border-t";
      case "right":
        return "absolute top-1/2 -translate-y-1/2 -left-1.5 rotate-45 w-3 h-3 bg-surface-900 border-surface-500/50 border-l border-b";
      default:
        return "";
    }
  };

  const tooltipElement = (
    <div
      ref={tooltipRef}
      className={`fixed z-[99999] ${width} p-2.5 bg-surface-900/95 backdrop-blur-sm border border-surface-500/50 rounded-lg shadow-cosmic pointer-events-none`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {children}
      {/* Seta indicadora */}
      <div className={getArrowClasses()} />
    </div>
  );

  // Renderiza no body via portal para escapar de qualquer overflow
  return createPortal(tooltipElement, document.body);
};

export default Tooltip;

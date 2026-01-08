import React, {
  useState,
  useRef,
  useEffect,
  createContext,
  useContext,
} from "react";
import { Tooltip } from "@/components/Tooltip";

// =============================================================================
// CONTEXTO: PopupContainerRef (para tooltips dentro de popups)
// =============================================================================

/**
 * Context para fornecer a ref do container popup aos filhos.
 * Usado para posicionar tooltips ao lado do popup, não ao lado do item individual.
 */
export const PopupContainerContext =
  createContext<React.RefObject<HTMLDivElement | null> | null>(null);

/**
 * Hook para usar o container ref do popup
 */
export const usePopupContainer = () => useContext(PopupContainerContext);

// =============================================================================
// TIPOS
// =============================================================================

export interface PanelStripProps {
  children: React.ReactNode;
  /** Se true, o strip tem borda direita */
  bordered?: boolean;
  /** Padding interno */
  padding?: "none" | "sm" | "md";
  /** Se true, ocupa espaço flexível */
  flex?: boolean;
  /** Classe adicional */
  className?: string;
}

export interface PanelStripButtonProps {
  icon: string;
  label: string;
  count?: number;
  color: string;
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Se true, abre popup ao invés de chamar onClick */
  hasPopup?: boolean;
}

// =============================================================================
// COMPONENTE: PanelStrip (Faixa do painel)
// =============================================================================

/**
 * PanelStrip - Faixa padronizada para o UnitPanel
 * Garante visual consistente em todas as seções
 */
export const PanelStrip: React.FC<PanelStripProps> = ({
  children,
  bordered = true,
  padding = "sm",
  flex = false,
  className = "",
}) => {
  const paddingClasses = {
    none: "",
    sm: "px-2 py-1",
    md: "px-3 py-2",
  };

  return (
    <div
      className={`
        flex-shrink-0 flex items-center
        ${paddingClasses[padding]}
        ${bordered ? "border-r border-surface-700/50" : ""}
        ${flex ? "flex-1 min-w-0" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// =============================================================================
// COMPONENTE: PanelStripButton (Botão de faixa com popup)
// =============================================================================

/**
 * PanelStripButton - Botão padronizado que pode abrir popup
 * Usado para: Condições, Características, Ações, Skills, Magias
 */
export const PanelStripButton: React.FC<PanelStripButtonProps> = ({
  icon,
  label,
  count,
  color,
  children,
  onClick,
  disabled = false,
  hasPopup = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [popupPosition, setPopupPosition] = useState<
    "center" | "left" | "right"
  >("center");
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Calculate popup position to avoid clipping
  useEffect(() => {
    if (!isOpen || !btnRef.current) return;

    const btnRect = btnRef.current.getBoundingClientRect();
    const popupWidth = 210; // max-w-[180px] + padding
    const viewportWidth = window.innerWidth;

    // Check if popup would overflow right
    const centeredLeft = btnRect.left + btnRect.width / 2 - popupWidth / 2;
    const centeredRight = centeredLeft + popupWidth;

    if (centeredRight > viewportWidth - 16) {
      setPopupPosition("left");
    } else if (centeredLeft < 16) {
      setPopupPosition("right");
    } else {
      setPopupPosition("center");
    }
  }, [isOpen]);

  // Fechar popup ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleClick = () => {
    if (hasPopup) {
      setIsOpen(!isOpen);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-stretch">
      <button
        ref={btnRef}
        onClick={handleClick}
        onMouseEnter={() => !isOpen && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={disabled}
        className={`
          relative w-12 py-3 flex flex-col items-center justify-center gap-0.5
          border-l border-r transition-all duration-200
          ${
            disabled
              ? "opacity-40 cursor-not-allowed bg-surface-800/50 border-surface-600"
              : isOpen
              ? "ring-2 ring-white/20 ring-inset"
              : "hover:brightness-125"
          }
        `}
        style={{
          borderColor: disabled ? undefined : `${color}60`,
          backgroundColor: disabled ? undefined : `${color}15`,
        }}
      >
        <span className="text-lg">{icon}</span>
        {count !== undefined && (
          <span
            className="text-[9px] font-bold leading-none"
            style={{ color: disabled ? "#6b7280" : color }}
          >
            {count}
          </span>
        )}
      </button>

      {/* Tooltip */}
      {!isOpen && (
        <Tooltip
          anchorRef={btnRef}
          visible={showTooltip}
          preferredPosition="top"
          width="w-32"
        >
          <p className="text-astral-chrome font-bold text-xs text-center">
            {label}
          </p>
          {count !== undefined && (
            <p className="text-surface-400 text-[10px] text-center">
              {count} disponíve{count === 1 ? "l" : "is"}
            </p>
          )}
        </Tooltip>
      )}

      {/* Popup */}
      {hasPopup && isOpen && children && (
        <div
          ref={popupRef}
          className={`absolute bottom-full mb-2 bg-surface-900/95 backdrop-blur-sm border-2 rounded-xl shadow-2xl shadow-black/50 p-2.5 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            popupPosition === "left"
              ? "right-0"
              : popupPosition === "right"
              ? "left-0"
              : "left-1/2 -translate-x-1/2"
          }`}
          style={{ borderColor: `${color}80`, minWidth: "180px" }}
        >
          {/* Seta */}
          <div
            className={`absolute -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent ${
              popupPosition === "left"
                ? "right-4"
                : popupPosition === "right"
                ? "left-4"
                : "left-1/2 -translate-x-1/2"
            }`}
            style={{ borderTopColor: `${color}80` }}
          />

          {/* Título do popup */}
          <p
            className="text-xs font-bold text-center mb-2 pb-1 border-b"
            style={{ color, borderColor: `${color}30` }}
          >
            {label}
          </p>

          {/* Fornece o containerRef para filhos via Context */}
          <PopupContainerContext.Provider value={popupRef}>
            {children}
          </PopupContainerContext.Provider>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// COMPONENTE: ActionStripButton (Botão de ação com popup de itens)
// =============================================================================

export interface ActionStripItem {
  code: string;
  icon: string;
  name: string;
  description: string;
  requiresTarget?: boolean;
  cooldown?: number;
  disabled?: boolean;
}

export interface ActionStripButtonProps {
  icon: string;
  label: string;
  color: string;
  hoverColor: string;
  items: ActionStripItem[];
  /** Código da ability pendente (ou null) */
  pendingAbilityCode: string | null;
  onExecuteAction: (code: string, requiresTarget: boolean) => void;
  disabled?: boolean;
}

export const ActionStripButton: React.FC<ActionStripButtonProps> = ({
  icon,
  label,
  color,
  hoverColor,
  items,
  pendingAbilityCode,
  onExecuteAction,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [popupPosition, setPopupPosition] = useState<
    "center" | "left" | "right"
  >("center");
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Calculate popup position to avoid clipping
  useEffect(() => {
    if (!isOpen || !btnRef.current) return;

    const btnRect = btnRef.current.getBoundingClientRect();
    const popupWidth = 310; // max-w-[280px] + padding
    const viewportWidth = window.innerWidth;

    // Check if popup would overflow right
    const centeredLeft = btnRect.left + btnRect.width / 2 - popupWidth / 2;
    const centeredRight = centeredLeft + popupWidth;

    if (centeredRight > viewportWidth - 16) {
      // Would overflow right - align to right edge of button
      setPopupPosition("left");
    } else if (centeredLeft < 16) {
      // Would overflow left - align to left edge of button
      setPopupPosition("right");
    } else {
      setPopupPosition("center");
    }
  }, [isOpen]);

  // Fechar popup ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Fechar quando ability pendente é selecionada
  useEffect(() => {
    if (pendingAbilityCode) {
      setIsOpen(false);
    }
  }, [pendingAbilityCode]);

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className="relative h-full">
      <button
        ref={btnRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => !isOpen && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={disabled}
        className={`
          relative h-full w-12 flex flex-col items-center justify-center gap-0.5
          border-l border-r transition-all duration-200
          ${
            disabled
              ? "opacity-40 cursor-not-allowed bg-surface-800/50 border-surface-600"
              : isOpen
              ? "ring-2 ring-white/20 ring-inset brightness-110"
              : "hover:brightness-125"
          }
        `}
        style={{
          borderColor: disabled ? undefined : `${color}60`,
          backgroundColor: disabled ? undefined : `${color}15`,
        }}
      >
        <span className="text-lg">{icon}</span>
        <span
          className="text-[9px] font-bold leading-none"
          style={{ color: disabled ? "#6b7280" : color }}
        >
          {items.length}
        </span>
      </button>

      {/* Tooltip */}
      {!isOpen && (
        <Tooltip
          anchorRef={btnRef}
          visible={showTooltip}
          preferredPosition="top"
          width="w-36"
        >
          <p className="font-bold text-xs text-center" style={{ color }}>
            {label}
          </p>
          <p className="text-surface-400 text-[10px] text-center">
            {items.length} disponíve{items.length === 1 ? "l" : "is"}
          </p>
        </Tooltip>
      )}

      {/* Popup com itens */}
      {isOpen && (
        <div
          ref={popupRef}
          className={`absolute bottom-full mb-2 bg-surface-900/95 backdrop-blur-sm border-2 rounded-xl shadow-2xl shadow-black/50 p-2.5 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            popupPosition === "left"
              ? "right-0"
              : popupPosition === "right"
              ? "left-0"
              : "left-1/2 -translate-x-1/2"
          }`}
          style={{ borderColor: `${color}80`, minWidth: "200px" }}
        >
          {/* Seta */}
          <div
            className={`absolute -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent ${
              popupPosition === "left"
                ? "right-4"
                : popupPosition === "right"
                ? "left-4"
                : "left-1/2 -translate-x-1/2"
            }`}
            style={{ borderTopColor: `${color}80` }}
          />

          {/* Título do popup */}
          <p
            className="text-xs font-bold text-center mb-2 pb-1 border-b"
            style={{ color, borderColor: `${color}30` }}
          >
            {label}
          </p>

          {/* Grid de itens */}
          <div className="flex flex-wrap gap-2 max-w-[280px] justify-center">
            {items.map((item) => (
              <ActionStripItemComponent
                key={item.code}
                item={item}
                color={color}
                hoverColor={hoverColor}
                popupContainerRef={popupRef}
                isActive={pendingAbilityCode === item.code}
                onClick={() => {
                  onExecuteAction(item.code, item.requiresTarget ?? false);
                  if (!item.requiresTarget) {
                    setIsOpen(false);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// COMPONENTE: ActionStripItem (Item individual dentro do popup)
// =============================================================================

interface ActionStripItemComponentProps {
  item: ActionStripItem;
  color: string;
  hoverColor: string;
  isActive: boolean;
  onClick: () => void;
  /** Ref do container popup para posicionar tooltip ao lado dele */
  popupContainerRef?: React.RefObject<HTMLDivElement | null>;
}

const ActionStripItemComponent: React.FC<ActionStripItemComponentProps> = ({
  item,
  color,
  hoverColor,
  isActive,
  onClick,
  popupContainerRef,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const isOnCooldown = (item.cooldown ?? 0) > 0;
  const isDisabled = item.disabled || isOnCooldown;

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        ref={btnRef}
        onClick={onClick}
        disabled={isDisabled}
        className={`
          relative w-11 h-11 rounded-lg border-2 flex items-center justify-center
          transition-all duration-200
          ${
            isDisabled
              ? "opacity-40 cursor-not-allowed border-surface-600 bg-surface-800/50"
              : isActive
              ? "shadow-lg brightness-110"
              : "hover:brightness-125 hover:shadow-md"
          }
        `}
        style={{
          borderColor: isDisabled
            ? undefined
            : isActive
            ? hoverColor
            : `${color}60`,
          backgroundColor: isDisabled
            ? undefined
            : isActive
            ? `${hoverColor}30`
            : `${color}15`,
        }}
      >
        <span className="text-lg">{item.icon}</span>

        {/* Cooldown badge */}
        {isOnCooldown && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-red-400">
            {item.cooldown}
          </span>
        )}

        {/* Target indicator */}
        {item.requiresTarget && !isDisabled && (
          <span className="absolute -bottom-0.5 -right-0.5 text-[8px]">🎯</span>
        )}
      </button>

      <Tooltip
        anchorRef={btnRef}
        containerRef={popupContainerRef}
        visible={showTooltip}
        preferredPosition="left"
        width="w-48"
      >
        <p
          className="font-bold text-xs mb-1 flex items-center gap-1.5"
          style={{ color }}
        >
          <span>{item.icon}</span>
          <span>{item.name}</span>
        </p>
        <p className="text-surface-200 text-[10px] leading-relaxed mb-1">
          {item.description}
        </p>
        {isOnCooldown && (
          <p className="text-red-400 text-[9px] font-semibold">
            ⏳ Cooldown: {item.cooldown} rodada
            {(item.cooldown ?? 0) > 1 ? "s" : ""}
          </p>
        )}
        {isDisabled && !isOnCooldown && (
          <p className="text-red-400 text-[9px] font-semibold">
            ⚠️ Sem ações disponíveis
          </p>
        )}
        {item.requiresTarget && !isDisabled && (
          <p className="text-[9px]" style={{ color }}>
            🎯 Clique para selecionar alvo
          </p>
        )}
      </Tooltip>
    </div>
  );
};

export default PanelStrip;

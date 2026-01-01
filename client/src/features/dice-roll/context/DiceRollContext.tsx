// client/src/features/dice-roll/context/DiceRollContext.tsx
// Context global para gerenciar o modal de rolagem

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  DiceRollPanelData,
  OpenRollPanelOptions,
  OnRollCompleteCallback,
} from "../types/dice-roll.types";
import DiceRollModal from "../components/DiceRollModal";
import { socketService } from "../../../services/socket.service";

interface DiceRollContextValue {
  /** Abre o painel de rolagem */
  openRollPanel: (options: OpenRollPanelOptions) => void;
  /** Fecha o painel de rolagem */
  closeRollPanel: () => void;
  /** Se o painel está aberto */
  isOpen: boolean;
}

const DiceRollContext = createContext<DiceRollContextValue | null>(null);

interface DiceRollProviderProps {
  children: ReactNode;
}

export function DiceRollProvider({ children }: DiceRollProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelData, setPanelData] = useState<DiceRollPanelData | null>(null);
  const [_options, setOptions] = useState<Partial<OpenRollPanelOptions>>({});
  const [onCompleteCallback, setOnCompleteCallback] =
    useState<OnRollCompleteCallback | null>(null);

  const openRollPanel = useCallback((opts: OpenRollPanelOptions) => {
    setPanelData(opts.data);
    setOptions({
      autoPlay: opts.autoPlay,
      speedMultiplier: opts.speedMultiplier,
      skipable: opts.skipable,
    });
    // Wrap em função para evitar que React chame como função
    if (opts.onComplete) {
      setOnCompleteCallback(() => opts.onComplete);
    }
    setIsOpen(true);
  }, []);

  const closeRollPanel = useCallback(() => {
    setIsOpen(false);
    // Chamar callback com outcome
    if (onCompleteCallback && panelData?.outcome) {
      onCompleteCallback(panelData.outcome);
    }
    // Limpar após animação
    setTimeout(() => {
      setPanelData(null);
      setOnCompleteCallback(null);
    }, 300);
  }, [onCompleteCallback, panelData]);

  // Notificar servidor quando modal abre/fecha para pausar/retomar timer
  useEffect(() => {
    if (isOpen && panelData?.battleId) {
      socketService.emit("battle:dice_modal_open", {
        battleId: panelData.battleId,
      });
    } else if (!isOpen && panelData?.battleId) {
      socketService.emit("battle:dice_modal_close", {
        battleId: panelData.battleId,
      });
    }
  }, [isOpen, panelData?.battleId]);

  return (
    <DiceRollContext.Provider
      value={{
        openRollPanel,
        closeRollPanel,
        isOpen,
      }}
    >
      {children}

      {/* Modal renderizado aqui para estar acima de tudo */}
      {panelData && (
        <DiceRollModal
          data={panelData}
          isOpen={isOpen}
          onClose={closeRollPanel}
          autoCloseDelay={panelData.actionType === "attack" ? 3000 : 0}
        />
      )}
    </DiceRollContext.Provider>
  );
}

export function useDiceRoll(): DiceRollContextValue {
  const context = useContext(DiceRollContext);
  if (!context) {
    throw new Error("useDiceRoll must be used within a DiceRollProvider");
  }
  return context;
}

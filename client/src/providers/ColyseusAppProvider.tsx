// client/src/providers/ColyseusAppProvider.tsx
// Provider raiz que usa Colyseus para conexão

import React from "react";

// Colyseus Provider
import { ColyseusProvider } from "../core/context/ColyseusContext";

// Feature Providers (Colyseus versions)
import { AuthProvider } from "../features/auth";
import { KingdomProvider } from "../features/kingdom";
import { MatchColyseusProvider } from "../features/match";
import { ArenaColyseusProvider } from "../features/arena";
import { EventProvider } from "../features/events";

interface ColyseusAppProviderProps {
  children: React.ReactNode;
}

/**
 * ColyseusAppProvider - Compõe todos os context providers usando Colyseus
 *
 * Ordem de dependência (de fora para dentro):
 * 1. ColyseusProvider - Conexão Colyseus base
 * 2. AuthProvider - Autenticação do usuário
 * 3. EventProvider - Sistema de eventos/toasts
 * 4. KingdomProvider - Gerenciamento de reinos
 * 5. MatchColyseusProvider - Gerenciamento de partidas (Colyseus)
 * 6. ArenaColyseusProvider - Gerenciamento de arena PvP (Colyseus)
 */
export const ColyseusAppProvider: React.FC<ColyseusAppProviderProps> = ({
  children,
}) => {
  return (
    <ColyseusProvider>
      <AuthProvider>
        <EventProvider>
          <KingdomProvider>
            <MatchColyseusProvider>
              <ArenaColyseusProvider>{children}</ArenaColyseusProvider>
            </MatchColyseusProvider>
          </KingdomProvider>
        </EventProvider>
      </AuthProvider>
    </ColyseusProvider>
  );
};

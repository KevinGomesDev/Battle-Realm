// client/src/providers/AppProvider.tsx
// Provider raiz que compõe todos os providers da aplicação

import React from "react";

// Core Providers
import { ColyseusProvider, SessionProvider } from "../core";

// Feature Providers
import { AuthProvider } from "../features/auth";
import { KingdomProvider } from "../features/kingdom";
import { MatchColyseusProvider } from "../features/match";
import { ArenaColyseusProvider } from "../features/arena";
import { EventProvider } from "../features/events";

interface AppProviderProps {
  children: React.ReactNode;
}

/**
 * AppProvider - Compõe todos os context providers na ordem correta
 *
 * Ordem de dependência (de fora para dentro):
 * 1. ColyseusProvider - Base de conexão Colyseus
 * 2. SessionProvider - Gerenciamento de sessão
 * 3. AuthProvider - Autenticação do usuário
 * 4. EventProvider - Sistema de eventos/toasts
 * 5. KingdomProvider - Gerenciamento de reinos
 * 6. MatchColyseusProvider - Gerenciamento de partidas (Colyseus)
 * 7. ArenaColyseusProvider - Gerenciamento de arena PvP (Colyseus)
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <ColyseusProvider>
      <SessionProvider>
        <AuthProvider>
          <EventProvider>
            <KingdomProvider>
              <MatchColyseusProvider>
                <ArenaColyseusProvider>{children}</ArenaColyseusProvider>
              </MatchColyseusProvider>
            </KingdomProvider>
          </EventProvider>
        </AuthProvider>
      </SessionProvider>
    </ColyseusProvider>
  );
};

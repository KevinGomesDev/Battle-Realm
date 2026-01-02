// client/src/providers/AppProvider.tsx
// Provider raiz que compõe todos os providers da aplicação

import React from "react";

// Core Providers
import { ConnectionProvider, SessionProvider } from "../core";

// Feature Providers
import { AuthProvider } from "../features/auth";
import { KingdomProvider } from "../features/kingdom";
import { MatchProvider } from "../features/match";
import { ArenaProvider } from "../features/arena";
import { EventProvider } from "../features/events";
import { DiceRollProvider } from "../features/dice-roll";

interface AppProviderProps {
  children: React.ReactNode;
}

/**
 * AppProvider - Compõe todos os context providers na ordem correta
 *
 * Ordem de dependência (de fora para dentro):
 * 1. ConnectionProvider - Base de conexão socket
 * 2. SessionProvider - Gerenciamento de sessão
 * 3. AuthProvider - Autenticação do usuário
 * 4. EventProvider - Sistema de eventos/toasts
 * 5. KingdomProvider - Gerenciamento de reinos
 * 6. MatchProvider - Gerenciamento de partidas
 * 7. DiceRollProvider - Sistema de rolagem de dados
 * 8. ArenaProvider - Gerenciamento de arena PvP
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <ConnectionProvider>
      <SessionProvider>
        <AuthProvider>
          <EventProvider>
            <KingdomProvider>
              <MatchProvider>
                <DiceRollProvider>
                  <ArenaProvider>{children}</ArenaProvider>
                </DiceRollProvider>
              </MatchProvider>
            </KingdomProvider>
          </EventProvider>
        </AuthProvider>
      </SessionProvider>
    </ConnectionProvider>
  );
};

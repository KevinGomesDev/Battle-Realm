import React from "react";

// Core
import { ConnectionProvider, SessionProvider } from "../core";

// Features
import { AuthProvider } from "../features/auth";
import { KingdomProvider } from "../features/kingdom";
import { MatchProvider } from "../features/match";
import { MapProvider } from "../features/map";
import { GameDataProvider } from "../features/game";
import { ArenaProvider } from "../features/arena";
import { DiceRollProvider } from "../features/dice-roll";

interface AppProviderProps {
  children: React.ReactNode;
}

/**
 * AppProvider - Combines all context providers in the correct order.
 *
 * Order matters! Dependencies:
 * 1. ConnectionProvider - Base (no dependencies)
 * 2. SessionProvider - Depends on Connection
 * 3. AuthProvider - Depends on Connection
 * 4. KingdomProvider - Depends on Auth
 * 5. GameDataProvider - Independent
 * 6. MatchProvider - Depends on Auth, Kingdom, Session
 * 7. MapProvider - Independent (used by Match internally)
 * 8. DiceRollProvider - Independent (UI overlay for dice rolls) - ANTES do Arena!
 * 9. ArenaProvider - Depends on Auth, Session, DiceRoll
 */
export function AppProvider({ children }: AppProviderProps) {
  return (
    <ConnectionProvider>
      <SessionProvider>
        <AuthProvider>
          <KingdomProvider>
            <GameDataProvider>
              <MatchProvider>
                <MapProvider>
                  <DiceRollProvider>
                    <ArenaProvider>{children}</ArenaProvider>
                  </DiceRollProvider>
                </MapProvider>
              </MatchProvider>
            </GameDataProvider>
          </KingdomProvider>
        </AuthProvider>
      </SessionProvider>
    </ConnectionProvider>
  );
}

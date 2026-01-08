// client/src/providers/AppProvider.tsx
// Provider raiz que inicializa as stores Zustand

import React from "react";
import { StoreInitializer } from "../stores";

interface AppProviderProps {
  children: React.ReactNode;
}

/**
 * AppProvider - Inicializa todas as stores Zustand
 *
 * Com Zustand, não precisamos mais de providers aninhados.
 * O StoreInitializer configura os listeners necessários para as stores.
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return <StoreInitializer>{children}</StoreInitializer>;
};

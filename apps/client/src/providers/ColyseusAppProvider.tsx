// client/src/providers/ColyseusAppProvider.tsx
// Provider raiz que inicializa as stores Zustand

import React from "react";
import { StoreInitializer } from "../stores";

interface ColyseusAppProviderProps {
  children: React.ReactNode;
}

/**
 * ColyseusAppProvider - Inicializa todas as stores Zustand
 *
 * Com Zustand, não precisamos mais de providers aninhados.
 * O StoreInitializer configura os listeners necessários para as stores.
 */
export const ColyseusAppProvider: React.FC<ColyseusAppProviderProps> = ({
  children,
}) => {
  return <StoreInitializer>{children}</StoreInitializer>;
};

// server/src/colyseus/rooms/global/types.ts
// Tipos compartilhados entre os handlers do GlobalRoom

import { Client, Room } from "@colyseus/core";
import { GlobalRoomState } from "../../schemas";

/**
 * Interface para userData do cliente autenticado
 */
export interface UserData {
  userId: string;
  username: string;
  authenticated: boolean;
}

/**
 * Cliente com userData tipado
 */
export interface AuthenticatedClient extends Client {
  userData: UserData;
}

/**
 * Contexto passado para os handlers
 */
export interface HandlerContext {
  room: Room<GlobalRoomState>;
  authenticatedClients: Map<string, AuthenticatedClient>;
}

/**
 * Helper para extrair userData do client
 */
export function getUserData(client: Client): UserData | undefined {
  return client.userData as UserData | undefined;
}

/**
 * Verifica se o cliente está autenticado
 */
export function isAuthenticated(client: Client): boolean {
  const userData = getUserData(client);
  return userData?.authenticated === true;
}

/**
 * Envia erro de autenticação
 */
export function sendAuthError(client: Client, event: string = "error"): void {
  client.send(event, { message: "Não autenticado", code: "AUTH_REQUIRED" });
}

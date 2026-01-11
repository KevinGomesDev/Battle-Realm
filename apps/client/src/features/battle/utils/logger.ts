/**
 * Logger condicional para desenvolvimento
 * Só exibe logs quando não está em produção
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === "development";

type LogFn = (prefix: string, message: string, ...args: unknown[]) => void;

function createLogger(category: string, color: string): LogFn {
  return (prefix: string, message: string, ...args: unknown[]) => {
    if (!isDev) return;
  };
}

/**
 * Logger para operações gerais do Battle
 */
export const BattleLog = createLogger("battle", "#f472b6");

/**
 * Logger para eventos de lobby
 */
export const lobbyLog = createLogger("Lobby", "#34d399");

/**
 * Logger para avisos
 */
export const warnLog = (
  prefix: string,
  message: string,
  ...args: unknown[]
) => {
  if (!isDev) return;
  console.warn(`[Battle] ${prefix} ${message}`, ...args);
};

/**
 * Logger para erros (sempre exibe, mesmo em produção)
 */
export const errorLog = (
  prefix: string,
  message: string,
  ...args: unknown[]
) => {
  console.error(`[Battle] ${prefix} ${message}`, ...args);
};

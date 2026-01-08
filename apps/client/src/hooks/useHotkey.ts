// client/src/hooks/useHotkey.ts
// Wrapper hooks para react-hotkeys-hook com configurações padronizadas

import { useHotkeys, type Options } from "react-hotkeys-hook";

/**
 * Opções estendidas para hotkeys do Battle Realm
 */
export interface HotkeyOptions
  extends Omit<Options, "enabled" | "enableOnFormTags"> {
  /** Desabilitar hotkey quando em inputs/textareas (padrão: true) */
  ignoreInputs?: boolean;
  /** Habilitado (padrão: true) */
  enabled?: boolean;
}

/**
 * Hook padrão para hotkeys - ignora inputs por padrão
 *
 * @example
 * // Movimento WASD
 * useHotkey('w', () => move('up'));
 * useHotkey('a,s,d', handleMove);
 *
 * // Escape para fechar modal
 * useHotkey('escape', closeModal, { enabled: isOpen });
 *
 * // Enter para toggle
 * useHotkey('enter', toggleChat);
 */
export function useHotkey(
  keys: string,
  callback: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {}
): void {
  const { ignoreInputs = true, enabled = true, ...restOptions } = options;

  useHotkeys(keys, callback, {
    enabled,
    enableOnFormTags: !ignoreInputs,
    preventDefault: true,
    ...restOptions,
  });
}

/**
 * Hook para hotkeys globais (funciona em qualquer lugar do documento)
 */
export function useGlobalHotkey(
  keys: string,
  callback: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {}
): void {
  const { ignoreInputs = true, enabled = true, ...restOptions } = options;

  useHotkeys(keys, callback, {
    enabled,
    enableOnFormTags: !ignoreInputs,
    preventDefault: true,
    ...restOptions,
  });
}

/**
 * Hook para teclas de escape (muito comum em modais)
 *
 * @example
 * useEscapeKey(closeModal, { enabled: isOpen });
 */
export function useEscapeKey(
  callback: () => void,
  options: Pick<HotkeyOptions, "enabled"> = {}
): void {
  useGlobalHotkey("escape", callback, {
    ...options,
    ignoreInputs: false, // ESC funciona mesmo em inputs
  });
}

/**
 * Hook para tecla Enter (comum para toggle/confirm)
 *
 * @example
 * useEnterKey(toggleChat, { ignoreInputs: true });
 */
export function useEnterKey(
  callback: () => void,
  options: HotkeyOptions = {}
): void {
  useGlobalHotkey("enter", callback, options);
}

/**
 * Hook para movimento WASD + Arrow Keys
 *
 * @example
 * useMovementKeys({
 *   onUp: () => move(0, -1),
 *   onDown: () => move(0, 1),
 *   onLeft: () => move(-1, 0),
 *   onRight: () => move(1, 0),
 * }, { enabled: canMove });
 */
export interface MovementCallbacks {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
}

export function useMovementKeys(
  callbacks: MovementCallbacks,
  options: Pick<HotkeyOptions, "enabled" | "ignoreInputs"> = {}
): void {
  const { enabled = true, ignoreInputs = true } = options;
  const commonOptions: HotkeyOptions = { enabled, ignoreInputs };

  useGlobalHotkey("w, ArrowUp", () => callbacks.onUp?.(), commonOptions);

  useGlobalHotkey("s, ArrowDown", () => callbacks.onDown?.(), commonOptions);

  useGlobalHotkey("a, ArrowLeft", () => callbacks.onLeft?.(), commonOptions);

  useGlobalHotkey("d, ArrowRight", () => callbacks.onRight?.(), commonOptions);
}

/**
 * Hook para número keys (1-9, útil para seleção rápida de skills/itens)
 *
 * @example
 * useNumberKeys((num) => selectSkill(num - 1), { enabled: isMyTurn });
 */
export function useNumberKeys(
  callback: (number: number) => void,
  options: Pick<HotkeyOptions, "enabled" | "ignoreInputs"> = {}
): void {
  useGlobalHotkey(
    "1, 2, 3, 4, 5, 6, 7, 8, 9",
    (event) => {
      const num = parseInt(event.key, 10);
      if (!isNaN(num)) {
        callback(num);
      }
    },
    options
  );
}

// Re-export o hook original para casos avançados
export { useHotkeys, type Options as HotkeysOptions } from "react-hotkeys-hook";

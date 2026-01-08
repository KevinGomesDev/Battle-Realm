// client/src/features/commands/hooks/useCommands.ts
// Hook para executar comandos de batalha

import { useCallback, useState } from "react";
import { colyseusService } from "../../../services/colyseus.service";
import type {
  CommandResponse,
  CommandResult,
} from "../../../../../shared/types/commands.types";
import {
  parseCommand,
  createCommandPayload,
  isCommand,
} from "../utils/command-parser";

interface UseCommandsOptions {
  /** ID da unidade selecionada (para comandos que requerem) */
  selectedUnitId?: string;
  /** Callback quando um comando é executado com sucesso */
  onSuccess?: (result: CommandResult) => void;
  /** Callback quando um comando falha */
  onError?: (error: string) => void;
}

interface UseCommandsReturn {
  /** Executa um comando a partir de uma mensagem de chat */
  executeCommand: (message: string) => Promise<boolean>;
  /** Verifica se uma mensagem é um comando */
  isCommand: (message: string) => boolean;
  /** Estado de loading */
  isLoading: boolean;
  /** Último resultado de comando */
  lastResult: CommandResult | null;
}

/**
 * Hook para gerenciar comandos de batalha
 */
export function useCommands(
  options: UseCommandsOptions = {}
): UseCommandsReturn {
  const { selectedUnitId, onSuccess, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);

  const executeCommand = useCallback(
    async (message: string): Promise<boolean> => {
      // Verificar se é um comando
      if (!isCommand(message)) {
        return false;
      }

      // Parsear o comando
      const parsed = parseCommand(message);

      if (!parsed.isCommand) {
        return false;
      }

      // Se houve erro de parsing, reportar
      if (parsed.error) {
        const errorResult: CommandResult = {
          success: false,
          message: parsed.error,
        };
        setLastResult(errorResult);
        onError?.(parsed.error);
        return true; // Retorna true porque ERA um comando (só que inválido)
      }

      // Criar payload
      const payload = createCommandPayload(parsed, selectedUnitId);
      if (!payload) {
        return false;
      }

      // Enviar ao servidor
      setIsLoading(true);

      try {
        const response =
          await colyseusService.sendToBattleAndWait<CommandResponse>(
            "battle:command",
            payload,
            "battle:command:response"
          );

        const result = response.result;
        setLastResult(result);

        if (result.success) {
          onSuccess?.(result);
        } else {
          onError?.(result.message);
        }

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Erro ao executar comando";
        const errorResult: CommandResult = {
          success: false,
          message: errorMessage,
        };
        setLastResult(errorResult);
        onError?.(errorMessage);
        return true;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedUnitId, onSuccess, onError]
  );

  return {
    executeCommand,
    isCommand,
    isLoading,
    lastResult,
  };
}

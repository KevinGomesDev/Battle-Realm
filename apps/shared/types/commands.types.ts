// shared/types/commands.types.ts
// Tipos compartilhados para o sistema de comandos de batalha

// =============================================================================
// TIPOS DE COMANDOS
// =============================================================================

/**
 * Contextos onde comandos podem ser executados
 */
export type CommandContext = "BATTLE" | "MATCH" | "GLOBAL";

/**
 * Definição de um comando
 */
export interface CommandDefinition {
  /** Código único do comando (sem a barra) */
  code: string;
  /** Nome legível do comando */
  name: string;
  /** Descrição do que o comando faz */
  description: string;
  /** Sintaxe de uso (ex: "/spawn [quantidade]") */
  usage: string;
  /** Contextos onde o comando pode ser usado */
  allowedContexts: CommandContext[];
  /** Se requer uma unidade selecionada */
  requiresSelectedUnit: boolean;
  /** Nome da função executora no servidor */
  executorName: string;
  /** Parâmetros esperados */
  params: CommandParamDefinition[];
}

/**
 * Definição de parâmetro de comando
 */
export interface CommandParamDefinition {
  /** Nome do parâmetro */
  name: string;
  /** Tipo do parâmetro */
  type: "number" | "string" | "boolean";
  /** Se é obrigatório */
  required: boolean;
  /** Valor padrão */
  defaultValue?: number | string | boolean;
  /** Descrição do parâmetro */
  description: string;
}

// =============================================================================
// PAYLOADS DE COMUNICAÇÃO
// =============================================================================

/**
 * Payload enviado pelo cliente ao executar um comando
 */
export interface CommandPayload {
  /** Código do comando (sem a barra) */
  commandCode: string;
  /** Argumentos do comando parseados */
  args: Record<string, number | string | boolean>;
  /** ID da unidade selecionada (se aplicável) */
  selectedUnitId?: string;
}

/**
 * Resultado da execução de um comando
 */
export interface CommandResult {
  /** Se o comando foi executado com sucesso */
  success: boolean;
  /** Mensagem de feedback */
  message: string;
  /** Dados adicionais (específicos por comando) */
  data?: Record<string, unknown>;
}

/**
 * Resposta do servidor após executar um comando
 */
export interface CommandResponse {
  /** Código do comando executado */
  commandCode: string;
  /** Resultado da execução */
  result: CommandResult;
}

// =============================================================================
// RESULTADO DO PARSING
// =============================================================================

/**
 * Resultado do parsing de uma mensagem de chat
 */
export interface ParsedCommand {
  /** Se a mensagem é um comando */
  isCommand: boolean;
  /** Código do comando (se for comando) */
  commandCode?: string;
  /** Argumentos brutos (string[]) */
  rawArgs?: string[];
  /** Argumentos parseados */
  parsedArgs?: Record<string, number | string | boolean>;
  /** Erro de parsing (se houver) */
  error?: string;
}

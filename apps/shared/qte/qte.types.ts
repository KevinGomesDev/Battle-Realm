// shared/qte/qte.types.ts
// Tipos principais para o Sistema de Quick Time Event (QTE)
// FONTE DE VERDADE para QTE em ataques, defesas, skills e spells

// =============================================================================
// ENUMS E TIPOS BASE
// =============================================================================

/**
 * Tipo de ação do QTE
 */
export type QTEActionType = "ATTACK" | "BLOCK" | "DODGE" | "SKILL" | "SPELL";

/**
 * Resultado do QTE
 */
export type QTEResultGrade = "FAIL" | "HIT" | "PERFECT";

/**
 * Direções para esquiva (WASD)
 */
export type DodgeDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

/**
 * Input do jogador no QTE
 */
export type QTEInput = "E" | "W" | "A" | "S" | "D" | "NONE";

// =============================================================================
// CONFIGURAÇÃO DO QTE (Calculada pelo servidor)
// =============================================================================

/**
 * Parâmetros do QTE calculados pelo servidor baseado nos atributos
 * Enviado ao cliente para renderizar o QTE
 *
 * ARQUITETURA "TRUST BUT VERIFY":
 * - serverStartTime: Timestamp do servidor quando o QTE COMEÇA (futuro)
 * - O cliente agenda o visual para serverStartTime
 * - O cliente envia serverTimestamp estimado quando responde
 * - O servidor valida se serverTimestamp está dentro da janela
 */
export interface QTEConfig {
  /** ID único do QTE (para sincronização) */
  qteId: string;

  /** Tipo de ação sendo realizada */
  actionType: QTEActionType;

  /** ID da batalha */
  battleId: string;

  /** ID da unidade que deve responder ao QTE */
  responderId: string;

  /** ID do jogador dono da unidade que deve responder (para validação no cliente) */
  responderOwnerId: string;

  /** ID do atacante (para contexto) */
  attackerId?: string;

  /** ID do alvo original (para contexto de esquiva) */
  targetId?: string;

  /** Direção do ataque (para mecânica de esquiva) */
  attackDirection?: DodgeDirection;

  /** Tempo total do QTE em milissegundos (afetado por Speed vs Speed) */
  duration: number;

  /** Intensidade do tremor/vibração (0-100, afetado por Combat vs Resistance) */
  shakeIntensity: number;

  /** Tamanho da zona de acerto em porcentagem (5-50%, afetado por Focus vs Focus) */
  hitZoneSize: number;

  /** Tamanho da zona perfeita em porcentagem (1-15%, subset da hitZone) */
  perfectZoneSize: number;

  /** Posição inicial do indicador (0-100%) */
  startPosition: number;

  /** Inputs válidos para este QTE */
  validInputs: QTEInput[];

  /** Inputs inválidos (ex: direção do ataque na esquiva) */
  invalidInputs?: QTEInput[];

  /** Posição do alvo no grid (para calcular esquiva) */
  targetPosition?: { x: number; y: number };

  /** Células bloqueadas para esquiva (paredes, unidades) */
  blockedCells?: { x: number; y: number }[];

  /**
   * Timestamp do SERVIDOR quando o QTE foi criado (para referência)
   * Usar serverStartTime para sincronização real
   */
  createdAt: number;

  /**
   * Timestamp do SERVIDOR quando o QTE COMEÇA (no futuro)
   * O cliente deve agendar o visual para este momento
   */
  serverStartTime: number;

  /**
   * Timestamp do SERVIDOR quando o QTE expira (serverStartTime + duration)
   */
  serverEndTime: number;

  /**
   * @deprecated Use serverEndTime em vez disso
   * Timestamp de quando o QTE expira
   */
  expiresAt: number;

  /** Se é um QTE de defesa em cascata (projétil continuou após esquiva) */
  isCascade?: boolean;

  /** Skill/Spell sendo usado (para contexto visual) */
  skillCode?: string;
  spellCode?: string;
}

// =============================================================================
// RESPOSTA E RESULTADO DO QTE
// =============================================================================

/**
 * Resposta do jogador ao QTE
 *
 * ARQUITETURA "TRUST BUT VERIFY":
 * - O cliente envia serverTimestamp (tempo estimado do servidor quando apertou)
 * - O servidor valida se está dentro da janela com tolerância
 */
export interface QTEResponse {
  /** ID do QTE sendo respondido */
  qteId: string;

  /** ID da batalha */
  battleId: string;

  /** ID do jogador respondendo */
  playerId: string;

  /** ID da unidade respondendo */
  unitId: string;

  /** Input do jogador (E, W, A, S, D ou NONE se não apertou) */
  input: QTEInput;

  /** Posição do indicador quando o jogador apertou (0-100%) */
  hitPosition: number;

  /**
   * Timestamp estimado do SERVIDOR quando o jogador apertou
   * Calculado pelo cliente: serverStartTime + tempoDecorrido
   */
  serverTimestamp: number;

  /**
   * @deprecated Use serverTimestamp
   * Timestamp de quando o jogador respondeu (tempo local)
   */
  respondedAt: number;
}

/**
 * Resultado processado do QTE (calculado pelo servidor)
 */
export interface QTEResult {
  /** ID do QTE */
  qteId: string;

  /** ID da batalha */
  battleId: string;

  /** Grau do resultado */
  grade: QTEResultGrade;

  /** Tipo de ação que foi executada */
  actionType: QTEActionType;

  /** ID da unidade que respondeu */
  responderId: string;

  /** Modificador de dano (0.5, 1.0 ou 1.5 para ataque) */
  damageModifier: number;

  /** Modificador de redução de dano (1.0, 0.5 ou 0.25 para bloqueio) */
  damageReductionModifier?: number;

  /** Se a esquiva foi bem-sucedida */
  dodgeSuccessful?: boolean;

  /** Direção da esquiva (se aplicável) */
  dodgeDirection?: DodgeDirection;

  /** Nova posição após esquiva */
  newPosition?: { x: number; y: number };

  /** Se o projétil continua após esquiva */
  projectileContinues?: boolean;

  /** Próximo alvo na trajetória (se projétil continua) */
  nextTargetId?: string;

  /** Buff aplicado por esquiva perfeita */
  perfectDodgeBuff?: string;

  /** Mensagem de feedback para o jogador */
  feedbackMessage: string;

  /** Cor do feedback (para UI) */
  feedbackColor: string;

  /** Se o jogador não respondeu a tempo */
  timedOut: boolean;
}

// =============================================================================
// ESTADO DO QTE NO CLIENTE
// =============================================================================

/**
 * Estado do QTE para gerenciamento no cliente
 */
export interface QTEClientState {
  /** QTE ativo atual (se houver) */
  activeQTE: QTEConfig | null;

  /** Posição atual do indicador (0-100%) */
  indicatorPosition: number;

  /** Se o jogador já respondeu */
  hasResponded: boolean;

  /** Resposta do jogador (se já respondeu) */
  response: QTEResponse | null;

  /** Resultado do QTE (quando resolvido) */
  result: QTEResult | null;

  /** Histórico de QTEs desta batalha */
  history: QTEResult[];

  /** Se está aguardando QTE de outro jogador */
  waitingForOpponent: boolean;
}

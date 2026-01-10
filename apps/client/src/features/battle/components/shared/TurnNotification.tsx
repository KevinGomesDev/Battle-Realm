import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TurnNotificationProps {
  // Props de identificação de turno
  currentPlayerId: string | null | undefined;
  myUserId: string | undefined;
  round: number;
  isRoundStart?: boolean;
  currentPlayerKingdomName?: string;

  // Props para auto-end (condições da unidade)
  myUnitHasStartedAction: boolean;
  myUnitMovesLeft: number;
  myUnitActionsLeft: number;
  myUnitAttacksLeft: number;

  // Callback para encerrar turno
  onEndAction: () => void;
}

export function TurnNotification({
  currentPlayerId,
  myUserId,
  round,
  isRoundStart = false,
  currentPlayerKingdomName,
  myUnitHasStartedAction,
  myUnitMovesLeft,
  myUnitActionsLeft,
  myUnitAttacksLeft,
  onEndAction,
}: TurnNotificationProps) {
  // Estado do componente
  const [showTurnStart, setShowTurnStart] = useState(false);

  // Refs para controle
  const turnKeyRef = useRef<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoEndTriggeredRef = useRef<boolean>(false);

  const isMyTurn = currentPlayerId === myUserId;

  // Criar chave única para o turno
  const turnKey = `${currentPlayerId}-${round}`;

  // Detectar mudança de turno e mostrar modal
  useEffect(() => {
    if (!currentPlayerId || !myUserId) return;

    // Se mudou de turno
    if (turnKeyRef.current !== turnKey) {
      console.log("[TurnNotification] 🔄 Novo turno detectado:", turnKey);
      turnKeyRef.current = turnKey;

      // Resetar estados
      autoEndTriggeredRef.current = false;

      // Limpar timers anteriores
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      // Mostrar modal de início de turno após delay
      setTimeout(() => {
        setShowTurnStart(true);
      }, 800);
    }
  }, [turnKey, currentPlayerId, myUserId]);

  // Auto-hide do modal de início de turno após 3 segundos
  useEffect(() => {
    if (showTurnStart) {
      hideTimerRef.current = setTimeout(() => {
        console.log("[TurnNotification] ⏱️ Auto-hide do modal turn-start");
        setShowTurnStart(false);
      }, 3000);

      return () => {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
      };
    }
  }, [showTurnStart]);

  // Função estável para encerrar turno
  const triggerEndAction = useCallback(() => {
    if (autoEndTriggeredRef.current) return;
    autoEndTriggeredRef.current = true;
    console.log("[TurnNotification] ✅ Chamando onEndAction");
    onEndAction();
  }, [onEndAction]);

  // Lógica de auto-end: encerrar turno instantaneamente quando condições são atendidas
  useEffect(() => {
    // Não é meu turno - não fazer nada
    if (!isMyTurn) {
      return;
    }

    // Modal de turn-start ainda visível - não encerrar
    if (showTurnStart) {
      return;
    }

    // Já disparou auto-end neste turno
    if (autoEndTriggeredRef.current) {
      return;
    }

    // Verificar condições para auto-end
    const shouldAutoEnd =
      myUnitHasStartedAction &&
      myUnitMovesLeft === 0 &&
      myUnitActionsLeft === 0 &&
      myUnitAttacksLeft === 0;

    // Se não deve auto-end, não fazer nada
    if (!shouldAutoEnd) {
      return;
    }

    // Encerrar turno instantaneamente
    triggerEndAction();
  }, [
    isMyTurn,
    showTurnStart,
    myUnitHasStartedAction,
    myUnitMovesLeft,
    myUnitActionsLeft,
    myUnitAttacksLeft,
    triggerEndAction,
  ]);

  // Determinar o que mostrar
  const content: "turn-start" | null = showTurnStart ? "turn-start" : null;

  // Cores
  const colors = isMyTurn
    ? {
        border: "border-amber-500/50",
        shadow: "shadow-amber-500/20",
        glow: "from-amber-500/30",
        accent: "text-amber-400",
        gradient: "from-amber-300 via-yellow-400 to-amber-300",
        line: "via-amber-400",
        lineFaded: "via-amber-500/50",
      }
    : {
        border: "border-blue-500/50",
        shadow: "shadow-blue-500/20",
        glow: "from-blue-500/30",
        accent: "text-blue-400",
        gradient: "from-blue-300 via-cyan-400 to-blue-300",
        line: "via-blue-400",
        lineFaded: "via-blue-500/50",
      };

  return (
    <AnimatePresence mode="wait">
      {content && (
        <motion.div
          key={content}
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.9 }}
          transition={{
            duration: 0.3,
            ease: "easeOut",
          }}
          className="fixed top-1/2 right-4 -translate-y-1/2 z-[100]"
        >
          {/* Brilho de fundo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={`absolute inset-0 -m-4 blur-2xl bg-gradient-radial ${colors.glow} via-transparent to-transparent`}
          />

          {/* Card */}
          <motion.div
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className={`relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 rounded-xl shadow-2xl px-6 py-4 min-w-[200px] ${colors.border} ${colors.shadow}`}
          >
            {/* Decoração superior */}
            <div
              className={`absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-transparent to-transparent rounded-full ${colors.line}`}
            />

            {content === "turn-start" ? (
              <>
                {/* Ícone */}
                <motion.div
                  className="flex justify-center mb-3"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: 0.15,
                  }}
                >
                  <div className="relative">
                    <motion.span
                      className="text-4xl block"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      {isMyTurn ? "⚔️" : "⏳"}
                    </motion.span>
                    <div
                      className={`absolute inset-0 blur-xl rounded-full ${
                        isMyTurn ? "bg-amber-400/20" : "bg-blue-400/20"
                      }`}
                    />
                  </div>
                </motion.div>

                {/* Texto principal */}
                <motion.div
                  className="text-center space-y-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  {isRoundStart && (
                    <motion.p
                      className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-stellar-amber via-stellar-light to-stellar-amber"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 }}
                    >
                      🎯 Rodada {round}
                    </motion.p>
                  )}

                  {isMyTurn ? (
                    <motion.h2
                      className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${colors.gradient}`}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                        delay: 0.2,
                      }}
                    >
                      SEU TURNO!
                    </motion.h2>
                  ) : (
                    <>
                      <p className="text-gray-400 text-xs uppercase tracking-wider">
                        Turno de
                      </p>
                      <h2
                        className={`text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${colors.gradient}`}
                      >
                        {currentPlayerKingdomName || "Oponente"}
                      </h2>
                    </>
                  )}

                  {!isRoundStart && (
                    <p className="text-gray-400 text-sm">
                      Rodada <span className={colors.accent}>{round}</span>
                    </p>
                  )}
                </motion.div>
              </>
            ) : null}

            {/* Decoração inferior */}
            <div
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-gradient-to-r from-transparent to-transparent rounded-full ${colors.lineFaded}`}
            />

            {/* Cantos decorativos */}
            <div
              className={`absolute top-1.5 left-1.5 w-3 h-3 border-l-2 border-t-2 rounded-tl ${colors.border}`}
            />
            <div
              className={`absolute top-1.5 right-1.5 w-3 h-3 border-r-2 border-t-2 rounded-tr ${colors.border}`}
            />
            <div
              className={`absolute bottom-1.5 left-1.5 w-3 h-3 border-l-2 border-b-2 rounded-bl ${colors.border}`}
            />
            <div
              className={`absolute bottom-1.5 right-1.5 w-3 h-3 border-r-2 border-b-2 rounded-br ${colors.border}`}
            />
          </motion.div>

          {/* Partículas animadas */}
          <motion.div
            className={`absolute -top-2 -left-2 w-1.5 h-1.5 rounded-full ${
              isMyTurn ? "bg-amber-400" : "bg-blue-400"
            }`}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className={`absolute -bottom-2 -right-2 w-1.5 h-1.5 rounded-full ${
              isMyTurn ? "bg-amber-500" : "bg-blue-500"
            }`}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

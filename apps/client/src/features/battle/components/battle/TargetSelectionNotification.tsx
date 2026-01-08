import { motion, AnimatePresence } from "framer-motion";
import {
  getAbilityInfo,
  findAbilityByCode,
} from "@boundless/shared/data/abilities.data";

interface TargetSelectionNotificationProps {
  /** Código da ability pendente (ou "ATTACK" para ataque) */
  pendingAction: string | null;
  onCancel: () => void;
}

export function TargetSelectionNotification({
  pendingAction,
  onCancel,
}: TargetSelectionNotificationProps) {
  if (!pendingAction) return null;

  // Determinar informações da ação pendente usando API unificada
  let actionInfo: { icon: string; name: string; targetText: string } | null =
    null;

  // Caso especial: ATTACK
  if (pendingAction === "ATTACK" || pendingAction === "attack") {
    actionInfo = {
      icon: "⚔️",
      name: "Ataque",
      targetText: "um alvo adjacente",
    };
  } else {
    // Buscar ability pela API unificada
    const abilityDef = findAbilityByCode(pendingAction);
    const abilityInfo = getAbilityInfo(pendingAction);

    if (abilityDef && abilityInfo) {
      // Texto de alvo baseado no targetType
      let targetText = "uma unidade alvo";
      if (
        abilityDef.targetType === "POSITION" ||
        abilityDef.targetType === "GROUND"
      ) {
        targetText = "uma posição no mapa";
      } else if (abilityDef.range === "MELEE") {
        targetText = "um alvo adjacente";
      } else if (abilityDef.range === "RANGED") {
        targetText = "um alvo no alcance";
      } else if (abilityDef.range === "AREA") {
        targetText = "uma posição para a área";
      }

      actionInfo = {
        icon: abilityInfo.icon,
        name: abilityInfo.name,
        targetText,
      };
    }
  }

  if (!actionInfo) {
    actionInfo = {
      icon: "🎯",
      name: "Ação",
      targetText: "um alvo",
    };
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="target-selection"
        initial={{ opacity: 0, x: 50, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 50, scale: 0.9 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed top-1/2 right-4 -translate-y-1/2 z-[100]"
      >
        {/* Brilho de fundo vermelho */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 -m-4 blur-2xl bg-gradient-radial from-red-500/30 via-transparent to-transparent"
        />

        {/* Card principal */}
        <motion.div
          initial={{ y: 10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-red-500/50 rounded-xl shadow-2xl shadow-red-500/20 px-6 py-4 min-w-[220px] max-w-[280px]"
        >
          {/* Decoração superior */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-transparent via-red-400 to-transparent rounded-full" />

          {/* Ícone animado */}
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
                animate={{ scale: [1, 1.15, 1] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {actionInfo.icon}
              </motion.span>
              <div className="absolute inset-0 blur-xl rounded-full bg-red-400/20" />
            </div>
          </motion.div>

          {/* Texto principal */}
          <motion.div
            className="text-center space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-300 via-red-400 to-red-300">
              {actionInfo.name}
            </h2>

            <p className="text-gray-300 text-sm leading-relaxed">
              Mire e{" "}
              <span className="text-red-400 font-semibold">
                clique para confirmar
              </span>
            </p>

            <p className="text-gray-500 text-xs">Botão direito para cancelar</p>
          </motion.div>

          {/* Botão Cancelar */}
          <motion.button
            onClick={onCancel}
            className="mt-4 w-full py-2 px-4 bg-surface-700/70 hover:bg-red-600/30 border border-surface-500 hover:border-red-500/50 rounded-lg text-astral-chrome text-sm font-medium transition-all duration-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ✕ Cancelar
          </motion.button>

          {/* Decoração inferior */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-gradient-to-r from-transparent via-red-500/50 to-transparent rounded-full" />

          {/* Cantos decorativos */}
          <div className="absolute top-1.5 left-1.5 w-3 h-3 border-l-2 border-t-2 rounded-tl border-red-500/50" />
          <div className="absolute top-1.5 right-1.5 w-3 h-3 border-r-2 border-t-2 rounded-tr border-red-500/50" />
          <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-l-2 border-b-2 rounded-bl border-red-500/50" />
          <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-r-2 border-b-2 rounded-br border-red-500/50" />
        </motion.div>

        {/* Partículas animadas */}
        <motion.div
          className="absolute -top-2 -left-2 w-1.5 h-1.5 rounded-full bg-red-400"
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-2 -right-2 w-1.5 h-1.5 rounded-full bg-red-500"
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
    </AnimatePresence>
  );
}

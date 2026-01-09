// client/src/features/arena/components/CountdownOverlay.tsx
// Overlay de countdown antes da batalha iniciar

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Challenge } from "@boundless/shared/types/arena.types";

interface CountdownOverlayProps {
  challenge: Challenge;
  countdown: number;
}

/**
 * Overlay fullscreen com countdown antes da batalha
 */
export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  challenge,
  countdown,
}) => {
  const [displayCount, setDisplayCount] = useState(countdown);

  useEffect(() => {
    setDisplayCount(countdown);
  }, [countdown]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md"
    >
      <div className="text-center">
        {/* VS Header */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-center gap-8">
            {/* Challenger */}
            <div className="text-right">
              <p
                className="text-stellar-amber font-bold text-2xl"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {challenge.challenger.kingdomName}
              </p>
              <p className="text-astral-steel">
                {challenge.challenger.username}
              </p>
              <p className="text-astral-silver text-sm">
                ⚡ {challenge.challenger.power} • 👥{" "}
                {challenge.challenger.unitCount}
              </p>
            </div>

            {/* VS */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="text-6xl font-bold text-stellar-amber"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              ⚔️
            </motion.div>

            {/* Challenged */}
            <div className="text-left">
              <p
                className="text-mystic-purple font-bold text-2xl"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {challenge.challenged?.kingdomName || "???"}
              </p>
              <p className="text-astral-steel">
                {challenge.challenged?.username || "Desconhecido"}
              </p>
              <p className="text-astral-silver text-sm">
                ⚡ {challenge.challenged?.power || 0} • 👥{" "}
                {challenge.challenged?.unitCount || 0}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Countdown */}
        <motion.div
          key={displayCount}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative"
        >
          {displayCount > 0 ? (
            <>
              <p className="text-9xl font-bold text-stellar-amber drop-shadow-glow">
                {displayCount}
              </p>
              <p className="text-astral-steel text-xl mt-4">
                Preparando o campo de batalha...
              </p>
            </>
          ) : (
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <p
                className="text-6xl font-bold text-stellar-amber tracking-widest"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                ⚔️ BATALHA! ⚔️
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <div className="flex items-center justify-center gap-2">
            <div
              className="w-2 h-2 bg-stellar-amber rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-2 h-2 bg-stellar-amber rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-2 h-2 bg-stellar-amber rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

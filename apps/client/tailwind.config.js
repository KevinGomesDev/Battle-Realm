/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // BOUNDLESS - Cosmic Palette
        cosmos: {
          void: "#050510", // Vazio cósmico - máxima profundidade
          deep: "#0a0a1a", // Espaço profundo
          dark: "#0d0d20", // Nebulosa escura
          space: "#121230", // Céu noturno
          nebula: "#1a1a40", // Nebulosa visível
        },
        stellar: {
          gold: "#f59e0b", // Ouro estelar (amber-500)
          amber: "#fbbf24", // Âmbar brilhante (amber-400)
          light: "#fcd34d", // Luz dourada (amber-300)
          pale: "#fde68a", // Dourado pálido (amber-200)
          dark: "#d97706", // Ouro profundo (amber-600)
          deep: "#b45309", // Âmbar escuro (amber-700)
        },
        astral: {
          silver: "#94a3b8", // Prata astral (slate-400)
          steel: "#64748b", // Aço cósmico (slate-500)
          chrome: "#cbd5e1", // Cromo brilhante (slate-300)
          dim: "#475569", // Prata escura (slate-600)
          dark: "#334155", // Aço profundo (slate-700)
        },
        arcane: {
          violet: "#8b5cf6", // Violeta arcano (violet-500)
          purple: "#7c3aed", // Roxo místico (violet-600)
          deep: "#5b21b6", // Púrpura profunda (violet-800)
          dark: "#3b0764", // Escuridão arcana (violet-950)
          glow: "#a78bfa", // Brilho arcano (violet-400)
        },
        mystic: {
          blue: "#3b82f6", // Azul místico (blue-500)
          cyan: "#22d3ee", // Ciano estelar (cyan-400)
          sky: "#0ea5e9", // Céu místico (sky-500)
          deep: "#1d4ed8", // Azul profundo (blue-700)
          glow: "#60a5fa", // Brilho azul (blue-400)
        },
        ember: {
          green: "#22c55e", // Verde energia (green-500)
          emerald: "#10b981", // Esmeralda (emerald-500)
          teal: "#14b8a6", // Verde-azulado (teal-500)
          glow: "#4ade80", // Brilho verde (green-400)
        },
        surface: {
          900: "#0f0f1a", // Card backgrounds
          800: "#1a1a2d", // Elevated surfaces
          700: "#252545", // Hover states
          600: "#2f2f56", // Active states
          500: "#3d3d6b", // Borders
          400: "#4f4f80", // Subtle borders
          300: "#6b6b99", // Disabled text
          200: "#8888aa", // Secondary text
          100: "#ababcc", // Primary text muted
        },
      },
      fontFamily: {
        display: ["Orbitron", "sans-serif"], // Títulos futurísticos
        heading: ["Rajdhani", "sans-serif"], // Cabeçalhos
        body: ["Inter", "system-ui", "sans-serif"], // Corpo do texto
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
        "cosmic-rotate": "cosmicRotate 20s linear infinite",
        "star-twinkle": "starTwinkle 3s ease-in-out infinite",
        "stellar-pulse": "stellarPulse 3s ease-in-out infinite",
        "arcane-pulse": "arcanePulse 3s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.8", filter: "brightness(1.2)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(0.95)" },
        },
        cosmicRotate: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        starTwinkle: {
          "0%, 100%": { opacity: "0.3", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        stellarPulse: {
          "0%, 100%": {
            boxShadow:
              "0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(245, 158, 11, 0.2)",
          },
          "50%": {
            boxShadow:
              "0 0 30px rgba(251, 191, 36, 0.5), 0 0 60px rgba(245, 158, 11, 0.3)",
          },
        },
        arcanePulse: {
          "0%, 100%": {
            boxShadow:
              "0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(124, 58, 237, 0.2)",
          },
          "50%": {
            boxShadow:
              "0 0 30px rgba(139, 92, 246, 0.5), 0 0 60px rgba(124, 58, 237, 0.3)",
          },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        cosmos:
          "linear-gradient(180deg, #050510 0%, #0a0a1a 50%, #0d0d20 100%)",
        "cosmos-radial":
          "radial-gradient(ellipse at 50% 0%, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 25%, transparent 60%)",
        "stellar-glow":
          "radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.15) 0%, transparent 70%)",
        "arcane-glow":
          "radial-gradient(ellipse at top, rgba(139, 92, 246, 0.15) 0%, transparent 60%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(15, 15, 26, 0.98) 100%)",
        "surface-gradient":
          "linear-gradient(180deg, rgba(37, 37, 69, 0.5) 0%, rgba(26, 26, 46, 0.8) 100%)",
      },
      boxShadow: {
        stellar:
          "0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(245, 158, 11, 0.15)",
        arcane:
          "0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(124, 58, 237, 0.15)",
        cosmic:
          "0 4px 20px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.1)",
        card: "0 4px 16px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.1)",
        "card-hover":
          "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(251, 191, 36, 0.1)",
        inset:
          "inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(255,255,255,0.05)",
      },
      borderColor: {
        stellar: "rgba(251, 191, 36, 0.5)",
        arcane: "rgba(139, 92, 246, 0.5)",
        surface: "rgba(79, 79, 128, 0.3)",
      },
    },
  },
  plugins: [],
};

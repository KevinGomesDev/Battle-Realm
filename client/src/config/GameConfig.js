export const GameConfig = {
  // --- CONFIGURAÇÕES DO MAPA ESTRATÉGICO ---
  MAP: {
    TOTAL_TERRITORIES: 50, // Exemplo: Quantos pontos o Voronoi vai gerar
    RELAXATION_STEPS: 2, // Suavização do Voronoi
    STROKE_WIDTH: 2,
    STROKE_COLOR: 0x1a1a1a,
    WATER_COLOR: 0x457b9d,
  },

  // --- CONFIGURAÇÕES DO MODAL DE TERRITÓRIO ---
  TERRITORY: {
    // Quantidade de slots (hexágonos) por tamanho de território
    SLOTS: {
      Pequeno: 10,
      Médio: 20,
      Grande: 30,
      // Fallback caso venha null
      DEFAULT: 20,
    },
    // Visual
    BORDER_COLOR: 0xffffff,
    BORDER_ALPHA: 0.5,
    BORDER_THICKNESS: 4,
  },

  // --- CONFIGURAÇÕES DO MODAL DE COMBATE ---
  COMBAT: {
    // Definições do Grid
    GRID: {
      COLS: 25,
      ROWS: 25,
      FIXED_RADIUS: 35, // Tamanho do hexágono (controle do tamanho total do mapa)
    },
    // Controle de Zoom e Pan
    ZOOM: {
      MIN: 0.1,
      MAX: 3.0,
      STEP: 0.1, // Velocidade do zoom
    },
    // Visual
    COLORS: {
      TITLE_BG: 0x000000,
      TITLE_TEXT: "#ffffff",
    },
  },

  // --- CORES GERAIS DA UI ---
  UI: {
    COLORS: {
      BACKDROP: 0x000000,
      BACKDROP_ALPHA: 0.8,
      HEX_DEFAULT: 0x888888,
      HEX_HIGHLIGHT: 0xffffff,
      HEX_SELECTED: 0xffd700,
    },
  },
};

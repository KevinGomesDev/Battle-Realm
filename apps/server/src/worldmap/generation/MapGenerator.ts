// server/src/worldmap/generation/MapGenerator.ts
import { BiomeGenerator } from "./BiomeGenerator";
import { type TerrainType } from "@boundless/shared/config";

/**
 * Estrutura de um território gerado
 *
 * @property id - Índice único do território (0-24 terra, 25+ água)
 * @property center - Ponto central do quadrado
 * @property type - LAND (terra navegável) ou WATER (oceano)
 * @property terrain - Tipo de bioma (Gelo, Floresta, etc)
 * @property polygonPoints - Array de 4 vértices do quadrado (sentido horário)
 * @property size - Tamanho do território (SMALL=5 slots, MEDIUM=10, LARGE=15)
 * @property areaSlots - Slots totais disponíveis para construções
 */
export interface GeneratedTerritory {
  id: number;
  center: { x: number; y: number };
  type: "LAND" | "WATER";
  terrain: TerrainType;
  polygonPoints: [number, number][]; // [topLeft, topRight, bottomRight, bottomLeft]
  size: "SMALL" | "MEDIUM" | "LARGE";
  areaSlots: number;
}

/**
 * Gerador de mapa procedural usando grid de quadrados
 *
 * Layout:
 * - 5x5 grid de terra (25 territórios)
 * - Bordas de água em volta (20 territórios)
 * - Total: ~45 territórios no mapa
 */
export class MapGenerator {
  width: number;
  height: number;
  gridCols: number;
  gridRows: number;
  cellSize: number;

  biomeGenerator: BiomeGenerator;
  territoryData: GeneratedTerritory[];

  /**
   * @param width - Largura do mapa em pixels (default: 2000)
   * @param height - Altura do mapa em pixels (default: 1600)
   * @param gridSize - Tamanho do grid de terra (default: 25 = 5x5)
   */
  constructor(width = 2000, height = 1600, gridSize = 25) {
    this.width = width;
    this.height = height;
    this.gridCols = 5;
    this.gridRows = 5;
    this.cellSize = this.width / this.gridCols; // 400 pixels por célula
    this.territoryData = [];
    this.biomeGenerator = new BiomeGenerator(width, height);
  }

  /**
   * Gera o mapa completo
   *
   * Processo:
   * 1. Gera sementes de bioma
   * 2. Cria grid 5x5 de terra com tipos de terreno
   * 3. Atribui tamanhos aleatórios
   * 4. Cria bordas de água ao redor
   *
   * @returns Array de territórios gerados
   */
  generate(): GeneratedTerritory[] {
    this.biomeGenerator.generateBioSeeds(10);
    this.territoryData = [];

    const SIZES: ("SMALL" | "MEDIUM" | "LARGE")[] = [
      "SMALL",
      "MEDIUM",
      "LARGE",
    ];
    const SLOTS_MAP = { SMALL: 5, MEDIUM: 10, LARGE: 15 };

    let id = 0;

    // ============================================================
    // TERRA: Grid 5x5
    // ============================================================
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;
        const centerX = x + this.cellSize / 2;
        const centerY = y + this.cellSize / 2;

        // Obter bioma baseado na posição e nas sementes
        const terrain = this.biomeGenerator.getBiomeForPoint(centerX, centerY);

        // Tamanho aleatório
        const randomSize = SIZES[Math.floor(Math.random() * SIZES.length)];
        const areaSlots = SLOTS_MAP[randomSize];

        // 4 cantos do quadrado
        const polygonPoints: [number, number][] = [
          [x, y],
          [x + this.cellSize, y],
          [x + this.cellSize, y + this.cellSize],
          [x, y + this.cellSize],
        ];

        this.territoryData.push({
          id: id,
          center: { x: centerX, y: centerY },
          type: "LAND",
          terrain: terrain,
          polygonPoints: polygonPoints,
          size: randomSize,
          areaSlots: areaSlots,
        });

        id++;
      }
    }

    // ============================================================
    // ÁGUA: Bordas (4 faixas de 100px)
    // ============================================================
    const BORDER_WIDTH = 100;

    // Superior
    this._createWaterBorder(
      -BORDER_WIDTH,
      0,
      this.cellSize,
      BORDER_WIDTH,
      id,
      (id += this.gridCols)
    );
    id += this.gridCols;

    // Inferior
    this._createWaterBorder(
      this.gridRows * this.cellSize,
      0,
      this.cellSize,
      BORDER_WIDTH,
      id,
      (id += this.gridCols)
    );
    id += this.gridCols;

    // Esquerda
    this._createWaterBorder(
      0,
      -BORDER_WIDTH,
      BORDER_WIDTH,
      this.cellSize,
      id,
      (id += this.gridRows)
    );
    id += this.gridRows;

    // Direita
    this._createWaterBorder(
      0,
      this.gridCols * this.cellSize,
      BORDER_WIDTH,
      this.cellSize,
      id,
      (id += this.gridRows)
    );

    return this.territoryData;
  }

  /**
   * Cria faixa de água
   * @private
   */
  private _createWaterBorder(
    rowOrX: number,
    colOrY: number,
    width: number,
    height: number,
    startId: number,
    endId: number
  ) {
    let id = startId;

    for (let i = 0; i < this.gridCols || i < this.gridRows; i++) {
      if (id >= endId) break;

      const isHorizontal = width > height;
      const x = isHorizontal ? i * this.cellSize : colOrY;
      const y = isHorizontal ? rowOrX : i * this.cellSize;

      const centerX = x + (isHorizontal ? this.cellSize / 2 : width / 2);
      const centerY = y + (isHorizontal ? height / 2 : this.cellSize / 2);

      const polygonPoints: [number, number][] = [
        [x, y],
        [x + (isHorizontal ? this.cellSize : width), y],
        [
          x + (isHorizontal ? this.cellSize : width),
          y + (isHorizontal ? height : this.cellSize),
        ],
        [x, y + (isHorizontal ? height : this.cellSize)],
      ];

      this.territoryData.push({
        id: id,
        center: { x: centerX, y: centerY },
        type: "WATER",
        terrain: "OCEAN" as TerrainType,
        polygonPoints: polygonPoints,
        size: "LARGE",
        areaSlots: 0,
      });

      id++;
    }
  }
}

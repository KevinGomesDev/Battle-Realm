// server/src/logic/MapGenerator.ts
import { Delaunay } from "d3-delaunay";
import { BiomeGenerator } from "./BiomeGenerator";
import { type TerrainType } from "../../../../shared/config";

// Tipos de tamanho compatíveis com o enum do Prisma
export type TerritorySize = "SMALL" | "MEDIUM" | "LARGE";

// Mapa de slots por tamanho
const SLOTS_MAP: Record<TerritorySize, number> = {
  SMALL: 5,
  MEDIUM: 10,
  LARGE: 15,
};

// Define a estrutura de dados que o gerador cospe
export interface GeneratedTerritory {
  id: number;
  center: { x: number; y: number }; // Importante salvar o centro
  type: "LAND" | "WATER";
  terrain: TerrainType;
  polygonPoints: [number, number][]; // Array de pontos para o front desenhar
  size: TerritorySize;
  areaSlots: number;
}

export class MapGenerator {
  width: number;
  height: number;
  MAP_SIZE: number;
  MIN_TERRITORY_DIST: number;

  biomeGenerator: BiomeGenerator;
  territoryData: GeneratedTerritory[];

  constructor(width = 2000, height = 1600) {
    // Tamanho padrão do mundo lógico
    this.width = width;
    this.height = height;
    this.MAP_SIZE = 25;
    this.MIN_TERRITORY_DIST = 100;
    this.territoryData = [];
    this.biomeGenerator = new BiomeGenerator(width, height);
  }

  generate(): GeneratedTerritory[] {
    this.biomeGenerator.generateBioSeeds(10);

    const landPoints: [number, number][] = [];
    const waterPoints: [number, number][] = [];

    const marginX = this.width * 0.2;
    const marginY = this.height * 0.2;
    const bounds = {
      minX: marginX,
      maxX: this.width - marginX,
      minY: marginY,
      maxY: this.height - marginY,
    };

    // --- 1. Gerar Pontos de Terra ---
    let attempts = 0;
    while (landPoints.length < this.MAP_SIZE && attempts < 2000) {
      attempts++;
      const x = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
      const y = Math.random() * (bounds.maxY - bounds.minY) + bounds.minY;

      let tooClose = false;
      for (const p of landPoints) {
        const dist = Math.sqrt(Math.pow(p[0] - x, 2) + Math.pow(p[1] - y, 2));
        if (dist < this.MIN_TERRITORY_DIST) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) landPoints.push([x, y]);
    }

    const numLandTerritories = landPoints.length;

    // --- 2. Gerar Pontos de Água (Borda) ---
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const dx = bounds.minX + (i * (bounds.maxX - bounds.minX)) / steps;
      waterPoints.push([dx, bounds.minY - 40]);
      waterPoints.push([dx, bounds.maxY + 40]);
    }
    for (let i = 0; i <= steps; i++) {
      const dy = bounds.minY + (i * (bounds.maxY - bounds.minY)) / steps;
      waterPoints.push([bounds.minX - 40, dy]);
      waterPoints.push([bounds.maxX + 40, dy]);
    }

    // Água extra aleatória
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      if (
        x < bounds.minX ||
        x > bounds.maxX ||
        y < bounds.minY ||
        y > bounds.maxY
      ) {
        waterPoints.push([x, y]);
      }
    }

    // --- 3. Voronoi ---
    const allPoints = [...landPoints, ...waterPoints];
    const delaunay = Delaunay.from(allPoints);
    const voronoi = delaunay.voronoi([0, 0, this.width, this.height]);

    // --- 4. Montar Dados Finais ---
    const SIZES: TerritorySize[] = ["SMALL", "MEDIUM", "LARGE"];

    this.territoryData = allPoints
      .map((point, index) => {
        // Obtém o polígono como array de pontos [[x,y], [x,y]...]
        const polygon = voronoi.cellPolygon(index);

        if (!polygon) return null; // Segurança

        // ÁGUA
        if (index >= numLandTerritories) {
          return {
            id: index,
            center: { x: point[0], y: point[1] },
            type: "WATER" as const,
            terrain: "OCEAN" as TerrainType,
            polygonPoints: polygon as [number, number][],
            size: "MEDIUM" as TerritorySize,
            areaSlots: 0,
          };
        }

        // TERRA
        const [x, y] = point;
        const terrain = this.biomeGenerator.getBiomeForPoint(x, y);
        const randomSize = SIZES[Math.floor(Math.random() * SIZES.length)];
        const areaSlots = SLOTS_MAP[randomSize];

        return {
          id: index,
          center: { x, y },
          type: "LAND" as const,
          terrain: terrain,
          polygonPoints: polygon as [number, number][],
          size: randomSize,
          areaSlots,
        };
      })
      .filter((t) => t !== null) as GeneratedTerritory[];

    return this.territoryData;
  }
}

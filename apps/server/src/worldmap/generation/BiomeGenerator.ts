// server/src/worldmap/generation/BiomeGenerator.ts
import { type TerrainType } from "@boundless/shared/config";
import { MathUtils } from "../../utils/math";

interface BioSeed {
  x: number;
  y: number;
  type: TerrainType;
}

export class BiomeGenerator {
  width: number;
  height: number;
  biomeCenters: BioSeed[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.biomeCenters = [];
  }

  generateBioSeeds(count = 8) {
    this.biomeCenters = [];

    const marginX = this.width * 0.2;
    const marginY = this.height * 0.2;
    const areaW = this.width - marginX * 2;
    const areaH = this.height - marginY * 2;

    for (let i = 0; i < count; i++) {
      const x = marginX + Math.random() * areaW;
      const y = marginY + Math.random() * areaH;
      const type = this.getBiomeTypeByLatitude(y);

      this.biomeCenters.push({ x, y, type });
    }
  }

  getBiomeTypeByLatitude(y: number): TerrainType {
    const mapTop = this.height * 0.2;
    const mapBottom = this.height * 0.8;
    const mapHeight = mapBottom - mapTop;
    const pct = (y - mapTop) / mapHeight;

    if (pct < 0.25) return "ICE";
    if (pct < 0.35) return "MOUNTAIN";
    if (pct < 0.65) return Math.random() > 0.5 ? "FOREST" : "PLAINS";
    if (pct < 0.8) return "WASTELAND";
    return "DESERT";
  }

  getBiomeForPoint(x: number, y: number): TerrainType {
    let closestSeed: BioSeed | null = null;
    let minDist = Infinity;

    for (const seed of this.biomeCenters) {
      const dist = MathUtils.distance(x, y, seed.x, seed.y);
      const noise = Math.random() * 50 - 25;

      if (dist + noise < minDist) {
        minDist = dist;
        closestSeed = seed;
      }
    }

    return closestSeed ? closestSeed.type : "PLAINS";
  }
}

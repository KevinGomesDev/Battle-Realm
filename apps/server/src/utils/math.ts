// server/src/utils/math.ts

export const MathUtils = {
  distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  },

  randomRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  },
};

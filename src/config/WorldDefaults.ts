/**
 * World configuration defaults
 */

export interface WorldBounds {
  width: number;
  height: number;
}

export interface CourseUpdateLevel {
  minDist: number;
  maxDist: number;
  interval: number;  // Turns between updates
}

export const WORLD_DEFAULTS = {
  width: 1000,
  height: 1000,
  chunkSize: 64,
  get chunkCount() {
    return {
      x: Math.ceil(this.width / this.chunkSize),
      y: Math.ceil(this.height / this.chunkSize)
    };
  },
  maxActiveChunks: 9,  // 3x3 grid
  fullUpdateDistance: 1,
  courseUpdateSchedule: [
    { minDist: 2, maxDist: 3, interval: 5 },
    { minDist: 4, maxDist: 6, interval: 20 },
    { minDist: 7, maxDist: Infinity, interval: 100 }
  ] as CourseUpdateLevel[]
};

/**
 * Update Scheduler - Distance-based update scheduling
 */

import { WORLD_DEFAULTS, CourseUpdateLevel } from '../config/WorldDefaults';

export class UpdateScheduler {
  private courseSchedule: CourseUpdateLevel[];
  private fullUpdateDistance: number;
  private lastUpdates: Map<string, number> = new Map();
  private currentTurn: number = 0;

  constructor(
    courseSchedule: CourseUpdateLevel[] = WORLD_DEFAULTS.courseUpdateSchedule,
    fullUpdateDistance: number = WORLD_DEFAULTS.fullUpdateDistance
  ) {
    this.courseSchedule = courseSchedule;
    this.fullUpdateDistance = fullUpdateDistance;
  }

  getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }

  getDistanceFromPlayer(chunkX: number, chunkY: number, playerChunkX: number, playerChunkY: number): number {
    return Math.max(Math.abs(chunkX - playerChunkX), Math.abs(chunkY - playerChunkY));
  }

  shouldUpdate(chunkX: number, chunkY: number, playerChunkX: number, playerChunkY: number): boolean {
    const distance = this.getDistanceFromPlayer(chunkX, chunkY, playerChunkX, playerChunkY);
    const key = this.getChunkKey(chunkX, chunkY);
    const lastUpdate = this.lastUpdates.get(key) || 0;
    const turnsSinceUpdate = this.currentTurn - lastUpdate;

    // Full update range
    if (distance <= this.fullUpdateDistance) {
      return true;
    }

    // Course update schedule
    for (const level of this.courseSchedule) {
      if (distance >= level.minDist && distance <= level.maxDist) {
        return turnsSinceUpdate >= level.interval;
      }
    }

    return false;
  }

  markUpdated(chunkX: number, chunkY: number): void {
    this.lastUpdates.set(this.getChunkKey(chunkX, chunkY), this.currentTurn);
  }

  advanceTurn(): void {
    this.currentTurn++;
  }

  getCurrentTurn(): number {
    return this.currentTurn;
  }

  getTurnsSinceLastUpdate(chunkX: number, chunkY: number): number {
    const key = this.getChunkKey(chunkX, chunkY);
    const lastUpdate = this.lastUpdates.get(key) || 0;
    return this.currentTurn - lastUpdate;
  }
}

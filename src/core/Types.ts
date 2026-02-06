/**
 * Common type definitions
 */

// Unique identifier for entities
export type EntityId = number;

export interface Position {
  x: number;
  y: number;
  z?: number;  // Layer/elevation (optional, defaults to 0)
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type Direction = 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';

export interface ChunkCoord {
  chunkX: number;
  chunkY: number;
}

/**
 * Chunk - 64x64 tile storage unit
 */

import { Position } from '../core/Types';
import { EntityId } from '../ecs';
import { Tile, TERRAIN, TerrainType } from './WorldConfig';

// Entity reference in a chunk
export interface ChunkEntity {
  entityId: EntityId;
  x: number;
  y: number;
}

export class Chunk {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly size: number;
  private tiles: Tile[][];
  private entities: Map<EntityId, ChunkEntity> = new Map();
  private lastUpdateTurn: number = 0;
  private needsCatchUp: boolean = false;

  constructor(chunkX: number, chunkY: number, size: number = 64) {
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.size = size;
    this.tiles = Array(size).fill(null).map(() => 
      Array(size).fill(null).map(() => TERRAIN.floor)
    );
  }

  getTile(localX: number, localY: number): Tile | null {
    if (!this.isValidLocalPosition(localX, localY)) return null;
    return this.tiles[localY][localX];
  }

  setTile(localX: number, localY: number, tile: Tile): boolean {
    if (!this.isValidLocalPosition(localX, localY)) return false;
    this.tiles[localY][localX] = tile;
    return true;
  }

  addEntity(entityId: EntityId, localX: number, localY: number): void {
    this.entities.set(entityId, { entityId, x: localX, y: localY });
  }

  removeEntity(entityId: EntityId): boolean {
    return this.entities.delete(entityId);
  }

  getEntityPosition(entityId: EntityId): { x: number; y: number } | null {
    const entity = this.entities.get(entityId);
    return entity ? { x: entity.x, y: entity.y } : null;
  }

  getAllEntities(): ChunkEntity[] {
    return Array.from(this.entities.values());
  }

  getLastUpdateTurn(): number {
    return this.lastUpdateTurn;
  }

  markUpdated(turn: number): void {
    this.lastUpdateTurn = turn;
  }

  isCatchUpNeeded(): boolean {
    return this.needsCatchUp;
  }

  setCatchUpNeeded(needed: boolean): void {
    this.needsCatchUp = needed;
  }

  isValidLocalPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  toWorldPosition(localX: number, localY: number): Position {
    return {
      x: this.chunkX * this.size + localX,
      y: this.chunkY * this.size + localY
    };
  }

  toLocalPosition(worldX: number, worldY: number): Position {
    return {
      x: worldX - this.chunkX * this.size,
      y: worldY - this.chunkY * this.size
    };
  }

  fill(terrain: TerrainType): void {
    const tile = TERRAIN[terrain];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        this.tiles[y][x] = tile;
      }
    }
  }
}

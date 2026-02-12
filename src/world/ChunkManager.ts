/**
 * Chunk Manager - Chunk lifecycle management
 */

import { ChunkCoord } from '../core/Types';
import { WORLD_DEFAULTS } from '../config/WorldDefaults';
import { ECSWorld } from '../ecs';
import { EntityFactory } from '../ecs/EntityFactory';
import { Chunk } from './Chunk';
import { UpdateScheduler } from './UpdateScheduler';
import { Tile, TERRAIN } from './WorldConfig';

export class ChunkManager {
  private chunks: Map<string, Chunk> = new Map();
  private activeChunks: Set<string> = new Set();
  private chunkSize: number;
  private updateScheduler: UpdateScheduler;
  private playerChunkX: number = Infinity;
  private playerChunkY: number = Infinity;
  private ecsWorld: ECSWorld;

  constructor(
    chunkSize: number = WORLD_DEFAULTS.chunkSize,
    updateScheduler: UpdateScheduler,
    ecsWorld: ECSWorld
  ) {
    this.chunkSize = chunkSize;
    this.updateScheduler = updateScheduler;
    this.ecsWorld = ecsWorld;
  }

  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }

  worldToChunk(worldX: number, worldY: number): ChunkCoord {
    return {
      chunkX: Math.floor(worldX / this.chunkSize),
      chunkY: Math.floor(worldY / this.chunkSize)
    };
  }

  getOrCreateChunk(chunkX: number, chunkY: number): Chunk {
    const key = this.getChunkKey(chunkX, chunkY);
    
    if (!this.chunks.has(key)) {
      const chunk = new Chunk(chunkX, chunkY, this.chunkSize);
      this.chunks.set(key, chunk);
      
      // Generate simple terrain (placeholder for real generation)
      this.generateTerrain(chunk);
    }
    
    return this.chunks.get(key)!;
  }

  private generateTerrain(chunk: Chunk): void {
    // Use a deterministic RNG seeded by chunk coordinates
    // This ensures the same chunk always generates the same terrain
    let seed = chunk.chunkX * 374761 + chunk.chunkY * 668265; // Large primes for better distribution
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Simple placeholder generation - mostly floor with some walls
    for (let y = 0; y < chunk.size; y++) {
      for (let x = 0; x < chunk.size; x++) {
        // Border walls
        if (x === 0 || x === chunk.size - 1 || y === 0 || y === chunk.size - 1) {
          chunk.setTile(x, y, TERRAIN.wall);
        } else if (rng() < 0.05) {
          // Random trees (deterministic based on chunk position) - now as entities
          const worldPos = chunk.toWorldPosition(x, y);
          const treeEntity = EntityFactory.createTree(this.ecsWorld, {
            position: { x: worldPos.x, y: worldPos.y, z: 0 },
            treeType: rng() < 0.7 ? 'oak' : 'pine'
          });
          chunk.addEntity(treeEntity.id, x, y);
        }
      }
    }
  }

  getChunk(chunkX: number, chunkY: number): Chunk | null {
    return this.chunks.get(this.getChunkKey(chunkX, chunkY)) || null;
  }

  setPlayerPosition(worldX: number, worldY: number): void {
    const { chunkX, chunkY } = this.worldToChunk(worldX, worldY);
    
    if (chunkX !== this.playerChunkX || chunkY !== this.playerChunkY) {
      this.deactivateDistantChunks(chunkX, chunkY);
      this.playerChunkX = chunkX;
      this.playerChunkY = chunkY;
      this.activateNearbyChunks();
    }
  }

  private activateNearbyChunks(): void {
    // Activate 3x3 grid around player
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunkX = this.playerChunkX + dx;
        const chunkY = this.playerChunkY + dy;
        const key = this.getChunkKey(chunkX, chunkY);
        
        if (!this.activeChunks.has(key)) {
          this.activateChunk(chunkX, chunkY);
        }
      }
    }
  }

  private activateChunk(chunkX: number, chunkY: number): void {
    const key = this.getChunkKey(chunkX, chunkY);
    const chunk = this.getOrCreateChunk(chunkX, chunkY);
    
    this.activeChunks.add(key);
    
    // Check for catch-up needed
    const turnsSinceUpdate = this.updateScheduler.getTurnsSinceLastUpdate(chunkX, chunkY);
    if (turnsSinceUpdate > 0 && chunk.getLastUpdateTurn() > 0) {
      chunk.setCatchUpNeeded(true);
    }
  }

  private deactivateDistantChunks(newPlayerChunkX: number, newPlayerChunkY: number): void {
    const toDeactivate: string[] = [];
    
    for (const key of this.activeChunks) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      const distance = Math.max(
        Math.abs(chunkX - newPlayerChunkX),
        Math.abs(chunkY - newPlayerChunkY)
      );
      
      if (distance > 1) {
        toDeactivate.push(key);
      }
    }
    
    for (const key of toDeactivate) {
      this.activeChunks.delete(key);
    }
  }

  update(): void {
    // Update chunks based on distance from player
    for (const key of this.activeChunks) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      
      if (this.updateScheduler.shouldUpdate(chunkX, chunkY, this.playerChunkX, this.playerChunkY)) {
        this.processChunkUpdate(chunkX, chunkY);
        this.updateScheduler.markUpdated(chunkX, chunkY);
      }
    }
    
    this.updateScheduler.advanceTurn();
  }

  private processChunkUpdate(chunkX: number, chunkY: number): void {
    const chunk = this.getChunk(chunkX, chunkY);
    if (!chunk) return;
    
    // Handle catch-up if needed
    if (chunk.isCatchUpNeeded()) {
      this.processCatchUp(chunk);
      chunk.setCatchUpNeeded(false);
    }
    
    // Regular chunk update
    chunk.markUpdated(this.updateScheduler.getCurrentTurn());
  }

  private processCatchUp(chunk: Chunk): void {
    const turnsSinceUpdate = this.updateScheduler.getTurnsSinceLastUpdate(chunk.chunkX, chunk.chunkY);
    const entities = chunk.getAllEntities();
    
    if (turnsSinceUpdate <= 0) return;
    
    for (const chunkEntity of entities) {
      const entity = this.ecsWorld.getEntity(chunkEntity.entityId);
      if (entity) {
        // Process deferred updates for entity over missed turns
        // This would simulate hunger, thirst, status effects, etc.
        // For now, just a placeholder
        entity.getComponent('actor');
      }
    }
  }

  getActiveChunks(): Chunk[] {
    return Array.from(this.activeChunks)
      .map(key => this.chunks.get(key)!)
      .filter(chunk => chunk !== undefined);
  }

  getTileAt(worldX: number, worldY: number): Tile | null {
    const { chunkX, chunkY } = this.worldToChunk(worldX, worldY);
    const chunk = this.getChunk(chunkX, chunkY);
    
    if (!chunk) return null;
    
    const localPos = chunk.toLocalPosition(worldX, worldY);
    return chunk.getTile(localPos.x, localPos.y);
  }

  setTileAt(worldX: number, worldY: number, tile: Tile): boolean {
    const { chunkX, chunkY } = this.worldToChunk(worldX, worldY);
    const chunk = this.getOrCreateChunk(chunkX, chunkY);
    const localPos = chunk.toLocalPosition(worldX, worldY);
    return chunk.setTile(localPos.x, localPos.y, tile);
  }

  isValidPosition(worldX: number, worldY: number): boolean {
    const tile = this.getTileAt(worldX, worldY);
    return tile !== null && !tile.blocksMovement;
  }
}

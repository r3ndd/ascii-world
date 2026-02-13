/**
 * World container - supports multiple z-layers
 */

import { WORLD_DEFAULTS } from '../config/WorldDefaults';
import { ECSWorld, Entity } from '../ecs';
import { ChunkManager } from './ChunkManager';
import { UpdateScheduler } from './UpdateScheduler';
import { LayerConfig, Tile } from './WorldConfig';
import { GeneratorContext, ChunkGenerator } from '../content/WorldGenerator';

export class World {
  private layers: Map<number, LayerConfig> = new Map();
  private chunkManagers: Map<number, ChunkManager> = new Map();
  private updateScheduler: UpdateScheduler;
  private ecsWorld: ECSWorld;
  private chunkSize: number;
  private defaultLayer: number = 0;

  constructor(
    width: number = WORLD_DEFAULTS.width,
    height: number = WORLD_DEFAULTS.height,
    chunkSize: number = WORLD_DEFAULTS.chunkSize,
    ecsWorld: ECSWorld
  ) {
    this.chunkSize = chunkSize;
    this.ecsWorld = ecsWorld;
    this.updateScheduler = new UpdateScheduler();
    
    // Create default layer 0
    this.addLayer(0, width, height);
  }

  /**
   * Add a new layer to the world
   */
  addLayer(z: number, width: number, height: number): void {
    this.layers.set(z, { width, height });
    this.chunkManagers.set(z, new ChunkManager(this.chunkSize, this.updateScheduler, this.ecsWorld));
  }

  /**
   * Configure the terrain generator for a layer
   */
  configureGenerator(z: number, generator: ChunkGenerator, context: GeneratorContext): void {
    const chunkManager = this.chunkManagers.get(z);
    if (chunkManager) {
      chunkManager.setTerrainGenerator(generator, context);
    }
  }

  /**
   * Remove a layer from the world
   */
  removeLayer(z: number): boolean {
    if (z === this.defaultLayer) {
      throw new Error('Cannot remove the default layer (0)');
    }
    return this.layers.delete(z) && this.chunkManagers.delete(z);
  }

  /**
   * Check if a layer exists
   */
  hasLayer(z: number): boolean {
    return this.layers.has(z);
  }

  /**
   * Get all layer indices
   */
  getLayers(): number[] {
    return Array.from(this.layers.keys()).sort((a, b) => a - b);
  }

  /**
   * Get the chunk manager for a specific layer
   */
  getChunkManager(z: number = this.defaultLayer): ChunkManager {
    const manager = this.chunkManagers.get(z);
    if (!manager) {
      throw new Error(`Layer ${z} does not exist`);
    }
    return manager;
  }

  initialize(): void {
    // Initial chunk generation at center of default layer
    const config = this.layers.get(this.defaultLayer)!;
    const centerX = Math.floor(config.width / 2);
    const centerY = Math.floor(config.height / 2);
    this.getChunkManager(this.defaultLayer).setPlayerPosition(centerX, centerY);
  }

  getWidth(z: number = this.defaultLayer): number {
    const config = this.layers.get(z);
    return config ? config.width : 0;
  }

  getHeight(z: number = this.defaultLayer): number {
    const config = this.layers.get(z);
    return config ? config.height : 0;
  }

  getECSWorld(): ECSWorld {
    return this.ecsWorld;
  }

  getUpdateScheduler(): UpdateScheduler {
    return this.updateScheduler;
  }

  getTileAt(x: number, y: number, z: number = this.defaultLayer): Tile | null {
    const config = this.layers.get(z);
    if (!config || x < 0 || x >= config.width || y < 0 || y >= config.height) {
      return null;
    }
    return this.getChunkManager(z).getTileAt(x, y);
  }

  setTileAt(x: number, y: number, tile: Tile, z: number = this.defaultLayer): boolean {
    const config = this.layers.get(z);
    if (!config || x < 0 || x >= config.width || y < 0 || y >= config.height) {
      return false;
    }
    return this.getChunkManager(z).setTileAt(x, y, tile);
  }

  isValidPosition(x: number, y: number, z: number = this.defaultLayer): boolean {
    const config = this.layers.get(z);
    if (!config || x < 0 || x >= config.width || y < 0 || y >= config.height) {
      return false;
    }
    return this.getChunkManager(z).isValidPosition(x, y);
  }

  update(): void {
    // Update all layers
    for (const chunkManager of this.chunkManagers.values()) {
      chunkManager.update();
    }
  }

  setPlayerPosition(x: number, y: number, z: number = this.defaultLayer): void {
    this.getChunkManager(z).setPlayerPosition(x, y);
  }

  getEntitiesAt(x: number, y: number, z: number = this.defaultLayer): Entity[] {
    const chunkManager = this.getChunkManager(z);
    const { chunkX, chunkY } = chunkManager.worldToChunk(x, y);
    const chunk = chunkManager.getChunk(chunkX, chunkY);
    
    if (!chunk) return [];
    
    const localPos = chunk.toLocalPosition(x, y);
    const chunkEntities = chunk.getAllEntities();
    const entities: Entity[] = [];
    
    for (const chunkEntity of chunkEntities) {
      if (chunkEntity.x === localPos.x && chunkEntity.y === localPos.y) {
        const entity = this.ecsWorld.getEntity(chunkEntity.entityId);
        if (entity) {
          entities.push(entity);
        }
      }
    }
    
    return entities;
  }
}

/**
 * Map Manager - Multiple map support
 */

import { WORLD_DEFAULTS } from '../config/WorldDefaults';
import { ECSWorld } from '../ecs';
import { World } from './World';
import { MapMetadata } from './MapMetadata';
import { WorldGenerator } from '../content/WorldGenerator';

export interface WorldGeneratorConfig {
  generatorName: string;
  params?: Record<string, unknown>;
}

export class MapManager {
  private maps: Map<string, MapMetadata> = new Map();
  private currentMap: World | null = null;
  private ecsWorld: ECSWorld;
  private worldGenerator: WorldGenerator | null = null;

  constructor(ecsWorld: ECSWorld, worldGenerator?: WorldGenerator) {
    this.ecsWorld = ecsWorld;
    this.worldGenerator = worldGenerator || null;
  }

  /**
   * Set the world generator for creating worlds
   */
  setWorldGenerator(worldGenerator: WorldGenerator): void {
    this.worldGenerator = worldGenerator;
  }

  registerMap(metadata: MapMetadata): void {
    this.maps.set(metadata.id, metadata);
  }

  getMap(id: string): MapMetadata | undefined {
    return this.maps.get(id);
  }

  getAllMaps(): MapMetadata[] {
    return Array.from(this.maps.values());
  }

  loadMap(id: string, width?: number, height?: number): World {
    const metadata = this.maps.get(id);
    
    if (!metadata) {
      throw new Error(`Map ${id} not found`);
    }

    this.currentMap = new World(
      width || metadata.size.width,
      height || metadata.size.height,
      WORLD_DEFAULTS.chunkSize,
      this.ecsWorld
    );
    
    this.currentMap.initialize();
    return this.currentMap;
  }

  createDefaultWorld(generatorConfig?: WorldGeneratorConfig): World {
    const world = new World(
      WORLD_DEFAULTS.width,
      WORLD_DEFAULTS.height,
      WORLD_DEFAULTS.chunkSize,
      this.ecsWorld
    );

    // If we have a world generator and config, use it to generate the world
    if (this.worldGenerator && generatorConfig) {
      this.worldGenerator.generateWorld(world, generatorConfig.generatorName, generatorConfig.params);

      // Pass generator to chunk manager for each layer
      const generator = this.worldGenerator.getGenerator(generatorConfig.generatorName);
      const context = (world as any).__generatorContext;
      if (generator && context) {
        world.configureGenerator(0, generator, context);
      }
    }

    world.initialize();
    this.currentMap = world;
    return world;
  }

  getCurrentMap(): World | null {
    return this.currentMap;
  }
}

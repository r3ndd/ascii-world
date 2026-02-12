/**
 * Map Manager - Multiple map support
 */

import { WORLD_DEFAULTS } from '../config/WorldDefaults';
import { ECSWorld } from '../ecs';
import { World } from './World';
import { MapMetadata } from './MapMetadata';

export class MapManager {
  private maps: Map<string, MapMetadata> = new Map();
  private currentMap: World | null = null;
  private ecsWorld: ECSWorld;

  constructor(ecsWorld: ECSWorld) {
    this.ecsWorld = ecsWorld;
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

  createDefaultWorld(): World {
    const world = new World(
      WORLD_DEFAULTS.width,
      WORLD_DEFAULTS.height,
      WORLD_DEFAULTS.chunkSize,
      this.ecsWorld
    );
    world.initialize();
    this.currentMap = world;
    return world;
  }

  getCurrentMap(): World | null {
    return this.currentMap;
  }
}

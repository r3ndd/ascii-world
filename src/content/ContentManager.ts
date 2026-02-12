/**
 * Content Manager
 * Main facade for content loading, map management, and mod system
 */

import { EventBus } from '../core/EventBus';
import { MapMetadata, World } from '../world';
import { ECSWorld } from '../ecs';
import { ContentLoader, ContentPack } from './ContentLoader';
import { MapLoader } from './MapLoader';
import { ModLoader, Mod } from './ModLoader';
import { ChunkGenerator } from './WorldGenerator';

export class ContentManager {
  private eventBus: EventBus;
  contentLoader: ContentLoader;
  mapLoader: MapLoader;
  modLoader: ModLoader;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.contentLoader = new ContentLoader(eventBus);
    this.mapLoader = new MapLoader(this.contentLoader, eventBus);
    this.modLoader = new ModLoader(eventBus, this.contentLoader, this.mapLoader);
  }

  /**
   * Load content pack from JSON
   */
  loadContentPack(json: string): void {
    this.contentLoader.loadContentPackFromJSON(json);
  }

  /**
   * Load map definition from JSON
   */
  loadMap(json: string): void {
    this.mapLoader.loadMapFromJSON(json);
  }

  /**
   * Load a mod
   */
  loadMod(mod: Mod): void {
    this.modLoader.loadMod(mod);
  }

  /**
   * Initialize all loaded mods
   */
  initializeMods(itemManager?: any): void {
    this.modLoader.initializeMods(itemManager);
  }

  /**
   * Get all available maps for selection
   */
  getAvailableMaps(): MapMetadata[] {
    return this.mapLoader.getMapMetadataList();
  }

  /**
   * Create a world from a map definition
   */
  createWorld(mapId: string, ecsWorld: ECSWorld): World {
    const world = this.mapLoader.createWorldFromDefinition(mapId, ecsWorld);
    this.eventBus.emit('content:worldCreated', { mapId });
    return world;
  }

  /**
   * Register a custom world generator
   */
  registerGenerator(name: string, generator: ChunkGenerator): void {
    const wg = (this.mapLoader as any).worldGenerator;
    wg.registerGenerator(name, generator);
  }

  /**
   * Get all loaded content packs
   */
  getLoadedContentPacks(): ContentPack[] {
    return this.contentLoader.getLoadedPacks();
  }

  /**
   * Get all loaded mods
   */
  getLoadedMods(): Mod[] {
    return this.modLoader.getAllMods();
  }

  /**
   * Clear all content
   */
  clear(): void {
    this.modLoader.clear();
    this.contentLoader.clear();
  }
}

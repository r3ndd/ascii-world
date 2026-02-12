/**
 * Mod loading system
 * Handles loading and managing game mods with dependency resolution
 */

import { EventBus } from '../core/EventBus';
import { ItemManager, ItemTemplate } from '../items';
import { ECSWorld, Entity } from '../ecs';
import { createPosition, createHealth, createSpeed, createRenderable } from '../ecs';
import { ContentLoader, CreatureTemplate, Recipe, TerrainDefinition } from './ContentLoader';
import { MapLoader } from './MapLoader';
import { WorldGenerator, ChunkGenerator } from './WorldGenerator';

export interface ModAPI {
  eventBus: EventBus;
  contentLoader: ContentLoader;
  mapLoader: MapLoader;
  worldGenerator: WorldGenerator;
  registerItem: (template: ItemTemplate) => void;
  registerCreature: (template: CreatureTemplate) => void;
  registerRecipe: (recipe: Recipe) => void;
  registerTerrain: (definition: TerrainDefinition) => void;
  registerGenerator: (name: string, generator: ChunkGenerator) => void;
  createEntity: (templateId: string, x: number, y: number, ecsWorld: ECSWorld) => Entity | null;
  spawnItem: (templateId: string, quantity: number, x: number, y: number, ecsWorld: ECSWorld, itemManager: ItemManager) => Entity | null;
}

export interface Mod {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  dependencies?: string[];
  initialize(api: ModAPI): void;
  cleanup?(): void;
}

export class ModLoader {
  private eventBus: EventBus;
  private contentLoader: ContentLoader;
  private mapLoader: MapLoader;
  private loadedMods: Map<string, Mod> = new Map();
  private modOrder: string[] = [];

  constructor(
    eventBus: EventBus,
    contentLoader: ContentLoader,
    mapLoader: MapLoader
  ) {
    this.eventBus = eventBus;
    this.contentLoader = contentLoader;
    this.mapLoader = mapLoader;
  }

  /**
   * Create ModAPI instance
   */
  private createModAPI(_itemManager?: any): ModAPI {
    return {
      eventBus: this.eventBus,
      contentLoader: this.contentLoader,
      mapLoader: this.mapLoader,
      worldGenerator: (this.mapLoader as any).worldGenerator,
      registerItem: (template) => this.contentLoader.registerTerrain({
        ...template as any,
        id: template.id,
        name: template.name,
        character: (template as any).character || '?',
        foreground: (template as any).foreground || '#ffffff',
        blocksMovement: false,
        blocksLight: false,
        transparent: true
      }),
      registerCreature: () => {},
      registerRecipe: () => {},
      registerTerrain: (definition) => this.contentLoader.registerTerrain(definition),
      registerGenerator: (name, generator) => {
        const wg = (this.mapLoader as any).worldGenerator as WorldGenerator;
        wg.registerGenerator(name, generator);
      },
      createEntity: (templateId, x, y, ecsWorld) => {
        // Simple entity creation - mod can extend this
        const entity = ecsWorld.createEntity();
        entity.addComponent(createPosition(x, y));
        entity.addComponent(createHealth(100, 100));
        entity.addComponent(createSpeed(100));
        entity.addComponent(createRenderable('?', '#ffffff'));
        
        this.eventBus.emit('mod:entityCreated', {
          entityId: entity.id,
          templateId,
          x,
          y
        });
        
        return entity;
      },
      spawnItem: (templateId, quantity, x, y, ecsWorld, itemManager) => {
        if (!itemManager || typeof itemManager.spawnItem !== 'function') {
          return null;
        }
        const item = itemManager.spawnItem(ecsWorld, templateId, quantity, { x, y });
        if (item) {
          this.eventBus.emit('mod:itemSpawned', {
            itemId: item.id,
            templateId,
            quantity,
            x,
            y
          });
        }
        return item;
      }
    };
  }

  /**
   * Load a mod
   */
  loadMod(mod: Mod): void {
    // Check dependencies
    if (mod.dependencies) {
      for (const dep of mod.dependencies) {
        if (!this.loadedMods.has(dep)) {
          throw new Error(`Mod "${mod.id}" requires dependency "${dep}" which is not loaded`);
        }
      }
    }

    // Check if already loaded
    if (this.loadedMods.has(mod.id)) {
      throw new Error(`Mod "${mod.id}" is already loaded`);
    }

    this.loadedMods.set(mod.id, mod);
    this.modOrder.push(mod.id);

    this.eventBus.emit('mod:loaded', { 
      modId: mod.id, 
      name: mod.name,
      version: mod.version 
    });
  }

  /**
   * Initialize all loaded mods
   */
  initializeMods(itemManager?: any): void {
    const api = this.createModAPI(itemManager);

    for (const modId of this.modOrder) {
      const mod = this.loadedMods.get(modId);
      if (mod) {
        try {
          mod.initialize(api);
          this.eventBus.emit('mod:initialized', { modId });
        } catch (error) {
          console.error(`Failed to initialize mod "${modId}":`, error);
          this.eventBus.emit('mod:initError', { modId, error });
        }
      }
    }
  }

  /**
   * Cleanup all mods
   */
  cleanupMods(): void {
    // Cleanup in reverse order
    for (let i = this.modOrder.length - 1; i >= 0; i--) {
      const modId = this.modOrder[i];
      const mod = this.loadedMods.get(modId);
      if (mod && mod.cleanup) {
        try {
          mod.cleanup();
          this.eventBus.emit('mod:cleanup', { modId });
        } catch (error) {
          console.error(`Error during mod "${modId}" cleanup:`, error);
        }
      }
    }
  }

  /**
   * Get loaded mod
   */
  getMod(id: string): Mod | undefined {
    return this.loadedMods.get(id);
  }

  /**
   * Get all loaded mods
   */
  getAllMods(): Mod[] {
    return this.modOrder.map(id => this.loadedMods.get(id)!);
  }

  /**
   * Unload a mod
   */
  unloadMod(id: string): boolean {
    const mod = this.loadedMods.get(id);
    if (!mod) return false;

    // Cleanup first
    if (mod.cleanup) {
      try {
        mod.cleanup();
      } catch (error) {
        console.error(`Error during mod "${id}" cleanup:`, error);
      }
    }

    this.loadedMods.delete(id);
    this.modOrder = this.modOrder.filter(modId => modId !== id);

    this.eventBus.emit('mod:unloaded', { modId: id });
    return true;
  }

  /**
   * Clear all mods
   */
  clear(): void {
    this.cleanupMods();
    this.loadedMods.clear();
    this.modOrder = [];
  }

  /**
   * Check if mod is loaded
   */
  isModLoaded(id: string): boolean {
    return this.loadedMods.has(id);
  }
}

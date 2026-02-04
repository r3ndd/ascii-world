/**
 * Content module
 * Content loading pipeline, mod system, and world generation tools
 */

import { EventBus } from '../core/EventBus';
import { ItemTemplate } from '../items';
import { MapMetadata, World, TERRAIN, TerrainType } from '../world';
import { ECSWorld, Entity } from '../ecs';
import { createPosition, createHealth, createSpeed, createRenderable } from '../ecs';

// ============================================================================
// Content Types and Interfaces
// ============================================================================

export interface CreatureTemplate {
  id: string;
  name: string;
  description: string;
  character: string;
  foreground: string;
  background?: string;
  health: number;
  speed: number;
  faction?: string;
  tags: string[];
  ai?: {
    type: string;
    aggression: number;
    visionRange: number;
  };
  loot?: string[];
}

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: 'crafting' | 'construction' | 'cooking';
  ingredients: RecipeIngredient[];
  results: RecipeIngredient[];
  timeCost: number;
  requiredTools?: string[];
  requiredSkills?: Record<string, number>;
  station?: string;
}

export interface ContentPack {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  dependencies?: string[];
  items?: ItemTemplate[];
  creatures?: CreatureTemplate[];
  recipes?: Recipe[];
  terrains?: TerrainDefinition[];
}

export interface TerrainDefinition {
  id: string;
  name: string;
  character: string;
  foreground: string;
  background?: string;
  blocksMovement: boolean;
  blocksLight: boolean;
  transparent: boolean;
  tags?: string[];
}

export interface MapDefinition {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  chunkSize: number;
  generator?: string;
  generatorParams?: Record<string, unknown>;
  predefinedChunks?: PredefinedChunk[];
  spawnPoints?: SpawnPoint[];
}

export interface PredefinedChunk {
  chunkX: number;
  chunkY: number;
  tiles: string[][]; // 2D array of terrain IDs
  entities?: ChunkEntityPlacement[];
}

export interface ChunkEntityPlacement {
  x: number;
  y: number;
  type: 'creature' | 'item';
  templateId: string;
}

export interface SpawnPoint {
  x: number;
  y: number;
  type: 'player' | 'npc';
  tags?: string[];
}

// ============================================================================
// Content Loader
// ============================================================================

export class ContentLoader {
  private eventBus: EventBus;
  private loadedPacks: Map<string, ContentPack> = new Map();
  private terrainOverrides: Map<string, TerrainDefinition> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Load a content pack from JSON data
   */
  loadContentPack(pack: ContentPack): void {
    // Check dependencies
    if (pack.dependencies) {
      for (const dep of pack.dependencies) {
        if (!this.loadedPacks.has(dep)) {
          throw new Error(`Content pack "${pack.id}" requires dependency "${dep}" which is not loaded`);
        }
      }
    }

    this.loadedPacks.set(pack.id, pack);
    this.eventBus.emit('content:packLoaded', { packId: pack.id, name: pack.name });
  }

  /**
   * Load content pack from JSON string
   */
  loadContentPackFromJSON(json: string): void {
    const pack: ContentPack = JSON.parse(json);
    this.loadContentPack(pack);
  }

  /**
   * Get all loaded content packs
   */
  getLoadedPacks(): ContentPack[] {
    return Array.from(this.loadedPacks.values());
  }

  /**
   * Get content pack by ID
   */
  getPack(id: string): ContentPack | undefined {
    return this.loadedPacks.get(id);
  }

  /**
   * Get all item templates from all loaded packs
   */
  getAllItemTemplates(): ItemTemplate[] {
    const templates: ItemTemplate[] = [];
    for (const pack of this.loadedPacks.values()) {
      if (pack.items) {
        templates.push(...pack.items);
      }
    }
    return templates;
  }

  /**
   * Get all creature templates
   */
  getAllCreatureTemplates(): CreatureTemplate[] {
    const templates: CreatureTemplate[] = [];
    for (const pack of this.loadedPacks.values()) {
      if (pack.creatures) {
        templates.push(...pack.creatures);
      }
    }
    return templates;
  }

  /**
   * Get all recipes
   */
  getAllRecipes(): Recipe[] {
    const recipes: Recipe[] = [];
    for (const pack of this.loadedPacks.values()) {
      if (pack.recipes) {
        recipes.push(...pack.recipes);
      }
    }
    return recipes;
  }

  /**
   * Get terrain definitions
   */
  getAllTerrainDefinitions(): TerrainDefinition[] {
    const terrains: TerrainDefinition[] = [];
    for (const pack of this.loadedPacks.values()) {
      if (pack.terrains) {
        terrains.push(...pack.terrains);
      }
    }
    return terrains;
  }

  /**
   * Register a terrain override
   */
  registerTerrain(definition: TerrainDefinition): void {
    this.terrainOverrides.set(definition.id, definition);
  }

  /**
   * Get terrain definition
   */
  getTerrain(id: string): TerrainDefinition | undefined {
    return this.terrainOverrides.get(id);
  }

  /**
   * Apply terrain overrides to TERRAIN registry
   */
  applyTerrainOverrides(): void {
    for (const [id, definition] of this.terrainOverrides) {
      const terrainKey = id as TerrainType;
      if (TERRAIN[terrainKey]) {
        TERRAIN[terrainKey] = {
          ...TERRAIN[terrainKey],
          char: definition.character,
          fg: definition.foreground,
          bg: definition.background || TERRAIN[terrainKey].bg,
          blocksMovement: definition.blocksMovement,
          blocksLight: definition.blocksLight,
          transparent: definition.transparent,
          terrain: terrainKey
        };
      }
    }
  }

  /**
   * Clear all loaded content
   */
  clear(): void {
    this.loadedPacks.clear();
    this.terrainOverrides.clear();
  }
}

// ============================================================================
// Map Loader
// ============================================================================

export class MapLoader {
  contentLoader: ContentLoader;
  private _eventBus: EventBus;
  private loadedMaps: Map<string, MapDefinition> = new Map();
  worldGenerator: WorldGenerator;

  constructor(contentLoader: ContentLoader, eventBus: EventBus) {
    this.contentLoader = contentLoader;
    this._eventBus = eventBus;
    this.worldGenerator = new WorldGenerator(eventBus);
  }
  
  get eventBus(): EventBus {
    return this._eventBus;
  }

  /**
   * Load a map definition
   */
  loadMapDefinition(definition: MapDefinition): void {
    this.loadedMaps.set(definition.id, definition);
    this.eventBus.emit('map:definitionLoaded', { 
      mapId: definition.id, 
      name: definition.name,
      width: definition.width,
      height: definition.height 
    });
  }

  /**
   * Load map from JSON string
   */
  loadMapFromJSON(json: string): void {
    const definition: MapDefinition = JSON.parse(json);
    this.loadMapDefinition(definition);
  }

  /**
   * Get map definition
   */
  getMapDefinition(id: string): MapDefinition | undefined {
    return this.loadedMaps.get(id);
  }

  /**
   * Get all loaded map definitions
   */
  getAllMapDefinitions(): MapDefinition[] {
    return Array.from(this.loadedMaps.values());
  }

  /**
   * Create a world from a map definition
   */
  createWorldFromDefinition(
    mapId: string, 
    ecsWorld: ECSWorld,
    generatorOverrides?: Record<string, unknown>
  ): World {
    const definition = this.loadedMaps.get(mapId);
    if (!definition) {
      throw new Error(`Map definition "${mapId}" not found`);
    }

    const world = new World(
      definition.width,
      definition.height,
      definition.chunkSize,
      ecsWorld
    );

    // Apply predefined chunks if present
    if (definition.predefinedChunks) {
      this.applyPredefinedChunks(world, definition.predefinedChunks);
    }

    // Generate remaining chunks using specified generator
    if (definition.generator) {
      const params = { ...definition.generatorParams, ...generatorOverrides };
      this.worldGenerator.generateWorld(world, definition.generator, params);
    }

    // Place entities from spawn points
    if (definition.spawnPoints) {
      this.placeSpawnPoints(world, ecsWorld, definition.spawnPoints);
    }

    this.eventBus.emit('map:worldCreated', { 
      mapId: definition.id,
      worldWidth: definition.width,
      worldHeight: definition.height
    });

    return world;
  }

  /**
   * Apply predefined chunks to a world
   */
  private applyPredefinedChunks(world: World, chunks: PredefinedChunk[]): void {
    const chunkManager = world.getChunkManager();

    for (const chunkDef of chunks) {
      const chunk = chunkManager.getOrCreateChunk(chunkDef.chunkX, chunkDef.chunkY);
      
      // Apply tiles
      if (chunkDef.tiles) {
        for (let y = 0; y < chunk.size && y < chunkDef.tiles.length; y++) {
          const row = chunkDef.tiles[y];
          for (let x = 0; x < chunk.size && x < row.length; x++) {
            const terrainId = row[x] as TerrainType;
            if (TERRAIN[terrainId]) {
              chunk.setTile(x, y, TERRAIN[terrainId]);
            }
          }
        }
      }

      // Place entities
      if (chunkDef.entities) {
        for (const placement of chunkDef.entities) {
          const worldPos = chunk.toWorldPosition(placement.x, placement.y);
          this.eventBus.emit('map:entityPlacementQueued', {
            type: placement.type,
            templateId: placement.templateId,
            x: worldPos.x,
            y: worldPos.y
          });
        }
      }
    }
  }

  /**
   * Place spawn point entities
   */
  private placeSpawnPoints(
    _world: World, 
    _ecsWorld: ECSWorld, 
    spawnPoints: SpawnPoint[]
  ): void {
    for (const spawn of spawnPoints) {
      this.eventBus.emit('map:spawnPoint', {
        x: spawn.x,
        y: spawn.y,
        type: spawn.type,
        tags: spawn.tags
      });
    }
  }

  /**
   * Get metadata for all loaded maps (for map selection UI)
   */
  getMapMetadataList(): MapMetadata[] {
    return Array.from(this.loadedMaps.values()).map(def => ({
      id: def.id,
      name: def.name,
      description: def.description,
      size: { width: def.width, height: def.height }
    }));
  }
}

// ============================================================================
// World Generator
// ============================================================================

export interface GeneratorContext {
  world: World;
  rng: () => number;
  params: Record<string, unknown>;
}

export type ChunkGenerator = (chunk: Chunk, context: GeneratorContext) => void;

export class WorldGenerator {
  private eventBus: EventBus;
  private generators: Map<string, ChunkGenerator> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.registerDefaultGenerators();
  }

  /**
   * Register a chunk generator
   */
  registerGenerator(name: string, generator: ChunkGenerator): void {
    this.generators.set(name, generator);
  }

  /**
   * Get registered generator
   */
  getGenerator(name: string): ChunkGenerator | undefined {
    return this.generators.get(name);
  }

  /**
   * Generate a world using the specified generator
   */
  generateWorld(
    world: World, 
    generatorName: string, 
    params: Record<string, unknown> = {}
  ): void {
    const generator = this.generators.get(generatorName);
    if (!generator) {
      throw new Error(`Generator "${generatorName}" not found`);
    }

    // Simple RNG (could be replaced with rot.js RNG)
    // Use a deterministic default seed for reproducibility
    let seed = (params.seed as number) || 12345;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const context: GeneratorContext = {
      world,
      rng,
      params
    };

    this.eventBus.emit('generation:started', { 
      generator: generatorName,
      seed: params.seed || 'default'
    });

    // Store for chunk generation callback
    (world as any).__generatorContext = context;
    (world as any).__chunkGenerator = generator;
  }

  /**
   * Generate a specific chunk (called by ChunkManager when creating new chunks)
   */
  generateChunk(world: World, chunk: Chunk): void {
    const generator = (world as any).__chunkGenerator;
    const context = (world as any).__generatorContext;
    
    if (generator && context) {
      generator(chunk, context);
    }
  }

  private registerDefaultGenerators(): void {
    // Wilderness generator - forests, clearings, rivers
    this.registerGenerator('wilderness', (chunk, context) => {
      const treeDensity = (context.params.treeDensity as number) || 0.3;
      const waterChance = (context.params.waterChance as number) || 0.05;

      for (let y = 0; y < chunk.size; y++) {
        for (let x = 0; x < chunk.size; x++) {
          const rand = context.rng();
          
          if (rand < waterChance) {
            chunk.setTile(x, y, TERRAIN.water);
          } else if (rand < waterChance + treeDensity) {
            chunk.setTile(x, y, TERRAIN.tree);
          } else {
            chunk.setTile(x, y, TERRAIN.floor);
          }
        }
      }

      // Add border walls
      for (let x = 0; x < chunk.size; x++) {
        chunk.setTile(x, 0, TERRAIN.wall);
        chunk.setTile(x, chunk.size - 1, TERRAIN.wall);
      }
      for (let y = 0; y < chunk.size; y++) {
        chunk.setTile(0, y, TERRAIN.wall);
        chunk.setTile(chunk.size - 1, y, TERRAIN.wall);
      }
    });

    // Dungeon generator - rooms and corridors
    this.registerGenerator('dungeon', (chunk, context) => {
      const roomChance = (context.params.roomChance as number) || 0.3;
      
      // Start with all walls
      chunk.fill('wall');

      // Carve rooms
      const roomCount = Math.floor(context.rng() * 5) + 3;
      const rooms: Array<{x: number; y: number; w: number; h: number}> = [];

      for (let i = 0; i < roomCount; i++) {
        if (context.rng() > roomChance) continue;

        const w = Math.floor(context.rng() * 10) + 5;
        const h = Math.floor(context.rng() * 10) + 5;
        const x = Math.floor(context.rng() * (chunk.size - w - 2)) + 1;
        const y = Math.floor(context.rng() * (chunk.size - h - 2)) + 1;

        // Check overlap
        let overlaps = false;
        for (const room of rooms) {
          if (x < room.x + room.w && x + w > room.x &&
              y < room.y + room.h && y + h > room.y) {
            overlaps = true;
            break;
          }
        }

        if (!overlaps) {
          rooms.push({ x, y, w, h });
          
          // Carve room
          for (let ry = y; ry < y + h; ry++) {
            for (let rx = x; rx < x + w; rx++) {
              chunk.setTile(rx, ry, TERRAIN.floor);
            }
          }
        }
      }

      // Connect rooms with corridors
      for (let i = 0; i < rooms.length - 1; i++) {
        const roomA = rooms[i];
        const roomB = rooms[i + 1];
        
        const startX = Math.floor(roomA.x + roomA.w / 2);
        const startY = Math.floor(roomA.y + roomA.h / 2);
        const endX = Math.floor(roomB.x + roomB.w / 2);
        const endY = Math.floor(roomB.y + roomB.h / 2);

        // L-shaped corridor
        if (context.rng() > 0.5) {
          // Horizontal then vertical
          const minX = Math.min(startX, endX);
          const maxX = Math.max(startX, endX);
          for (let x = minX; x <= maxX; x++) {
            chunk.setTile(x, startY, TERRAIN.floor);
          }
          const minY = Math.min(startY, endY);
          const maxY = Math.max(startY, endY);
          for (let y = minY; y <= maxY; y++) {
            chunk.setTile(endX, y, TERRAIN.floor);
          }
        } else {
          // Vertical then horizontal
          const minY = Math.min(startY, endY);
          const maxY = Math.max(startY, endY);
          for (let y = minY; y <= maxY; y++) {
            chunk.setTile(startX, y, TERRAIN.floor);
          }
          const minX = Math.min(startX, endX);
          const maxX = Math.max(startX, endX);
          for (let x = minX; x <= maxX; x++) {
            chunk.setTile(x, endY, TERRAIN.floor);
          }
        }
      }

      // Add some doors
      for (const room of rooms) {
        if (context.rng() > 0.7) {
          const doorX = room.x + Math.floor(context.rng() * room.w);
          const doorY = room.y + Math.floor(context.rng() * room.h);
          if (chunk.getTile(doorX, doorY)?.terrain === 'floor') {
            // Find adjacent wall to place door
            const adjacent = [
              { x: doorX - 1, y: doorY },
              { x: doorX + 1, y: doorY },
              { x: doorX, y: doorY - 1 },
              { x: doorX, y: doorY + 1 }
            ];
            
            for (const pos of adjacent) {
              if (chunk.getTile(pos.x, pos.y)?.terrain === 'wall') {
                chunk.setTile(pos.x, pos.y, TERRAIN.door);
                break;
              }
            }
          }
        }
      }
    });

    // Cave generator - cellular automata
    this.registerGenerator('cave', (chunk, context) => {
      const fillPercent = (context.params.fillPercent as number) || 0.45;
      const iterations = (context.params.iterations as number) || 5;
      
      // Initialize random walls
      const grid: boolean[][] = [];
      for (let y = 0; y < chunk.size; y++) {
        grid[y] = [];
        for (let x = 0; x < chunk.size; x++) {
          grid[y][x] = context.rng() < fillPercent;
        }
      }

      // Cellular automata smoothing
      for (let i = 0; i < iterations; i++) {
        const newGrid: boolean[][] = [];
        for (let y = 0; y < chunk.size; y++) {
          newGrid[y] = [];
          for (let x = 0; x < chunk.size; x++) {
            const neighbors = this.countWallNeighbors(grid, x, y, chunk.size);
            
            if (neighbors > 4) {
              newGrid[y][x] = true; // Wall
            } else if (neighbors < 4) {
              newGrid[y][x] = false; // Floor
            } else {
              newGrid[y][x] = grid[y][x];
            }
          }
        }
        
        // Copy back
        for (let y = 0; y < chunk.size; y++) {
          for (let x = 0; x < chunk.size; x++) {
            grid[y][x] = newGrid[y][x];
          }
        }
      }

      // Apply to chunk
      for (let y = 0; y < chunk.size; y++) {
        for (let x = 0; x < chunk.size; x++) {
          if (grid[y][x]) {
            chunk.setTile(x, y, TERRAIN.wall);
          } else {
            chunk.setTile(x, y, TERRAIN.floor);
          }
        }
      }
    });

    // City generator - buildings and streets
    this.registerGenerator('city', (chunk, context) => {
      const blockSize = (context.params.blockSize as number) || 20;
      const buildingDensity = (context.params.buildingDensity as number) || 0.7;
      
      // Create street grid
      for (let y = 0; y < chunk.size; y++) {
        for (let x = 0; x < chunk.size; x++) {
          // Streets on regular intervals
          if (x % blockSize === 0 || y % blockSize === 0) {
            chunk.setTile(x, y, TERRAIN.floor);
          } else {
            // Buildings in blocks
            const blockX = Math.floor(x / blockSize);
            const blockY = Math.floor(y / blockSize);
            
            // Vary building placement per block
            const blockSeed = blockX * 374761 + blockY * 668265;
            const blockRng = ((blockSeed * 9301 + 49297) % 233280) / 233280;
            
            if (blockRng < buildingDensity) {
              chunk.setTile(x, y, TERRAIN.wall);
            } else {
              chunk.setTile(x, y, TERRAIN.floor);
            }
          }
        }
      }

      // Add some trees
      for (let y = 0; y < chunk.size; y += 2) {
        for (let x = 0; x < chunk.size; x += 2) {
          if (chunk.getTile(x, y)?.terrain === 'floor' && context.rng() < 0.1) {
            chunk.setTile(x, y, TERRAIN.tree);
          }
        }
      }
    });
  }

  private countWallNeighbors(grid: boolean[][], x: number, y: number, size: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
          count++;
        } else if (grid[ny][nx]) {
          count++;
        }
      }
    }
    return count;
  }
}

// Import needed for WorldGenerator
import { Chunk } from '../world';

// ============================================================================
// Mod Loader
// ============================================================================

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
  spawnItem: (templateId: string, quantity: number, x: number, y: number, itemManager: any) => any;
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
      spawnItem: (templateId, quantity, x, y, itemManager) => {
        if (itemManager && itemManager.spawnItem) {
          const item = itemManager.spawnItem(templateId, quantity, { x, y });
          this.eventBus.emit('mod:itemSpawned', {
            itemId: item?.id,
            templateId,
            quantity,
            x,
            y
          });
          return item;
        }
        return null;
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

// ============================================================================
// Content Manager - Main Facade
// ============================================================================

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
    const wg = (this.mapLoader as any).worldGenerator as WorldGenerator;
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

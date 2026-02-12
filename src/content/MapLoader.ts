/**
 * Map loading system
 * Handles loading map definitions and creating worlds from them
 */

import { EventBus } from '../core/EventBus';
import { MapMetadata, World, TERRAIN, TerrainType } from '../world';
import { ECSWorld } from '../ecs';
import { ContentLoader } from './ContentLoader';
import { WorldGenerator } from './WorldGenerator';

export interface LayerDefinition {
  z: number;
  width: number;
  height: number;
  predefinedChunks?: PredefinedChunk[];
  spawnPoints?: SpawnPoint[];
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
  layers?: LayerDefinition[]; // Multi-layer support
  stairLinks?: StairLinkDefinition[];
}

export interface StairLinkDefinition {
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  direction: 'up' | 'down';
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

    // Handle multi-layer maps
    if (definition.layers && definition.layers.length > 0) {
      // Add additional layers
      for (const layerDef of definition.layers) {
        if (layerDef.z !== 0) { // Layer 0 is already created by World constructor
          world.addLayer(layerDef.z, layerDef.width, layerDef.height);
        }
        
        // Apply predefined chunks for this layer
        if (layerDef.predefinedChunks) {
          this.applyPredefinedChunks(world, layerDef.predefinedChunks, layerDef.z);
        }
        
        // Place spawn points for this layer
        if (layerDef.spawnPoints) {
          this.placeSpawnPoints(world, ecsWorld, layerDef.spawnPoints, layerDef.z);
        }
        
        // Generate remaining chunks for this layer
        if (definition.generator) {
          const params = { ...definition.generatorParams, ...generatorOverrides };
          this.worldGenerator.generateWorldLayer(world, layerDef.z, definition.generator, params);
        }
      }
    } else {
      // Single layer (backward compatibility)
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
    }

    this.eventBus.emit('map:worldCreated', { 
      mapId: definition.id,
      worldWidth: definition.width,
      worldHeight: definition.height,
      layerCount: world.getLayers().length
    });

    return world;
  }

  /**
   * Apply predefined chunks to a world
   */
  private applyPredefinedChunks(world: World, chunks: PredefinedChunk[], z: number = 0): void {
    const chunkManager = world.getChunkManager(z);

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
            y: worldPos.y,
            z
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
    spawnPoints: SpawnPoint[],
    z: number = 0
  ): void {
    for (const spawn of spawnPoints) {
      this.eventBus.emit('map:spawnPoint', {
        x: spawn.x,
        y: spawn.y,
        z,
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

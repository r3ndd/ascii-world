/**
 * Save module
 * Save/load system for game state persistence
 */

import { World, Chunk, Tile, TERRAIN, ChunkEntity } from '../world';
import { Entity, EntityId, Component, ECSWorld } from '../ecs';
import { EventBus } from '../core/EventBus';
import { ItemManager, InventoryManager, ItemInstance, ItemTemplate } from '../items';
import { TurnManager } from '../time';
import { Position } from '../core/Types';

// Save metadata
export interface SaveMetadata {
  slot: number;
  name: string;
  timestamp: number;
  turn: number;
  playerPosition: Position;
  playTime: number; // in seconds
  version: string;
  checksum: string;
}

// Save data structure
export interface SaveData {
  metadata: SaveMetadata;
  world: SerializedWorld;
  entities: SerializedEntity[];
  items: {
    templates: ItemTemplate[];
    instances: ItemInstance[];
  };
  inventories: {
    ownerId: EntityId;
    capacity: number;
    volumeCapacity: number;
    itemIds: string[];
  }[];
  turn: {
    currentTurn: number;
  };
}

// Serialized world data
export interface SerializedWorld {
  width: number;
  height: number;
  chunkSize: number;
  chunks: SerializedChunk[];
  playerPosition: Position;
}

// Serialized chunk data
export interface SerializedChunk {
  chunkX: number;
  chunkY: number;
  size: number;
  tiles: Tile[][];
  entities: ChunkEntity[];
  lastUpdateTurn: number;
  needsCatchUp: boolean;
}

// Serialized entity data
export interface SerializedEntity {
  id: EntityId;
  components: Component[];
}

// Storage provider interface for flexibility
export interface StorageProvider {
  save(slot: number, data: string): Promise<void>;
  load(slot: number): Promise<string | null>;
  delete(slot: number): Promise<boolean>;
  list(): Promise<SaveMetadata[]>;
  exists(slot: number): Promise<boolean>;
}

// LocalStorage implementation
export class LocalStorageProvider implements StorageProvider {
  private prefix: string = 'ascii_world_save_';
  private metadataPrefix: string = 'ascii_world_meta_';

  async save(slot: number, data: string): Promise<void> {
    try {
      localStorage.setItem(`${this.prefix}${slot}`, data);
    } catch (error) {
      throw new Error(`Failed to save to slot ${slot}: ${error}`);
    }
  }

  async load(slot: number): Promise<string | null> {
    return localStorage.getItem(`${this.prefix}${slot}`);
  }

  async delete(slot: number): Promise<boolean> {
    const key = `${this.prefix}${slot}`;
    const metaKey = `${this.metadataPrefix}${slot}`;
    
    if (localStorage.getItem(key) === null) {
      return false;
    }
    
    localStorage.removeItem(key);
    localStorage.removeItem(metaKey);
    return true;
  }

  async list(): Promise<SaveMetadata[]> {
    const saves: SaveMetadata[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.metadataPrefix)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            saves.push(JSON.parse(data));
          } catch {
            // Skip invalid metadata
          }
        }
      }
    }
    
    return saves.sort((a, b) => b.timestamp - a.timestamp);
  }

  async exists(slot: number): Promise<boolean> {
    return localStorage.getItem(`${this.prefix}${slot}`) !== null;
  }

  async saveMetadata(slot: number, metadata: SaveMetadata): Promise<void> {
    localStorage.setItem(`${this.metadataPrefix}${slot}`, JSON.stringify(metadata));
  }

  async loadMetadata(slot: number): Promise<SaveMetadata | null> {
    const data = localStorage.getItem(`${this.metadataPrefix}${slot}`);
    return data ? JSON.parse(data) : null;
  }
}

// Save manager - handles save slots and orchestrates serialization
export class SaveManager {
  private storage: StorageProvider;
  private eventBus: EventBus;
  private version: string = '0.1.0';
  private playTimeStart: number = 0;
  private totalPlayTime: number = 0;

  constructor(storage: StorageProvider, eventBus: EventBus) {
    this.storage = storage;
    this.eventBus = eventBus;
  }

  // Create a new save
  async createSave(
    slot: number,
    name: string,
    world: World,
    ecsWorld: ECSWorld,
    itemManager: ItemManager,
    inventoryManager: InventoryManager,
    turnManager: TurnManager,
    playerPosition: Position
  ): Promise<SaveMetadata> {
    const startTime = Date.now();

    this.eventBus.emit('save:started', { slot, name });

    try {
      // Serialize all systems
      const serializedWorld = WorldSerializer.serialize(world);
      const serializedEntities = EntitySerializer.serializeAll(ecsWorld);
      const serializedItems = {
        templates: itemManager.getAllTemplates(),
        instances: itemManager.serializeItems()
      };
      const serializedInventories = inventoryManager.serializeInventories();

      // Calculate checksum
      const dataString = JSON.stringify({
        world: serializedWorld,
        entities: serializedEntities,
        items: serializedItems,
        inventories: serializedInventories
      });
      const checksum = this.calculateChecksum(dataString);

      // Create metadata
      const metadata: SaveMetadata = {
        slot,
        name,
        timestamp: Date.now(),
        turn: turnManager.getCurrentTurn(),
        playerPosition,
        playTime: this.totalPlayTime + (this.playTimeStart > 0 ? Math.floor((Date.now() - this.playTimeStart) / 1000) : 0),
        version: this.version,
        checksum
      };

      // Build save data
      const saveData: SaveData = {
        metadata,
        world: serializedWorld,
        entities: serializedEntities,
        items: serializedItems,
        inventories: serializedInventories,
        turn: {
          currentTurn: turnManager.getCurrentTurn()
        }
      };

      // Save to storage
      await this.storage.save(slot, JSON.stringify(saveData));
      
      // Save metadata separately for quick listing
      if (this.storage instanceof LocalStorageProvider) {
        await this.storage.saveMetadata(slot, metadata);
      }

      const duration = Date.now() - startTime;
      this.eventBus.emit('save:completed', { slot, name, duration });

      return metadata;
    } catch (error) {
      this.eventBus.emit('save:error', { slot, error });
      throw error;
    }
  }

  // Load a save
  async loadSave(
    slot: number,
    ecsWorld: ECSWorld,
    itemManager: ItemManager,
    inventoryManager: InventoryManager
  ): Promise<{
    metadata: SaveMetadata;
    world: SerializedWorld;
    turn: { currentTurn: number };
  }> {
    const startTime = Date.now();

    this.eventBus.emit('load:started', { slot });

    try {
      const data = await this.storage.load(slot);
      if (!data) {
        throw new Error(`Save slot ${slot} not found`);
      }

      const saveData: SaveData = JSON.parse(data);

      // Verify checksum
      const dataString = JSON.stringify({
        world: saveData.world,
        entities: saveData.entities,
        items: saveData.items,
        inventories: saveData.inventories
      });
      const checksum = this.calculateChecksum(dataString);
      
      if (checksum !== saveData.metadata.checksum) {
        console.warn(`Save ${slot} checksum mismatch - data may be corrupted`);
        this.eventBus.emit('load:checksumMismatch', { slot });
      }

      // Load templates first (required for items)
      for (const template of saveData.items.templates) {
        itemManager.registerTemplate(template);
      }

      // Load items
      itemManager.deserializeItems(saveData.items.instances);

      // Load inventories
      inventoryManager.deserializeInventories(saveData.inventories);

      // Load entities
      EntitySerializer.deserializeAll(saveData.entities, ecsWorld);

      // Reset play time tracking
      this.totalPlayTime = saveData.metadata.playTime;
      this.playTimeStart = Date.now();

      const duration = Date.now() - startTime;
      this.eventBus.emit('load:completed', { slot, duration });

      return {
        metadata: saveData.metadata,
        world: saveData.world,
        turn: saveData.turn
      };
    } catch (error) {
      this.eventBus.emit('load:error', { slot, error });
      throw error;
    }
  }

  // Delete a save
  async deleteSave(slot: number): Promise<boolean> {
    const result = await this.storage.delete(slot);
    if (result) {
      this.eventBus.emit('save:deleted', { slot });
    }
    return result;
  }

  // List all saves
  async listSaves(): Promise<SaveMetadata[]> {
    return this.storage.list();
  }

  // Check if save exists
  async saveExists(slot: number): Promise<boolean> {
    return this.storage.exists(slot);
  }

  // Get quick save slot (slot 0 is reserved for quick save)
  getQuickSaveSlot(): number {
    return 0;
  }

  // Quick save
  async quickSave(
    world: World,
    ecsWorld: ECSWorld,
    itemManager: ItemManager,
    inventoryManager: InventoryManager,
    turnManager: TurnManager,
    playerPosition: Position
  ): Promise<SaveMetadata> {
    return this.createSave(
      this.getQuickSaveSlot(),
      'Quick Save',
      world,
      ecsWorld,
      itemManager,
      inventoryManager,
      turnManager,
      playerPosition
    );
  }

  // Quick load
  async quickLoad(
    ecsWorld: ECSWorld,
    itemManager: ItemManager,
    inventoryManager: InventoryManager
  ): ReturnType<SaveManager['loadSave']> {
    return this.loadSave(this.getQuickSaveSlot(), ecsWorld, itemManager, inventoryManager);
  }

  // Start tracking play time
  startPlayTimeTracking(): void {
    this.playTimeStart = Date.now();
  }

  // Stop tracking play time
  stopPlayTimeTracking(): void {
    if (this.playTimeStart > 0) {
      this.totalPlayTime += Math.floor((Date.now() - this.playTimeStart) / 1000);
      this.playTimeStart = 0;
    }
  }

  // Get current play time
  getPlayTime(): number {
    if (this.playTimeStart > 0) {
      return this.totalPlayTime + Math.floor((Date.now() - this.playTimeStart) / 1000);
    }
    return this.totalPlayTime;
  }

  // Simple checksum calculation
  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

// World serializer - handles world state serialization
export class WorldSerializer {
  static serialize(world: World): SerializedWorld {
    const chunkManager = world.getChunkManager();
    const activeChunks = chunkManager.getActiveChunks();
    
    // Serialize all chunks (you might want to limit this for performance)
    const serializedChunks: SerializedChunk[] = activeChunks.map(chunk => this.serializeChunk(chunk));

    // Get player position (approximate from active chunks)
    // In a real implementation, you'd track the player entity separately
    const playerPosition: Position = { x: 0, y: 0 }; // Placeholder

    return {
      width: world.getWidth(),
      height: world.getHeight(),
      chunkSize: 64, // TODO: get from chunk
      chunks: serializedChunks,
      playerPosition
    };
  }

  static serializeChunk(chunk: Chunk): SerializedChunk {
    // Get all tiles
    const tiles: Tile[][] = [];
    for (let y = 0; y < chunk.size; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < chunk.size; x++) {
        const tile = chunk.getTile(x, y);
        row.push(tile || TERRAIN.floor);
      }
      tiles.push(row);
    }

    return {
      chunkX: chunk.chunkX,
      chunkY: chunk.chunkY,
      size: chunk.size,
      tiles,
      entities: chunk.getAllEntities(),
      lastUpdateTurn: chunk.getLastUpdateTurn(),
      needsCatchUp: chunk.isCatchUpNeeded()
    };
  }

  static deserializeWorld(data: SerializedWorld): {
    width: number;
    height: number;
    chunkSize: number;
    chunks: SerializedChunk[];
  } {
    return {
      width: data.width,
      height: data.height,
      chunkSize: data.chunkSize,
      chunks: data.chunks
    };
  }

  // Apply serialized chunk data to an existing chunk
  static applyChunkData(chunk: Chunk, data: SerializedChunk): void {
    // Restore tiles
    for (let y = 0; y < data.size && y < chunk.size; y++) {
      for (let x = 0; x < data.size && x < chunk.size; x++) {
        if (data.tiles[y] && data.tiles[y][x]) {
          chunk.setTile(x, y, data.tiles[y][x]);
        }
      }
    }

    // Restore entity references (actual entities are loaded separately)
    for (const entityRef of data.entities) {
      chunk.addEntity(entityRef.entityId, entityRef.x, entityRef.y);
    }

    // Restore chunk state
    chunk.markUpdated(data.lastUpdateTurn);
    if (data.needsCatchUp) {
      chunk.setCatchUpNeeded(true);
    }
  }
}

// Entity serializer - handles entity and component serialization
export class EntitySerializer {
  static serialize(entity: Entity): SerializedEntity {
    return {
      id: entity.id,
      components: entity.getAllComponents()
    };
  }

  static serializeAll(ecsWorld: ECSWorld): SerializedEntity[] {
    return ecsWorld.getAllEntities().map(entity => this.serialize(entity));
  }

  static deserialize(data: SerializedEntity, ecsWorld: ECSWorld): Entity {
    // Check if entity already exists
    let entity = ecsWorld.getEntity(data.id);
    
    if (!entity) {
      // Create new entity with the specified ID
      // We need to access the private static counter, so we'll use a workaround
      entity = ecsWorld.createEntity();
      // Note: In a real implementation, you might want to add a method to ECSWorld
      // to create an entity with a specific ID
    }

    // Clear existing components
    const existingComponents = entity.getAllComponents();
    for (const component of existingComponents) {
      entity.removeComponent(component.type);
    }

    // Add serialized components
    for (const component of data.components) {
      // Type assertion needed since we're working with generic components
      (entity as any).addComponent(component);
    }

    return entity;
  }

  static deserializeAll(data: SerializedEntity[], ecsWorld: ECSWorld): void {
    // Clear existing entities first
    const existingEntities = ecsWorld.getAllEntities();
    for (const entity of existingEntities) {
      ecsWorld.removeEntity(entity.id);
    }

    // Deserialize all entities
    for (const entityData of data) {
      this.deserialize(entityData, ecsWorld);
    }
  }
}

// Utility function to format play time
export function formatPlayTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Compression utility for large saves
export class SaveCompressor {
  // Simple compression using LZ-string like approach
  // In production, you might want to use a proper library like pako for gzip
  static compress(data: string): string {
    // For now, just return as-is (compression can be added later)
    return data;
  }

  static decompress(data: string): string {
    // For now, just return as-is
    return data;
  }
}

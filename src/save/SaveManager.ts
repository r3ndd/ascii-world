/**
 * Save Manager
 * Handles save slots and orchestrates serialization
 */

import { World } from '../world';
import { ECSWorld } from '../ecs';
import { EventBus } from '../core/EventBus';
import { ItemManager, InventoryManager } from '../items';
import { TurnManager } from '../time';
import { Position } from '../core/Types';
import { StorageProvider, LocalStorageProvider } from './StorageProvider';
import { SaveMetadata } from './SaveMetadata';
import { SaveData } from './SerializedData';
import { WorldSerializer } from './WorldSerializer';
import { EntitySerializer } from './EntitySerializer';

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
      const serializedTemplates = itemManager.getAllTemplates();
      const serializedInventories = inventoryManager.serializeInventories();

      // Calculate checksum
      const dataString = JSON.stringify({
        world: serializedWorld,
        entities: serializedEntities,
        templates: serializedTemplates,
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
        templates: serializedTemplates,
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
    world: import('./SerializedData').SerializedWorld;
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
        templates: saveData.templates,
        inventories: saveData.inventories
      });
      const checksum = this.calculateChecksum(dataString);
      
      if (checksum !== saveData.metadata.checksum) {
        console.warn(`Save ${slot} checksum mismatch - data may be corrupted`);
        this.eventBus.emit('load:checksumMismatch', { slot });
      }

      // Load templates first (required for items)
      for (const template of saveData.templates) {
        itemManager.registerTemplate(template);
      }

      // Load items - they are now ECS entities in saveData.entities

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

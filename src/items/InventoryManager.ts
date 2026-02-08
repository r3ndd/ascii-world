/**
 * Inventory Manager
 * Handles all inventories in the game
 */

import { ECSWorld, EntityId } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Inventory } from './Inventory';

/**
 * Inventory manager - handles all inventories in the game
 */
export class InventoryManager {
  private inventories: Map<EntityId, Inventory> = new Map();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Create a new inventory
   */
  createInventory(
    ownerId: EntityId,
    capacity: number,
    volumeCapacity: number
  ): Inventory {
    const inventory = new Inventory(
      ownerId,
      capacity,
      volumeCapacity,
      this.eventBus
    );
    this.inventories.set(ownerId, inventory);
    return inventory;
  }

  /**
   * Get an inventory by owner ID
   */
  getInventory(ownerId: EntityId): Inventory | undefined {
    return this.inventories.get(ownerId);
  }

  /**
   * Remove an inventory
   */
  removeInventory(ecsWorld: ECSWorld, ownerId: EntityId): boolean {
    const inventory = this.inventories.get(ownerId);
    if (inventory) {
      inventory.clear(ecsWorld);
      this.inventories.delete(ownerId);
      return true;
    }
    return false;
  }

  /**
   * Check if entity has an inventory
   */
  hasInventory(ownerId: EntityId): boolean {
    return this.inventories.has(ownerId);
  }

  /**
   * Get all inventories
   */
  getAllInventories(): Inventory[] {
    return Array.from(this.inventories.values());
  }

  /**
   * Transfer item between inventories
   */
  transferItem(
    ecsWorld: ECSWorld,
    fromOwnerId: EntityId,
    toOwnerId: EntityId,
    itemId: EntityId
  ): boolean {
    const fromInventory = this.inventories.get(fromOwnerId);
    const toInventory = this.inventories.get(toOwnerId);

    if (!fromInventory || !toInventory) {
      return false;
    }

    return fromInventory.transferItem(ecsWorld, itemId, toInventory);
  }

  /**
   * Clear all inventories
   */
  clear(ecsWorld: ECSWorld): void {
    for (const inventory of this.inventories.values()) {
      inventory.clear(ecsWorld);
    }
    this.inventories.clear();
  }

  /**
   * Serialize all inventories
   */
  serializeInventories(): {
    ownerId: EntityId;
    capacity: number;
    volumeCapacity: number;
    itemIds: EntityId[];
  }[] {
    return Array.from(this.inventories.values()).map(inv => inv.toJSON());
  }

  /**
   * Deserialize inventories
   * Note: Item entities should be deserialized first via ECS
   */
  deserializeInventories(
    data: {
      ownerId: EntityId;
      capacity: number;
      volumeCapacity: number;
      itemIds: EntityId[];
    }[]
  ): void {
    this.inventories.clear();
    
    for (const invData of data) {
      const inventory = Inventory.fromJSON(invData, this.eventBus);
      this.inventories.set(invData.ownerId, inventory);
    }
  }
}

export default InventoryManager;

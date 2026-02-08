/**
 * Item factory for testing
 * Provides functions to create test items and inventories
 */

import { ItemManager, Inventory, InventoryManager, ItemCategory } from '../../src/items';
import { ECSWorld } from '../../src/ecs';
import { EventBus } from '../../src/core/EventBus';
import { EntityId } from '../../src/core/Types';

/**
 * Create a test item manager with default templates
 */
export function createTestItemManager(eventBus: EventBus): ItemManager {
  return new ItemManager(eventBus);
}

/**
 * Create a test inventory for an entity
 */
export function createTestInventory(
  ownerId: EntityId,
  eventBus: EventBus,
  capacity: number = 50,
  volumeCapacity: number = 100
): Inventory {
  return new Inventory(ownerId, capacity, volumeCapacity, eventBus);
}

/**
 * Create a test inventory manager
 */
export function createTestInventoryManager(
  eventBus: EventBus
): InventoryManager {
  return new InventoryManager(eventBus);
}

/**
 * Spawn test items into an inventory
 */
export function spawnItemsIntoInventory(
  ecsWorld: ECSWorld,
  inventory: Inventory,
  itemManager: ItemManager,
  itemCounts: Array<{ templateId: string; quantity?: number }>
): void {
  for (const { templateId, quantity = 1 } of itemCounts) {
    const item = itemManager.spawnItem(ecsWorld, templateId, quantity);
    if (item) {
      inventory.addItem(ecsWorld, item);
    }
  }
}

/**
 * Item factory for testing
 * Provides functions to create test items and inventories
 */

import { ItemManager, Inventory, InventoryManager, ItemCategory } from '../../src/items';
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
  itemManager: ItemManager,
  eventBus: EventBus,
  capacity: number = 50,
  volumeCapacity: number = 100
): Inventory {
  return new Inventory(ownerId, capacity, volumeCapacity, itemManager, eventBus);
}

/**
 * Create a test inventory manager
 */
export function createTestInventoryManager(
  itemManager: ItemManager,
  eventBus: EventBus
): InventoryManager {
  return new InventoryManager(itemManager, eventBus);
}

/**
 * Spawn test items into an inventory
 */
export function spawnItemsIntoInventory(
  inventory: Inventory,
  itemManager: ItemManager,
  itemCounts: Array<{ templateId: string; quantity?: number }>
): void {
  for (const { templateId, quantity = 1 } of itemCounts) {
    const item = itemManager.spawnItem(templateId, quantity);
    if (item) {
      inventory.addItem(item);
    }
  }
}

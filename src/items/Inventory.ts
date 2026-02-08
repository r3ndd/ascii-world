/**
 * Inventory
 * Manages items as ECS entities for a container/entity
 */

import { Entity, ECSWorld, createPosition, createRenderable } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Position, EntityId } from '../core/Types';
import { ItemTemplateComponent, ItemComponent } from './components';

/**
 * Inventory component for ECS entities
 */
export interface InventoryComponent extends Component {
  type: 'inventory';
  capacity: number;             // Max weight capacity
  volumeCapacity: number;     // Max volume capacity
  itemIds: EntityId[];        // Item entity IDs (changed from string[])
}

import { Component } from '../ecs';

/**
 * Component factory for inventory
 */
export function createInventoryComponent(
  capacity: number,
  volumeCapacity: number
): InventoryComponent {
  return {
    type: 'inventory',
    capacity,
    volumeCapacity,
    itemIds: []
  };
}

/**
 * Inventory class - manages items for a container entity
 */
export class Inventory {
  private ownerId: EntityId;
  private itemIds: Set<EntityId> = new Set();
  private capacity: number;
  private volumeCapacity: number;
  private eventBus: EventBus;

  constructor(
    ownerId: EntityId,
    capacity: number,
    volumeCapacity: number,
    eventBus: EventBus
  ) {
    this.ownerId = ownerId;
    this.capacity = capacity;
    this.volumeCapacity = volumeCapacity;
    this.eventBus = eventBus;
  }

  get owner(): EntityId {
    return this.ownerId;
  }

  get weightCapacity(): number {
    return this.capacity;
  }

  get volCapacity(): number {
    return this.volumeCapacity;
  }

  /**
   * Get items in this inventory
   */
  getItems(ecsWorld: ECSWorld): Entity[] {
    const items: Entity[] = [];
    for (const itemId of this.itemIds) {
      const item = ecsWorld.getEntity(itemId);
      if (item) {
        items.push(item);
      }
    }
    return items;
  }

  /**
   * Calculate current total weight
   */
  getCurrentWeight(ecsWorld: ECSWorld): number {
    let total = 0;
    for (const item of this.getItems(ecsWorld)) {
      const templateComp = item.getComponent<ItemTemplateComponent>('item_template');
      const itemComp = item.getComponent<ItemComponent>('item');
      if (templateComp && itemComp) {
        total += templateComp.weight * itemComp.quantity;
      }
    }
    return total;
  }

  /**
   * Calculate current total volume
   */
  getCurrentVolume(ecsWorld: ECSWorld): number {
    let total = 0;
    for (const item of this.getItems(ecsWorld)) {
      const templateComp = item.getComponent<ItemTemplateComponent>('item_template');
      const itemComp = item.getComponent<ItemComponent>('item');
      if (templateComp && itemComp) {
        total += templateComp.volume * itemComp.quantity;
      }
    }
    return total;
  }

  /**
   * Get remaining weight capacity
   */
  get remainingWeight(): number {
    return this.capacity; // Will be calculated dynamically
  }

  /**
   * Get remaining volume capacity
   */
  get remainingVolume(): number {
    return this.volumeCapacity; // Will be calculated dynamically
  }

  /**
   * Get number of items
   */
  getItemCount(): number {
    return this.itemIds.size;
  }

  /**
   * Check if inventory has an item
   */
  hasItem(itemId: EntityId): boolean {
    return this.itemIds.has(itemId);
  }

  /**
   * Check if can add item
   */
  canAddItem(ecsWorld: ECSWorld, item: Entity): boolean {
    const templateComp = item.getComponent<ItemTemplateComponent>('item_template');
    const itemComp = item.getComponent<ItemComponent>('item');
    
    if (!templateComp || !itemComp) return false;

    const weight = templateComp.weight * itemComp.quantity;
    const volume = templateComp.volume * itemComp.quantity;

    if (this.getCurrentWeight(ecsWorld) + weight > this.capacity) {
      return false;
    }

    if (this.getCurrentVolume(ecsWorld) + volume > this.volumeCapacity) {
      return false;
    }

    return true;
  }

  /**
   * Check if can add weight
   */
  canAddWeight(weight: number): boolean {
    return weight <= this.capacity; // Simplified check
  }

  /**
   * Add item to inventory
   */
  addItem(ecsWorld: ECSWorld, item: Entity): boolean {
    if (!this.canAddItem(ecsWorld, item)) {
      this.eventBus.emit('inventory:addFailed', {
        ownerId: this.ownerId,
        itemId: item.id,
        reason: 'capacity_exceeded'
      });
      return false;
    }

    const itemComp = item.getComponent<ItemComponent>('item');

    // Try to stack with existing items
    if (itemComp?.stackable) {
      const existingStack = this.findStackableItem(ecsWorld, item);
      if (existingStack) {
        const existingComp = existingStack.getComponent<ItemComponent>('item')!;
        existingComp.quantity += itemComp.quantity;
        
        // Remove the item from world since it's been merged
        ecsWorld.removeEntity(item.id);
        
        this.eventBus.emit('inventory:stacked', {
          ownerId: this.ownerId,
          targetItemId: existingStack.id,
          sourceItemId: item.id,
          quantity: itemComp.quantity
        });
        return true;
      }
    }

    // Add as new item
    this.itemIds.add(item.id);
    
    // Remove position and renderable components (now in inventory)
    item.removeComponent('position');
    item.removeComponent('renderable');
    
    // Ensure equipped flag is false
    if (itemComp) {
      itemComp.equipped = false;
    }

    this.eventBus.emit('inventory:itemAdded', {
      ownerId: this.ownerId,
      itemId: item.id,
      templateId: itemComp?.templateId
    });

    return true;
  }

  /**
   * Remove item from inventory
   */
  removeItem(ecsWorld: ECSWorld, itemId: EntityId): Entity | null {
    if (!this.itemIds.has(itemId)) {
      return null;
    }

    const item = ecsWorld.getEntity(itemId);
    if (!item) {
      this.itemIds.delete(itemId);
      return null;
    }

    this.itemIds.delete(itemId);

    this.eventBus.emit('inventory:itemRemoved', {
      ownerId: this.ownerId,
      itemId: item.id
    });

    return item;
  }

  /**
   * Drop item at location
   */
  dropItem(ecsWorld: ECSWorld, itemId: EntityId, location: Position): Entity | null {
    const item = this.removeItem(ecsWorld, itemId);
    if (!item) return null;

    // Add position and renderable components
    const templateComp = item.getComponent<ItemTemplateComponent>('item_template');
    item.addComponent(createPosition(location.x, location.y, location.z ?? 0));
    if (templateComp) {
      item.addComponent(createRenderable(
        templateComp.character,
        templateComp.foreground,
        templateComp.background
      ));
    }

    this.eventBus.emit('inventory:itemDropped', {
      ownerId: this.ownerId,
      itemId: item.id,
      location
    });

    return item;
  }

  /**
   * Transfer item to another inventory
   */
  transferItem(ecsWorld: ECSWorld, itemId: EntityId, targetInventory: Inventory): boolean {
    const item = this.removeItem(ecsWorld, itemId);
    if (!item) return false;

    if (targetInventory.addItem(ecsWorld, item)) {
      this.eventBus.emit('inventory:itemTransferred', {
        fromOwnerId: this.ownerId,
        toOwnerId: targetInventory.owner,
        itemId: item.id
      });
      return true;
    } else {
      // Put it back if transfer failed
      this.addItem(ecsWorld, item);
      return false;
    }
  }

  /**
   * Get equipped items
   */
  getEquippedItems(ecsWorld: ECSWorld): Entity[] {
    return this.getItems(ecsWorld).filter(item => {
      const itemComp = item.getComponent<ItemComponent>('item');
      return itemComp?.equipped ?? false;
    });
  }

  /**
   * Equip an item
   */
  equipItem(ecsWorld: ECSWorld, itemId: EntityId, slot?: string): boolean {
    if (!this.itemIds.has(itemId)) return false;

    const item = ecsWorld.getEntity(itemId);
    if (!item) return false;

    const itemComp = item.getComponent<ItemComponent>('item');
    if (!itemComp) return false;

    itemComp.equipped = true;
    if (slot) {
      itemComp.equippedSlot = slot;
    }

    this.eventBus.emit('inventory:itemEquipped', {
      ownerId: this.ownerId,
      itemId,
      slot
    });

    return true;
  }

  /**
   * Unequip an item
   */
  unequipItem(ecsWorld: ECSWorld, itemId: EntityId): boolean {
    if (!this.itemIds.has(itemId)) return false;

    const item = ecsWorld.getEntity(itemId);
    if (!item) return false;

    const itemComp = item.getComponent<ItemComponent>('item');
    if (!itemComp) return false;

    itemComp.equipped = false;
    itemComp.equippedSlot = undefined;

    this.eventBus.emit('inventory:itemUnequipped', {
      ownerId: this.ownerId,
      itemId
    });

    return true;
  }

  /**
   * Get items by category
   */
  getItemsByCategory(ecsWorld: ECSWorld, category: string): Entity[] {
    return this.getItems(ecsWorld).filter(item => {
      const templateComp = item.getComponent<ItemTemplateComponent>('item_template');
      return templateComp?.category === category;
    });
  }

  /**
   * Get total value of all items
   */
  getTotalValue(ecsWorld: ECSWorld): number {
    return this.getItems(ecsWorld).reduce((total, item) => {
      const itemComp = item.getComponent<ItemComponent>('item');
      if (itemComp) {
        return total + (itemComp.value || 0) * itemComp.quantity;
      }
      return total;
    }, 0);
  }

  /**
   * Clear all items
   */
  clear(ecsWorld: ECSWorld): void {
    for (const itemId of this.itemIds) {
      ecsWorld.removeEntity(itemId);
    }
    this.itemIds.clear();
  }

  /**
   * Serialization
   */
  toJSON(): {
    ownerId: EntityId;
    capacity: number;
    volumeCapacity: number;
    itemIds: EntityId[];
  } {
    return {
      ownerId: this.ownerId,
      capacity: this.capacity,
      volumeCapacity: this.volumeCapacity,
      itemIds: Array.from(this.itemIds)
    };
  }

  static fromJSON(
    data: {
      ownerId: EntityId;
      capacity: number;
      volumeCapacity: number;
      itemIds: EntityId[];
    },
    eventBus: EventBus
  ): Inventory {
    const inventory = new Inventory(
      data.ownerId,
      data.capacity,
      data.volumeCapacity,
      eventBus
    );
    
    for (const itemId of data.itemIds) {
      inventory.itemIds.add(itemId);
    }
    
    return inventory;
  }

  /**
   * Find a stackable item that can accept more quantity
   */
  private findStackableItem(ecsWorld: ECSWorld, item: Entity): Entity | undefined {
    const itemComp = item.getComponent<ItemComponent>('item');
    if (!itemComp || !itemComp.stackable) return undefined;

    const templateComp = item.getComponent<ItemTemplateComponent>('item_template');
    if (!templateComp) return undefined;

    for (const existingId of this.itemIds) {
      const existing = ecsWorld.getEntity(existingId);
      if (!existing) continue;

      const existingComp = existing.getComponent<ItemComponent>('item');
      const existingTemplate = existing.getComponent<ItemTemplateComponent>('item_template');
      
      if (!existingComp || !existingTemplate) continue;
      if (!existingComp.stackable) continue;
      if (existingComp.templateId !== itemComp.templateId) continue;
      if (existingComp.quality !== itemComp.quality) continue;
      
      if (existingComp.quantity < existingComp.maxStack) {
        return existing;
      }
    }

    return undefined;
  }
}

export default Inventory;

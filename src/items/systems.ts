/**
 * Item ECS Systems
 * Systems for processing item behaviors
 */

import { BaseSystem, Entity, ECSWorld, Query } from '../ecs';
import { ItemComponent } from './components';
import { WORLD_ITEMS_QUERY } from './queries';

/**
 * System that automatically stacks items at the same position
 */
export class ItemStackingSystem extends BaseSystem {
  readonly name = 'itemStacking';
  readonly priority = 50;
  query = WORLD_ITEMS_QUERY;
  private ecsWorld?: ECSWorld;

  onEntityAdded(_entity: Entity): void {
    // Could trigger immediate stacking check
  }

  onEntityRemoved(_entity: Entity): void {
    // Clean up if needed
  }

  update(entities: Entity[], _deltaTime: number): void {
    // Group items by position and template
    const groups = new Map<string, Entity[]>();
    
    for (const entity of entities) {
      const pos = entity.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
      const item = entity.getComponent<ItemComponent>('item');
      
      if (!pos || !item || !item.stackable) continue;
      
      // Create grouping key: position + template + quality
      const key = `${pos.x},${pos.y},${pos.z ?? 0}:${item.templateId}:${item.quality}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entity);
    }
    
    // Merge stacks
    for (const [_, stack] of groups) {
      if (stack.length < 2) continue;
      
      const primary = stack[0];
      const primaryComp = primary.getComponent<ItemComponent>('item')!;
      const maxStack = primaryComp.maxStack;
      
      for (let i = 1; i < stack.length; i++) {
        const other = stack[i];
        const otherComp = other.getComponent<ItemComponent>('item')!;
        
        const space = maxStack - primaryComp.quantity;
        if (space <= 0) break;
        
        const amount = Math.min(space, otherComp.quantity);
        primaryComp.quantity += amount;
        otherComp.quantity -= amount;
        
        if (otherComp.quantity <= 0) {
          // Remove the merged entity
          if (this.ecsWorld) {
            this.ecsWorld.removeEntity(other.id);
          }
        }
      }
    }
  }
}

/**
 * System that processes durability changes and item breaking
 */
export class ItemDurabilitySystem extends BaseSystem {
  readonly name = 'itemDurability';
  readonly priority = 40;
  query: Query = {
    all: ['item']
  };

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const item = entity.getComponent<ItemComponent>('item');
      if (!item || item.durability === undefined) continue;
      
      if (item.durability <= 0) {
        // Item is broken - could emit event or auto-remove
        // For now, just mark it
      }
    }
  }
}

/**
 * System for applying item effects (burning, cursed, etc.)
 */
export class ItemEffectSystem extends BaseSystem {
  readonly name = 'itemEffects';
  readonly priority = 30;
  query: Query = {
    all: ['item']
  };

  update(entities: Entity[], _deltaTime: number): void {
    // Process active item effects
    // This is a placeholder for future effect implementations
    for (const _entity of entities) {
      // Check for effect components (burning, frozen, etc.)
      // Apply effects based on deltaTime
    }
  }
}

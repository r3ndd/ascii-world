/**
 * Item Manager
 * Handles item template registry and spawning items as ECS entities
 */

import { Entity, ECSWorld, createPosition, createRenderable } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Position, EntityId } from '../core/Types';
import { ItemTemplate, ItemCategory, ItemProperties } from './types';
import { createItemComponent, createItemTemplateComponent } from './components';

export { ItemTemplate, ItemCategory, ItemProperties };

/**
 * Item manager - handles templates and entity creation
 */
export class ItemManager {
  private templates: Map<string, ItemTemplate> = new Map();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.registerDefaultTemplates();
  }

  /**
   * Register an item template
   */
  registerTemplate(template: ItemTemplate): void {
    this.templates.set(template.id, template);
    this.eventBus.emit('item:templateRegistered', { templateId: template.id });
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): ItemTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all registered templates
   */
  getAllTemplates(): ItemTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: ItemCategory): ItemTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  /**
   * Spawn an item as an ECS entity
   * @param ecsWorld - The ECS world to create the entity in
   * @param templateId - ID of the item template
   * @param quantity - Quantity to spawn (default: 1)
   * @param position - World position (if null, item is not in world)
   * @returns The created entity, or null if template not found
   */
  spawnItem(
    ecsWorld: ECSWorld,
    templateId: string,
    quantity: number = 1,
    position?: Position
  ): Entity | null {
    const template = this.templates.get(templateId);
    if (!template) {
      console.warn(`Item template not found: ${templateId}`);
      return null;
    }

    // Cap quantity to max stack
    const actualQuantity = Math.min(quantity, template.properties.maxStack || quantity);

    // Create entity
    const entity = ecsWorld.createEntity();

    // Add item component
    entity.addComponent(createItemComponent(
      templateId,
      actualQuantity,
      {
        durability: template.properties.durability,
        maxDurability: template.properties.maxDurability,
        quality: template.properties.quality,
        stackable: template.properties.stackable,
        maxStack: template.properties.maxStack,
        value: template.properties.value,
        equipped: false
      }
    ));

    // Add template component
    entity.addComponent(createItemTemplateComponent(
      template.name,
      template.description,
      template.category,
      template.properties.weight,
      template.properties.volume,
      template.character,
      template.foreground,
      {
        tags: template.tags,
        background: template.background
      }
    ));

    // Add position and renderable if in world
    if (position) {
      entity.addComponent(createPosition(position.x, position.y, position.z ?? 0));
      entity.addComponent(createRenderable(
        template.character,
        template.foreground,
        template.background
      ));
    }

    this.eventBus.emit('item:spawned', {
      entityId: entity.id,
      templateId,
      quantity: actualQuantity,
      position
    });

    return entity;
  }

  /**
   * Get an item entity by ID
   */
  getItem(ecsWorld: ECSWorld, entityId: EntityId): Entity | undefined {
    return ecsWorld.getEntity(entityId);
  }

  /**
   * Get all items at a specific position
   */
  getItemsAt(ecsWorld: ECSWorld, position: Position): Entity[] {
    return ecsWorld.queryEntities({
      all: ['item', 'position']
    }).filter(entity => {
      const pos = entity.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
      return pos &&
             pos.x === position.x &&
             pos.y === position.y &&
             pos.z === (position.z ?? 0);
    });
  }

  /**
   * Get items by container entity ID
   */
  getItemsByContainer(ecsWorld: ECSWorld, _containerId: EntityId): Entity[] {
    // Items in inventories don't have position components
    return ecsWorld.queryEntities({
      all: ['item'],
      none: ['position']
    }).filter(_entity => {
      // Check if item's owner matches container
      // This requires storing owner info somewhere - for now, we'll rely on
      // the Inventory class to track this relationship
      return false; // Placeholder - actual implementation in Inventory
    });
  }

  /**
   * Remove an item entity
   */
  removeItem(ecsWorld: ECSWorld, entityId: EntityId): boolean {
    const entity = ecsWorld.getEntity(entityId);
    if (!entity) return false;

    ecsWorld.removeEntity(entityId);
    this.eventBus.emit('item:removed', { entityId });
    return true;
  }

  /**
   * Clear all templates
   */
  clear(): void {
    this.templates.clear();
    this.registerDefaultTemplates();
  }

  /**
   * Serialize templates for saving
   */
  serializeTemplates(): ItemTemplate[] {
    return this.getAllTemplates();
  }

  /**
   * Register default item templates
   */
  private registerDefaultTemplates(): void {
    this.registerTemplate({
      id: 'sword_iron',
      name: 'Iron Sword',
      description: 'A sturdy iron sword.',
      category: ItemCategory.WEAPON,
      character: '/',
      foreground: '#cccccc',
      properties: {
        weight: 1.5,
        volume: 3,
        durability: 100,
        maxDurability: 100,
        value: 50
      }
    });

    this.registerTemplate({
      id: 'potion_health',
      name: 'Health Potion',
      description: 'Restores health when consumed.',
      category: ItemCategory.CONSUMABLE,
      character: '!',
      foreground: '#ff0000',
      properties: {
        weight: 0.3,
        volume: 0.5,
        stackable: true,
        maxStack: 20,
        value: 10
      }
    });

    this.registerTemplate({
      id: 'wood_plank',
      name: 'Wooden Plank',
      description: 'A sturdy wooden plank.',
      category: ItemCategory.MATERIAL,
      character: '=',
      foreground: '#8b4513',
      properties: {
        weight: 2,
        volume: 4,
        stackable: true,
        maxStack: 10,
        value: 5
      }
    });

    this.registerTemplate({
      id: 'backpack',
      name: 'Backpack',
      description: 'A sturdy backpack for carrying items.',
      category: ItemCategory.CONTAINER,
      character: '[',
      foreground: '#8b4513',
      properties: {
        weight: 1,
        volume: 20,
        durability: 50,
        maxDurability: 50,
        value: 25
      }
    });
  }
}

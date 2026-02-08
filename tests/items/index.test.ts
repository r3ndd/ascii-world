/**
 * Item System Tests
 * Tests for the ECS-based item system
 */

import {
  ItemManager,
  Inventory,
  InventoryManager,
  ItemCategory,
  ItemTemplate,
  ItemComponent,
  ItemTemplateComponent,
  createInventoryComponent
} from '../../src/items';
import { ECSWorld, Entity } from '../../src/ecs';
import { EventBus } from '../../src/core/EventBus';

describe('ItemManager', () => {
  let itemManager: ItemManager;
  let eventBus: EventBus;
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    eventBus = new EventBus();
    ecsWorld = new ECSWorld(eventBus);
    itemManager = new ItemManager(eventBus);
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  describe('template management', () => {
    it('should register templates', () => {
      const template: ItemTemplate = {
        id: 'test_item',
        name: 'Test Item',
        description: 'A test item',
        category: ItemCategory.MISC,
        character: '?',
        foreground: '#ffffff',
        properties: { weight: 1, volume: 1 }
      };

      const handler = jest.fn();
      eventBus.on('item:templateRegistered', handler);

      itemManager.registerTemplate(template);

      expect(itemManager.getTemplate('test_item')).toEqual(template);
      expect(handler).toHaveBeenCalledWith({ templateId: 'test_item' });
    });

    it('should get all templates', () => {
      const templates = itemManager.getAllTemplates();
      expect(templates.length).toBeGreaterThan(0); // Default templates
    });

    it('should get templates by category', () => {
      const weapons = itemManager.getTemplatesByCategory(ItemCategory.WEAPON);
      expect(weapons.length).toBeGreaterThan(0);
      expect(weapons.every(t => t.category === ItemCategory.WEAPON)).toBe(true);
    });
  });

  describe('item spawning', () => {
    it('should spawn item from template', () => {
      const handler = jest.fn();
      eventBus.on('item:spawned', handler);

      const item = itemManager.spawnItem(ecsWorld, 'sword_iron');

      expect(item).toBeInstanceOf(Entity);
      expect(item).not.toBeNull();
      
      const itemComp = item?.getComponent<ItemComponent>('item');
      expect(itemComp?.templateId).toBe('sword_iron');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        templateId: 'sword_iron',
        quantity: 1
      }));
    });

    it('should spawn item with quantity', () => {
      const item = itemManager.spawnItem(ecsWorld, 'potion_health', 5);
      const itemComp = item?.getComponent<ItemComponent>('item');
      expect(itemComp?.quantity).toBe(5);
    });

    it('should spawn item at location', () => {
      const item = itemManager.spawnItem(ecsWorld, 'sword_iron', 1, { x: 10, y: 20 });
      const pos = item?.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
      expect(pos).toEqual({ type: 'position', x: 10, y: 20, z: 0 });
    });

    it('should return null for non-existent template', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const item = itemManager.spawnItem(ecsWorld, 'nonexistent');
      expect(item).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should respect max stack size', () => {
      const item = itemManager.spawnItem(ecsWorld, 'potion_health', 50);
      const itemComp = item?.getComponent<ItemComponent>('item');
      expect(itemComp?.quantity).toBeLessThanOrEqual(20); // maxStack for potion_health
    });
  });

  describe('item retrieval', () => {
    it('should get item by id', () => {
      const spawned = itemManager.spawnItem(ecsWorld, 'sword_iron');
      expect(spawned).not.toBeNull();
      
      const retrieved = itemManager.getItem(ecsWorld, spawned!.id);
      expect(retrieved).toBe(spawned);
    });

    it('should return undefined for non-existent item', () => {
      expect(itemManager.getItem(ecsWorld, 99999)).toBeUndefined();
    });

    it('should get items at location', () => {
      itemManager.spawnItem(ecsWorld, 'sword_iron', 1, { x: 10, y: 20 });
      itemManager.spawnItem(ecsWorld, 'potion_health', 1, { x: 10, y: 20 });
      itemManager.spawnItem(ecsWorld, 'wood_plank', 1, { x: 5, y: 5 });

      const itemsAtLocation = itemManager.getItemsAt(ecsWorld, { x: 10, y: 20 });
      expect(itemsAtLocation.length).toBe(2);
    });
  });

  describe('item removal', () => {
    it('should remove item', () => {
      const item = itemManager.spawnItem(ecsWorld, 'sword_iron')!;

      const handler = jest.fn();
      eventBus.on('item:removed', handler);

      const result = itemManager.removeItem(ecsWorld, item.id);

      expect(result).toBe(true);
      expect(itemManager.getItem(ecsWorld, item.id)).toBeUndefined();
      expect(handler).toHaveBeenCalledWith({ entityId: item.id });
    });

    it('should return false when removing non-existent item', () => {
      const result = itemManager.removeItem(ecsWorld, 99999);
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all templates', () => {
      itemManager.clear();

      // Default templates should be re-registered
      expect(itemManager.getAllTemplates().length).toBeGreaterThan(0);
    });
  });
});

describe('Inventory', () => {
  let inventory: Inventory;
  let itemManager: ItemManager;
  let eventBus: EventBus;
  let ecsWorld: ECSWorld;
  let sword: Entity;

  beforeEach(() => {
    eventBus = new EventBus();
    ecsWorld = new ECSWorld(eventBus);
    itemManager = new ItemManager(eventBus);
    inventory = new Inventory(1, 50, 100, eventBus);

    sword = itemManager.spawnItem(ecsWorld, 'sword_iron')!;
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  describe('creation', () => {
    it('should create inventory with owner and capacity', () => {
      expect(inventory.owner).toBe(1);
      expect(inventory.weightCapacity).toBe(50);
      expect(inventory.volCapacity).toBe(100);
    });

    it('should start empty', () => {
      expect(inventory.getItemCount()).toBe(0);
      expect(inventory.getCurrentWeight(ecsWorld)).toBe(0);
      expect(inventory.getCurrentVolume(ecsWorld)).toBe(0);
    });
  });

  describe('weight and volume tracking', () => {
    it('should track current weight', () => {
      inventory.addItem(ecsWorld, sword);
      const templateComp = sword.getComponent<ItemTemplateComponent>('item_template');
      expect(inventory.getCurrentWeight(ecsWorld)).toBe(templateComp?.weight || 0);
    });

    it('should track current volume', () => {
      inventory.addItem(ecsWorld, sword);
      const templateComp = sword.getComponent<ItemTemplateComponent>('item_template');
      expect(inventory.getCurrentVolume(ecsWorld)).toBe(templateComp?.volume || 0);
    });
  });

  describe('adding items', () => {
    it('should add item to inventory', () => {
      const handler = jest.fn();
      eventBus.on('inventory:itemAdded', handler);

      const result = inventory.addItem(ecsWorld, sword);

      expect(result).toBe(true);
      expect(inventory.getItemCount()).toBe(1);
      expect(inventory.hasItem(sword.id)).toBe(true);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: 1,
        itemId: sword.id
      }));
    });

    it('should reject item exceeding weight capacity', () => {
      // Create a heavy item template that exceeds capacity
      const heavyTemplate: ItemTemplate = {
        id: 'heavy_item',
        name: 'Heavy Item',
        description: 'Very heavy item',
        category: ItemCategory.MISC,
        character: '?',
        foreground: '#ffffff',
        properties: {
          weight: 60, // 60kg, exceeds 50kg capacity
          volume: 10
        }
      };
      itemManager.registerTemplate(heavyTemplate);
      const heavyItem = itemManager.spawnItem(ecsWorld, 'heavy_item')!;

      const handler = jest.fn();
      eventBus.on('inventory:addFailed', handler);

      const result = inventory.addItem(ecsWorld, heavyItem);

      expect(result).toBe(false);
      expect(inventory.getItemCount()).toBe(0);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: 1,
        reason: 'capacity_exceeded'
      }));
    });

    it('should reject item exceeding volume capacity', () => {
      // Create a template with high volume
      const template: ItemTemplate = {
        id: 'bulky_item',
        name: 'Bulky Item',
        description: 'Very bulky',
        category: ItemCategory.MISC,
        character: '?',
        foreground: '#ffffff',
        properties: { weight: 1, volume: 150 }
      };
      itemManager.registerTemplate(template);
      const bulkyItem = itemManager.spawnItem(ecsWorld, 'bulky_item')!;

      const result = inventory.addItem(ecsWorld, bulkyItem);
      expect(result).toBe(false);
    });

    it('should stack with existing items', () => {
      const potion1 = itemManager.spawnItem(ecsWorld, 'potion_health')!;
      const potion2 = itemManager.spawnItem(ecsWorld, 'potion_health')!;

      const handler = jest.fn();
      eventBus.on('inventory:stacked', handler);

      inventory.addItem(ecsWorld, potion1);
      inventory.addItem(ecsWorld, potion2);

      expect(inventory.getItemCount()).toBe(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: 1,
        targetItemId: potion1.id,
        sourceItemId: potion2.id
      }));
    });
  });

  describe('removing items', () => {
    it('should remove item from inventory', () => {
      inventory.addItem(ecsWorld, sword);

      const handler = jest.fn();
      eventBus.on('inventory:itemRemoved', handler);

      const removed = inventory.removeItem(ecsWorld, sword.id);

      expect(removed).toBe(sword);
      expect(inventory.getItemCount()).toBe(0);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: 1,
        itemId: sword.id
      }));
    });

    it('should return null when removing non-existent item', () => {
      const removed = inventory.removeItem(ecsWorld, 99999);
      expect(removed).toBeNull();
    });
  });

  describe('dropping items', () => {
    it('should drop item at location', () => {
      inventory.addItem(ecsWorld, sword);

      const handler = jest.fn();
      eventBus.on('inventory:itemDropped', handler);

      const dropped = inventory.dropItem(ecsWorld, sword.id, { x: 10, y: 20 });

      expect(dropped).toBe(sword);
      expect(inventory.getItemCount()).toBe(0);
      
      // Item should now have position component
      const pos = dropped?.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
      expect(pos).toEqual({ type: 'position', x: 10, y: 20, z: 0 });
      
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: 1,
        location: { x: 10, y: 20 }
      }));
    });

    it('should return null when dropping non-existent item', () => {
      const dropped = inventory.dropItem(ecsWorld, 99999, { x: 0, y: 0 });
      expect(dropped).toBeNull();
    });
  });

  describe('transferring items', () => {
    it('should transfer item to another inventory', () => {
      const otherInventory = new Inventory(2, 50, 100, eventBus);
      inventory.addItem(ecsWorld, sword);

      const handler = jest.fn();
      eventBus.on('inventory:itemTransferred', handler);

      const result = inventory.transferItem(ecsWorld, sword.id, otherInventory);

      expect(result).toBe(true);
      expect(inventory.getItemCount()).toBe(0);
      expect(otherInventory.getItemCount()).toBe(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        fromOwnerId: 1,
        toOwnerId: 2
      }));
    });

    it('should return item when transfer fails', () => {
      const smallInventory = new Inventory(2, 0.1, 0.1, eventBus);
      inventory.addItem(ecsWorld, sword);

      const result = inventory.transferItem(ecsWorld, sword.id, smallInventory);

      expect(result).toBe(false);
      expect(inventory.getItemCount()).toBe(1); // Item returned
    });
  });

  describe('equipment', () => {
    it('should equip item', () => {
      inventory.addItem(ecsWorld, sword);

      const result = inventory.equipItem(ecsWorld, sword.id);

      expect(result).toBe(true);
      const itemComp = sword.getComponent<ItemComponent>('item');
      expect(itemComp?.equipped).toBe(true);
    });

    it('should unequip item', () => {
      inventory.addItem(ecsWorld, sword);
      inventory.equipItem(ecsWorld, sword.id);

      const result = inventory.unequipItem(ecsWorld, sword.id);

      expect(result).toBe(true);
      const itemComp = sword.getComponent<ItemComponent>('item');
      expect(itemComp?.equipped).toBe(false);
    });

    it('should not equip item not in inventory', () => {
      const result = inventory.equipItem(ecsWorld, 99999);
      expect(result).toBe(false);
    });

    it('should get equipped items', () => {
      inventory.addItem(ecsWorld, sword);
      inventory.equipItem(ecsWorld, sword.id);

      const equipped = inventory.getEquippedItems(ecsWorld);
      expect(equipped.length).toBe(1);
      expect(equipped[0].id).toBe(sword.id);
    });
  });

  describe('querying', () => {
    beforeEach(() => {
      inventory.addItem(ecsWorld, sword);
      const potion = itemManager.spawnItem(ecsWorld, 'potion_health')!;
      inventory.addItem(ecsWorld, potion);
    });

    it('should get all items', () => {
      const items = inventory.getItems(ecsWorld);
      expect(items.length).toBe(2);
    });

    it('should get items by category', () => {
      const weapons = inventory.getItemsByCategory(ecsWorld, ItemCategory.WEAPON);
      expect(weapons.length).toBe(1);
      const templateComp = weapons[0].getComponent<ItemTemplateComponent>('item_template');
      expect(templateComp?.category).toBe(ItemCategory.WEAPON);
    });

    it('should calculate total value', () => {
      const totalValue = inventory.getTotalValue(ecsWorld);
      expect(totalValue).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all items', () => {
      inventory.addItem(ecsWorld, sword);
      inventory.clear(ecsWorld);

      expect(inventory.getItemCount()).toBe(0);
    });
  });

  describe('serialization', () => {
    it('should serialize inventory', () => {
      inventory.addItem(ecsWorld, sword);

      const json = inventory.toJSON();

      expect(json.ownerId).toBe(1);
      expect(json.capacity).toBe(50);
      expect(json.itemIds).toContain(sword.id);
    });

    it('should deserialize inventory', () => {
      inventory.addItem(ecsWorld, sword);
      const json = inventory.toJSON();

      const restored = Inventory.fromJSON(json, eventBus);

      expect(restored.owner).toBe(1);
      expect(restored.weightCapacity).toBe(50);
      expect(restored.getItemCount()).toBe(1);
    });
  });
});

describe('InventoryManager', () => {
  let inventoryManager: InventoryManager;
  let itemManager: ItemManager;
  let eventBus: EventBus;
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    eventBus = new EventBus();
    ecsWorld = new ECSWorld(eventBus);
    itemManager = new ItemManager(eventBus);
    inventoryManager = new InventoryManager(eventBus);
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  describe('inventory creation', () => {
    it('should create inventory', () => {
      const inventory = inventoryManager.createInventory(1, 50, 100);

      expect(inventory).toBeInstanceOf(Inventory);
      expect(inventory.owner).toBe(1);
      expect(inventoryManager.hasInventory(1)).toBe(true);
    });

    it('should get inventory', () => {
      inventoryManager.createInventory(1, 50, 100);
      const retrieved = inventoryManager.getInventory(1);

      expect(retrieved).toBeInstanceOf(Inventory);
    });

    it('should return undefined for non-existent inventory', () => {
      expect(inventoryManager.getInventory(999)).toBeUndefined();
    });

    it('should get all inventories', () => {
      inventoryManager.createInventory(1, 50, 100);
      inventoryManager.createInventory(2, 30, 60);

      const inventories = inventoryManager.getAllInventories();
      expect(inventories.length).toBe(2);
    });
  });

  describe('inventory removal', () => {
    it('should remove inventory', () => {
      inventoryManager.createInventory(1, 50, 100);
      const result = inventoryManager.removeInventory(ecsWorld, 1);

      expect(result).toBe(true);
      expect(inventoryManager.hasInventory(1)).toBe(false);
    });

    it('should return false when removing non-existent inventory', () => {
      const result = inventoryManager.removeInventory(ecsWorld, 999);
      expect(result).toBe(false);
    });

    it('should clear items when removing inventory', () => {
      const inventory = inventoryManager.createInventory(1, 50, 100);
      const item = itemManager.spawnItem(ecsWorld, 'sword_iron')!;
      inventory.addItem(ecsWorld, item);

      inventoryManager.removeInventory(ecsWorld, 1);

      expect(itemManager.getItem(ecsWorld, item.id)).toBeUndefined();
    });
  });

  describe('item transfer', () => {
    it('should transfer item between inventories', () => {
      const inv1 = inventoryManager.createInventory(1, 50, 100);
      const inv2 = inventoryManager.createInventory(2, 50, 100);

      const item = itemManager.spawnItem(ecsWorld, 'sword_iron')!;
      inv1.addItem(ecsWorld, item);

      const result = inventoryManager.transferItem(ecsWorld, 1, 2, item.id);

      expect(result).toBe(true);
      expect(inv1.getItemCount()).toBe(0);
      expect(inv2.getItemCount()).toBe(1);
    });

    it('should return false when source inventory does not exist', () => {
      inventoryManager.createInventory(2, 50, 100);
      const result = inventoryManager.transferItem(ecsWorld, 1, 2, 999);
      expect(result).toBe(false);
    });

    it('should return false when target inventory does not exist', () => {
      inventoryManager.createInventory(1, 50, 100);
      const result = inventoryManager.transferItem(ecsWorld, 1, 2, 999);
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all inventories', () => {
      inventoryManager.createInventory(1, 50, 100);
      inventoryManager.createInventory(2, 30, 60);

      inventoryManager.clear(ecsWorld);

      expect(inventoryManager.getAllInventories().length).toBe(0);
    });
  });

  describe('serialization', () => {
    it('should serialize inventories', () => {
      const inv = inventoryManager.createInventory(1, 50, 100);
      const item = itemManager.spawnItem(ecsWorld, 'sword_iron')!;
      inv.addItem(ecsWorld, item);

      const serialized = inventoryManager.serializeInventories();

      expect(serialized.length).toBe(1);
      expect(serialized[0].ownerId).toBe(1);
    });

    it('should deserialize inventories', () => {
      const inv = inventoryManager.createInventory(1, 50, 100);
      const item = itemManager.spawnItem(ecsWorld, 'sword_iron')!;
      inv.addItem(ecsWorld, item);

      const serialized = inventoryManager.serializeInventories();
      inventoryManager.clear(ecsWorld);

      inventoryManager.deserializeInventories(serialized);

      const restored = inventoryManager.getInventory(1);
      expect(restored).toBeInstanceOf(Inventory);
      expect(restored?.weightCapacity).toBe(50);
    });
  });
});

describe('createInventoryComponent', () => {
  it('should create inventory component', () => {
    const component = createInventoryComponent(50, 100);

    expect(component.type).toBe('inventory');
    expect(component.capacity).toBe(50);
    expect(component.volumeCapacity).toBe(100);
    expect(component.itemIds).toEqual([]);
  });
});

describe('ItemComponent Access', () => {
  let itemManager: ItemManager;
  let eventBus: EventBus;
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    eventBus = new EventBus();
    ecsWorld = new ECSWorld(eventBus);
    itemManager = new ItemManager(eventBus);
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  it('should access item data through components', () => {
    const item = itemManager.spawnItem(ecsWorld, 'sword_iron')!;
    
    const itemComp = item.getComponent<ItemComponent>('item');
    const templateComp = item.getComponent<ItemTemplateComponent>('item_template');
    
    expect(itemComp).toBeDefined();
    expect(templateComp).toBeDefined();
    expect(itemComp?.templateId).toBe('sword_iron');
    expect(templateComp?.name).toBe('Iron Sword');
    expect(templateComp?.category).toBe(ItemCategory.WEAPON);
  });

  it('should modify durability through component', () => {
    const item = itemManager.spawnItem(ecsWorld, 'sword_iron')!;
    const itemComp = item.getComponent<ItemComponent>('item');
    
    expect(itemComp?.durability).toBe(100);
    
    // Modify durability
    if (itemComp) {
      itemComp.durability = 75;
    }
    
    expect(item.getComponent<ItemComponent>('item')?.durability).toBe(75);
  });

  it('should track quantity through component', () => {
    const item = itemManager.spawnItem(ecsWorld, 'potion_health', 5)!;
    const itemComp = item.getComponent<ItemComponent>('item');
    
    expect(itemComp?.quantity).toBe(5);
    
    // Modify quantity
    if (itemComp) {
      itemComp.quantity = 3;
    }
    
    expect(item.getComponent<ItemComponent>('item')?.quantity).toBe(3);
  });
});

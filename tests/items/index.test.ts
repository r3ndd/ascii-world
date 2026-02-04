import {
  Item,
  ItemManager,
  Inventory,
  InventoryManager,
  ItemCategory,
  ItemTemplate,
  ItemInstance,
  createInventoryComponent
} from '../../src/items';
import { EventBus } from '../../src/core/EventBus';

describe('Item', () => {
  let item: Item;
  let eventBus: EventBus;
  let template: ItemTemplate;
  let instance: ItemInstance;

  beforeEach(() => {
    eventBus = new EventBus();
    template = {
      id: 'sword_iron',
      name: 'Iron Sword',
      description: 'A sturdy iron sword',
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
    };

    instance = {
      id: 'item_1',
      templateId: 'sword_iron',
      name: 'Iron Sword',
      description: 'A sturdy iron sword',
      category: ItemCategory.WEAPON,
      character: '/',
      foreground: '#cccccc',
      quantity: 1,
      properties: { ...template.properties },
      equipped: false
    };

    item = new Item(instance, template, eventBus);
  });

  describe('basic properties', () => {
    it('should have id', () => {
      expect(item.id).toBe('item_1');
    });

    it('should have templateId', () => {
      expect(item.templateId).toBe('sword_iron');
    });

    it('should have name', () => {
      expect(item.name).toBe('Iron Sword');
    });

    it('should have description', () => {
      expect(item.description).toBe('A sturdy iron sword');
    });

    it('should have category', () => {
      expect(item.category).toBe(ItemCategory.WEAPON);
    });

    it('should have quantity', () => {
      expect(item.quantity).toBe(1);
    });

    it('should have display character', () => {
      expect(item.character).toBe('/');
    });

    it('should have colors', () => {
      expect(item.foreground).toBe('#cccccc');
      expect(item.background).toBeUndefined();
    });
  });

  describe('weight and volume', () => {
    it('should calculate weight based on quantity', () => {
      expect(item.weight).toBe(1.5);

      item.quantity = 2;
      expect(item.weight).toBe(3.0);
    });

    it('should calculate volume based on quantity', () => {
      expect(item.volume).toBe(3);

      item.quantity = 3;
      expect(item.volume).toBe(9);
    });
  });

  describe('durability', () => {
    it('should have durability', () => {
      expect(item.durability).toBe(100);
      expect(item.maxDurability).toBe(100);
    });

    it('should damage item', () => {
      const handler = jest.fn();
      eventBus.on('item:damaged', handler);

      item.damage(25);

      expect(item.durability).toBe(75);
      expect(handler).toHaveBeenCalledWith({
        itemId: item.id,
        damage: 25,
        remainingDurability: 75
      });
    });

    it('should not go below 0 durability', () => {
      item.damage(150);
      expect(item.durability).toBe(0);
    });

    it('should emit broken event when durability reaches 0', () => {
      const handler = jest.fn();
      eventBus.on('item:broken', handler);

      item.damage(100);

      expect(handler).toHaveBeenCalledWith({ itemId: item.id });
    });

    it('should repair item', () => {
      const handler = jest.fn();
      eventBus.on('item:repaired', handler);

      item.damage(50);
      item.repair(25);

      expect(item.durability).toBe(75);
      expect(handler).toHaveBeenCalledWith({
        itemId: item.id,
        amount: 25,
        durability: 75
      });
    });

    it('should not exceed max durability when repairing', () => {
      item.repair(50);
      expect(item.durability).toBe(100);
    });
  });

  describe('quantity', () => {
    it('should update quantity', () => {
      item.quantity = 5;
      expect(item.quantity).toBe(5);
    });

    it('should not go below 0', () => {
      item.quantity = -10;
      expect(item.quantity).toBe(0);
    });

    it('should emit event when quantity changes', () => {
      const handler = jest.fn();
      eventBus.on('item:quantityChanged', handler);

      item.quantity = 5;

      expect(handler).toHaveBeenCalledWith({
        itemId: item.id,
        oldValue: 1,
        newValue: 5
      });
    });

    it('should not emit when quantity stays the same', () => {
      const handler = jest.fn();
      eventBus.on('item:quantityChanged', handler);

      item.quantity = 1;

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('equipment', () => {
    it('should start unequipped', () => {
      expect(item.isEquipped()).toBe(false);
    });

    it('should equip item', () => {
      const handler = jest.fn();
      eventBus.on('item:equippedChanged', handler);

      item.setEquipped(true);

      expect(item.isEquipped()).toBe(true);
      expect(handler).toHaveBeenCalledWith({
        itemId: item.id,
        equipped: true
      });
    });

    it('should unequip item', () => {
      item.setEquipped(true);
      item.setEquipped(false);

      expect(item.isEquipped()).toBe(false);
    });
  });

  describe('stacking', () => {
    it('should not be stackable by default', () => {
      expect(item.isStackable()).toBe(false);
    });

    it('should check stackability with other items', () => {
      const otherInstance: ItemInstance = {
        id: 'item_2',
        templateId: 'sword_iron',
        name: 'Iron Sword',
        description: 'A sturdy iron sword',
        category: ItemCategory.WEAPON,
        character: '/',
        foreground: '#cccccc',
        quantity: 1,
        properties: { ...template.properties },
        equipped: false
      };

      const otherItem = new Item(otherInstance, template, eventBus);

      expect(item.canStackWith(otherItem)).toBe(false); // Swords are not stackable
    });

    it('should not stack with different template', () => {
      const stackableTemplate: ItemTemplate = {
        id: 'potion',
        name: 'Potion',
        description: 'A potion',
        category: ItemCategory.CONSUMABLE,
        character: '!',
        foreground: '#ff0000',
        properties: {
          weight: 0.5,
          volume: 0.5,
          stackable: true,
          maxStack: 10
        }
      };

      const instance1: ItemInstance = {
        id: 'item_1',
        templateId: 'potion',
        name: 'Potion',
        description: 'A potion',
        category: ItemCategory.CONSUMABLE,
        character: '!',
        foreground: '#ff0000',
        quantity: 1,
        properties: { ...stackableTemplate.properties }
      };

      const instance2: ItemInstance = {
        id: 'item_2',
        templateId: 'potion',
        name: 'Potion',
        description: 'A potion',
        category: ItemCategory.CONSUMABLE,
        character: '!',
        foreground: '#ff0000',
        quantity: 1,
        properties: { ...stackableTemplate.properties }
      };

      const item1 = new Item(instance1, stackableTemplate, eventBus);
      const item2 = new Item(instance2, stackableTemplate, eventBus);

      expect(item1.canStackWith(item2)).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const json = item.toJSON();
      expect(json.id).toBe('item_1');
      expect(json.templateId).toBe('sword_iron');
    });

    it('should create from JSON', () => {
      const json = item.toJSON();
      const restored = Item.fromJSON(json, template, eventBus);

      expect(restored.id).toBe(item.id);
      expect(restored.name).toBe(item.name);
    });

    it('should get instance data', () => {
      const instance = item.getInstance();
      expect(instance.id).toBe('item_1');
    });

    it('should get template data', () => {
      const template = item.getTemplate();
      expect(template.id).toBe('sword_iron');
    });
  });
});

describe('ItemManager', () => {
  let itemManager: ItemManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    itemManager = new ItemManager(eventBus);
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

      const item = itemManager.spawnItem('sword_iron');

      expect(item).toBeInstanceOf(Item);
      expect(item?.templateId).toBe('sword_iron');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        templateId: 'sword_iron',
        quantity: 1
      }));
    });

    it('should spawn item with quantity', () => {
      const item = itemManager.spawnItem('potion_health', 5);
      expect(item?.quantity).toBe(5);
    });

    it('should spawn item at location', () => {
      const item = itemManager.spawnItem('sword_iron', 1, { x: 10, y: 20 });
      expect(item?.location).toEqual({ x: 10, y: 20 });
    });

    it('should return null for non-existent template', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const item = itemManager.spawnItem('nonexistent');
      expect(item).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should respect max stack size', () => {
      const item = itemManager.spawnItem('potion_health', 50);
      expect(item?.quantity).toBeLessThanOrEqual(20); // maxStack for potion_health
    });
  });

  describe('item retrieval', () => {
    it('should get item by id', () => {
      const spawned = itemManager.spawnItem('sword_iron');
      const retrieved = itemManager.getItem(spawned!.id);
      expect(retrieved).toBe(spawned);
    });

    it('should return undefined for non-existent item', () => {
      expect(itemManager.getItem('nonexistent')).toBeUndefined();
    });

    it('should get all items', () => {
      itemManager.spawnItem('sword_iron');
      itemManager.spawnItem('potion_health');

      const items = itemManager.getAllItems();
      expect(items.length).toBe(2);
    });

    it('should get items at location', () => {
      itemManager.spawnItem('sword_iron', 1, { x: 10, y: 20 });
      itemManager.spawnItem('potion_health', 1, { x: 10, y: 20 });
      itemManager.spawnItem('wood_plank', 1, { x: 5, y: 5 });

      const itemsAtLocation = itemManager.getItemsAt({ x: 10, y: 20 });
      expect(itemsAtLocation.length).toBe(2);
    });

    it('should get items by container', () => {
      const item1 = itemManager.spawnItem('sword_iron');
      const item2 = itemManager.spawnItem('potion_health');

      // Manually set containerId
      (item1 as any).instance.containerId = 1;
      (item2 as any).instance.containerId = 1;

      const items = itemManager.getItemsByContainer(1);
      expect(items.length).toBe(2);
    });
  });

  describe('item removal', () => {
    it('should remove item', () => {
      const item = itemManager.spawnItem('sword_iron')!;

      const handler = jest.fn();
      eventBus.on('item:removed', handler);

      const result = itemManager.removeItem(item.id);

      expect(result).toBe(true);
      expect(itemManager.getItem(item.id)).toBeUndefined();
      expect(handler).toHaveBeenCalledWith({ itemId: item.id });
    });

    it('should return false when removing non-existent item', () => {
      const result = itemManager.removeItem('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize items', () => {
      itemManager.spawnItem('sword_iron');
      itemManager.spawnItem('potion_health', 5);

      const serialized = itemManager.serializeItems();
      expect(serialized.length).toBe(2);
    });

    it('should deserialize items', () => {
      itemManager.spawnItem('sword_iron');
      const serialized = itemManager.serializeItems();

      itemManager.clear();
      itemManager.deserializeItems(serialized);

      expect(itemManager.getAllItems().length).toBe(1);
    });

    it('should skip items with missing templates on deserialize', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      itemManager.deserializeItems([{
        id: 'item_1',
        templateId: 'nonexistent_template',
        name: 'Test',
        description: 'Test',
        category: ItemCategory.MISC,
        character: '?',
        foreground: '#ffffff',
        quantity: 1,
        properties: { weight: 1, volume: 1 }
      }]);

      expect(itemManager.getAllItems().length).toBe(0);
      consoleSpy.mockRestore();
    });
  });

  describe('clear', () => {
    it('should clear all items and templates', () => {
      itemManager.spawnItem('sword_iron');
      expect(itemManager.getAllItems().length).toBeGreaterThan(0);

      itemManager.clear();

      expect(itemManager.getAllItems().length).toBe(0);
      // Default templates should be re-registered
      expect(itemManager.getAllTemplates().length).toBeGreaterThan(0);
    });
  });
});

describe('Inventory', () => {
  let inventory: Inventory;
  let itemManager: ItemManager;
  let eventBus: EventBus;
  let sword: Item;

  beforeEach(() => {
    eventBus = new EventBus();
    itemManager = new ItemManager(eventBus);
    inventory = new Inventory(1, 50, 100, itemManager, eventBus);

    sword = itemManager.spawnItem('sword_iron')!;
  });

  describe('creation', () => {
    it('should create inventory with owner and capacity', () => {
      expect(inventory.owner).toBe(1);
      expect(inventory.weightCapacity).toBe(50);
      expect(inventory.volCapacity).toBe(100);
    });

    it('should start empty', () => {
      expect(inventory.getItemCount()).toBe(0);
      expect(inventory.currentWeight).toBe(0);
      expect(inventory.currentVolume).toBe(0);
    });
  });

  describe('weight and volume tracking', () => {
    it('should track current weight', () => {
      inventory.addItem(sword);
      expect(inventory.currentWeight).toBe(sword.weight);
    });

    it('should track current volume', () => {
      inventory.addItem(sword);
      expect(inventory.currentVolume).toBe(sword.volume);
    });

    it('should calculate remaining capacity', () => {
      inventory.addItem(sword);
      expect(inventory.remainingWeight).toBe(50 - sword.weight);
      expect(inventory.remainingVolume).toBe(100 - sword.volume);
    });
  });

  describe('adding items', () => {
    it('should add item to inventory', () => {
      const handler = jest.fn();
      eventBus.on('inventory:itemAdded', handler);

      const result = inventory.addItem(sword);

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
      const heavyItem = itemManager.spawnItem('heavy_item')!;

      const handler = jest.fn();
      eventBus.on('inventory:addFailed', handler);

      const result = inventory.addItem(heavyItem);

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
      const bulkyItem = itemManager.spawnItem('bulky_item')!;

      const result = inventory.addItem(bulkyItem);
      expect(result).toBe(false);
    });

    it('should stack with existing items', () => {
      const potion1 = itemManager.spawnItem('potion_health')!;
      const potion2 = itemManager.spawnItem('potion_health')!;

      const handler = jest.fn();
      eventBus.on('inventory:stacked', handler);

      inventory.addItem(potion1);
      inventory.addItem(potion2);

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
      inventory.addItem(sword);

      const handler = jest.fn();
      eventBus.on('inventory:itemRemoved', handler);

      const removed = inventory.removeItem(sword.id);

      expect(removed).toBe(sword);
      expect(inventory.getItemCount()).toBe(0);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: 1,
        itemId: sword.id
      }));
    });

    it('should return null when removing non-existent item', () => {
      const removed = inventory.removeItem('nonexistent');
      expect(removed).toBeNull();
    });

    it('should remove item from item manager when not found', () => {
      // Add item ID that doesn't exist in item manager
      (inventory as any).itemIds.add('ghost_item');

      const removed = inventory.removeItem('ghost_item');
      expect(removed).toBeNull();
    });
  });

  describe('dropping items', () => {
    it('should drop item at location', () => {
      inventory.addItem(sword);

      const handler = jest.fn();
      eventBus.on('inventory:itemDropped', handler);

      const dropped = inventory.dropItem(sword.id, { x: 10, y: 20 });

      expect(dropped).toBe(sword);
      expect(inventory.getItemCount()).toBe(0);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: 1,
        location: { x: 10, y: 20 }
      }));
    });

    it('should return null when dropping non-existent item', () => {
      const dropped = inventory.dropItem('nonexistent', { x: 0, y: 0 });
      expect(dropped).toBeNull();
    });
  });

  describe('transferring items', () => {
    it('should transfer item to another inventory', () => {
      const otherInventory = new Inventory(2, 50, 100, itemManager, eventBus);
      inventory.addItem(sword);

      const handler = jest.fn();
      eventBus.on('inventory:itemTransferred', handler);

      const result = inventory.transferItem(sword.id, otherInventory);

      expect(result).toBe(true);
      expect(inventory.getItemCount()).toBe(0);
      expect(otherInventory.getItemCount()).toBe(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        fromOwnerId: 1,
        toOwnerId: 2
      }));
    });

    it('should return item when transfer fails', () => {
      const smallInventory = new Inventory(2, 0.1, 0.1, itemManager, eventBus);
      inventory.addItem(sword);

      const result = inventory.transferItem(sword.id, smallInventory);

      expect(result).toBe(false);
      expect(inventory.getItemCount()).toBe(1); // Item returned
    });
  });

  describe('equipment', () => {
    it('should equip item', () => {
      inventory.addItem(sword);

      const result = inventory.equipItem(sword.id);

      expect(result).toBe(true);
      expect(sword.isEquipped()).toBe(true);
    });

    it('should unequip item', () => {
      inventory.addItem(sword);
      inventory.equipItem(sword.id);

      const result = inventory.unequipItem(sword.id);

      expect(result).toBe(true);
      expect(sword.isEquipped()).toBe(false);
    });

    it('should not equip item not in inventory', () => {
      const result = inventory.equipItem('nonexistent');
      expect(result).toBe(false);
    });

    it('should get equipped items', () => {
      inventory.addItem(sword);
      inventory.equipItem(sword.id);

      const equipped = inventory.getEquippedItems();
      expect(equipped).toContain(sword);
    });
  });

  describe('querying', () => {
    beforeEach(() => {
      inventory.addItem(sword);
      const potion = itemManager.spawnItem('potion_health')!;
      inventory.addItem(potion);
    });

    it('should get all items', () => {
      const items = inventory.getItems();
      expect(items.length).toBe(2);
    });

    it('should get items by category', () => {
      const weapons = inventory.getItemsByCategory(ItemCategory.WEAPON);
      expect(weapons.length).toBe(1);
      expect(weapons[0].category).toBe(ItemCategory.WEAPON);
    });

    it('should calculate total value', () => {
      const totalValue = inventory.getTotalValue();
      expect(totalValue).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all items', () => {
      inventory.addItem(sword);
      inventory.clear();

      expect(inventory.getItemCount()).toBe(0);
    });
  });

  describe('serialization', () => {
    it('should serialize inventory', () => {
      inventory.addItem(sword);

      const json = inventory.toJSON();

      expect(json.ownerId).toBe(1);
      expect(json.capacity).toBe(50);
      expect(json.itemIds).toContain(sword.id);
    });

    it('should deserialize inventory', () => {
      inventory.addItem(sword);
      const json = inventory.toJSON();

      const restored = Inventory.fromJSON(json, itemManager, eventBus);

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

  beforeEach(() => {
    eventBus = new EventBus();
    itemManager = new ItemManager(eventBus);
    inventoryManager = new InventoryManager(itemManager, eventBus);
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
      const result = inventoryManager.removeInventory(1);

      expect(result).toBe(true);
      expect(inventoryManager.hasInventory(1)).toBe(false);
    });

    it('should return false when removing non-existent inventory', () => {
      const result = inventoryManager.removeInventory(999);
      expect(result).toBe(false);
    });

    it('should clear items when removing inventory', () => {
      const inventory = inventoryManager.createInventory(1, 50, 100);
      const item = itemManager.spawnItem('sword_iron')!;
      inventory.addItem(item);

      inventoryManager.removeInventory(1);

      expect(itemManager.getItem(item.id)).toBeUndefined();
    });
  });

  describe('item transfer', () => {
    it('should transfer item between inventories', () => {
      const inv1 = inventoryManager.createInventory(1, 50, 100);
      const inv2 = inventoryManager.createInventory(2, 50, 100);

      const item = itemManager.spawnItem('sword_iron')!;
      inv1.addItem(item);

      const result = inventoryManager.transferItem(1, 2, item.id);

      expect(result).toBe(true);
      expect(inv1.getItemCount()).toBe(0);
      expect(inv2.getItemCount()).toBe(1);
    });

    it('should return false when source inventory does not exist', () => {
      inventoryManager.createInventory(2, 50, 100);
      const result = inventoryManager.transferItem(1, 2, 'item_id');
      expect(result).toBe(false);
    });

    it('should return false when target inventory does not exist', () => {
      inventoryManager.createInventory(1, 50, 100);
      const result = inventoryManager.transferItem(1, 2, 'item_id');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all inventories', () => {
      inventoryManager.createInventory(1, 50, 100);
      inventoryManager.createInventory(2, 30, 60);

      inventoryManager.clear();

      expect(inventoryManager.getAllInventories().length).toBe(0);
    });
  });

  describe('serialization', () => {
    it('should serialize inventories', () => {
      const inv = inventoryManager.createInventory(1, 50, 100);
      const item = itemManager.spawnItem('sword_iron')!;
      inv.addItem(item);

      const serialized = inventoryManager.serializeInventories();

      expect(serialized.length).toBe(1);
      expect(serialized[0].ownerId).toBe(1);
    });

    it('should deserialize inventories', () => {
      const inv = inventoryManager.createInventory(1, 50, 100);
      const item = itemManager.spawnItem('sword_iron')!;
      inv.addItem(item);

      const serialized = inventoryManager.serializeInventories();
      inventoryManager.clear();

      // Need to respawn item for deserialization to work
      itemManager.spawnItem('sword_iron');
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

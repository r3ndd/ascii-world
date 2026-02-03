/**
 * Items module
 * Item and inventory management
 */

import { EventBus } from '../core/EventBus';
import { Position, EntityId } from '../core/Types';
import { Component } from '../ecs';

// Item categories
export enum ItemCategory {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  CONSUMABLE = 'consumable',
  TOOL = 'tool',
  MATERIAL = 'material',
  CONTAINER = 'container',
  MISC = 'misc'
}

// Item properties interface
export interface ItemProperties {
  weight: number;           // Weight in kg
  volume: number;           // Volume in liters
  durability?: number;      // Current durability
  maxDurability?: number;     // Maximum durability
  stackable?: boolean;       // Can stack with same items
  maxStack?: number;         // Maximum stack size
  value?: number;           // Base value/cost
  quality?: number;         // Quality level (1-100)
  metadata?: Record<string, unknown>; // Custom properties
}

// Item instance data
export interface ItemInstance {
  id: string;               // Unique instance ID
  templateId: string;       // Reference to item template
  name: string;
  description: string;
  category: ItemCategory;
  character: string;        // Display character
  foreground: string;       // Display color
  background?: string;
  quantity: number;
  properties: ItemProperties;
  equipped?: boolean;
  location?: Position;      // World position if on ground
  containerId?: EntityId;   // Entity holding this item
}

// Item template for spawning
export interface ItemTemplate {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  character: string;
  foreground: string;
  background?: string;
  properties: ItemProperties;
  tags?: string[];
}

// Inventory component for ECS entities
export interface InventoryComponent extends Component {
  type: 'inventory';
  capacity: number;         // Max weight capacity
  volumeCapacity: number;   // Max volume capacity
  itemIds: string[];         // Item instance IDs
}

// Item class - represents an item instance
export class Item {
  private instance: ItemInstance;
  private template: ItemTemplate;
  private eventBus: EventBus;

  constructor(instance: ItemInstance, template: ItemTemplate, eventBus: EventBus) {
    this.instance = instance;
    this.template = template;
    this.eventBus = eventBus;
  }

  get id(): string {
    return this.instance.id;
  }

  get templateId(): string {
    return this.instance.templateId;
  }

  get name(): string {
    return this.instance.name;
  }

  get description(): string {
    return this.instance.description;
  }

  get category(): ItemCategory {
    return this.instance.category;
  }

  get quantity(): number {
    return this.instance.quantity;
  }

  set quantity(value: number) {
    const oldValue = this.instance.quantity;
    this.instance.quantity = Math.max(0, value);
    
    if (this.instance.quantity !== oldValue) {
      this.eventBus.emit('item:quantityChanged', {
        itemId: this.id,
        oldValue,
        newValue: this.instance.quantity
      });
    }
  }

  get character(): string {
    return this.instance.character;
  }

  get foreground(): string {
    return this.instance.foreground;
  }

  get background(): string | undefined {
    return this.instance.background;
  }

  get weight(): number {
    return (this.instance.properties.weight || 0) * this.quantity;
  }

  get volume(): number {
    return (this.instance.properties.volume || 0) * this.quantity;
  }

  get durability(): number | undefined {
    return this.instance.properties.durability;
  }

  get maxDurability(): number | undefined {
    return this.instance.properties.maxDurability;
  }

  get location(): Position | undefined {
    return this.instance.location;
  }

  get containerId(): EntityId | undefined {
    return this.instance.containerId;
  }

  isStackable(): boolean {
    return this.instance.properties.stackable ?? false;
  }

  isEquipped(): boolean {
    return this.instance.equipped ?? false;
  }

  setEquipped(equipped: boolean): void {
    this.instance.equipped = equipped;
    this.eventBus.emit('item:equippedChanged', {
      itemId: this.id,
      equipped
    });
  }

  damage(amount: number): void {
    if (this.instance.properties.durability !== undefined) {
      this.instance.properties.durability = Math.max(
        0,
        this.instance.properties.durability - amount
      );
      
      this.eventBus.emit('item:damaged', {
        itemId: this.id,
        damage: amount,
        remainingDurability: this.instance.properties.durability
      });

      if (this.instance.properties.durability <= 0) {
        this.eventBus.emit('item:broken', { itemId: this.id });
      }
    }
  }

  repair(amount: number): void {
    if (this.instance.properties.durability !== undefined && 
        this.instance.properties.maxDurability !== undefined) {
      this.instance.properties.durability = Math.min(
        this.instance.properties.maxDurability,
        this.instance.properties.durability + amount
      );
      
      this.eventBus.emit('item:repaired', {
        itemId: this.id,
        amount,
        durability: this.instance.properties.durability
      });
    }
  }

  canStackWith(other: Item): boolean {
    if (!this.isStackable() || !other.isStackable()) return false;
    if (this.templateId !== other.templateId) return false;
    if (this.instance.properties.quality !== other.instance.properties.quality) return false;
    return true;
  }

  getInstance(): ItemInstance {
    return { ...this.instance };
  }

  getTemplate(): ItemTemplate {
    return { ...this.template };
  }

  toJSON(): ItemInstance {
    return this.getInstance();
  }

  static fromJSON(json: ItemInstance, template: ItemTemplate, eventBus: EventBus): Item {
    return new Item(json, template, eventBus);
  }
}

// Item manager - handles templates and instance creation
export class ItemManager {
  private templates: Map<string, ItemTemplate> = new Map();
  private items: Map<string, Item> = new Map();
  private eventBus: EventBus;
  private nextId: number = 1;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.registerDefaultTemplates();
  }

  registerTemplate(template: ItemTemplate): void {
    this.templates.set(template.id, template);
    this.eventBus.emit('item:templateRegistered', { templateId: template.id });
  }

  getTemplate(id: string): ItemTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): ItemTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: ItemCategory): ItemTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  spawnItem(templateId: string, quantity: number = 1, location?: Position): Item | null {
    const template = this.templates.get(templateId);
    if (!template) {
      console.warn(`Item template not found: ${templateId}`);
      return null;
    }

    const instanceId = `item_${this.nextId++}`;
    const instance: ItemInstance = {
      id: instanceId,
      templateId,
      name: template.name,
      description: template.description,
      category: template.category,
      character: template.character,
      foreground: template.foreground,
      background: template.background,
      quantity: Math.min(quantity, template.properties.maxStack || quantity),
      properties: { ...template.properties },
      location
    };

    const item = new Item(instance, template, this.eventBus);
    this.items.set(instanceId, item);

    this.eventBus.emit('item:spawned', {
      itemId: instanceId,
      templateId,
      quantity: instance.quantity,
      location
    });

    return item;
  }

  getItem(id: string): Item | undefined {
    return this.items.get(id);
  }

  removeItem(id: string): boolean {
    const item = this.items.get(id);
    if (!item) return false;

    this.items.delete(id);
    this.eventBus.emit('item:removed', { itemId: id });
    return true;
  }

  getItemsAt(location: Position): Item[] {
    return Array.from(this.items.values()).filter(
      item => item.location?.x === location.x && item.location?.y === location.y
    );
  }

  getItemsByContainer(containerId: EntityId): Item[] {
    return Array.from(this.items.values()).filter(
      item => item.containerId === containerId
    );
  }

  getAllItems(): Item[] {
    return Array.from(this.items.values());
  }

  clear(): void {
    this.items.clear();
    this.templates.clear();
    this.nextId = 1;
    this.registerDefaultTemplates();
  }

  private registerDefaultTemplates(): void {
    // Register some basic item templates
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

  // Serialize all items for save/load
  serializeItems(): ItemInstance[] {
    return Array.from(this.items.values()).map(item => item.toJSON());
  }

  // Deserialize items (requires templates to be loaded first)
  deserializeItems(data: ItemInstance[]): void {
    this.items.clear();
    this.nextId = 1;

    for (const instance of data) {
      const template = this.templates.get(instance.templateId);
      if (!template) {
        console.warn(`Template not found for item: ${instance.templateId}`);
        continue;
      }

      // Extract ID number for nextId tracking
      const idMatch = instance.id.match(/item_(\d+)/);
      if (idMatch) {
        const idNum = parseInt(idMatch[1], 10);
        if (idNum >= this.nextId) {
          this.nextId = idNum + 1;
        }
      }

      const item = new Item(instance, template, this.eventBus);
      this.items.set(instance.id, item);
    }
  }
}

// Inventory class - manages items for a container (entity)
export class Inventory {
  private ownerId: EntityId;
  private itemIds: Set<string> = new Set();
  private capacity: number;
  private volumeCapacity: number;
  private itemManager: ItemManager;
  private eventBus: EventBus;

  constructor(
    ownerId: EntityId,
    capacity: number,
    volumeCapacity: number,
    itemManager: ItemManager,
    eventBus: EventBus
  ) {
    this.ownerId = ownerId;
    this.capacity = capacity;
    this.volumeCapacity = volumeCapacity;
    this.itemManager = itemManager;
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

  get currentWeight(): number {
    let total = 0;
    for (const itemId of this.itemIds) {
      const item = this.itemManager.getItem(itemId);
      if (item) {
        total += item.weight;
      }
    }
    return total;
  }

  get currentVolume(): number {
    let total = 0;
    for (const itemId of this.itemIds) {
      const item = this.itemManager.getItem(itemId);
      if (item) {
        total += item.volume;
      }
    }
    return total;
  }

  get remainingWeight(): number {
    return this.capacity - this.currentWeight;
  }

  get remainingVolume(): number {
    return this.volumeCapacity - this.currentVolume;
  }

  getItemCount(): number {
    return this.itemIds.size;
  }

  getItems(): Item[] {
    const items: Item[] = [];
    for (const itemId of this.itemIds) {
      const item = this.itemManager.getItem(itemId);
      if (item) {
        items.push(item);
      }
    }
    return items;
  }

  hasItem(itemId: string): boolean {
    return this.itemIds.has(itemId);
  }

  canAddItem(item: Item): boolean {
    // Check weight capacity
    if (item.weight > this.remainingWeight) {
      return false;
    }

    // Check volume capacity
    if (item.volume > this.remainingVolume) {
      return false;
    }

    return true;
  }

  canAddWeight(weight: number): boolean {
    return weight <= this.remainingWeight;
  }

  addItem(item: Item): boolean {
    if (!this.canAddItem(item)) {
      this.eventBus.emit('inventory:addFailed', {
        ownerId: this.ownerId,
        itemId: item.id,
        reason: 'capacity_exceeded'
      });
      return false;
    }

    // Try to stack with existing items
    if (item.isStackable()) {
      const existingItem = this.findStackableItem(item);
      if (existingItem) {
        existingItem.quantity += item.quantity;
        
        // Remove the item from world since it's been merged
        this.itemManager.removeItem(item.id);
        
        this.eventBus.emit('inventory:stacked', {
          ownerId: this.ownerId,
          targetItemId: existingItem.id,
          sourceItemId: item.id,
          quantity: item.quantity
        });
        return true;
      }
    }

    // Add as new item
    this.itemIds.add(item.id);
    
    // Update item's container reference
    const instance = item.getInstance();
    instance.containerId = this.ownerId;
    instance.location = undefined;

    this.eventBus.emit('inventory:itemAdded', {
      ownerId: this.ownerId,
      itemId: item.id,
      weight: item.weight,
      volume: item.volume
    });

    return true;
  }

  removeItem(itemId: string): Item | null {
    if (!this.itemIds.has(itemId)) {
      return null;
    }

    const item = this.itemManager.getItem(itemId);
    if (!item) {
      this.itemIds.delete(itemId);
      return null;
    }

    this.itemIds.delete(itemId);

    this.eventBus.emit('inventory:itemRemoved', {
      ownerId: this.ownerId,
      itemId: item.id,
      weight: item.weight,
      volume: item.volume
    });

    return item;
  }

  dropItem(itemId: string, location: Position): Item | null {
    const item = this.removeItem(itemId);
    if (!item) return null;

    // Update item's location
    const instance = item.getInstance();
    instance.location = location;
    instance.containerId = undefined;

    this.eventBus.emit('inventory:itemDropped', {
      ownerId: this.ownerId,
      itemId: item.id,
      location
    });

    return item;
  }

  transferItem(itemId: string, targetInventory: Inventory): boolean {
    const item = this.removeItem(itemId);
    if (!item) return false;

    if (targetInventory.addItem(item)) {
      this.eventBus.emit('inventory:itemTransferred', {
        fromOwnerId: this.ownerId,
        toOwnerId: targetInventory.ownerId,
        itemId: item.id
      });
      return true;
    } else {
      // Put it back if transfer failed
      this.addItem(item);
      return false;
    }
  }

  getEquippedItems(): Item[] {
    return this.getItems().filter(item => item.isEquipped());
  }

  equipItem(itemId: string): boolean {
    const item = this.itemManager.getItem(itemId);
    if (!item || !this.itemIds.has(itemId)) return false;

    item.setEquipped(true);
    return true;
  }

  unequipItem(itemId: string): boolean {
    const item = this.itemManager.getItem(itemId);
    if (!item || !this.itemIds.has(itemId)) return false;

    item.setEquipped(false);
    return true;
  }

  getItemsByCategory(category: ItemCategory): Item[] {
    return this.getItems().filter(item => item.category === category);
  }

  getTotalValue(): number {
    return this.getItems().reduce((total, item) => {
      return total + (item.getInstance().properties.value || 0) * item.quantity;
    }, 0);
  }

  clear(): void {
    for (const itemId of this.itemIds) {
      this.itemManager.removeItem(itemId);
    }
    this.itemIds.clear();
  }

  private findStackableItem(item: Item): Item | undefined {
    if (!item.isStackable()) return undefined;

    for (const existingId of this.itemIds) {
      const existing = this.itemManager.getItem(existingId);
      if (existing && existing.canStackWith(item)) {
        const maxStack = existing.getInstance().properties.maxStack || Infinity;
        if (existing.quantity < maxStack) {
          return existing;
        }
      }
    }

    return undefined;
  }

  // Serialization
  toJSON(): {
    ownerId: EntityId;
    capacity: number;
    volumeCapacity: number;
    itemIds: string[];
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
      itemIds: string[];
    },
    itemManager: ItemManager,
    eventBus: EventBus
  ): Inventory {
    const inventory = new Inventory(
      data.ownerId,
      data.capacity,
      data.volumeCapacity,
      itemManager,
      eventBus
    );
    
    for (const itemId of data.itemIds) {
      inventory.itemIds.add(itemId);
    }
    
    return inventory;
  }
}

// Inventory manager - handles all inventories in the game
export class InventoryManager {
  private inventories: Map<EntityId, Inventory> = new Map();
  private itemManager: ItemManager;
  private eventBus: EventBus;

  constructor(itemManager: ItemManager, eventBus: EventBus) {
    this.itemManager = itemManager;
    this.eventBus = eventBus;
  }

  createInventory(
    ownerId: EntityId,
    capacity: number,
    volumeCapacity: number
  ): Inventory {
    const inventory = new Inventory(
      ownerId,
      capacity,
      volumeCapacity,
      this.itemManager,
      this.eventBus
    );
    this.inventories.set(ownerId, inventory);
    return inventory;
  }

  getInventory(ownerId: EntityId): Inventory | undefined {
    return this.inventories.get(ownerId);
  }

  removeInventory(ownerId: EntityId): boolean {
    const inventory = this.inventories.get(ownerId);
    if (inventory) {
      inventory.clear();
      this.inventories.delete(ownerId);
      return true;
    }
    return false;
  }

  hasInventory(ownerId: EntityId): boolean {
    return this.inventories.has(ownerId);
  }

  getAllInventories(): Inventory[] {
    return Array.from(this.inventories.values());
  }

  transferItem(
    fromOwnerId: EntityId,
    toOwnerId: EntityId,
    itemId: string
  ): boolean {
    const fromInventory = this.inventories.get(fromOwnerId);
    const toInventory = this.inventories.get(toOwnerId);

    if (!fromInventory || !toInventory) {
      return false;
    }

    return fromInventory.transferItem(itemId, toInventory);
  }

  clear(): void {
    for (const inventory of this.inventories.values()) {
      inventory.clear();
    }
    this.inventories.clear();
  }

  // Serialization
  serializeInventories(): {
    ownerId: EntityId;
    capacity: number;
    volumeCapacity: number;
    itemIds: string[];
  }[] {
    return Array.from(this.inventories.values()).map(inv => inv.toJSON());
  }

  deserializeInventories(data: {
    ownerId: EntityId;
    capacity: number;
    volumeCapacity: number;
    itemIds: string[];
  }[]): void {
    this.inventories.clear();
    
    for (const invData of data) {
      const inventory = Inventory.fromJSON(invData, this.itemManager, this.eventBus);
      this.inventories.set(invData.ownerId, inventory);
    }
  }
}

// Component factory for inventory
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

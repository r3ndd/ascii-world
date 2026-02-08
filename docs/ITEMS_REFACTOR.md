# Item System Refactoring Plan

**Date**: 2026-02-07  
**Goal**: Convert items from standalone class instances to proper ECS entities  
**Motivation**: Enable items to participate in all ECS systems (physics, rendering, lighting, effects) while preserving data-driven content architecture

---

## Current Architecture

Items exist as parallel system to ECS:
- `Item` class with instance data (quantity, durability)
- `ItemManager` manages instances by string IDs
- `Inventory` references items via `itemIds: string[]`
- Items don't participate in ECS queries or systems

**Problems**:
- Items on ground can't use ECS spatial queries
- Two identity spaces: `EntityId` (number) vs `Item.id` (string)
- Can't add runtime components to items (burning, cursed, etc.)
- Manual ID tracking and lookup overhead

---

## Target Architecture

Items become first-class ECS entities:
- Items have `EntityId` like everything else
- Items use `ItemComponent` and `ItemTemplateComponent`
- Items can have any component added (Position, Renderable, Burning, etc.)
- Unified identity space - everything is an entity
- Unified serialization - entities saved together

---

## Implementation Phases

### Phase 1: New ECS Components & Types

**New File**: `src/items/components.ts`

```typescript
export interface ItemComponent extends Component {
  type: 'item';
  templateId: string;           // Reference to content pack template
  quantity: number;
  durability?: number;
  maxDurability?: number;
  quality?: number;
  stackable: boolean;
  maxStack: number;
  value: number;
  equipped: boolean;
  equippedSlot?: string;
}

export interface ItemTemplateComponent extends Component {
  type: 'item_template';
  name: string;
  description: string;
  category: ItemCategory;
  weight: number;
  volume: number;
  tags: string[];
}
```

**New File**: `src/items/queries.ts`

```typescript
export const ITEMS_QUERY: Query = { all: ['item'] };
export const EQUIPPED_ITEMS_QUERY: Query = { all: ['item'], any: ['equipped'] };
export const WORLD_ITEMS_QUERY: Query = { all: ['item', 'position'] };
export const INVENTORY_ITEMS_QUERY: Query = { all: ['item', 'inventory'] };
```

### Phase 2: Refactor ItemManager

**File**: `src/items/ItemManager.ts` (extract from index.ts)

Changes:
- Remove `Item` class (replaced by ECS entities)
- `spawnItem()` returns `Entity` instead of `Item`
- Keep `ItemTemplate` registry
- New entity factory:

```typescript
spawnItem(
  ecsWorld: ECSWorld,
  templateId: string,
  quantity: number = 1,
  position?: Position
): Entity | null {
  const template = this.templates.get(templateId);
  if (!template) return null;

  const entity = ecsWorld.createEntity();
  
  // Add item data component
  entity.addComponent({
    type: 'item',
    templateId,
    quantity: Math.min(quantity, template.properties.maxStack || quantity),
    durability: template.properties.durability,
    maxDurability: template.properties.maxDurability,
    stackable: template.properties.stackable ?? false,
    maxStack: template.properties.maxStack ?? 1,
    value: template.properties.value ?? 0,
    equipped: false,
    quality: template.properties.quality ?? 50
  });
  
  // Add template component
  entity.addComponent({
    type: 'item_template',
    name: template.name,
    description: template.description,
    category: template.category,
    weight: template.properties.weight,
    volume: template.properties.volume,
    tags: template.tags ?? []
  });
  
  // Add position and renderable if in world
  if (position) {
    entity.addComponent(createPosition(position.x, position.y, position.z ?? 0));
    entity.addComponent(createRenderable(
      template.character,
      template.foreground,
      template.background
    ));
  }
  
  this.eventBus.emit('item:spawned', { entityId: entity.id, templateId, quantity });
  return entity;
}

getItem(ecsWorld: ECSWorld, entityId: EntityId): Entity | undefined {
  return ecsWorld.getEntity(entityId);
}

getItemsAt(ecsWorld: ECSWorld, position: Position): Entity[] {
  return ecsWorld.queryEntities({
    all: ['item', 'position'],
    any: []
  }).filter(entity => {
    const pos = entity.getComponent<PositionComponent>('position');
    return pos && pos.x === position.x && pos.y === position.y && pos.z === (position.z ?? 0);
  });
}
```

### Phase 3: Refactor Inventory System

**File**: `src/items/Inventory.ts` (extract from index.ts)

Changes:
- Change `itemIds: Set<string>` to `itemIds: Set<EntityId>`
- Methods work with `Entity` instead of `Item`:

```typescript
addItem(ecsWorld: ECSWorld, itemEntity: Entity): boolean {
  // Check capacity
  if (!this.canAddItem(ecsWorld, itemEntity)) {
    return false;
  }
  
  // Try stacking
  const itemComp = itemEntity.getComponent<ItemComponent>('item');
  if (itemComp?.stackable) {
    const existingStack = this.findStackableItem(ecsWorld, itemEntity);
    if (existingStack) {
      const existingComp = existingStack.getComponent<ItemComponent>('item')!;
      existingComp.quantity += itemComp.quantity;
      ecsWorld.removeEntity(itemEntity.id); // Remove merged item
      this.eventBus.emit('inventory:stacked', {
        ownerId: this.ownerId,
        targetItemId: existingStack.id,
        sourceItemId: itemEntity.id,
        quantity: itemComp.quantity
      });
      return true;
    }
  }
  
  // Add as new item
  this.itemIds.add(itemEntity.id);
  
  // Remove position/renderable components (now in inventory)
  itemEntity.removeComponent('position');
  itemEntity.removeComponent('renderable');
  
  // Mark as equipped if applicable
  if (itemComp) {
    itemComp.equipped = false;
  }
  
  this.eventBus.emit('inventory:itemAdded', {
    ownerId: this.ownerId,
    itemId: itemEntity.id,
    templateId: itemComp?.templateId
  });
  
  return true;
}

removeItem(ecsWorld: ECSWorld, itemId: EntityId): Entity | null {
  if (!this.itemIds.has(itemId)) return null;
  
  const item = ecsWorld.getEntity(itemId);
  if (!item) {
    this.itemIds.delete(itemId);
    return null;
  }
  
  this.itemIds.delete(itemId);
  
  this.eventBus.emit('inventory:itemRemoved', {
    ownerId: this.ownerId,
    itemId
  });
  
  return item;
}

dropItem(ecsWorld: ECSWorld, itemId: EntityId, location: Position): Entity | null {
  const item = this.removeItem(ecsWorld, itemId);
  if (!item) return null;
  
  // Add position and renderable components
  const templateComp = item.getComponent<ItemTemplateComponent>('item_template');
  item.addComponent(createPosition(location.x, location.y, location.z ?? 0));
  if (templateComp) {
    item.addComponent(createRenderable(
      '?', // Could look up from template
      '#ffffff'
    ));
  }
  
  this.eventBus.emit('inventory:itemDropped', {
    ownerId: this.ownerId,
    itemId,
    location
  });
  
  return item;
}

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
```

**InventoryComponent Update**:

```typescript
export interface InventoryComponent extends Component {
  type: 'inventory';
  capacity: number;
  volumeCapacity: number;
  itemIds: EntityId[];  // Changed from string[]
}

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
```

### Phase 4: Item Systems

**New File**: `src/items/systems.ts`

```typescript
export class ItemStackingSystem extends BaseSystem {
  readonly name = 'itemStacking';
  readonly priority = 50;
  query = WORLD_ITEMS_QUERY;

  update(entities: Entity[], deltaTime: number): void {
    // Group by position and template
    const groups = new Map<string, Entity[]>();
    
    for (const entity of entities) {
      const pos = entity.getComponent<PositionComponent>('position');
      const item = entity.getComponent<ItemComponent>('item');
      if (!pos || !item || !item.stackable) continue;
      
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
          this.ecsWorld.removeEntity(other.id);
        }
      }
    }
  }
}
```

### Phase 5: Save/Load Updates

**File**: `src/save/index.ts`

New SaveData structure:

```typescript
export interface SaveData {
  metadata: SaveMetadata;
  world: SerializedWorld;
  entities: SerializedEntity[];  // Items included here
  templates: ItemTemplate[];      // For template registry
  turn: { currentTurn: number };
}
```

Changes:
- Remove separate `items` and `inventories` sections
- Items saved as regular entities via `EntitySerializer`
- Templates still saved separately (needed for lookup)
- InventoryComponent now stores `EntityId[]`

Migration function for old saves:

```typescript
export function migrateOldSaveFormat(oldSave: any): SaveData {
  // Convert old ItemInstance[] + Inventory[] to new format
  const entities: SerializedEntity[] = [...oldSave.entities];
  
  // Convert items to entities
  for (const itemInstance of oldSave.items?.instances || []) {
    const entity: SerializedEntity = {
      id: generateEntityId(), // Need to generate new ID
      components: [
        {
          type: 'item',
          templateId: itemInstance.templateId,
          quantity: itemInstance.quantity,
          durability: itemInstance.properties?.durability,
          maxDurability: itemInstance.properties?.maxDurability,
          stackable: itemInstance.properties?.stackable ?? false,
          maxStack: itemInstance.properties?.maxStack ?? 1,
          value: itemInstance.properties?.value ?? 0,
          equipped: itemInstance.equipped ?? false,
          quality: itemInstance.properties?.quality ?? 50
        },
        // Look up template for template component
        // Add position if itemInstance.location exists
      ]
    };
    
    if (itemInstance.location) {
      entity.components.push({
        type: 'position',
        x: itemInstance.location.x,
        y: itemInstance.location.y,
        z: itemInstance.location.z ?? 0
      });
    }
    
    entities.push(entity);
  }
  
  // Convert inventories
  for (const invData of oldSave.inventories || []) {
    // Map old string itemIds to new EntityIds
    // This requires tracking the mapping from old item IDs to new entity IDs
  }
  
  return {
    metadata: oldSave.metadata,
    world: oldSave.world,
    entities,
    templates: oldSave.items?.templates || [],
    turn: oldSave.turn
  };
}
```

### Phase 6: Content System Updates

**File**: `src/content/index.ts`

Update `ModAPI.spawnItem()`:

```typescript
spawnItem: (
  templateId: string,
  quantity: number,
  x: number,
  y: number,
  ecsWorld: ECSWorld
) => Entity | null {
  const item = itemManager.spawnItem(ecsWorld, templateId, quantity, { x, y });
  if (item) {
    this.eventBus.emit('mod:itemSpawned', {
      itemId: item.id,
      templateId,
      quantity,
      x,
      y
    });
  }
  return item;
}
```

### Phase 7: Main Index Export

**File**: `src/index.ts`

Add items to public API:

```typescript
// Add this export
export * from './items';
```

### Phase 8: File Reorganization

Split `src/items/index.ts` into focused modules:

```
src/items/
├── index.ts           # Public exports
├── types.ts           # ItemCategory, ItemTemplate, ItemProperties
├── components.ts      # ItemComponent, ItemTemplateComponent
├── queries.ts         # ECS query definitions
├── ItemManager.ts     # Item template registry and spawning
├── Inventory.ts       # Inventory class
├── InventoryManager.ts # InventoryManager class
└── systems.ts         # ItemStackingSystem, etc.
```

---

## Migration Checklist

### Code Changes
- [ ] Create `src/items/components.ts`
- [ ] Create `src/items/queries.ts`
- [ ] Create `src/items/ItemManager.ts` (refactored)
- [ ] Create `src/items/Inventory.ts` (refactored)
- [ ] Create `src/items/InventoryManager.ts`
- [ ] Create `src/items/systems.ts`
- [ ] Update `src/items/index.ts` (exports only)
- [ ] Update `src/save/index.ts` (new save format)
- [ ] Update `src/content/index.ts` (ModAPI changes)
- [ ] Update `src/index.ts` (add items export)

### Test Changes
- [ ] Rewrite `tests/items/index.test.ts`
- [ ] Update `tests/fixtures/items.ts`
- [ ] Update `tests/save/index.test.ts`
- [ ] Update `tests/integration/index.test.ts`
- [ ] Update `tests/content/index.test.ts`

### Documentation
- [ ] Update ARCHITECTURE.md
- [ ] Update modding guide
- [ ] Create migration guide for old saves

---

## Benefits

1. **Unified Architecture**: Everything is an entity - single identity space
2. **ECS Integration**: Items participate in physics, rendering, lighting, AI
3. **Composition**: Add any component to items (BurningComponent, EnchantedComponent, etc.)
4. **Better Queries**: "Find all burning items within 5 tiles"
5. **Simplified Serialization**: One path for all entities
6. **Performance**: Spatial queries via ECS instead of manual filtering

## Trade-offs

1. **More Entities**: ECS overhead for every item (minimal with proper system)
2. **Breaking Change**: Old saves need migration
3. **Test Rewrite**: Significant test updates
4. **Learning Curve**: Team needs to understand ECS pattern for items

---

## Migration Path for Existing Code

### Before:
```typescript
const item = itemManager.spawnItem('sword_iron', 1, { x: 10, y: 10 });
inventory.addItem(item);
```

### After:
```typescript
const itemEntity = itemManager.spawnItem(ecsWorld, 'sword_iron', 1, { x: 10, y: 10 });
inventory.addItem(ecsWorld, itemEntity);
```

### Before:
```typescript
item.damage(10);
item.repair(5);
```

### After:
```typescript
const itemComp = itemEntity.getComponent<ItemComponent>('item');
if (itemComp) {
  itemComp.durability = Math.max(0, (itemComp.durability || 0) - 10);
  // Or use a DurabilitySystem
}
```

---

**Status**: Ready for implementation

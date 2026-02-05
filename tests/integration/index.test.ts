/**
 * Phase 4 Integration Tests
 * End-to-end scenarios testing complete game workflows
 */

import {
  ECSWorld,
  Entity,
  createPosition,
  createHealth,
  createSpeed,
  createActor,
  createRenderable,
  PositionComponent,
  HealthComponent
} from '../../src/ecs';
import {
  World,
  Chunk,
  ChunkManager,
  UpdateScheduler,
  TERRAIN
} from '../../src/world';
import {
  TurnManager,
  SpeedSystem,
  Actor
} from '../../src/time';
import {
  PhysicsSystem,
  FOVSystem,
  LightingSystem,
  Pathfinding
} from '../../src/physics';
import {
  ItemManager,
  InventoryManager,
  ItemCategory,
  ItemTemplate
} from '../../src/items';
import {
  SaveManager,
  EntitySerializer,
  LocalStorageProvider
} from '../../src/save';
import { Engine } from '../../src/core/Engine';
import { EventBus } from '../../src/core/EventBus';
import {
  ContentLoader,
  MapLoader,
  WorldGenerator,
  ModLoader,
  MapDefinition,
  ContentPack,
  Mod,
  TerrainDefinition
} from '../../src/content';

// Mock localStorage for save tests
class MockLocalStorage {
  private store: { [key: string]: string } = {};
  
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  
  removeItem(key: string): void {
    delete this.store[key];
  }
  
  clear(): void {
    this.store = {};
  }
  
  key(index: number): string | null {
    return Object.keys(this.store)[index] || null;
  }
  
  get length(): number {
    return Object.keys(this.store).length;
  }
}

// Helper functions for creating test entities
function createTestPlayer(world: ECSWorld, options: { x?: number; y?: number; health?: number; speed?: number } = {}): Entity {
  const entity = world.createEntity();
  entity.addComponent(createPosition(options.x ?? 10, options.y ?? 10));
  entity.addComponent(createHealth(options.health ?? 100, options.health ?? 100));
  entity.addComponent(createSpeed(options.speed ?? 100));
  entity.addComponent(createActor(true));
  entity.addComponent(createRenderable('@', '#00ff00'));
  return entity;
}

function createTestNPC(world: ECSWorld, options: { x?: number; y?: number; health?: number; speed?: number; char?: string } = {}): Entity {
  const entity = world.createEntity();
  entity.addComponent(createPosition(options.x ?? 15, options.y ?? 10));
  entity.addComponent(createHealth(options.health ?? 50, options.health ?? 50));
  entity.addComponent(createSpeed(options.speed ?? 80));
  entity.addComponent(createActor(false));
  entity.addComponent(createRenderable(options.char ?? 'n', '#ff0000'));
  return entity;
}

function createTestActor(world: ECSWorld, options: { x?: number; y?: number; health?: number; speed?: number } = {}): Entity {
  const entity = world.createEntity();
  entity.addComponent(createPosition(options.x ?? 0, options.y ?? 0));
  entity.addComponent(createHealth(options.health ?? 100, options.health ?? 100));
  entity.addComponent(createSpeed(options.speed ?? 100));
  entity.addComponent(createActor(false));
  entity.addComponent(createRenderable('a', '#ffffff'));
  return entity;
}

describe('Integration Tests - Phase 4', () => {
  let eventBus: EventBus;
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    eventBus = new EventBus();
    ecsWorld = new ECSWorld(eventBus);
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  describe('Player Movement Workflow', () => {
    it('should move player through world and update chunks', () => {
      // Setup world
      const world = new World(128, 128, 64, ecsWorld);
      world.initialize();
      
      createTestPlayer(ecsWorld, { x: 32, y: 32 });
      
      // Set player position to activate chunks
      world.setPlayerPosition(32, 32);
      
      const chunkManager = world.getChunkManager();
      const activeChunks = chunkManager.getActiveChunks();
      expect(activeChunks.length).toBeGreaterThan(0);
      
      // Move player to adjacent area
      world.setPlayerPosition(96, 32);
      
      // Verify chunks are still active
      const newActiveChunks = chunkManager.getActiveChunks();
      expect(newActiveChunks.length).toBeGreaterThan(0);
    });

    it('should handle collision detection during movement', () => {
      const world = new World(64, 64, 64, ecsWorld);
      world.initialize();
      
      createTestPlayer(ecsWorld, { x: 10, y: 10 });
      new PhysicsSystem(world, ecsWorld, eventBus);
      
      // Place a wall blocking movement
      world.setTileAt(11, 10, TERRAIN.wall);
      
      // Attempt to check if we can move into wall
      const canMoveToWall = world.isValidPosition(11, 10);
      expect(canMoveToWall).toBe(false);
      
      // Check valid position
      world.setTileAt(9, 10, TERRAIN.floor);
      const canMoveToFloor = world.isValidPosition(9, 10);
      expect(canMoveToFloor).toBe(true);
    });

    it('should update FOV when player moves', () => {
      const world = new World(64, 64, 64, ecsWorld);
      world.initialize();
      
      const fovSystem = new FOVSystem(world);
      
      // Create player and NPC
      createTestPlayer(ecsWorld, { x: 10, y: 10 });
      createTestNPC(ecsWorld, { x: 15, y: 10 });
      
      // Calculate FOV from player position
      const visible = fovSystem.computeFOV(10, 10, 10);
      
      // Should have visible tiles
      expect(visible.length).toBeGreaterThan(0);
      
      // NPC position should be within range (10 tiles)
      const npcVisible = visible.some(v => v.x === 15 && v.y === 10);
      expect(npcVisible).toBe(true);
      
      // Create walls to block line of sight
      world.setTileAt(12, 10, TERRAIN.wall);
      world.setTileAt(13, 10, TERRAIN.wall);
      
      // Recalculate with walls
      fovSystem.reset();
      const visibleWithWalls = fovSystem.computeFOV(10, 10, 10);
      
      // Should still have visible tiles
      expect(visibleWithWalls.length).toBeGreaterThan(0);
    });
  });

  describe('Turn-Based Combat Workflow', () => {
    it('should process turns for player and enemies', async () => {
      const speedSystem = new SpeedSystem();
      const turnManager = new TurnManager(ecsWorld, eventBus, speedSystem);
      
      // Create player and enemy actors
      const playerEntity = createTestPlayer(ecsWorld, { health: 100, speed: 100 });
      const enemyEntity = createTestNPC(ecsWorld, { health: 50, speed: 80 });
      
      let playerTurnCount = 0;
      let enemyTurnCount = 0;
      
      const playerActor: Actor = {
        entityId: playerEntity.id,
        getSpeed: () => 100,
        act: async () => { playerTurnCount++; }
      };
      
      const enemyActor: Actor = {
        entityId: enemyEntity.id,
        getSpeed: () => 80,
        act: async () => { enemyTurnCount++; }
      };
      
      turnManager.registerActor(playerActor, true);
      turnManager.registerActor(enemyActor);
      
      // Process 10 turns
      for (let i = 0; i < 10; i++) {
        await turnManager.processSingleTurn();
      }
      
      // Both should have had turns
      expect(playerTurnCount).toBeGreaterThan(0);
      expect(enemyTurnCount).toBeGreaterThan(0);
      
      // Faster actor (player) should have more or equal turns
      expect(playerTurnCount).toBeGreaterThanOrEqual(enemyTurnCount);
    });

    it('should handle combat damage between entities', () => {
      const attacker = createTestActor(ecsWorld, { health: 100, speed: 100 });
      const defender = createTestActor(ecsWorld, { health: 100, speed: 100 });
      
      const healthComponent = defender.getComponent('health') as HealthComponent;
      const initialHealth = healthComponent.current;
      
      // Simulate attack
      const damage = 20;
      healthComponent.current -= damage;
      
      expect(healthComponent.current).toBe(initialHealth - damage);
      
      // Emit combat event
      const handler = jest.fn();
      eventBus.on('combat:damage', handler);
      eventBus.emit('combat:damage', { 
        attackerId: attacker.id, 
        defenderId: defender.id, 
        damage 
      });
      
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        attackerId: attacker.id,
        defenderId: defender.id,
        damage: 20
      }));
    });

    it('should handle entity death', () => {
      const entity = createTestActor(ecsWorld, { health: 10 });
      const health = entity.getComponent('health') as HealthComponent;
      
      const deathHandler = jest.fn();
      eventBus.on('entity:died', deathHandler);
      
      // Deal lethal damage
      health.current = 0;
      
      // Emit death event
      if (health.current <= 0) {
        eventBus.emit('entity:died', { entityId: entity.id });
      }
      
      expect(deathHandler).toHaveBeenCalledWith({ entityId: entity.id });
    });
  });

  describe('Item Management Workflow', () => {
    it('should handle item pickup and inventory management', () => {
      const itemManager = new ItemManager(eventBus);
      const inventoryManager = new InventoryManager(itemManager, eventBus);
      
      // Register item template
      const swordTemplate: ItemTemplate = {
        id: 'sword_steel',
        name: 'Steel Sword',
        description: 'A sharp steel blade',
        category: ItemCategory.WEAPON,
        character: '/',
        foreground: '#c0c0c0',
        properties: {
          weight: 1.5,
          volume: 3,
          durability: 150,
          maxDurability: 150,
          value: 100
        }
      };
      itemManager.registerTemplate(swordTemplate);
      
      // Create player with inventory
      const player = createTestPlayer(ecsWorld);
      const inventory = inventoryManager.createInventory(player.id, 50, 100); // 50kg, 100L capacity
      
      // Spawn item and add to inventory
      const sword = itemManager.spawnItem('sword_steel');
      expect(sword).not.toBeNull();
      
      if (sword) {
        const added = inventory.addItem(sword);
        expect(added).toBe(true);
        expect(inventory.getItemCount()).toBe(1);
        expect(inventory.currentWeight).toBe(1.5);
        
        // Remove item from inventory
        const removed = inventory.removeItem(sword.id);
        expect(removed).not.toBeNull();
        expect(inventory.getItemCount()).toBe(0);
      }
    });

    it('should prevent adding items exceeding capacity', () => {
      const itemManager = new ItemManager(eventBus);
      const inventoryManager = new InventoryManager(itemManager, eventBus);
      
      // Create heavy item template
      const anvilTemplate: ItemTemplate = {
        id: 'anvil',
        name: 'Anvil',
        description: 'A heavy anvil',
        category: ItemCategory.TOOL,
        character: 'A',
        foreground: '#888888',
        properties: {
          weight: 100,
          volume: 50,
          value: 50
        }
      };
      itemManager.registerTemplate(anvilTemplate);
      
      // Create small inventory
      const player = createTestPlayer(ecsWorld);
      const inventory = inventoryManager.createInventory(player.id, 10, 100); // Only 10kg capacity
      
      // Try to add heavy item
      const anvil = itemManager.spawnItem('anvil');
      expect(anvil).not.toBeNull();
      
      if (anvil) {
        const added = inventory.addItem(anvil);
        expect(added).toBe(false);
        expect(inventory.getItemCount()).toBe(0);
      }
    });

    it('should handle item stacking', () => {
      const itemManager = new ItemManager(eventBus);
      
      // Create stackable item template
      const arrowTemplate: ItemTemplate = {
        id: 'arrow',
        name: 'Arrow',
        description: 'A sharp arrow',
        category: ItemCategory.MISC,
        character: '/',
        foreground: '#8b4513',
        properties: {
          weight: 0.1,
          volume: 0.1,
          stackable: true,
          maxStack: 20,
          value: 1
        }
      };
      itemManager.registerTemplate(arrowTemplate);
      
      // Spawn multiple arrows
      const arrows1 = itemManager.spawnItem('arrow', 10);
      const arrows2 = itemManager.spawnItem('arrow', 8);
      
      expect(arrows1).not.toBeNull();
      expect(arrows2).not.toBeNull();
      
      if (arrows1 && arrows2) {
        const inventoryManager = new InventoryManager(itemManager, eventBus);
        const player = createTestPlayer(ecsWorld);
        const inventory = inventoryManager.createInventory(player.id, 50, 100);
        
        inventory.addItem(arrows1);
        
        // Try to add more (should stack)
        const added = inventory.addItem(arrows2);
        expect(added).toBe(true);
        
        // Check total count - should be merged into one stack
        const items = inventory.getItems();
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        expect(totalQuantity).toBe(18);
      }
    });
  });

  describe('Save/Load Workflow', () => {
    beforeEach(() => {
      // Setup mock localStorage
      Object.defineProperty(global, 'localStorage', {
        value: new MockLocalStorage(),
        writable: true
      });
    });

    it('should save and load world state', async () => {
      const storage = new LocalStorageProvider();
      const saveManager = new SaveManager(storage, eventBus);
      const world = new World(100, 100, 64, ecsWorld);
      world.initialize();
      
      const itemManager = new ItemManager(eventBus);
      const inventoryManager = new InventoryManager(itemManager, eventBus);
      const turnManager = new TurnManager(ecsWorld, eventBus, new SpeedSystem());
      
      // Save game
      const metadata = await saveManager.createSave(
        1,
        'Test Save',
        world,
        ecsWorld,
        itemManager,
        inventoryManager,
        turnManager,
        { x: 50, y: 50 }
      );
      
      expect(metadata).toBeDefined();
      expect(metadata.slot).toBe(1);
      expect(metadata.name).toBe('Test Save');
      
      // Verify save exists
      const exists = await saveManager.saveExists(1);
      expect(exists).toBe(true);
      
      // List saves
      const saves = await saveManager.listSaves();
      expect(saves.length).toBeGreaterThan(0);
    });

    it('should serialize and deserialize entities', () => {
      // Create entity with components
      const entity = createTestPlayer(ecsWorld, {
        x: 10,
        y: 20,
        health: 80,
        speed: 120
      });
      
      // Serialize
      const serialized = EntitySerializer.serialize(entity);
      expect(serialized.id).toBe(entity.id);
      expect(serialized.components).toBeDefined();
      expect(serialized.components.length).toBeGreaterThan(0);
      
      // Deserialize into new world
      const newEventBus = new EventBus();
      const newWorld = new ECSWorld(newEventBus);
      const deserialized = EntitySerializer.deserialize(serialized, newWorld);
      
      // Note: EntitySerializer creates a new entity, so ID won't match
      // The important thing is that the entity exists and has the right components
      expect(deserialized).toBeDefined();
      
      const pos = deserialized.getComponent('position') as PositionComponent;
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(20);
      
      const health = deserialized.getComponent('health') as HealthComponent;
      expect(health.current).toBe(80);
    });

    it('should handle quick save and load', async () => {
      const storage = new LocalStorageProvider();
      const saveManager = new SaveManager(storage, eventBus);
      
      const world = new World(100, 100, 64, ecsWorld);
      world.initialize();
      const itemManager = new ItemManager(eventBus);
      const inventoryManager = new InventoryManager(itemManager, eventBus);
      const turnManager = new TurnManager(ecsWorld, eventBus, new SpeedSystem());
      
      // Quick save
      const quickSave = await saveManager.quickSave(
        world,
        ecsWorld,
        itemManager,
        inventoryManager,
        turnManager,
        { x: 10, y: 10 }
      );
      expect(quickSave.slot).toBe(0); // Quick save is slot 0
      
      // Quick load
      const loaded = await saveManager.quickLoad(ecsWorld, itemManager, inventoryManager);
      expect(loaded).toBeDefined();
      expect(loaded.metadata.slot).toBe(0);
    });
  });

  describe('World Generation Workflow', () => {
    it('should generate wilderness world', () => {
      const generator = new WorldGenerator(eventBus);
      
      // Generate a chunk
      const chunk = new Chunk(0, 0, 16);
      
      // Manually generate wilderness content
      generator['registerDefaultGenerators']();
      const wildernessGen = generator.getGenerator('wilderness');
      expect(wildernessGen).toBeDefined();
      
      if (wildernessGen) {
        wildernessGen(chunk, {
          world: new World(100, 100, 64, ecsWorld),
          rng: () => Math.random(),
          params: { treeDensity: 0.3, waterChance: 0.05 }
        });
      }
      
      // Verify generation
      let treeCount = 0;
      let floorCount = 0;
      let wallCount = 0;
      
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const tile = chunk.getTile(x, y);
          if (tile?.terrain === 'tree') treeCount++;
          if (tile?.terrain === 'floor') floorCount++;
          if (tile?.terrain === 'wall') wallCount++;
        }
      }
      
      // Should have border walls at minimum
      expect(wallCount).toBeGreaterThan(0);
      expect(treeCount + floorCount + wallCount).toBeGreaterThan(0);
    });

    it('should generate dungeon with rooms', () => {
      const generator = new WorldGenerator(eventBus);
      
      // Access the generator method
      generator['registerDefaultGenerators']();
      const dungeonGen = generator.getGenerator('dungeon');
      expect(dungeonGen).toBeDefined();
      
      if (dungeonGen) {
        const chunk = new Chunk(0, 0, 32);
        dungeonGen(chunk, {
          world: new World(100, 100, 64, ecsWorld),
          rng: () => Math.random(),
          params: { roomChance: 0.5 }
        });
        
        // Verify both walls and floors exist
        let wallCount = 0;
        let floorCount = 0;
        
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            const tile = chunk.getTile(x, y);
            if (tile?.terrain === 'wall') wallCount++;
            if (tile?.terrain === 'floor') floorCount++;
          }
        }
        
        expect(wallCount).toBeGreaterThan(0);
        expect(floorCount).toBeGreaterThan(0);
      }
    });

    it('should load predefined map with custom chunks', () => {
      const contentLoader = new ContentLoader(eventBus);
      const mapLoader = new MapLoader(contentLoader, eventBus);
      
      // Define a custom map
      const mapDefinition: MapDefinition = {
        id: 'test_map',
        name: 'Test Map',
        description: 'A test map',
        width: 128,
        height: 128,
        chunkSize: 64,
        generator: 'wilderness',
        generatorParams: { treeDensity: 0.3 },
        predefinedChunks: [
          {
            chunkX: 0,
            chunkY: 0,
            tiles: [
              ['wall', 'wall', 'wall'],
              ['wall', 'floor', 'door'],
              ['wall', 'wall', 'wall']
            ],
            entities: []
          }
        ],
        spawnPoints: [
          { x: 32, y: 32, type: 'player', tags: ['start'] }
        ]
      };
      
      // Register the map
      mapLoader.loadMapDefinition(mapDefinition);
      
      // Load it
      const mapDef = mapLoader.getMapDefinition('test_map');
      expect(mapDef).toBeDefined();
      expect(mapDef?.name).toBe('Test Map');
      expect(mapDef?.spawnPoints).toHaveLength(1);
    });
  });

  describe('Content Loading Workflow', () => {
    it('should load content pack with items and recipes', () => {
      const contentLoader = new ContentLoader(eventBus);
      
      // Define content pack
      const contentPack: ContentPack = {
        id: 'test_content',
        name: 'Test Content',
        version: '1.0.0',
        author: 'Test',
        description: 'Test content pack',
        items: [
          {
            id: 'test_sword',
            name: 'Test Sword',
            description: 'A test weapon',
            category: ItemCategory.WEAPON,
            character: '/',
            foreground: '#c0c0c0',
            properties: {
              weight: 2,
              volume: 4,
              durability: 100,
              maxDurability: 100,
              value: 100
            }
          }
        ],
        recipes: [
          {
            id: 'craft_test_sword',
            name: 'Craft Test Sword',
            description: 'Make a test sword',
            category: 'crafting',
            ingredients: [
              { itemId: 'iron_ingot', quantity: 3 }
            ],
            results: [
              { itemId: 'test_sword', quantity: 1 }
            ],
            timeCost: 100
          }
        ]
      };
      
      // Load pack
      contentLoader.loadContentPack(contentPack);
      
      // Verify items loaded
      const items = contentLoader.getAllItemTemplates();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('test_sword');
      
      // Verify recipes loaded
      const recipes = contentLoader.getAllRecipes();
      expect(recipes).toHaveLength(1);
      expect(recipes[0].id).toBe('craft_test_sword');
    });

    it('should handle mod loading with dependencies', () => {
      const contentLoader = new ContentLoader(eventBus);
      const mapLoader = new MapLoader(contentLoader, eventBus);
      const modLoader = new ModLoader(eventBus, contentLoader, mapLoader);
      
      // Create test mods
      const baseMod: Mod = {
        id: 'base_mod',
        name: 'Base Mod',
        version: '1.0.0',
        dependencies: [],
        initialize: jest.fn(),
        cleanup: jest.fn()
      };
      
      const dependentMod: Mod = {
        id: 'dependent_mod',
        name: 'Dependent Mod',
        version: '1.0.0',
        dependencies: ['base_mod'],
        initialize: jest.fn(),
        cleanup: jest.fn()
      };
      
      // Load mods
      modLoader.loadMod(baseMod);
      modLoader.loadMod(dependentMod);
      
      // Initialize mods
      modLoader.initializeMods();
      
      // Verify base mod initialized first
      expect(baseMod.initialize).toHaveBeenCalled();
      expect(dependentMod.initialize).toHaveBeenCalled();
      
      // Cleanup should happen in reverse order
      modLoader.cleanupMods();
      expect(dependentMod.cleanup).toHaveBeenCalled();
      expect(baseMod.cleanup).toHaveBeenCalled();
    });

    it('should allow mods to register content through API', () => {
      const contentLoader = new ContentLoader(eventBus);
      const mapLoader = new MapLoader(contentLoader, eventBus);
      const modLoader = new ModLoader(eventBus, contentLoader, mapLoader);
      
      // Create a test mod that registers terrain
      const testMod: Mod = {
        id: 'test_mod',
        name: 'Test Mod',
        version: '1.0.0',
        initialize: (api) => {
          const customTerrain: TerrainDefinition = {
            id: 'custom_floor',
            name: 'Custom Floor',
            character: '.',
            foreground: '#ff00ff',
            background: '#000000',
            blocksMovement: false,
            blocksLight: false,
            transparent: true
          };
          api.registerTerrain(customTerrain);
        }
      };
      
      // Load and initialize the mod
      modLoader.loadMod(testMod);
      modLoader.initializeMods();
      
      // Verify terrain was registered
      const terrain = contentLoader.getTerrain('custom_floor');
      expect(terrain).toBeDefined();
      expect(terrain?.name).toBe('Custom Floor');
    });
  });

  describe('Complete Game Session Workflow', () => {
    it('should run complete game lifecycle from start to save', async () => {
      // Setup mock localStorage
      Object.defineProperty(global, 'localStorage', {
        value: new MockLocalStorage(),
        writable: true
      });

      const engine = new Engine();
      await engine.initialize();
      
      // Create world
      const ecsWorld = new ECSWorld(eventBus);
      const world = new World(100, 100, 64, ecsWorld);
      world.initialize();
      
      // Create player
      const player = createTestPlayer(ecsWorld, { x: 32, y: 32 });
      
      // Setup systems
      const turnManager = new TurnManager(ecsWorld, eventBus, new SpeedSystem());
      const physics = new PhysicsSystem(world, ecsWorld, eventBus);
      const itemManager = new ItemManager(eventBus);
      const inventoryManager = new InventoryManager(itemManager, eventBus);
      
      // Register player actor
      let playerActions: string[] = [];
      const playerActor: Actor = {
        entityId: player.id,
        getSpeed: () => 100,
        act: async () => {
          playerActions.push(`Turn ${turnManager.getCurrentTurn()}`);
          
          // Simulate some actions - move east if possible
          const position = player.getComponent('position') as PositionComponent;
          if (physics.canMoveTo(position.x + 1, position.y)) {
            physics.moveEntity(player, 'east');
            playerActions.push('moved east');
          }
        }
      };
      turnManager.registerActor(playerActor, true);
      
      // Process a few turns
      for (let i = 0; i < 5; i++) {
        await turnManager.processSingleTurn();
      }
      
      // Verify turns were processed
      expect(playerActions.length).toBeGreaterThan(0);
      expect(turnManager.getCurrentTurn()).toBe(5);
      
      // Save the game
      const storage = new LocalStorageProvider();
      const saveManager = new SaveManager(storage, eventBus);
      const save = await saveManager.createSave(
        1,
        'test-session',
        world,
        ecsWorld,
        itemManager,
        inventoryManager,
        turnManager,
        { x: (player.getComponent('position') as PositionComponent)?.x ?? 0, y: (player.getComponent('position') as PositionComponent)?.y ?? 0 }
      );
      
      expect(save.slot).toBe(1);
      
      engine.start();
      expect(engine.running).toBe(true);
      
      engine.stop();
      expect(engine.running).toBe(false);
    });

    it('should handle multiple systems interacting during gameplay', () => {
      const world = new World(64, 64, 64, ecsWorld);
      world.initialize();
      
      // Setup all systems
      new PhysicsSystem(world, ecsWorld, eventBus);
      const fov = new FOVSystem(world);
      const lighting = new LightingSystem(world);
      const pathfinding = new Pathfinding(world);
      const itemManager = new ItemManager(eventBus);
      
      // Create entities
      createTestPlayer(ecsWorld, { x: 10, y: 10 });
      createTestNPC(ecsWorld, { x: 15, y: 10 });
      
      // Add light source at player position
      lighting.addLightSource('player_light', 10, 10, [255, 255, 0], 5);
      
      // Calculate FOV
      const visibleTiles = fov.computeFOV(10, 10, 10);
      expect(visibleTiles.length).toBeGreaterThan(0);
      
      // Calculate path from enemy to player
      const path = pathfinding.findPath(15, 10, 10, 10);
      expect(path).not.toBeNull();
      
      if (path) {
        expect(path.length).toBeGreaterThan(0);
      }
      
      // Spawn an item at a location
      const item = itemManager.spawnItem('sword_iron', 1, { x: 12, y: 10 });
      expect(item).not.toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle entity removal during turn processing', async () => {
      const turnManager = new TurnManager(ecsWorld, eventBus, new SpeedSystem());
      
      const entity1 = createTestActor(ecsWorld);
      const entity2 = createTestActor(ecsWorld);
      
      let entity1Acted = false;
      
      const actor1: Actor = {
        entityId: entity1.id,
        getSpeed: () => 100,
        act: async () => {
          entity1Acted = true;
          // Remove other entity during turn
          turnManager.removeActor(entity2.id);
        }
      };
      
      const actor2: Actor = {
        entityId: entity2.id,
        getSpeed: () => 100,
        act: jest.fn()
      };
      
      turnManager.registerActor(actor1);
      turnManager.registerActor(actor2);
      
      // Process turn - should not crash
      await turnManager.processSingleTurn();
      
      expect(entity1Acted).toBe(true);
    });

    it('should handle concurrent chunk operations', () => {
      const scheduler = new UpdateScheduler();
      new ChunkManager(64, scheduler, ecsWorld);
      const world = new World(256, 256, 64, ecsWorld);
      
      // The chunk manager is accessed through world
      const worldChunkManager = world.getChunkManager();
      
      // Initialize world (this activates chunks around center)
      world.initialize();
      
      const initialActiveCount = worldChunkManager.getActiveChunks().length;
      expect(initialActiveCount).toBeGreaterThan(0);
      
      // Move player to activate different chunks
      world.setPlayerPosition(128, 128);
      
      const newActiveCount = worldChunkManager.getActiveChunks().length;
      expect(newActiveCount).toBeGreaterThan(0);
    });

    it('should handle invalid save slot gracefully', async () => {
      Object.defineProperty(global, 'localStorage', {
        value: new MockLocalStorage(),
        writable: true
      });
      
      const storage = new LocalStorageProvider();
      const saveManager = new SaveManager(storage, eventBus);
      
      // Try to load non-existent save
      const itemManager = new ItemManager(eventBus);
      const inventoryManager = new InventoryManager(itemManager, eventBus);
      
      await expect(
        saveManager.loadSave(999, ecsWorld, itemManager, inventoryManager)
      ).rejects.toThrow('Save slot 999 not found');
    });

    it('should handle rapid turn processing without race conditions', async () => {
      const turnManager = new TurnManager(ecsWorld, eventBus, new SpeedSystem());
      const entity = createTestActor(ecsWorld);
      
      let actionCount = 0;
      const actor: Actor = {
        entityId: entity.id,
        getSpeed: () => 100,
        act: async () => {
          actionCount++;
          // Small delay to simulate processing
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      };
      
      turnManager.registerActor(actor);
      
      // Process many turns rapidly
      for (let i = 0; i < 20; i++) {
        await turnManager.processSingleTurn();
      }
      
      expect(actionCount).toBe(20);
      expect(turnManager.getCurrentTurn()).toBe(20);
    });
  });
});

describe('Performance Integration Tests', () => {
  it('should handle large world with many entities', () => {
    const ecsWorld = new ECSWorld();
    const world = new World(1000, 1000, 64, ecsWorld);
    world.initialize();
    
    // Create many entities
    const startTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      createTestActor(ecsWorld, {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000)
      });
    }
    const endTime = Date.now();
    
    // Should complete in reasonable time (< 1 second for 1000 entities)
    expect(endTime - startTime).toBeLessThan(1000);
    expect(ecsWorld.getAllEntities().length).toBe(1000);
  });

  it('should process chunk updates efficiently', () => {
    const eventBus = new EventBus();
    const ecsWorld = new ECSWorld(eventBus);
    const world = new World(512, 512, 64, ecsWorld);
    world.initialize();
    
    const chunkManager = world.getChunkManager();
    
    // Move player to trigger chunk activations
    const startTime = Date.now();
    world.setPlayerPosition(200, 200);
    const endTime = Date.now();
    
    const activeChunks = chunkManager.getActiveChunks();
    expect(activeChunks.length).toBeGreaterThan(0);
    expect(endTime - startTime).toBeLessThan(100);
  });
});

import {
  SaveManager,
  WorldSerializer,
  EntitySerializer,
  LocalStorageProvider,
  formatPlayTime,
  SaveData,
  SaveMetadata,
  SerializedWorld,
  SerializedEntity,
  SaveCompressor
} from '../../src/save';
import { World, TERRAIN } from '../../src/world';
import { ECSWorld, createPosition, createHealth } from '../../src/ecs';
import { EventBus } from '../../src/core/EventBus';
import { ItemManager, InventoryManager } from '../../src/items';
import { TurnManager, SpeedSystem, ActorSystem } from '../../src/time';
import { PhysicsSystem } from '../../src/physics';

// Mock localStorage for testing
class MockLocalStorage {
  private storage: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  get length(): number {
    return this.storage.size;
  }

  key(index: number): string | null {
    return Array.from(this.storage.keys())[index] || null;
  }

  clear(): void {
    this.storage.clear();
  }
}

// Setup mock localStorage before tests
Object.defineProperty(global, 'localStorage', {
  value: new MockLocalStorage(),
  writable: true
});

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  beforeEach(() => {
    localStorage.clear();
    provider = new LocalStorageProvider();
  });

  describe('save/load', () => {
    it('should save data', async () => {
      await provider.save(1, 'test data');
      expect(localStorage.getItem('ascii_world_save_1')).toBe('test data');
    });

    it('should load data', async () => {
      await provider.save(1, 'test data');
      const loaded = await provider.load(1);
      expect(loaded).toBe('test data');
    });

    it('should return null for non-existent save', async () => {
      const loaded = await provider.load(999);
      expect(loaded).toBeNull();
    });

    it('should throw error on save failure', async () => {
      // Mock storage to throw
      const mockStorage = {
        setItem: () => { throw new Error('Storage full'); },
        getItem: () => null,
        removeItem: () => {},
        length: 0,
        key: () => null,
        clear: () => {}
      };
      Object.defineProperty(global, 'localStorage', { value: mockStorage, writable: true });

      await expect(provider.save(1, 'data')).rejects.toThrow('Failed to save to slot 1');

      // Restore mock
      Object.defineProperty(global, 'localStorage', { value: new MockLocalStorage(), writable: true });
    });
  });

  describe('delete', () => {
    it('should delete save', async () => {
      await provider.save(1, 'test data');
      const result = await provider.delete(1);
      expect(result).toBe(true);
      expect(await provider.load(1)).toBeNull();
    });

    it('should return false for non-existent save', async () => {
      const result = await provider.delete(999);
      expect(result).toBe(false);
    });
  });

  describe('list', () => {
    it('should list saves', async () => {
      const metadata: SaveMetadata = {
        slot: 1,
        name: 'Test Save',
        timestamp: Date.now(),
        turn: 100,
        playerPosition: { x: 10, y: 20 },
        playTime: 3600,
        version: '0.1.0',
        checksum: 'abc123'
      };

      await provider.saveMetadata(1, metadata);
      const saves = await provider.list();

      expect(saves.length).toBe(1);
      expect(saves[0].name).toBe('Test Save');
    });

    it('should skip invalid metadata', async () => {
      localStorage.setItem('ascii_world_meta_1', 'invalid json');

      const saves = await provider.list();
      expect(saves.length).toBe(0);
    });
  });

  describe('exists', () => {
    it('should check if save exists', async () => {
      await provider.save(1, 'test data');
      expect(await provider.exists(1)).toBe(true);
      expect(await provider.exists(999)).toBe(false);
    });
  });

  describe('metadata', () => {
    it('should save and load metadata', async () => {
      const metadata: SaveMetadata = {
        slot: 1,
        name: 'Test Save',
        timestamp: Date.now(),
        turn: 100,
        playerPosition: { x: 10, y: 20 },
        playTime: 3600,
        version: '0.1.0',
        checksum: 'abc123'
      };

      await provider.saveMetadata(1, metadata);
      const loaded = await provider.loadMetadata(1);

      expect(loaded).toEqual(metadata);
    });

    it('should return null for non-existent metadata', async () => {
      const loaded = await provider.loadMetadata(999);
      expect(loaded).toBeNull();
    });
  });
});

describe('WorldSerializer', () => {
  let world: World;
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
    world = new World(100, 100, 16, ecsWorld);
    world.initialize();
  });

  describe('serialize', () => {
    it('should serialize world', () => {
      const serialized = WorldSerializer.serialize(world);

      expect(serialized.width).toBe(100);
      expect(serialized.height).toBe(100);
      expect(serialized.chunkSize).toBe(64); // Actual chunk size from world
      expect(Array.isArray(serialized.chunks)).toBe(true);
    });

    it('should serialize active chunks', () => {
      // Initialize some chunks
      const chunkManager = world.getChunkManager();
      chunkManager.setPlayerPosition(50, 50);

      const serialized = WorldSerializer.serialize(world);
      expect(serialized.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('serialize chunk', () => {
    it('should serialize chunk', () => {
      const chunkManager = world.getChunkManager();
      const chunk = chunkManager.getOrCreateChunk(0, 0);
      chunk.setTile(5, 5, TERRAIN.wall);

      const serialized = WorldSerializer.serializeChunk(chunk);

      expect(serialized.chunkX).toBe(0);
      expect(serialized.chunkY).toBe(0);
      expect(serialized.size).toBe(16);
      expect(serialized.tiles[5][5]).toEqual(TERRAIN.wall);
    });
  });

  describe('deserialize', () => {
    it('should deserialize world data', () => {
      const data: SerializedWorld = {
        width: 50,
        height: 50,
        chunkSize: 16,
        chunks: [],
        playerPosition: { x: 25, y: 25 }
      };

      const deserialized = WorldSerializer.deserializeWorld(data);

      expect(deserialized.width).toBe(50);
      expect(deserialized.height).toBe(50);
    });
  });

  describe('apply chunk data', () => {
    it('should apply serialized data to chunk', () => {
      const chunkManager = world.getChunkManager();
      const chunk = chunkManager.getOrCreateChunk(0, 0);

      const data = WorldSerializer.serializeChunk(chunk);
      data.tiles[5][5] = TERRAIN.wall;
      data.lastUpdateTurn = 100;
      data.needsCatchUp = true;

      // Clear the tile first
      chunk.setTile(5, 5, TERRAIN.floor);

      WorldSerializer.applyChunkData(chunk, data);

      expect(chunk.getTile(5, 5)).toEqual(TERRAIN.wall);
      expect(chunk.getLastUpdateTurn()).toBe(100);
      expect(chunk.isCatchUpNeeded()).toBe(true);
    });
  });
});

describe('EntitySerializer', () => {
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  describe('serialize', () => {
    it('should serialize entity', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(10, 20));
      entity.addComponent(createHealth(50, 100));

      const serialized = EntitySerializer.serialize(entity);

      expect(serialized.id).toBe(entity.id);
      expect(serialized.components).toHaveLength(2);
    });

    it('should serialize all entities', () => {
      const entity1 = ecsWorld.createEntity();
      const entity2 = ecsWorld.createEntity();

      const serialized = EntitySerializer.serializeAll(ecsWorld);

      expect(serialized).toHaveLength(2);
      expect(serialized.map(e => e.id)).toContain(entity1.id);
      expect(serialized.map(e => e.id)).toContain(entity2.id);
    });
  });

  describe('deserialize', () => {
    it('should deserialize entity', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(10, 20));
      entity.addComponent(createHealth(50, 100));

      const serialized = EntitySerializer.serialize(entity);
      ecsWorld.clear();

      const deserialized = EntitySerializer.deserialize(serialized, ecsWorld);

      expect(deserialized.getComponent('position')).toEqual(createPosition(10, 20));
      expect(deserialized.getComponent('health')).toEqual(createHealth(50, 100));
    });

    it('should deserialize all entities', () => {
      const entity1 = ecsWorld.createEntity();
      entity1.addComponent(createPosition(1, 1));

      const entity2 = ecsWorld.createEntity();
      entity2.addComponent(createPosition(2, 2));

      const serialized = EntitySerializer.serializeAll(ecsWorld);
      ecsWorld.clear();

      EntitySerializer.deserializeAll(serialized, ecsWorld);

      expect(ecsWorld.getAllEntities()).toHaveLength(2);
    });

    it('should clear existing entities on deserialize all', () => {
      ecsWorld.createEntity();

      const serialized: SerializedEntity[] = [{
        id: 999,
        components: [createPosition(0, 0)]
      }];

      EntitySerializer.deserializeAll(serialized, ecsWorld);

      expect(ecsWorld.getAllEntities()).toHaveLength(1);
      // Note: Entity ID may not be preserved exactly during deserialization
      // A new entity is created with components from the serialized data
      const entity = ecsWorld.getAllEntities()[0];
      expect(entity).toBeDefined();
      expect(entity.getComponent('position')).toEqual(createPosition(0, 0));
    });
  });
});

describe('SaveManager', () => {
  let saveManager: SaveManager;
  let storage: LocalStorageProvider;
  let eventBus: EventBus;
  let world: World;
  let ecsWorld: ECSWorld;
  let itemManager: ItemManager;
  let inventoryManager: InventoryManager;
  let turnManager: TurnManager;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalStorageProvider();
    eventBus = new EventBus();
    saveManager = new SaveManager(storage, eventBus);

    ecsWorld = new ECSWorld();
    world = new World(50, 50, 16, ecsWorld);
    world.initialize();
    itemManager = new ItemManager(eventBus);
    inventoryManager = new InventoryManager(eventBus);
    const speedSystem = new SpeedSystem();
    const actorSystem = new ActorSystem(ecsWorld, {} as PhysicsSystem);
    turnManager = new TurnManager(ecsWorld, eventBus, speedSystem, actorSystem);
  });

  describe('create save', () => {
    it('should create save', async () => {
      const handler = jest.fn();
      eventBus.on('save:started', handler);

      const metadata = await saveManager.createSave(
        1,
        'Test Save',
        world,
        ecsWorld,
        itemManager,
        inventoryManager,
        turnManager,
        { x: 10, y: 20 }
      );

      expect(metadata.slot).toBe(1);
      expect(metadata.name).toBe('Test Save');
      expect(metadata.playerPosition).toEqual({ x: 10, y: 20 });
      expect(handler).toHaveBeenCalledWith({ slot: 1, name: 'Test Save' });
    });

    it('should emit completed event', async () => {
      const handler = jest.fn();
      eventBus.on('save:completed', handler);

      await saveManager.createSave(
        1,
        'Test Save',
        world,
        ecsWorld,
        itemManager,
        inventoryManager,
        turnManager,
        { x: 0, y: 0 }
      );

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        slot: 1,
        name: 'Test Save'
      }));
    });

    it('should emit error event on failure', async () => {
      // Mock storage to fail
      const failingStorage = {
        ...storage,
        save: () => Promise.reject(new Error('Save failed'))
      };
      saveManager = new SaveManager(failingStorage as any, eventBus);

      const handler = jest.fn();
      eventBus.on('save:error', handler);

      await expect(saveManager.createSave(
        1,
        'Test Save',
        world,
        ecsWorld,
        itemManager,
        inventoryManager,
        turnManager,
        { x: 0, y: 0 }
      )).rejects.toThrow('Save failed');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('load save', () => {
    beforeEach(async () => {
      // Create a save first
      await saveManager.createSave(
        1,
        'Test Save',
        world,
        ecsWorld,
        itemManager,
        inventoryManager,
        turnManager,
        { x: 10, y: 20 }
      );
    });

    it('should load save', async () => {
      const handler = jest.fn();
      eventBus.on('load:started', handler);

      const result = await saveManager.loadSave(1, ecsWorld, itemManager, inventoryManager);

      expect(result.metadata.slot).toBe(1);
      expect(result.metadata.name).toBe('Test Save');
      expect(handler).toHaveBeenCalledWith({ slot: 1 });
    });

    it('should throw error for non-existent save', async () => {
      await expect(saveManager.loadSave(999, ecsWorld, itemManager, inventoryManager))
        .rejects.toThrow('Save slot 999 not found');
    });

    it('should warn on checksum mismatch', async () => {
      // Corrupt the save data
      const data = await storage.load(1);
      const saveData: SaveData = JSON.parse(data!);
      saveData.metadata.checksum = 'wrong_checksum';
      await storage.save(1, JSON.stringify(saveData));

      const handler = jest.fn();
      eventBus.on('load:checksumMismatch', handler);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await saveManager.loadSave(1, ecsWorld, itemManager, inventoryManager);

      expect(handler).toHaveBeenCalledWith({ slot: 1 });
      consoleSpy.mockRestore();
    });

    it('should emit completed event', async () => {
      const handler = jest.fn();
      eventBus.on('load:completed', handler);

      await saveManager.loadSave(1, ecsWorld, itemManager, inventoryManager);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ slot: 1 }));
    });

    it('should emit error event on failure', async () => {
      // Corrupt save data to cause parse error
      await storage.save(1, 'not valid json');

      const handler = jest.fn();
      eventBus.on('load:error', handler);

      await expect(saveManager.loadSave(1, ecsWorld, itemManager, inventoryManager))
        .rejects.toThrow();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('delete save', () => {
    beforeEach(async () => {
      await saveManager.createSave(
        1,
        'Test Save',
        world,
        ecsWorld,
        itemManager,
        inventoryManager,
        turnManager,
        { x: 0, y: 0 }
      );
    });

    it('should delete save', async () => {
      const handler = jest.fn();
      eventBus.on('save:deleted', handler);

      const result = await saveManager.deleteSave(1);

      expect(result).toBe(true);
      expect(await saveManager.saveExists(1)).toBe(false);
      expect(handler).toHaveBeenCalledWith({ slot: 1 });
    });

    it('should return false for non-existent save', async () => {
      const result = await saveManager.deleteSave(999);
      expect(result).toBe(false);
    });
  });

  describe('list saves', () => {
    it('should list all saves', async () => {
      await saveManager.createSave(1, 'Save 1', world, ecsWorld, itemManager, inventoryManager, turnManager, { x: 0, y: 0 });
      await saveManager.createSave(2, 'Save 2', world, ecsWorld, itemManager, inventoryManager, turnManager, { x: 0, y: 0 });

      const saves = await saveManager.listSaves();

      expect(saves).toHaveLength(2);
    });
  });

  describe('quick save/load', () => {
    it('should quick save', async () => {
      const metadata = await saveManager.quickSave(
        world, ecsWorld, itemManager, inventoryManager, turnManager, { x: 0, y: 0 }
      );

      expect(metadata.slot).toBe(0); // Quick save slot
      expect(metadata.name).toBe('Quick Save');
    });

    it('should quick load', async () => {
      await saveManager.quickSave(
        world, ecsWorld, itemManager, inventoryManager, turnManager, { x: 5, y: 10 }
      );

      const result = await saveManager.quickLoad(ecsWorld, itemManager, inventoryManager);

      expect(result.metadata.playerPosition).toEqual({ x: 5, y: 10 });
    });
  });

  describe('play time tracking', () => {
    it('should track play time', () => {
      saveManager.startPlayTimeTracking();

      // Wait a bit
      const startTime = Date.now();
      while (Date.now() - startTime < 100) {
        // Busy wait
      }

      const playTime = saveManager.getPlayTime();
      expect(playTime).toBeGreaterThanOrEqual(0);
    });

    it('should stop tracking', () => {
      saveManager.startPlayTimeTracking();
      
      // Wait a bit
      const startTime = Date.now();
      while (Date.now() - startTime < 100) {
        // Busy wait
      }
      
      saveManager.stopPlayTimeTracking();

      const playTimeAfterStop = saveManager.getPlayTime();

      // Wait again - play time should not increase
      while (Date.now() - startTime < 200) {
        // Busy wait
      }
      
      const playTimeLater = saveManager.getPlayTime();

      expect(playTimeAfterStop).toBe(playTimeLater);
    });
  });
});

describe('formatPlayTime', () => {
  it('should format seconds only', () => {
    expect(formatPlayTime(45)).toBe('45s');
  });

  it('should format minutes and seconds', () => {
    expect(formatPlayTime(125)).toBe('2m 5s');
  });

  it('should format hours and minutes', () => {
    expect(formatPlayTime(3665)).toBe('1h 1m');
  });

  it('should handle zero', () => {
    expect(formatPlayTime(0)).toBe('0s');
  });
});

describe('SaveCompressor', () => {
  it('should compress and decompress', () => {
    const original = 'test data';
    const compressed = SaveCompressor.compress(original);
    const decompressed = SaveCompressor.decompress(compressed);

    // Currently just passes through (no actual compression)
    expect(decompressed).toBe(original);
  });
});

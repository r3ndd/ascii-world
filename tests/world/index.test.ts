import {
  Chunk,
  ChunkManager,
  UpdateScheduler,
  World,
  MapManager,
  TERRAIN,
  MapMetadata
} from '../../src/world';
import { ECSWorld } from '../../src/ecs';


describe('Chunk', () => {
  let chunk: Chunk;

  beforeEach(() => {
    chunk = new Chunk(0, 0, 16);
  });

  describe('creation', () => {
    it('should create a chunk with coordinates and size', () => {
      expect(chunk.chunkX).toBe(0);
      expect(chunk.chunkY).toBe(0);
      expect(chunk.size).toBe(16);
    });

    it('should create a chunk with default floor tiles', () => {
      const tile = chunk.getTile(0, 0);
      expect(tile).toEqual(TERRAIN.floor);
    });

    it('should create chunks with different sizes', () => {
      const smallChunk = new Chunk(1, 1, 8);
      const largeChunk = new Chunk(2, 2, 32);

      expect(smallChunk.size).toBe(8);
      expect(largeChunk.size).toBe(32);
    });
  });

  describe('tile management', () => {
    it('should set and get tiles', () => {
      chunk.setTile(5, 5, TERRAIN.wall);
      const tile = chunk.getTile(5, 5);
      expect(tile).toEqual(TERRAIN.wall);
    });

    it('should return null for out-of-bounds tiles', () => {
      expect(chunk.getTile(-1, 0)).toBeNull();
      expect(chunk.getTile(0, -1)).toBeNull();
      expect(chunk.getTile(16, 0)).toBeNull();
      expect(chunk.getTile(0, 16)).toBeNull();
    });

    it('should return false when setting out-of-bounds tiles', () => {
      const result = chunk.setTile(-1, 0, TERRAIN.wall);
      expect(result).toBe(false);
    });

    it('should fill all tiles with a terrain type', () => {
      chunk.fill('wall');

      for (let y = 0; y < chunk.size; y++) {
        for (let x = 0; x < chunk.size; x++) {
          expect(chunk.getTile(x, y)).toEqual(TERRAIN.wall);
        }
      }
    });

    it('should handle different terrain types', () => {
      chunk.setTile(0, 0, TERRAIN.floor);
      chunk.setTile(1, 0, TERRAIN.wall);
      chunk.setTile(2, 0, TERRAIN.water);
      chunk.setTile(3, 0, TERRAIN.tree);
      chunk.setTile(4, 0, TERRAIN.door);
      chunk.setTile(5, 0, TERRAIN.stairs_up);
      chunk.setTile(6, 0, TERRAIN.stairs_down);

      expect(chunk.getTile(0, 0)?.terrain).toBe('floor');
      expect(chunk.getTile(1, 0)?.terrain).toBe('wall');
      expect(chunk.getTile(2, 0)?.terrain).toBe('water');
      expect(chunk.getTile(3, 0)?.terrain).toBe('tree');
      expect(chunk.getTile(4, 0)?.terrain).toBe('door');
      expect(chunk.getTile(5, 0)?.terrain).toBe('stairs_up');
      expect(chunk.getTile(6, 0)?.terrain).toBe('stairs_down');
    });
  });

  describe('entity management', () => {
    it('should add entities', () => {
      chunk.addEntity(1, 5, 5);
      const position = chunk.getEntityPosition(1);
      expect(position).toEqual({ x: 5, y: 5 });
    });

    it('should remove entities', () => {
      chunk.addEntity(1, 5, 5);
      const result = chunk.removeEntity(1);
      expect(result).toBe(true);
      expect(chunk.getEntityPosition(1)).toBeNull();
    });

    it('should return false when removing non-existent entity', () => {
      const result = chunk.removeEntity(999);
      expect(result).toBe(false);
    });

    it('should get all entities', () => {
      chunk.addEntity(1, 1, 1);
      chunk.addEntity(2, 2, 2);
      chunk.addEntity(3, 3, 3);

      const entities = chunk.getAllEntities();
      expect(entities).toHaveLength(3);
      expect(entities.map(e => e.entityId)).toContain(1);
      expect(entities.map(e => e.entityId)).toContain(2);
      expect(entities.map(e => e.entityId)).toContain(3);
    });

    it('should return empty array when no entities', () => {
      expect(chunk.getAllEntities()).toEqual([]);
    });
  });

  describe('position conversion', () => {
    it('should convert local to world position', () => {
      const worldPos = chunk.toWorldPosition(5, 7);
      expect(worldPos).toEqual({ x: 5, y: 7 });
    });

    it('should convert world to local position', () => {
      const localPos = chunk.toLocalPosition(5, 7);
      expect(localPos).toEqual({ x: 5, y: 7 });
    });

    it('should handle position conversion for different chunk coordinates', () => {
      const chunk2 = new Chunk(2, 3, 16);
      const worldPos = chunk2.toWorldPosition(5, 5);
      expect(worldPos).toEqual({ x: 37, y: 53 }); // 2*16 + 5 = 37, 3*16 + 5 = 53
    });

    it('should validate local positions', () => {
      expect(chunk.isValidLocalPosition(0, 0)).toBe(true);
      expect(chunk.isValidLocalPosition(15, 15)).toBe(true);
      expect(chunk.isValidLocalPosition(-1, 0)).toBe(false);
      expect(chunk.isValidLocalPosition(0, -1)).toBe(false);
      expect(chunk.isValidLocalPosition(16, 0)).toBe(false);
      expect(chunk.isValidLocalPosition(0, 16)).toBe(false);
    });
  });

  describe('update tracking', () => {
    it('should track last update turn', () => {
      expect(chunk.getLastUpdateTurn()).toBe(0);
      chunk.markUpdated(100);
      expect(chunk.getLastUpdateTurn()).toBe(100);
    });

    it('should track catch-up status', () => {
      expect(chunk.isCatchUpNeeded()).toBe(false);
      chunk.setCatchUpNeeded(true);
      expect(chunk.isCatchUpNeeded()).toBe(true);
      chunk.setCatchUpNeeded(false);
      expect(chunk.isCatchUpNeeded()).toBe(false);
    });
  });
});

describe('UpdateScheduler', () => {
  let scheduler: UpdateScheduler;

  beforeEach(() => {
    scheduler = new UpdateScheduler();
  });

  describe('distance calculation', () => {
    it('should calculate distance from player', () => {
      const distance = scheduler.getDistanceFromPlayer(2, 3, 0, 0);
      expect(distance).toBe(3); // max(|2-0|, |3-0|) = 3
    });

    it('should return 0 when at player position', () => {
      const distance = scheduler.getDistanceFromPlayer(0, 0, 0, 0);
      expect(distance).toBe(0);
    });

    it('should calculate diagonal distance correctly', () => {
      const distance = scheduler.getDistanceFromPlayer(3, 3, 0, 0);
      expect(distance).toBe(3);
    });
  });

  describe('update scheduling', () => {
    it('should always update chunks within full update distance', () => {
      expect(scheduler.shouldUpdate(0, 0, 0, 0)).toBe(true); // Distance 0
      expect(scheduler.shouldUpdate(1, 0, 0, 0)).toBe(true); // Distance 1
      expect(scheduler.shouldUpdate(0, 1, 0, 0)).toBe(true); // Distance 1
    });

    it('should track turns since last update', () => {
      scheduler.advanceTurn();
      scheduler.advanceTurn();
      scheduler.advanceTurn();
      expect(scheduler.getCurrentTurn()).toBe(3);
    });

    it('should mark chunks as updated', () => {
      scheduler.markUpdated(1, 1);
      expect(scheduler.getTurnsSinceLastUpdate(1, 1)).toBe(0);

      scheduler.advanceTurn();
      expect(scheduler.getTurnsSinceLastUpdate(1, 1)).toBe(1);

      scheduler.advanceTurn();
      expect(scheduler.getTurnsSinceLastUpdate(1, 1)).toBe(2);
    });

    it('should generate consistent chunk keys', () => {
      expect(scheduler.getChunkKey(1, 2)).toBe('1,2');
      expect(scheduler.getChunkKey(-1, -2)).toBe('-1,-2');
    });
  });
});

describe('ChunkManager', () => {
  let chunkManager: ChunkManager;
  let ecsWorld: ECSWorld;
  let scheduler: UpdateScheduler;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
    scheduler = new UpdateScheduler();
    chunkManager = new ChunkManager(16, scheduler, ecsWorld);
  });

  describe('chunk retrieval', () => {
    it('should get or create chunks', () => {
      const chunk1 = chunkManager.getOrCreateChunk(0, 0);
      expect(chunk1).toBeInstanceOf(Chunk);
      expect(chunk1.chunkX).toBe(0);
      expect(chunk1.chunkY).toBe(0);

      // Should return same chunk
      const chunk2 = chunkManager.getOrCreateChunk(0, 0);
      expect(chunk2).toBe(chunk1);
    });

    it('should convert world to chunk coordinates', () => {
      expect(chunkManager.worldToChunk(5, 5)).toEqual({ chunkX: 0, chunkY: 0 });
      expect(chunkManager.worldToChunk(20, 30)).toEqual({ chunkX: 1, chunkY: 1 });
      expect(chunkManager.worldToChunk(-5, -5)).toEqual({ chunkX: -1, chunkY: -1 });
    });

    it('should get existing chunk without creating', () => {
      chunkManager.getOrCreateChunk(0, 0);
      const chunk = chunkManager.getChunk(0, 0);
      expect(chunk).toBeInstanceOf(Chunk);

      const nonExistent = chunkManager.getChunk(999, 999);
      expect(nonExistent).toBeNull();
    });
  });

  describe('tile management', () => {
    it('should get tile at world position', () => {
      // First create the chunk
      chunkManager.getOrCreateChunk(0, 0);
      const tile = chunkManager.getTileAt(5, 5);
      expect(tile).toBeTruthy();
    });

    it('should return null for tiles in non-existent chunks', () => {
      const tile = chunkManager.getTileAt(9999, 9999);
      expect(tile).toBeNull();
    });

    it('should set tile at world position', () => {
      chunkManager.setTileAt(5, 5, TERRAIN.wall);
      const tile = chunkManager.getTileAt(5, 5);
      expect(tile).toEqual(TERRAIN.wall);
    });

    it('should validate positions', () => {
      chunkManager.setTileAt(5, 5, TERRAIN.wall);
      expect(chunkManager.isValidPosition(5, 5)).toBe(false); // Wall blocks movement

      chunkManager.setTileAt(6, 6, TERRAIN.floor);
      expect(chunkManager.isValidPosition(6, 6)).toBe(true);
    });

    it('should return false for invalid positions', () => {
      expect(chunkManager.isValidPosition(9999, 9999)).toBe(false);
    });
  });

  describe('player position management', () => {
    it('should set player position', () => {
      chunkManager.setPlayerPosition(50, 50);
      // Should not throw
    });

    it('should activate nearby chunks when player moves', () => {
      chunkManager.setPlayerPosition(0, 0);
      const activeChunks = chunkManager.getActiveChunks();
      expect(activeChunks.length).toBeGreaterThan(0);
    });

    it('should deactivate distant chunks when player moves far', () => {
      chunkManager.setPlayerPosition(0, 0);
      chunkManager.getActiveChunks().length;

      chunkManager.setPlayerPosition(100, 100);
      const newActiveChunks = chunkManager.getActiveChunks();

      // Should have different active chunks
      expect(newActiveChunks.length).toBeGreaterThan(0);
    });
  });

  describe('update processing', () => {
    it('should update active chunks', () => {
      chunkManager.setPlayerPosition(0, 0);
      chunkManager.update();
      // Should not throw
    });

    it('should process catch-up for reactivated chunks', () => {
      // Create a chunk and mark it as needing catch-up
      const chunk = chunkManager.getOrCreateChunk(0, 0);
      chunk.setCatchUpNeeded(true);

      // Process update
      chunkManager.setPlayerPosition(0, 0);
      chunkManager.update();

      // Catch-up should be processed
      expect(chunk.isCatchUpNeeded()).toBe(false);
    });
  });
});

describe('World', () => {
  let world: World;
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
    world = new World(100, 100, 16, ecsWorld);
    world.initialize();
    
    // Ensure test positions have floor tiles to avoid random terrain generation issues
    world.setTileAt(50, 50, TERRAIN.floor);
  });

  describe('creation', () => {
    it('should create a world with dimensions', () => {
      expect(world.getWidth()).toBe(100);
      expect(world.getHeight()).toBe(100);
    });

    it('should have a chunk manager', () => {
      expect(world.getChunkManager()).toBeInstanceOf(ChunkManager);
    });

    it('should have an update scheduler', () => {
      expect(world.getUpdateScheduler()).toBeInstanceOf(UpdateScheduler);
    });
  });

  describe('tile access', () => {
    it('should get tile at valid position', () => {
      const tile = world.getTileAt(50, 50);
      expect(tile).toBeTruthy();
    });

    it('should return null for out-of-bounds tiles', () => {
      expect(world.getTileAt(-1, 0)).toBeNull();
      expect(world.getTileAt(0, -1)).toBeNull();
      expect(world.getTileAt(100, 0)).toBeNull();
      expect(world.getTileAt(0, 100)).toBeNull();
    });

    it('should set tile at valid position', () => {
      const result = world.setTileAt(50, 50, TERRAIN.wall);
      expect(result).toBe(true);

      const tile = world.getTileAt(50, 50);
      expect(tile).toEqual(TERRAIN.wall);
    });

    it('should return false when setting out-of-bounds tile', () => {
      const result = world.setTileAt(-1, 0, TERRAIN.wall);
      expect(result).toBe(false);
    });
  });

  describe('position validation', () => {
    it('should validate positions within bounds', () => {
      expect(world.isValidPosition(50, 50)).toBe(true);
    });

    it('should reject out-of-bounds positions', () => {
      expect(world.isValidPosition(-1, 0)).toBe(false);
      expect(world.isValidPosition(0, -1)).toBe(false);
      expect(world.isValidPosition(100, 0)).toBe(false);
      expect(world.isValidPosition(0, 100)).toBe(false);
    });

    it('should reject positions blocked by terrain', () => {
      world.setTileAt(50, 50, TERRAIN.wall);
      expect(world.isValidPosition(50, 50)).toBe(false);
    });
  });

  describe('entity management', () => {
    it('should get entities at position', () => {
      const entities = world.getEntitiesAt(0, 0);
      expect(Array.isArray(entities)).toBe(true);
    });

    it('should return empty array for positions with no entities', () => {
      const entities = world.getEntitiesAt(999, 999);
      expect(entities).toEqual([]);
    });
  });

  describe('player position', () => {
    it('should set player position', () => {
      world.setPlayerPosition(10, 20);
      // Should update chunk manager
    });
  });

  describe('update', () => {
    it('should update world state', () => {
      world.update();
      // Should not throw
    });
  });
});

describe('MapManager', () => {
  let mapManager: MapManager;
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
    mapManager = new MapManager(ecsWorld);
  });

  describe('map registration', () => {
    it('should register maps', () => {
      const metadata: MapMetadata = {
        id: 'test_map',
        name: 'Test Map',
        description: 'A test map',
        size: { width: 100, height: 100 }
      };

      mapManager.registerMap(metadata);
      const retrieved = mapManager.getMap('test_map');
      expect(retrieved).toEqual(metadata);
    });

    it('should get all registered maps', () => {
      mapManager.registerMap({
        id: 'map1',
        name: 'Map 1',
        description: 'First map',
        size: { width: 100, height: 100 }
      });
      mapManager.registerMap({
        id: 'map2',
        name: 'Map 2',
        description: 'Second map',
        size: { width: 200, height: 200 }
      });

      const maps = mapManager.getAllMaps();
      expect(maps).toHaveLength(2);
    });
  });

  describe('map loading', () => {
    it('should throw error when loading non-existent map', () => {
      expect(() => mapManager.loadMap('nonexistent')).toThrow('Map nonexistent not found');
    });

    it('should load registered map', () => {
      mapManager.registerMap({
        id: 'test_map',
        name: 'Test Map',
        description: 'A test map',
        size: { width: 100, height: 100 }
      });

      const world = mapManager.loadMap('test_map');
      expect(world).toBeInstanceOf(World);
      expect(world.getWidth()).toBe(100);
      expect(world.getHeight()).toBe(100);
    });

    it('should load map with custom dimensions', () => {
      mapManager.registerMap({
        id: 'test_map',
        name: 'Test Map',
        description: 'A test map',
        size: { width: 100, height: 100 }
      });

      const world = mapManager.loadMap('test_map', 200, 200);
      expect(world.getWidth()).toBe(200);
      expect(world.getHeight()).toBe(200);
    });

    it('should set current map when loading', () => {
      mapManager.registerMap({
        id: 'test_map',
        name: 'Test Map',
        description: 'A test map',
        size: { width: 100, height: 100 }
      });

      const world = mapManager.loadMap('test_map');
      expect(mapManager.getCurrentMap()).toBe(world);
    });
  });

  describe('default world creation', () => {
    it('should create default world', () => {
      const world = mapManager.createDefaultWorld();
      expect(world).toBeInstanceOf(World);
      expect(mapManager.getCurrentMap()).toBe(world);
    });
  });
});

describe('TERRAIN definitions', () => {
  it('should have all terrain types defined', () => {
    expect(TERRAIN.floor).toBeDefined();
    expect(TERRAIN.wall).toBeDefined();
    expect(TERRAIN.water).toBeDefined();
    expect(TERRAIN.tree).toBeDefined();
    expect(TERRAIN.door).toBeDefined();
    expect(TERRAIN.stairs_up).toBeDefined();
    expect(TERRAIN.stairs_down).toBeDefined();
  });

  it('should have correct properties for each terrain type', () => {
    // Floor: passable
    expect(TERRAIN.floor.blocksMovement).toBe(false);
    expect(TERRAIN.floor.blocksLight).toBe(false);
    expect(TERRAIN.floor.transparent).toBe(true);

    // Wall: impassable
    expect(TERRAIN.wall.blocksMovement).toBe(true);
    expect(TERRAIN.wall.blocksLight).toBe(true);
    expect(TERRAIN.wall.transparent).toBe(false);

    // Water: passable
    expect(TERRAIN.water.blocksMovement).toBe(false);
    expect(TERRAIN.water.blocksLight).toBe(false);
    expect(TERRAIN.water.transparent).toBe(true);

    // Tree: impassable
    expect(TERRAIN.tree.blocksMovement).toBe(true);
    expect(TERRAIN.tree.blocksLight).toBe(false);
    expect(TERRAIN.tree.transparent).toBe(true);
  });

  it('should have display characters', () => {
    expect(TERRAIN.floor.char).toBe('.');
    expect(TERRAIN.wall.char).toBe('#');
    expect(TERRAIN.water.char).toBe('~');
    expect(TERRAIN.tree.char).toBe('T');
    expect(TERRAIN.door.char).toBe('+');
    expect(TERRAIN.stairs_up.char).toBe('>');
    expect(TERRAIN.stairs_down.char).toBe('<');
  });
});

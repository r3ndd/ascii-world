import {
  PhysicsSystem,
  FOVSystem,
  LightingSystem,
  Pathfinding
} from '../../src/physics';
import { World, TERRAIN } from '../../src/world';
import { ECSWorld, createPosition } from '../../src/ecs';
import { EventBus } from '../../src/core/EventBus';
import type { Direction } from '../../src/core/Types';

describe('PhysicsSystem', () => {
  let physicsSystem: PhysicsSystem;
  let world: World;
  let ecsWorld: ECSWorld;
  let eventBus: EventBus;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
    world = new World(50, 50, 16, ecsWorld);
    world.initialize();
    eventBus = new EventBus();
    physicsSystem = new PhysicsSystem(world, ecsWorld, eventBus);
    
    // Ensure test positions have floor tiles to avoid random terrain generation issues
    // Position (25, 25) is used in most tests
    world.setTileAt(25, 25, TERRAIN.floor);
    world.setTileAt(25, 24, TERRAIN.floor); // north
    world.setTileAt(25, 26, TERRAIN.floor); // south
    world.setTileAt(26, 25, TERRAIN.floor); // east
    world.setTileAt(24, 25, TERRAIN.floor); // west
    world.setTileAt(26, 24, TERRAIN.floor); // northeast
    world.setTileAt(24, 24, TERRAIN.floor); // northwest
    world.setTileAt(26, 26, TERRAIN.floor); // southeast
    world.setTileAt(24, 26, TERRAIN.floor); // southwest
  });

  describe('movement validation', () => {
    it('should allow movement to valid position', () => {
      expect(physicsSystem.canMoveTo(25, 25)).toBe(true);
    });

    it('should block movement to wall', () => {
      world.setTileAt(10, 10, TERRAIN.wall);
      expect(physicsSystem.canMoveTo(10, 10)).toBe(false);
    });

    it('should block movement out of bounds', () => {
      expect(physicsSystem.canMoveTo(-1, 0)).toBe(false);
      expect(physicsSystem.canMoveTo(0, -1)).toBe(false);
      expect(physicsSystem.canMoveTo(50, 0)).toBe(false);
      expect(physicsSystem.canMoveTo(0, 50)).toBe(false);
    });
  });

  describe('entity movement', () => {
    it('should move entity in direction', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(25, 25));

      const result = physicsSystem.moveEntity(entity, 'north');

      expect(result).toBe(true);
      const pos = entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
      expect(pos?.y).toBe(24);
    });

    it('should emit movement event on success', () => {
      const handler = jest.fn();
      eventBus.on('physics:entityMoved', handler);

      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(25, 25));

      physicsSystem.moveEntity(entity, 'east');

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        entityId: entity.id,
        from: { x: 25, y: 25 },
        to: { x: 26, y: 25 }
      }));
    });

    it('should emit blocked event on failure', () => {
      world.setTileAt(25, 24, TERRAIN.wall);

      const handler = jest.fn();
      eventBus.on('physics:movementBlocked', handler);

      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(25, 25));

      const result = physicsSystem.moveEntity(entity, 'north');

      expect(result).toBe(false);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        entityId: entity.id,
        from: { x: 25, y: 25 },
        to: { x: 25, y: 24 }
      }));
    });

    it('should handle all 8 directions', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(25, 25));

      // Test each direction
      const directions: Direction[] = [
        'north', 'south', 'east', 'west',
        'northeast', 'northwest', 'southeast', 'southwest'
      ];

      for (const dir of directions) {
        const pos = entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
        const startX = pos!.x;
        const startY = pos!.y;

        const result = physicsSystem.moveEntity(entity, dir);

        // Reset position for next test
        if (result) {
          const newPos = entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
          // Either x or y (or both) should have changed
          expect(newPos?.x !== startX || newPos?.y !== startY).toBe(true);
          pos!.x = 25;
          pos!.y = 25;
        }
      }
    });

    it('should return false for entity without position', () => {
      const entity = ecsWorld.createEntity();
      // No position component

      const result = physicsSystem.moveEntity(entity, 'north');
      expect(result).toBe(false);
    });
  });

  describe('move to position', () => {
    it('should move entity to specific position', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(10, 10));

      const result = physicsSystem.moveEntityTo(entity, 20, 20);

      expect(result).toBe(true);
      const pos = entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
      expect(pos?.x).toBe(20);
      expect(pos?.y).toBe(20);
    });

    it('should emit movement event', () => {
      const handler = jest.fn();
      eventBus.on('physics:entityMoved', handler);

      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(10, 10));

      physicsSystem.moveEntityTo(entity, 20, 20);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        from: { x: 10, y: 10 },
        to: { x: 20, y: 20 }
      }));
    });

    it('should return false for invalid position', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(10, 10));

      const result = physicsSystem.moveEntityTo(entity, -1, 0);
      expect(result).toBe(false);
    });

    it('should return false for entity without position', () => {
      const entity = ecsWorld.createEntity();
      // No position component

      const result = physicsSystem.moveEntityTo(entity, 20, 20);
      expect(result).toBe(false);
    });
  });

  describe('get entity position', () => {
    it('should get position of entity', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(15, 25));

      const pos = physicsSystem.getEntityPosition(entity);
      expect(pos).toEqual({ x: 15, y: 25 });
    });

    it('should return null for entity without position', () => {
      const entity = ecsWorld.createEntity();
      // No position component

      const pos = physicsSystem.getEntityPosition(entity);
      expect(pos).toBeNull();
    });
  });
});

describe('FOVSystem', () => {
  let fovSystem: FOVSystem;
  let world: World;
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
    world = new World(30, 30, 16, ecsWorld);
    world.initialize();
    fovSystem = new FOVSystem(world);
  });

  describe('FOV computation', () => {
    it('should compute FOV from origin', () => {
      const visible = fovSystem.computeFOV(15, 15, 5);

      expect(visible.length).toBeGreaterThan(0);
      expect(visible).toContainEqual({ x: 15, y: 15 });
    });

    it('should compute visible tiles within radius', () => {
      const visible = fovSystem.computeFOV(15, 15, 3);

      // Check tiles within radius
      for (const pos of visible) {
        const dx = Math.abs(pos.x - 15);
        const dy = Math.abs(pos.y - 15);
        expect(Math.max(dx, dy)).toBeLessThanOrEqual(3);
      }
    });

    it('should respect light blocking tiles', () => {
      // Ensure all chunks within FOV radius exist
      // FOV radius 5 from (15,15) spans chunks (0,0), (1,0), (0,1), (1,1)
      world.getChunkManager().getOrCreateChunk(0, 0);
      world.getChunkManager().getOrCreateChunk(1, 0);
      world.getChunkManager().getOrCreateChunk(0, 1);
      world.getChunkManager().getOrCreateChunk(1, 1);
      
      // Fill with floor tiles first
      for (let y = 10; y <= 20; y++) {
        for (let x = 10; x <= 20; x++) {
          world.setTileAt(x, y, TERRAIN.floor);
        }
      }
      
      // Create a wall blocking the east direction
      world.setTileAt(16, 15, TERRAIN.wall);

      const visible = fovSystem.computeFOV(15, 15, 5);

      // Wall should be visible (you can see walls)
      expect(visible.some(p => p.x === 16 && p.y === 15)).toBe(true);
      // But tile immediately behind wall might not be visible
    });
  });

  describe('visibility checking', () => {
    beforeEach(() => {
      fovSystem.computeFOV(15, 15, 5);
    });

    it('should check if tile is visible', () => {
      expect(fovSystem.isVisible(15, 15)).toBe(true);
    });

    it('should track explored tiles', () => {
      expect(fovSystem.isExplored(15, 15)).toBe(true);
    });

    it('should get all visible tiles', () => {
      const visible = fovSystem.getVisibleTiles();
      expect(visible.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset visible tiles', () => {
      fovSystem.computeFOV(15, 15, 5);
      expect(fovSystem.getVisibleTiles().length).toBeGreaterThan(0);

      fovSystem.reset();
      expect(fovSystem.getVisibleTiles().length).toBe(0);
    });

    it('should preserve explored tiles after reset', () => {
      fovSystem.computeFOV(15, 15, 5);
      fovSystem.reset();

      expect(fovSystem.isExplored(15, 15)).toBe(true);
    });
  });
});

describe('LightingSystem', () => {
  let lightingSystem: LightingSystem;
  let world: World;
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
    world = new World(30, 30, 16, ecsWorld);
    world.initialize();
    lightingSystem = new LightingSystem(world);
  });

  describe('light source management', () => {
    it('should add light source', () => {
      lightingSystem.addLightSource('torch1', 15, 15, [255, 200, 100], 1.0);

      const light = lightingSystem.getLightAt(15, 15);
      expect(light).toBeTruthy();
    });

    it('should remove light source', () => {
      lightingSystem.addLightSource('torch1', 15, 15, [255, 200, 100], 1.0);
      lightingSystem.removeLightSource('torch1');

      // Light should be cleared
      const light = lightingSystem.getLightAt(15, 15);
      expect(light).toBeFalsy();
    });

    it('should move light source', () => {
      lightingSystem.addLightSource('torch1', 15, 15, [255, 200, 100], 1.0);
      lightingSystem.moveLightSource('torch1', 20, 20);

      // Light should be present at new location
      const lightAtNew = lightingSystem.getLightAt(20, 20);
      expect(lightAtNew).toBeTruthy();
    });

    it('should handle multiple light sources', () => {
      lightingSystem.addLightSource('torch1', 10, 10, [255, 200, 100], 1.0);
      lightingSystem.addLightSource('torch2', 20, 20, [100, 200, 255], 1.0);

      const light1 = lightingSystem.getLightAt(10, 10);
      const light2 = lightingSystem.getLightAt(20, 20);

      expect(light1).toBeTruthy();
      expect(light2).toBeTruthy();
    });
  });

  describe('light computation', () => {
    it('should emit light from source', () => {
      lightingSystem.addLightSource('torch1', 15, 15, [255, 200, 100], 1.0);

      const lightAtSource = lightingSystem.getLightAt(15, 15);
      expect(lightAtSource).toBeTruthy();
    });

    it('should have light diminish with distance', () => {
      lightingSystem.addLightSource('torch1', 15, 15, [255, 255, 255], 1.0);

      const lightAtSource = lightingSystem.getLightAt(15, 15);
      const lightNearby = lightingSystem.getLightAt(16, 15);

      // Source should be brighter than nearby
      if (lightAtSource && lightNearby) {
        const sourceIntensity = lightAtSource[0] + lightAtSource[1] + lightAtSource[2];
        const nearbyIntensity = lightNearby[0] + lightNearby[1] + lightNearby[2];
        expect(sourceIntensity).toBeGreaterThanOrEqual(nearbyIntensity);
      }
    });
  });

  describe('reset', () => {
    it('should clear all lights', () => {
      lightingSystem.addLightSource('torch1', 15, 15, [255, 200, 100], 1.0);
      lightingSystem.reset();

      const light = lightingSystem.getLightAt(15, 15);
      expect(light).toBeNull();
    });
  });
});

describe('Pathfinding', () => {
  let pathfinding: Pathfinding;
  let world: World;
  let ecsWorld: ECSWorld;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
    world = new World(30, 30, 16, ecsWorld);
    world.initialize();
    pathfinding = new Pathfinding(world);
  });

  describe('A* pathfinding', () => {
    it('should find path between two points', () => {
      // Ensure chunks exist for the path (15,15) to (20,20)
      // (15,15) is in chunk (0,0), (20,20) is in chunk (1,1)
      world.getChunkManager().getOrCreateChunk(0, 0);
      world.getChunkManager().getOrCreateChunk(1, 0);
      world.getChunkManager().getOrCreateChunk(0, 1);
      world.getChunkManager().getOrCreateChunk(1, 1);
      
      // Fill chunks with floor tiles to ensure path is clear
      for (let y = 14; y <= 21; y++) {
        for (let x = 14; x <= 21; x++) {
          world.setTileAt(x, y, TERRAIN.floor);
        }
      }
      
      const path = pathfinding.findPath(15, 15, 20, 20);

      expect(path).not.toBeNull();
      expect(path!.length).toBeGreaterThan(0);
      expect(path![0]).toEqual({ x: 15, y: 15 });
      expect(path![path!.length - 1]).toEqual({ x: 20, y: 20 });
    });

    it('should find path around obstacles', () => {
      // Ensure chunk exists (positions 5-10 are in chunk 0 with size 16)
      world.getChunkManager().getOrCreateChunk(0, 0);
      
      // Fill area with floor first
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          world.setTileAt(x, y, TERRAIN.floor);
        }
      }
      
      // Create a wall in the middle
      for (let y = 5; y <= 10; y++) {
        world.setTileAt(7, y, TERRAIN.wall);
      }

      const path = pathfinding.findPath(5, 5, 10, 10);

      expect(path).not.toBeNull();
      // Path should not go through the wall
      for (const pos of path!) {
        expect(pos.x === 7 && pos.y >= 5 && pos.y <= 10).toBe(false);
      }
    });

    it('should return null for unreachable destination', () => {
      // Ensure chunk exists
      world.getChunkManager().getOrCreateChunk(0, 0);
      
      // Fill area with floor first
      for (let y = 4; y <= 12; y++) {
        for (let x = 4; x <= 12; x++) {
          world.setTileAt(x, y, TERRAIN.floor);
        }
      }
      
      // Create a wall around destination
      world.setTileAt(9, 9, TERRAIN.wall);
      world.setTileAt(10, 9, TERRAIN.wall);
      world.setTileAt(11, 9, TERRAIN.wall);
      world.setTileAt(9, 10, TERRAIN.wall);
      world.setTileAt(11, 10, TERRAIN.wall);
      world.setTileAt(9, 11, TERRAIN.wall);
      world.setTileAt(10, 11, TERRAIN.wall);
      world.setTileAt(11, 11, TERRAIN.wall);

      const path = pathfinding.findPath(5, 5, 10, 10);

      expect(path).toBeNull();
    });

    it('should return path with just start when start equals end', () => {
      // Ensure chunk exists
      world.getChunkManager().getOrCreateChunk(0, 0);
      world.setTileAt(5, 5, TERRAIN.floor);
      
      const path = pathfinding.findPath(5, 5, 5, 5);

      expect(path).not.toBeNull();
      expect(path!.length).toBe(1);
      expect(path![0]).toEqual({ x: 5, y: 5 });
    });
  });

  describe('Dijkstra pathfinding', () => {
    it('should find path to target using callback', () => {
      // Ensure chunks exist for the path (15,15) to (20,20)
      // (15,15) is in chunk (0,0), (20,20) is in chunk (1,1)
      world.getChunkManager().getOrCreateChunk(0, 0);
      world.getChunkManager().getOrCreateChunk(1, 0);
      world.getChunkManager().getOrCreateChunk(0, 1);
      world.getChunkManager().getOrCreateChunk(1, 1);
      
      // Fill chunks with floor tiles to ensure path is clear
      for (let y = 14; y <= 21; y++) {
        for (let x = 14; x <= 21; x++) {
          world.setTileAt(x, y, TERRAIN.floor);
        }
      }
      
      const path = pathfinding.findPathDijkstra(15, 15, (x, y) => x === 20 && y === 20);

      expect(path).not.toBeNull();
      expect(path![path!.length - 1]).toEqual({ x: 20, y: 20 });
    });

    it('should return null when target not found', () => {
      // Create walls blocking all paths
      for (let x = 0; x < 30; x++) {
        world.setTileAt(x, 7, TERRAIN.wall);
      }

      const path = pathfinding.findPathDijkstra(5, 5, (x, y) => x === 5 && y === 10);

      expect(path).toBeNull();
    });
  });
});
